"""
Session Manager.

This module contains the SessionManager class which manages multiple
concurrent Claude Agent sessions, handling creation, restoration,
and cleanup operations.

Adapted from sample-claude-code-web-agent-on-bedrock-agentcore for slide generation.
"""

import json
import os
import re
import uuid
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Optional

from fastapi import HTTPException

from ..models import SessionInfo
from .session import AgentSession


# System message patterns to filter out from previews
SYSTEM_MESSAGE_PATTERNS = [
    r"^<command-name>",
    r"^<command-message>",
    r"^<system-reminder>",
    r"^Caveat:",
    r"^This session is being continued from a previous",
]

SYSTEM_MESSAGE_REGEX = re.compile("|".join(SYSTEM_MESSAGE_PATTERNS))


def _is_system_message(content: str) -> bool:
    """Check if a message content is a system message that should be filtered."""
    if not content:
        return False
    return bool(SYSTEM_MESSAGE_REGEX.search(content))


def _extract_text_content(content: Any) -> Optional[str]:
    """Extract text content from various message content formats."""
    if isinstance(content, str):
        return content
    if isinstance(content, list) and len(content) > 0:
        first_block = content[0]
        if isinstance(first_block, dict):
            return first_block.get("text", "")
        if isinstance(first_block, str):
            return first_block
    return None


def _parse_jsonl_sessions(file_path: Path) -> dict[str, Any]:
    """
    Parse a JSONL session file and extract session metadata.

    Returns a dict with session information including messages and metadata.
    """
    sessions: dict[str, dict] = {}

    try:
        with open(file_path, encoding="utf-8") as f:
            for line in f:
                line = line.strip()
                if not line:
                    continue

                try:
                    entry = json.loads(line)

                    # Handle summary entries
                    if entry.get("type") == "summary" and entry.get("summary"):
                        session_id = entry.get("sessionId")
                        if session_id and session_id in sessions:
                            sessions[session_id]["summary"] = entry["summary"]
                        continue

                    session_id = entry.get("sessionId")
                    if not session_id:
                        continue

                    if session_id not in sessions:
                        sessions[session_id] = {
                            "id": session_id,
                            "summary": "New Session",
                            "message_count": 0,
                            "last_activity": datetime.now(timezone.utc),
                            "cwd": entry.get("cwd", ""),
                            "last_user_message": None,
                            "last_assistant_message": None,
                        }

                    session = sessions[session_id]

                    # Track messages
                    msg = entry.get("message", {})
                    role = msg.get("role")
                    content = msg.get("content")

                    if role == "user" and content:
                        text_content = _extract_text_content(content)
                        if text_content and not _is_system_message(text_content):
                            session["last_user_message"] = text_content

                    elif role == "assistant" and content:
                        if entry.get("isApiErrorMessage"):
                            continue
                        text_content = _extract_text_content(content)
                        if text_content and not _is_system_message(text_content):
                            session["last_assistant_message"] = text_content

                    session["message_count"] += 1

                    if entry.get("timestamp"):
                        try:
                            session["last_activity"] = datetime.fromisoformat(
                                entry["timestamp"].replace("Z", "+00:00")
                            )
                        except (ValueError, AttributeError):
                            pass

                except json.JSONDecodeError:
                    continue

        # Set final summary based on messages if no summary exists
        for session in sessions.values():
            if session["summary"] == "New Session":
                last_msg = session["last_user_message"] or session["last_assistant_message"]
                if last_msg:
                    session["summary"] = last_msg[:50] + "..." if len(last_msg) > 50 else last_msg

        return {"sessions": list(sessions.values())}

    except Exception:
        return {"sessions": []}


