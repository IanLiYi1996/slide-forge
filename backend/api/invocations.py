"""
Unified Invocations Endpoint for AgentCore.

This module provides a single /invocations endpoint that routes requests
to the appropriate internal handlers based on the path and method in the
request payload. This is the pattern required by AWS Bedrock AgentCore.

Request format:
{
    "path": "/sessions",
    "method": "POST",
    "payload": {...},
    "path_params": {},
    "query_params": {}
}
"""

import json
import logging
import re
from typing import Any, Dict, Optional

import jwt
from fastapi import APIRouter, HTTPException, Request
from fastapi.responses import StreamingResponse
from pydantic import BaseModel

from ..core import SessionManager
from ..core.claude_sync_manager import get_claude_sync_manager
from ..models import (
    CreateSessionRequest,
    SendMessageRequest,
    SetPermissionModeRequest,
)

logger = logging.getLogger(__name__)


router = APIRouter()


def extract_user_id_from_request(http_request: Request) -> Optional[str]:
    """
    Extract user_id from the JWT Authorization header.

    Decodes the JWT without signature verification since AgentCore
    already validates the token via the JWT authorizer.

    Args:
        http_request: The incoming FastAPI Request

    Returns:
        User ID (sub claim) if found, None otherwise
    """
    auth_header = http_request.headers.get("authorization", "")
    if not auth_header.startswith("Bearer "):
        return None

    token = auth_header[len("Bearer "):]
    try:
        # Decode without verification — AgentCore already validated the JWT
        payload = jwt.decode(token, options={"verify_signature": False})
        return payload.get("sub")
    except Exception as e:
        logger.debug(f"Failed to decode JWT: {e}")
        return None


class InvocationRequest(BaseModel):
    """Request format for the unified /invocations endpoint."""
    path: str
    method: str = "GET"
    payload: Optional[Dict[str, Any]] = None
    path_params: Optional[Dict[str, str]] = None
    query_params: Optional[Dict[str, str]] = None


def get_session_manager() -> SessionManager:
    """Get the global session manager instance."""
    from ..server import session_manager
    return session_manager


def safe_json_dumps(obj: Any) -> str:
    """
    Safely serialize objects to JSON, handling non-serializable objects.

    Args:
        obj: Object to serialize

    Returns:
        JSON string
    """
    def default_handler(o):
        if hasattr(o, "__dict__"):
            return o.__dict__
        return str(o)

    return json.dumps(obj, default=default_handler)


def extract_session_id(path: str, path_params: Optional[Dict[str, str]] = None) -> Optional[str]:
    """
    Extract session_id from path or path_params.

    Args:
        path: The request path
        path_params: Optional path parameters

    Returns:
        Session ID if found
    """
    # Try path_params first
    if path_params and "session_id" in path_params:
        return path_params["session_id"]

    # Try extracting from path
    match = re.search(r"/sessions/([^/]+)", path)
    if match:
        return match.group(1)

    return None


