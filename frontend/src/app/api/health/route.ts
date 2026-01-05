/**
 * Health Check API
 *
 * Purpose:
 * - ECS/ALB health checks hit this endpoint every 30 seconds
 * - Verifies database connectivity
 * - Triggers session pool warmup on container startup
 * - Reports session pool status
 */

import { NextResponse } from "next/server";
import { db } from "@/server/db";
import { sessionPoolManager } from "@/lib/agent/session-pool-manager";

export async function GET() {
  try {
    // Check database connectivity
    await db.$queryRaw`SELECT 1`;

    // Get session pool statistics
    const poolStats = sessionPoolManager.getPoolStats();

    // Trigger warmup if pool is empty (non-blocking)
    // This happens on container startup when health checks begin
    if (poolStats.total === 0 && !sessionPoolManager.isWarming) {
      console.log('[Health] Pool empty, triggering warmup...');
      sessionPoolManager.warmPool().catch((error) => {
        console.error('[Health] Pool warmup failed:', error);
      });
    }

    return NextResponse.json({
      status: "healthy",
      timestamp: new Date().toISOString(),
      service: "slide-forge",
      database: "connected",
      sessionPool: poolStats,
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
