/**
 * Health Check API
 *
 * Purpose:
 * - ECS/ALB health checks hit this endpoint every 30 seconds
 * - Verifies database connectivity
 */

import { NextResponse } from "next/server";
import { db } from "@/server/db";

export async function GET() {
  try {
    // Check database connectivity
    await db.$queryRaw`SELECT 1`;

    return NextResponse.json({
      status: "healthy",
      timestamp: new Date().toISOString(),
      service: "slide-forge",
      database: "connected",
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
