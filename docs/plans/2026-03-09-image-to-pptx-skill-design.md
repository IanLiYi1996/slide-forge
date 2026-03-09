# Image-to-PPTX Skill Design

## Overview

A Claude Code skill that generates .pptx presentations from image files or text topics. The skill is a SKILL.md instruction file that guides Claude through a complete pipeline: input analysis, outline generation, slide image generation, and PPTX packaging.

## Input

- **Image file path**: Claude analyzes the image via Bedrock Claude to extract content and generate a structured outline
- **Text topic**: Claude generates a structured outline directly from the topic description
- Both modes produce the same intermediate format (structured outline) before image generation

## Output

- `.pptx` file with full-page AI-generated images as slide backgrounds
- A folder containing individual slide images (PNG)
- Location: `./slide-forge-output/<title-slug>/`

## Workflow

```
Step 1: Parse input (image path or text topic)
Step 2: Generate structured outline (Bedrock Claude via boto3)
Step 3: Generate slide images (Yunwu or z-image-turbo via curl)
Step 4: Package into .pptx (python-pptx)
Step 5: Report results
```

## Step Details

### Step 1: Parse Input
- If input is a file path to an image (.jpg/.png/.webp), read and base64-encode it
- If input is text, use it as the topic for outline generation

### Step 2: Generate Outline
- **Image input**: Call Bedrock Converse API with the image + analysis prompt via boto3
- **Text input**: Call Bedrock Converse API with the topic + outline generation prompt via boto3
- Output: structured outline with N slides, each containing:
  - Title
  - Narrative Goal
  - Key Content
  - Visual description
  - Layout guidance

### Step 3: Generate Slide Images
- For each outline item, call the image generation API
- Default provider: Yunwu (Gemini 3 Pro Image)
- Alternative: z-image-turbo (user selectable)
- Parameters: aspect ratio 16:9, image size 2K, hand-drawn template style
- Save each image as PNG to output directory
- Includes strict prohibitions against copyright text, page numbers, watermarks

### Step 4: Package PPTX
- Use python-pptx to create a presentation
- Slide dimensions: 16:9 widescreen (13.333 x 7.5 inches)
- Each slide: single full-page image as background
- Save to output directory

## Configuration Defaults

| Parameter | Default | Options |
|-----------|---------|---------|
| Provider | yunwu | yunwu, z-image-turbo |
| Image Size | 2K | 1K, 2K, 4K |
| Aspect Ratio | 16:9 | 1:1, 4:3, 16:9 |
| Template | hand-drawn | hand-drawn, blueprint, minimal, corporate, creative |
| Language | zh (Chinese) | en, zh, ja, ko, etc. |
| Slide Count | 10 | 1-20 |

## Dependencies

- `python-pptx`: PPTX file creation
- `boto3`: AWS Bedrock Converse API calls
- `Pillow`: Image processing
- `requests`: HTTP API calls for image generation

## Environment Variables Required

- `AWS_REGION` (or AWS profile configured)
- `YUNWU_API_KEY` (for Yunwu provider)
- `DASHSCOPE_API_KEY` (for z-image-turbo provider)

## Skill Location

`/home/ec2-user/research/slide-forge/.claude/skills/image-to-pptx/SKILL.md`

## Trigger Keywords

- "generate pptx", "generate PPT", "image to slide", "image to pptx"
- "create presentation from image", "create slides"
- "图片转PPT", "生成PPT", "生成幻灯片"
