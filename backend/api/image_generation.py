"""
Image Generation API.

Provides an endpoint to generate presentation slide images using:
- Yunwu (Gemini 3 Pro) for text-in-image slides
- DashScope (z-image-turbo) for fast illustration slides

Images are uploaded to S3 and returned as URLs.
The agent calls this via WebFetch, making it compatible with
both local SDK and AgentCore Runtime deployments.
"""

import base64
import logging
import os
import uuid

import boto3
import httpx
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

logger = logging.getLogger(__name__)

router = APIRouter()


class GenerateImageRequest(BaseModel):
    """Request model for image generation."""

    prompt: str
    provider: str = "yunwu"
    aspect_ratio: str = "16:9"
    image_size: str = "1280*720"


class GenerateImageResponse(BaseModel):
    """Response model for image generation."""

    success: bool
    image_url: str = ""
    provider: str = ""
    error: str = ""


def _get_s3_client():
    """Get boto3 S3 client."""
    return boto3.client("s3")


def _upload_image_to_s3(image_data: bytes, content_type: str = "image/png") -> str:
    """Upload image bytes to S3 and return the URL."""
    bucket = os.environ.get("UPLOADS_BUCKET")
    if not bucket:
        raise ValueError("UPLOADS_BUCKET environment variable not set")

    s3 = _get_s3_client()
    key = f"generated-slides/{uuid.uuid4().hex}.png"

    s3.put_object(
        Bucket=bucket,
        Key=key,
        Body=image_data,
        ContentType=content_type,
    )

    region = os.environ.get("AWS_REGION", "us-east-1")
    return f"https://{bucket}.s3.{region}.amazonaws.com/{key}"


async def _generate_with_yunwu(prompt: str, aspect_ratio: str = "16:9") -> dict:
    """Generate image using Yunwu (Gemini 3 Pro Image Preview)."""
    api_key = os.environ.get("YUNWU_API_KEY")
    if not api_key:
        raise ValueError("YUNWU_API_KEY environment variable not set")

    url = "https://yunwu.ai/v1beta/models/gemini-3-pro-image-preview:generateContent"

    headers = {
        "Content-Type": "application/json",
        "Authorization": f"Bearer {api_key}",
    }

    payload = {
        "contents": [
            {
                "parts": [
                    {"text": prompt}
                ]
            }
        ],
        "generationConfig": {
            "responseModalities": ["IMAGE", "TEXT"],
            "imageDimension": aspect_ratio.replace(":", "x") if ":" in aspect_ratio else aspect_ratio,
        },
    }

    async with httpx.AsyncClient(timeout=120.0) as client:
        response = await client.post(url, headers=headers, json=payload)
        response.raise_for_status()

        result = response.json()

        candidates = result.get("candidates", [])
        if not candidates:
            raise ValueError("No candidates returned from Yunwu API")

        parts = candidates[0].get("content", {}).get("parts", [])
        for part in parts:
            if "inlineData" in part:
                image_b64 = part["inlineData"]["data"]
                mime_type = part["inlineData"].get("mimeType", "image/png")
                image_data = base64.b64decode(image_b64)
                return {"image_data": image_data, "content_type": mime_type}

        raise ValueError("No image data found in Yunwu API response")


async def _generate_with_dashscope(prompt: str, image_size: str = "1280*720") -> dict:
    """Generate image using DashScope (z-image-turbo / wanx)."""
    api_key = os.environ.get("DASHSCOPE_API_KEY")
    if not api_key:
        raise ValueError("DASHSCOPE_API_KEY environment variable not set")

    url = "https://dashscope.aliyuncs.com/api/v1/services/aigc/multimodal-generation/generation"

    headers = {
        "Content-Type": "application/json",
        "Authorization": f"Bearer {api_key}",
        "X-DashScope-Async": "disable",
    }

    payload = {
        "model": "wanx-v1",
        "input": {
            "prompt": prompt,
        },
        "parameters": {
            "size": image_size,
            "n": 1,
        },
    }

    async with httpx.AsyncClient(timeout=120.0) as client:
        response = await client.post(url, headers=headers, json=payload)
        response.raise_for_status()

        result = response.json()

        output = result.get("output", {})
        results = output.get("results", [])
        if not results:
            raise ValueError("No results returned from DashScope API")

        image_url = results[0].get("url")
        if not image_url:
            raise ValueError("No image URL in DashScope response")

        img_response = await client.get(image_url)
        img_response.raise_for_status()

        return {"image_data": img_response.content, "content_type": "image/png"}


@router.post("/generate-slide-image", response_model=GenerateImageResponse)
async def generate_slide_image(request: GenerateImageRequest):
    """
    Generate a presentation slide as an AI image.

    Accepts a prompt and provider, generates the image via the selected API,
    uploads to S3, and returns the image URL.
    """
    logger.info(f"[ImageGen] Generating image with provider={request.provider}")

    try:
        if request.provider == "yunwu":
            result = await _generate_with_yunwu(request.prompt, request.aspect_ratio)
        elif request.provider == "dashscope":
            result = await _generate_with_dashscope(request.prompt, request.image_size)
        else:
            return GenerateImageResponse(
                success=False,
                error=f"Unknown provider: {request.provider}. Use 'yunwu' or 'dashscope'.",
                provider=request.provider,
            )

        image_url = _upload_image_to_s3(
            result["image_data"],
            result.get("content_type", "image/png"),
        )

        logger.info(f"[ImageGen] Image generated and uploaded: {image_url[:80]}...")
        return GenerateImageResponse(
            success=True,
            image_url=image_url,
            provider=request.provider,
        )

    except Exception as e:
        logger.error(f"[ImageGen] Error: {e}")
        return GenerateImageResponse(
            success=False,
            error=str(e),
            provider=request.provider,
        )
