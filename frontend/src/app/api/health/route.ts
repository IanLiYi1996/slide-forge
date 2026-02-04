/**
 * Health Check API
 *
 * Purpose:
 * - ECS/ALB health checks hit this endpoint every 30 seconds
 * - Verifies S3 connectivity
 */

import { NextResponse } from "next/server";
import { objectExists, BUCKET_NAME } from "@/services/s3";

export async function GET() {
  try {
    // Check S3 connectivity by checking if a prefix exists (will not throw if bucket is accessible)
    // We don't need a specific object, just verifying we can talk to S3
    const canAccessS3 = await objectExists("data/.health-check");

    // Even if the object doesn't exist, if no error was thrown, S3 is accessible
    return NextResponse.json({
      status: "healthy",
      timestamp: new Date().toISOString(),
      service: "slide-forge",
      storage: "connected",
      bucket: BUCKET_NAME ? "configured" : "missing",
    });
  } catch (error) {
    console.error("[Health] Health check failed:", error);

    return NextResponse.json(
      {
        status: "unhealthy",
        timestamp: new Date().toISOString(),
        service: "slide-forge",
        error: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 503 },
    );
  }
}