class SessionManager:
    """
    Manages multiple concurrent Claude Agent sessions.

    Each session maintains its own SDK client, conversation history,
    and permission state. Supports session creation, restoration,
    and cleanup.
    """

    def __init__(self):
        """Initialize the session manager."""
        self.sessions: dict[str, AgentSession] = {}
        self.session_dir = Path.home() / ".claude" / "projects"

    async def create_session(
        self,
        user_id: Optional[str] = None,
        resume_session_id: Optional[str] = None,
        model: Optional[str] = None,
        cwd: Optional[str] = None,
        mcp_server_ids: Optional[list[str]] = None,
    ) -> str:
        """
        Create a new session or resume an existing one.

        Args:
            user_id: User ID for tracking
            resume_session_id: Optional session ID to resume
            model: Optional model name override
            cwd: Working directory for the session
            mcp_server_ids: List of MCP server names to enable

        Returns:
            The session ID (new or resumed)
        """
        session_id = resume_session_id or str(uuid.uuid4())

        # If session already exists in memory, reuse it instead of failing
        if session_id in self.sessions:
            existing = self.sessions[session_id]
            if existing.status == "connected":
                print(f"[SessionManager] Reusing active session: {session_id}")
                return session_id
            else:
                # Session exists but disconnected - clean up and recreate
                print(f"[SessionManager] Replacing disconnected session: {session_id}")
                del self.sessions[session_id]

        session = AgentSession(
            session_id,
            user_id,
            model,
            cwd,
            mcp_server_ids=mcp_server_ids,
        )
        await session.connect(resume_session_id)

        self.sessions[session_id] = session

        return session_id

    async def get_session(
        self,
        session_id: str,
        auto_resume: bool = True,
        user_id: Optional[str] = None,
        cwd: Optional[str] = None,
    ) -> AgentSession:
        """
        Get an active session by ID, optionally auto-resuming if not in memory.

        Args:
            session_id: The session ID
            auto_resume: Whether to automatically resume session if not active
            user_id: User ID for session creation
            cwd: Working directory

        Returns:
            The AgentSession instance

        Raises:
            HTTPException: If session not found and auto_resume is disabled
        """
        if session_id in self.sessions:
            return self.sessions[session_id]

        if not auto_resume:
            raise HTTPException(status_code=404, detail="Session not found")

        # Try to find session file on disk for resumption
        print(f"[SessionManager] Session {session_id} not in memory, checking for session file...")

        session_file = None
        session_cwd = None

        if self.session_dir.exists():
            for project_dir in self.session_dir.iterdir():
                if not project_dir.is_dir():
                    continue

                potential_file = project_dir / f"{session_id}.jsonl"
                if potential_file.exists():
                    session_file = potential_file

                    # Extract cwd from session file
                    try:
                        parsed = _parse_jsonl_sessions(potential_file)
                        if parsed["sessions"]:
                            session_cwd = parsed["sessions"][0].get("cwd", "")
                    except Exception:
                        pass

                    break

        # Resume if session file found
        if session_file:
            print(f"[SessionManager] Found session file: {session_file}")
            resume_cwd = session_cwd if session_cwd else cwd

            resumed_session_id = await self.create_session(
                user_id=user_id,
                resume_session_id=session_id,
                model=os.environ.get("ANTHROPIC_MODEL"),
                cwd=resume_cwd,
            )

            print(f"[SessionManager] Auto-resumed session: {resumed_session_id}")
            return self.sessions[resumed_session_id]

        # Create new session
        print(f"[SessionManager] No session file found, creating new session: {session_id}")

        session = AgentSession(
            session_id,
            user_id,
            os.environ.get("ANTHROPIC_MODEL"),
            cwd,
        )

        await session.connect(resume_session_id=None)
        self.sessions[session_id] = session

        print(f"[SessionManager] Created new session: {session_id}")
        return self.sessions[session_id]

    def update_session_id(self, old_session_id: str, new_session_id: str):
        """
        Update session ID after SDK provides real session_id.

        Args:
            old_session_id: Old/temporary session ID
            new_session_id: New/real session ID from SDK
        """
        if old_session_id not in self.sessions:
            raise HTTPException(status_code=404, detail=f"Session {old_session_id} not found")

        if new_session_id in self.sessions:
            return

        session = self.sessions.pop(old_session_id)
        session.session_id = new_session_id
        self.sessions[new_session_id] = session
        print(f"[SessionManager] Updated session ID: {old_session_id} -> {new_session_id}")

    async def get_or_ensure_session(
        self,
        session_id: str,
        model: Optional[str] = None,
        mcp_server_ids: Optional[list[str]] = None,
    ) -> AgentSession:
        """
        Get session and ensure model and MCP servers match the request.

        If model or mcp_server_ids are provided and differ from current session,
        the session will be disconnected and reconnected with new configuration.

        Args:
            session_id: The session ID
            model: Optional model to ensure
            mcp_server_ids: Optional MCP server IDs to ensure

        Returns:
            The AgentSession instance with correct configuration

        Raises:
            HTTPException: If session not found
        """
        session = await self.get_session(session_id)

        needs_reconnect = False

        # Check if model needs to be updated
        if model and model != session.model:
            print(f"[SessionManager] Model change: {session.model} -> {model}")
            session.model = model
            needs_reconnect = True

        # Check if MCP servers need to be updated
        if mcp_server_ids is not None and mcp_server_ids != session.mcp_server_ids:
            print(f"[SessionManager] MCP servers change: {session.mcp_server_ids} -> {mcp_server_ids}")
            session.mcp_server_ids = mcp_server_ids
            needs_reconnect = True

        if needs_reconnect:
            print(f"[SessionManager] Configuration changed — reconnecting session {session_id}")
            await session.disconnect()
            await session.connect(resume_session_id=session_id)
            print(f"[SessionManager] Session {session_id} reconnected")

        return session

    async def close_session(self, session_id: str):
        """
        Close and cleanup a session.

        Args:
            session_id: The session ID to close
        """
        if session_id in self.sessions:
            session = self.sessions[session_id]
            await session.disconnect()
            del self.sessions[session_id]

    def list_sessions(self, cwd: Optional[str] = None) -> list[SessionInfo]:
        """
        List all active sessions, optionally filtered by cwd.

        Args:
            cwd: Optional working directory to filter by

        Returns:
            List of SessionInfo objects
        """
        result = []
        for session_id, session in self.sessions.items():
            if cwd and session.cwd != cwd:
                continue

            result.append(
                SessionInfo(
                    session_id=session_id,
                    created_at=session.created_at.isoformat(),
                    last_activity=session.last_activity.isoformat(),
                    status=session.status,
                    message_count=session.message_count,
                    cwd=session.cwd,
                )
            )
        return result

    def list_available_sessions(
        self,
        cwd: Optional[str] = None,
        limit: int = 20,
        offset: int = 0,
    ) -> dict[str, Any]:
        """
        List all available sessions (both active and persisted on disk).

        Args:
            cwd: Optional working directory to filter by
            limit: Maximum number of sessions to return
            offset: Number of sessions to skip

        Returns:
            Dict with sessions list and pagination info
        """
        all_sessions: dict[str, dict] = {}
        session_ids_seen: set[str] = set()

        # Add active sessions
        for session_id, session in self.sessions.items():
            if cwd and session.cwd != cwd:
                continue

            path_key = session.cwd.replace("/", "-").replace("_", "-") if session.cwd else "default"

            session_data = {
                "id": session_id,
                "summary": "Active session",
                "message_count": session.message_count,
                "last_activity": session.last_activity,
                "cwd": session.cwd or "",
                "project": path_key,
                "active": True,
            }

            # Try to get metadata from session file
            session_file_path = self.session_dir / path_key / f"{session_id}.jsonl"
            if session_file_path.exists():
                parsed = _parse_jsonl_sessions(session_file_path)
                for s in parsed["sessions"]:
                    if s["id"] == session_id:
                        session_data.update({
                            "summary": s["summary"],
                            "message_count": s["message_count"],
                            "last_activity": s["last_activity"],
                        })
                        break

            all_sessions[session_id] = session_data
            session_ids_seen.add(session_id)

        # Scan persisted sessions from disk
        if self.session_dir.exists():
            if cwd:
                path_key = cwd.replace("/", "-").replace("_", "-")
                project_dirs = [self.session_dir / path_key]
            else:
                project_dirs = list(self.session_dir.iterdir())

            for project_dir in project_dirs:
                if not project_dir.exists() or not project_dir.is_dir():
                    continue

                for session_file in project_dir.glob("*.jsonl"):
                    session_id = session_file.stem

                    if session_id in session_ids_seen:
                        continue

                    parsed = _parse_jsonl_sessions(session_file)

                    for s in parsed["sessions"]:
                        if s["id"] not in all_sessions:
                            all_sessions[s["id"]] = {
                                **s,
                                "project": project_dir.name,
                                "active": False,
                            }

                    session_ids_seen.add(session_id)

        # Sort by last activity (newest first)
        visible_sessions = list(all_sessions.values())
        visible_sessions.sort(
            key=lambda x: x["last_activity"]
            if isinstance(x["last_activity"], datetime)
            else datetime.fromisoformat(str(x["last_activity"]).replace("Z", "+00:00")),
            reverse=True,
        )

        total = len(visible_sessions)
        paginated = visible_sessions[offset : offset + limit]
        has_more = offset + limit < total

        # Format output
        result_sessions = []
        for s in paginated:
            last_activity = s["last_activity"]
            if isinstance(last_activity, datetime):
                modified = last_activity.isoformat()
            else:
                modified = str(last_activity)

            result = {
                "session_id": s["id"],
                "modified": modified,
                "preview": s.get("summary", "No preview")[:100],
                "project": s.get("project", ""),
                "message_count": s.get("message_count", 0),
                "active": s.get("active", False),
                "cwd": s.get("cwd", ""),
            }

            result_sessions.append(result)

        return {
            "sessions": result_sessions,
            "has_more": has_more,
            "total": total,
            "offset": offset,
            "limit": limit,
        }