@router.post("/invocations")
async def handle_invocation(request: InvocationRequest, http_request: Request):
    """
    Unified invocations endpoint for AgentCore.

    Routes requests to the appropriate handler based on path and method.

    Supported routes:
    - POST /sessions -> Create session
    - GET /sessions -> List sessions
    - GET /sessions/available -> List available sessions
    - GET /sessions/{session_id}/status -> Get session status
    - GET /sessions/{session_id}/history -> Get session history
    - POST /sessions/{session_id}/messages -> Send message (non-streaming)
    - POST /sessions/{session_id}/messages/stream -> Send message (streaming)
    - POST /sessions/{session_id}/interrupt -> Interrupt session
    - POST /sessions/{session_id}/permission_mode -> Set permission mode
    - POST /sessions/{session_id}/permissions/respond -> Respond to permission
    - DELETE /sessions/{session_id} -> Close session
    - GET /env-vars -> List environment variables
    - POST /env-vars -> Set environment variable
    - PUT /env-vars -> Replace all environment variables
    - DELETE /env-vars/{key} -> Delete environment variable
    - GET /mcp-servers -> List MCP servers
    - POST /mcp-servers -> Add MCP server
    - DELETE /mcp-servers/{server_name} -> Delete MCP server

    Args:
        request: Invocation request with path, method, and payload
        http_request: Raw FastAPI request for header access

    Returns:
        Response from the appropriate handler
    """
    path = request.path
    method = request.method.upper()
    payload = request.payload or {}
    path_params = request.path_params or {}
    query_params = request.query_params or {}

    manager = get_session_manager()

    # Trigger initial .claude directory sync from S3 if enabled
    sync_manager = get_claude_sync_manager()
    if sync_manager:
        user_id = extract_user_id_from_request(http_request)
        if user_id:
            try:
                await sync_manager.ensure_initial_sync(user_id)
            except Exception as e:
                logger.warning(f"Initial .claude sync failed for user {user_id}: {e}")

    print(f"[Invocations] Routing: {method} {path}")
    print(f"[Invocations] Payload: {json.dumps(payload)[:200]}...")

    try:
        # ========================================
        # Session Management Routes
        # ========================================

        # POST /sessions - Create session
        if path == "/sessions" and method == "POST":
            from datetime import datetime, timezone

            session_request = CreateSessionRequest(**payload)
            session_id = await manager.create_session(
                user_id=session_request.user_id,
                resume_session_id=session_request.resume_session_id,
                model=session_request.model,
                cwd=session_request.cwd,
                mcp_server_ids=session_request.mcp_server_ids,
            )
            return {
                "session_id": session_id,
                "created_at": datetime.now(timezone.utc).isoformat(),
                "status": "connected",
            }

        # GET /sessions - List sessions
        if path == "/sessions" and method == "GET":
            cwd = query_params.get("cwd")
            sessions = manager.list_sessions(cwd=cwd)
            return {"sessions": [s.dict() for s in sessions]}

        # GET /sessions/available - List available sessions
        if path == "/sessions/available" and method == "GET":
            cwd = query_params.get("cwd")
            limit = int(query_params.get("limit", "20"))
            offset = int(query_params.get("offset", "0"))
            return manager.list_available_sessions(cwd=cwd, limit=limit, offset=offset)

        # ========================================
        # Session-specific Routes
        # ========================================

        session_id = extract_session_id(path, path_params)

        # GET /sessions/{session_id}/status - Get session status
        if re.match(r"^/sessions/[^/]+/status$", path) and method == "GET":
            if not session_id:
                raise HTTPException(status_code=400, detail="Session ID required")
            session = await manager.get_session(session_id)
            status = session.get_status()
            return status.dict() if hasattr(status, "dict") else status

        # GET /sessions/{session_id}/history - Get session history
        if re.match(r"^/sessions/[^/]+/history$", path) and method == "GET":
            if not session_id:
                raise HTTPException(status_code=400, detail="Session ID required")
            # Import and call the history function
            from .sessions import get_session_history
            cwd = query_params.get("cwd")
            return await get_session_history(session_id, cwd)

        # POST /sessions/{session_id}/messages - Send message (non-streaming)
        if re.match(r"^/sessions/[^/]+/messages$", path) and method == "POST":
            if not session_id:
                raise HTTPException(status_code=400, detail="Session ID required")
            session = await manager.get_session(session_id)
            message_request = SendMessageRequest(**payload)
            return await session.send_message(message_request.message)

        # POST /sessions/{session_id}/messages/stream - Send message (streaming)
        if re.match(r"^/sessions/[^/]+/messages/stream$", path) and method == "POST":
            if not session_id:
                raise HTTPException(status_code=400, detail="Session ID required")

            print(f"[Invocations] Streaming message to session {session_id}")
            message_request = SendMessageRequest(**payload)

            # Use get_or_ensure_session to handle model/MCP config changes
            if message_request.model or message_request.mcp_server_ids is not None:
                session = await manager.get_or_ensure_session(
                    session_id,
                    model=message_request.model,
                    mcp_server_ids=message_request.mcp_server_ids,
                )
            else:
                session = await manager.get_session(session_id)

            async def event_generator():
                """Generate SSE events from the agent response."""
                event_count = 0
                try:
                    async for event in session.send_message_stream(message_request.message):
                        event_count += 1
                        event_type = event.get("type", "unknown")
                        print(f"[Invocations] Event #{event_count}: type={event_type}")
                        yield f"data: {safe_json_dumps(event)}\n\n"

                    print(f"[Invocations] Stream complete (total events: {event_count})")
                except Exception as e:
                    print(f"[Invocations] Stream error: {type(e).__name__}: {str(e)}")
                    import traceback
                    print(f"[Invocations] Traceback:\n{traceback.format_exc()}")
                    error_event = {"type": "error", "error": str(e)}
                    yield f"data: {safe_json_dumps(error_event)}\n\n"

            return StreamingResponse(
                event_generator(),
                media_type="text/event-stream",
                headers={
                    "Cache-Control": "no-cache",
                    "Connection": "keep-alive",
                    "X-Accel-Buffering": "no",
                },
            )

        # POST /sessions/{session_id}/interrupt - Interrupt session
        if re.match(r"^/sessions/[^/]+/interrupt$", path) and method == "POST":
            if not session_id:
                raise HTTPException(status_code=400, detail="Session ID required")
            session = await manager.get_session(session_id)
            await session.interrupt()
            return {"status": "interrupted"}

        # POST /sessions/{session_id}/permission_mode - Set permission mode
        if re.match(r"^/sessions/[^/]+/permission_mode$", path) and method == "POST":
            if not session_id:
                raise HTTPException(status_code=400, detail="Session ID required")
            session = await manager.get_session(session_id)
            mode_request = SetPermissionModeRequest(**payload)
            await session.set_permission_mode(mode_request.mode)
            return {"status": "ok", "mode": mode_request.mode}

        # POST /sessions/{session_id}/permissions/respond - Respond to permission
        if re.match(r"^/sessions/[^/]+/permissions/respond$", path) and method == "POST":
            if not session_id:
                raise HTTPException(status_code=400, detail="Session ID required")
            session = await manager.get_session(session_id)
            request_id = payload.get("request_id")
            allowed = payload.get("allowed", False)

            if allowed:
                await session.grant_permission(request_id)
            else:
                await session.deny_permission(request_id)

            return {"status": "ok", "allowed": allowed}

        # DELETE /sessions/{session_id} - Close session
        if re.match(r"^/sessions/[^/]+$", path) and method == "DELETE":
            if not session_id:
                raise HTTPException(status_code=400, detail="Session ID required")
            await manager.close_session(session_id)
            return {"status": "closed"}

        # POST /sessions/close_all - Close all sessions
        if path == "/sessions/close_all" and method == "POST":
            cwd = query_params.get("cwd")
            sessions = manager.list_sessions(cwd=cwd)
            closed_count = 0
            for session_info in sessions:
                try:
                    await manager.close_session(session_info.session_id)
                    closed_count += 1
                except Exception as e:
                    print(f"Failed to close session {session_info.session_id}: {e}")
            return {"status": "success", "closed_count": closed_count}

        # ========================================
        # Environment Variables Routes
        # ========================================

        if path == "/env-vars" and method == "GET":
            from .env_vars import get_env_vars
            return await get_env_vars()

        if path == "/env-vars" and method == "POST":
            from .env_vars import set_env_var
            from ..models.schemas import SetEnvVarRequest
            env_request = SetEnvVarRequest(**payload)
            return await set_env_var(env_request)

        if re.match(r"^/env-vars/[^/]+$", path) and method == "DELETE":
            from .env_vars import delete_env_var
            key = path.split("/env-vars/", 1)[1]
            return await delete_env_var(key)

        if path == "/env-vars" and method == "PUT":
            from .env_vars import set_all_env_vars
            from ..models.schemas import SetAllEnvVarsRequest
            env_request = SetAllEnvVarsRequest(**payload)
            return await set_all_env_vars(env_request)

        # ========================================
        # MCP Servers Routes
        # ========================================

        if path == "/mcp-servers" and method == "GET":
            from .mcp_servers import list_mcp_servers
            return await list_mcp_servers()

        if path == "/mcp-servers" and method == "POST":
            from .mcp_servers import add_mcp_server
            from ..models.schemas import AddMCPServerRequest
            mcp_request = AddMCPServerRequest(**payload)
            return await add_mcp_server(mcp_request)

        if re.match(r"^/mcp-servers/[^/]+$", path) and method == "DELETE":
            from .mcp_servers import delete_mcp_server
            server_name = path.split("/mcp-servers/", 1)[1]
            return await delete_mcp_server(server_name)

        # ========================================
        # Image Generation Routes
        # ========================================

        if path == "/generate-slide-image" and method == "POST":
            from .image_generation import generate_slide_image, GenerateImageRequest
            img_request = GenerateImageRequest(**payload)
            return await generate_slide_image(img_request)

        # ========================================
        # Route Not Found
        # ========================================

        raise HTTPException(
            status_code=404,
            detail=f"Route not found: {method} {path}"
        )

    except HTTPException:
        raise
    except Exception as e:
        print(f"[Invocations] Error handling {method} {path}: {type(e).__name__}: {str(e)}")
        import traceback
        print(f"[Invocations] Traceback:\n{traceback.format_exc()}")
        raise HTTPException(status_code=500, detail=str(e))
