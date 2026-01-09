/**
 * 图片代理API
 * 解决前端跨域下载图片的问题，支持重试机制
 */

import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";
export const maxDuration = 60; // 1分钟超时

// 支持的图片源域名白名单（安全考虑）
const ALLOWED_DOMAINS = [
  "images.unsplash.com",
  "unsplash.com",
  // 添加你的对象存储域名
  "s3.amazonaws.com",
  "oss-cn-beijing.aliyuncs.com",
  // 可以根据需要添加更多
];

/**
 * GET /api/images/proxy?url=<image_url>&retry=<number>
 *
 * Query Parameters:
 * - url: 图片URL（必需）
 * - retry: 重试次数，默认3次
 */
export async function GET(req: NextRequest) {
  try {
    // 1. 获取参数
    const searchParams = req.nextUrl.searchParams;
    const imageUrl = searchParams.get("url");
    const retryCount = parseInt(searchParams.get("retry") || "3");

    if (!imageUrl) {
      return NextResponse.json(
        { error: "Missing 'url' parameter" },
        { status: 400 }
      );
    }

    // 2. 验证URL格式
    let parsedUrl: URL;
    try {
      parsedUrl = new URL(imageUrl);
    } catch (e) {
      return NextResponse.json(
        { error: "Invalid URL format" },
        { status: 400 }
      );
    }

    // 3. 检查域名白名单（安全）
    const isAllowed = ALLOWED_DOMAINS.some((domain) =>
      parsedUrl.hostname.endsWith(domain)
    );

    if (!isAllowed) {
      return NextResponse.json(
        {
          error: "Domain not allowed",
          allowedDomains: ALLOWED_DOMAINS,
        },
        { status: 403 }
      );
    }

    // 4. 下载图片（支持重试）
    let lastError: Error | null = null;
    for (let attempt = 0; attempt <= retryCount; attempt++) {
      try {
        console.log(
          `[Image Proxy] Attempt ${attempt + 1}/${retryCount + 1} for ${imageUrl}`
        );

        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 30000); // 30秒超时

        const response = await fetch(imageUrl, {
          signal: controller.signal,
          headers: {
            "User-Agent":
              "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
            Accept: "image/*",
          },
        });

        clearTimeout(timeoutId);

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        // 5. 获取内容类型
        const contentType =
          response.headers.get("content-type") || "image/jpeg";

        // 6. 验证是否为图片
        if (!contentType.startsWith("image/")) {
          throw new Error(`Invalid content type: ${contentType}`);
        }

        // 7. 读取图片数据
        const imageBuffer = await response.arrayBuffer();

        console.log(
          `[Image Proxy] Successfully downloaded ${imageBuffer.byteLength} bytes from ${imageUrl}`
        );

        // 8. 返回图片
        return new NextResponse(imageBuffer, {
          status: 200,
          headers: {
            "Content-Type": contentType,
            "Cache-Control": "public, max-age=31536000, immutable", // 缓存1年
            "Access-Control-Allow-Origin": "*", // 允许跨域
          },
        });
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));
        console.warn(
          `[Image Proxy] Attempt ${attempt + 1} failed:`,
          lastError.message
        );

        // 如果不是最后一次尝试，等待后重试
        if (attempt < retryCount) {
          await new Promise((resolve) =>
            setTimeout(resolve, 1000 * (attempt + 1))
          ); // 递增延迟
        }
      }
    }

    // 9. 所有重试失败
    console.error(
      `[Image Proxy] All ${retryCount + 1} attempts failed for ${imageUrl}`,
      lastError
    );

    return NextResponse.json(
      {
        error: "Failed to download image after retries",
        details: lastError?.message || "Unknown error",
        attempts: retryCount + 1,
      },
      { status: 502 }
    );
  } catch (error) {
    console.error("[Image Proxy] Unexpected error:", error);
    return NextResponse.json(
      {
        error: "Internal server error",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
