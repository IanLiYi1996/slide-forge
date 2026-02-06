#!/usr/bin/env python3
"""
Slide Forge API Server

A stateful API server for presentation generation using Claude Agent SDK.
Manages multiple concurrent sessions with slide detection and streaming support.

Key Features:
- Session-based state management
- Permission callback system
- Real-time slide detection and streaming
- Multi-turn conversation support
"""

import logging
import os
import sys
from contextlib import asynccontextmanager
from datetime import datetime, timezone

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

# ============================================================================
# Logging Configuration
# ============================================================================

LOG_LEVEL = os.environ.get("LOG_LEVEL", "INFO").upper()

logging.basicConfig(
    level=LOG_LEVEL,
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
    datefmt="%Y-%m-%d %H:%M:%S",
    handlers=[logging.StreamHandler(sys.stdout)],
)

# Quiet noisy libraries
logging.getLogger("urllib3").setLevel(logging.WARNING)
logging.getLogger("botocore").setLevel(logging.WARNING)
logging.getLogger("boto3").setLevel(logging.WARNING)

logger = logging.getLogger(__name__)

from .api import (
    env_vars_router,
    invocations_router,
    mcp_servers_router,
    messages_router,
    permissions_router,
    sessions_router,
)
from .core import SessionManager
from .core.claude_sync_manager import initialize_claude_sync_manager

# ============================================================================
# Global Session Manager
# ============================================================================

session_manager = SessionManager()

# Claude sync manager (initialized during startup if S3 sync is enabled)
claude_sync_manager = None


# ============================================================================
# FastAPI Application
# ============================================================================


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application lifespan manager."""
    global claude_sync_manager

    # Startup
    print("=" * 80)
    print("Slide Forge API Server Starting...")
    print(f"Log Level: {LOG_LEVEL}")
    print("=" * 80)

    logger.info("Starting Slide Forge API Server")
    logger.info(f"Log level set to: {LOG_LEVEL}")

    # Initialize S3 sync manager if enabled
    enable_s3_sync = os.environ.get("ENABLE_S3_SYNC", "true").lower() in ("true", "1", "yes")
    s3_bucket = os.environ.get("S3_WORKSPACE_BUCKET")

    if enable_s3_sync and s3_bucket:
        try:
            claude_sync_manager = initialize_claude_sync_manager()
            if claude_sync_manager:
                claude_sync_manager.start_backup_task()
                logger.info("Claude sync manager initialized and backup task started")
        except Exception as e:
            logger.warning(f"Failed to initialize Claude sync manager: {e}")
            claude_sync_manager = None
    elif enable_s3_sync and not s3_bucket:
        logger.warning("S3 sync enabled but S3_WORKSPACE_BUCKET not set, skipping sync manager")
    else:
        logger.info("S3 sync disabled via ENABLE_S3_SYNC")

    print("=" * 80)
    print("Server startup complete")
    print("=" * 80)

    yield

    # Shutdown
    if claude_sync_manager:
        await claude_sync_manager.stop_backup_task()

    print("Shutting down server...")
    for session_id in list(session_manager.sessions.keys()):
        await session_manager.close_session(session_id)

    print("Server shutdown complete")


app = FastAPI(
    title="Slide Forge API Server",
    description="Stateful API server for presentation generation with Claude Agent SDK",
    version="1.0.0",
    lifespan=lifespan,
)

# Add CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ============================================================================
# Register Routers
# ============================================================================

# Unified invocations endpoint for AgentCore
app.include_router(invocations_router, tags=["invocations"])

# Session management endpoints
app.include_router(sessions_router, tags=["sessions"])

# Message and status endpoints
app.include_router(messages_router, tags=["messages"])

# Permission endpoints
app.include_router(permissions_router, tags=["permissions"])

# Environment variables endpoints
app.include_router(env_vars_router, tags=["env-vars"])

# MCP servers endpoints
app.include_router(mcp_servers_router, tags=["mcp-servers"])


# ============================================================================
# Health Check
# ============================================================================


@app.get("/health")
async def health_check():
    """Health check endpoint."""
    return {
        "status": "healthy",
        "active_sessions": len(session_manager.sessions),
        "timestamp": datetime.now(timezone.utc).isoformat(),
    }


@app.get("/ping")
async def ping():
    """Ping endpoint for health monitoring."""
    import time

    return {
        "status": "Healthy",
        "time_of_last_update": int(time.time()),
    }


# ============================================================================
# Main Entry Point
# ============================================================================

if __name__ == "__main__":
    import uvicorn

    uvicorn.run(app, host="0.0.0.0", port=8080, log_level="info")
