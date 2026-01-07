/**
 * Unsplash 图片搜索工具
 * 根据查询关键词搜索合适的图片
 */

import { createApi } from "unsplash-js";
import type {
  SearchUnsplashImageParams,
  ToolResult,
  UnsplashImageResult,
} from "../types/workflow";

// 初始化 Unsplash API 客户端
const unsplash = createApi({
  accessKey: process.env.UNSPLASH_ACCESS_KEY || "",
});

export async function searchUnsplashImage(
  params: SearchUnsplashImageParams,
): Promise<ToolResult<UnsplashImageResult>> {
  try {
    const { query, orientation = "landscape" } = params;

    // 检查 API Key
    if (!process.env.UNSPLASH_ACCESS_KEY) {
      return {
        success: false,
        error: "Unsplash API key not configured",
      };
    }

    // 搜索图片
    const result = await unsplash.search.getPhotos({
      query,
      perPage: 1,
      orientation,
    });

    if (result.errors) {
      return {
        success: false,
        error: result.errors.join(", "),
      };
    }

    const photo = result.response?.results[0];
    if (!photo) {
      return {
        success: false,
        error: "No images found for this query",
      };
    }

    return {
      success: true,
      data: {
        imageUrl: photo.urls.regular,
        imageId: photo.id,
        author: photo.user.name,
        authorUrl: photo.user.links.html,
      },
      message: `Found image by ${photo.user.name}`,
    };
  } catch (error) {
    console.error("Error searching Unsplash:", error);
    return {
      success: false,
      error:
        error instanceof Error ? error.message : "Failed to search Unsplash",
    };
  }
}
