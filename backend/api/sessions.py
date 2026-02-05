"""
Session Management Endpoints.

Provides REST API endpoints for session CRUD operations including
creating, listing, and closing sessions.
"""

import json
from datetime import datetime, timezone
from pathlib import Path
from typing import Optional

from fastapi import APIRouter, HTTPException

from ..core import SessionManager
from ..models import (
    CreateSessionRequest,
    CreateSessionResponse,
    ListSessionsResponse,
)

router = APIRouter()


def get_session_manager() -> SessionManager:
    """Get the global session manager instance."""
    from ..server import session_manager

    return session_manager


@router.post("/sessions", response_model=CreateSessionResponse)
async def create_session(request: CreateSessionRequest):
    """
    Create a new session or resume an existing one.

    Args:
        request: Session creation request

    Returns:
        Session information
    """
    manager = get_session_manager()
    internal_session_id = await manager.create_session(
        user_id=request.user_id,
        resume_session_id=request.resume_session_id,
        model=request.model,
        cwd=request.cwd,
    )

    return CreateSessionResponse(
        session_id=internal_session_id,
        created_at=datetime.now(timezone.utc).isoformat(),
        status="connected",
    )


@router.get("/sessions", response_model=ListSessionsResponse)
async def list_sessions(cwd: Optional[str] = None):
    """
    List all active sessions, optionally filtered by cwd.

    Args:
        cwd: Optional working directory to filter by

    Returns:
        List of active sessions
    """
    manager = get_session_manager()
    sessions = manager.list_sessions(cwd=cwd)
    return ListSessionsResponse(sessions=sessions)


@router.get("/sessions/available")
async def list_available_sessions(
    cwd: Optional[str] = None,
    limit: int = 20,
    offset: int = 0,
):
    """
    List all available sessions from disk, optionally filtered by cwd.

    Args:
        cwd: Optional working directory to filter by
        limit: Maximum number of sessions to return
        offset: Number of sessions to skip

    Returns:
        Dict with sessions and pagination info
    """
    manager = get_session_manager()
    return manager.list_available_sessions(
        cwd=cwd,
        limit=limit,
        offset=offset,
    )


@router.get("/sessions/{session_id}/history")
async def get_session_history(session_id: str, cwd: Optional[str] = None):
    """
    Get the conversation history for a session from disk.

    Args:
        session_id: The session ID
        cwd: Optional current working directory

    Returns:
        Session history with messages and metadata
    """
    base_dir = Path.home() / ".claude" / "projects"

    session_file = None

    # If cwd is provided, try direct lookup
    if cwd:
        path_key = cwd.replace("/", "-").replace("_", "-")
        potential_file = base_dir / path_key / f"{session_id}.jsonl"
        if potential_file.exists():
            session_file = potential_file

    # Search all project directories
    if not session_file:
        for project_dir in base_dir.iterdir():
            if not project_dir.is_dir():
                continue
            potential_file = project_dir / f"{session_id}.jsonl"
            if potential_file.exists():
                session_file = potential_file
                break

    if not session_file:
        raise HTTPException(status_code=404, detail="Session history not found")

    try:
        messages = []
        metadata = {
            "session_id": session_id,
            "cwd": None,
        }

        with open(session_file, encoding="utf-8") as f:
            for line in f:
                line = line.strip()
                if not line:
                    continue

                try:
                    entry = json.loads(line)
                    entry_type = entry.get("type")

                    # Extract metadata
                    if not metadata["cwd"]:
                        metadata["cwd"] = entry.get("cwd")

                    # Process messages
                    if entry_type in ["user", "assistant"]:
                        msg_data = entry.get("message", {})
                        role = msg_data.get("role")
                        content = msg_data.get("content")

                        if isinstance(content, str):
                            messages.append({
                                "role": role,
                                "content": content,
                                "timestamp": entry.get("timestamp"),
                            })
                        elif isinstance(content, list):
                            for block in content:
                                if isinstance(block, dict):
                                    block_type = block.get("type")
                                    if block_type == "text":
                                        messages.append({
                                            "role": role,
                                            "content": block.get("text", ""),
                                            "timestamp": entry.get("timestamp"),
                                        })
                                    elif block_type == "tool_use":
                                        messages.append({
                                            "type": "tool_use",
                                            "role": role,
                                            "tool_name": block.get("name"),
                                            "tool_input": block.get("input"),
                                            "timestamp": entry.get("timestamp"),
                                        })
                except json.JSONDecodeError:
                    continue

        return {
            "metadata": metadata,
            "messages": messages,
            "message_count": len(messages),
        }

    except Exception as e:
        raise HTTPException(
            status_code=500, detail=f"Failed to read session history: {str(e)}"
        )


@router.delete("/sessions/{session_id}")
async def close_session(session_id: str):
    """
    Close a session.

    Args:
        session_id: The session ID

    Returns:
        Success message
    """
    manager = get_session_manager()
    await manager.close_session(session_id)
    return {"status": "closed"}


@router.post("/sessions/close_all")
async def close_all_sessions(cwd: Optional[str] = None):
    """
    Close all active sessions, optionally filtered by cwd.

    Args:
        cwd: Optional working directory to filter

    Returns:
        Number of sessions closed
    """
    manager = get_session_manager()
    sessions = manager.list_sessions(cwd=cwd)

    closed_count = 0
    for session_info in sessions:
        try:
            await manager.close_session(session_info.session_id)
            closed_count += 1
        except Exception as e:
            print(f"Failed to close session {session_info.session_id}: {e}")

    return {"status": "success", "closed_count": closed_count}
