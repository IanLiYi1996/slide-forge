/**
 * Cron Initialization API
 *
 * GET /api/cron/init - Initialize all cron jobs
 *
 * This endpoint should be called once when the application starts.
 * It initializes all scheduled tasks using node-cron.
 */

import { initializeCronJobs } from '@/services/cron-service';
import { NextResponse } from 'next/server';

let cronJobsInitialized = false;

export async function GET() {
  try {
    if (cronJobsInitialized) {
      return NextResponse.json({
        success: true,
        message: 'Cron jobs already initialized',
      });
    }

    initializeCronJobs();
    cronJobsInitialized = true;

    return NextResponse.json({
      success: true,
      message: 'Cron jobs initialized successfully',
      jobs: ['quota-reset (daily at 00:00 UTC)'],
    });
  } catch (error) {
    console.error('Failed to initialize cron jobs:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
