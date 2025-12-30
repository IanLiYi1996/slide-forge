import { db } from "~/server/db";

/**
 * Health check endpoint for ECS/ALB health checks
 * Tests database connectivity and returns service status
 */
export async function GET() {
  try {
    // Test database connection
    await db.$queryRaw`SELECT 1`;

    return Response.json({
      status: "healthy",
      timestamp: new Date().toISOString(),
      service: "slide-forge",
    });
  } catch (error) {
    console.error("Health check failed:", error);

    return Response.json(
      {
        status: "unhealthy",
        error: error instanceof Error ? error.message : String(error),
        timestamp: new Date().toISOString(),
      },
      { status: 503 },
    );
  }
}
