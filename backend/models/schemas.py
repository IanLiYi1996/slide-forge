"""
Pydantic models for request/response validation.

Contains all the data models used by the API endpoints for
request validation, response serialization, and documentation.
"""

from typing import Any, Optional

from pydantic import BaseModel


class CreateSessionRequest(BaseModel):
    """Request to create a new session or resume an existing one."""

    user_id: Optional[str] = None
    resume_session_id: Optional[str] = None
    model: Optional[str] = None
    cwd: Optional[str] = None


class CreateSessionResponse(BaseModel):
    """Response containing new session information."""

    session_id: str
    created_at: str
    status: str


class SendMessageRequest(BaseModel):
    """Request to send a message in a session."""

    message: str | dict[str, Any]
    model: Optional[str] = None
    enable_web_search: bool = True


class MessageBlock(BaseModel):
    """Represents a single content block in a message."""

    type: str  # "text", "tool_use", "thinking"
    content: Optional[str] = None
    tool_name: Optional[str] = None
    tool_input: Optional[dict[str, Any]] = None


class SendMessageResponse(BaseModel):
    """Response containing assistant's reply."""

    messages: list[MessageBlock]
    session_id: str
    cost_usd: Optional[float] = None
    num_turns: Optional[int] = None


class SessionInfo(BaseModel):
    """Information about a session."""

    session_id: str
    created_at: str
    last_activity: str
    status: str
    message_count: int
    cwd: Optional[str] = None


class ListSessionsResponse(BaseModel):
    """Response containing list of sessions."""

    sessions: list[SessionInfo]


class PermissionRequest(BaseModel):
    """Pending permission request."""

    request_id: str
    tool_name: str
    tool_input: dict[str, Any]
    suggestions: list[dict[str, Any]]


class PermissionResponse(BaseModel):
    """User's response to permission request."""

    request_id: str
    allowed: bool
    apply_suggestions: bool = False


class SessionStatus(BaseModel):
    """Current status of a session."""

    session_id: str
    status: str
    pending_permission: Optional[PermissionRequest] = None
    current_model: Optional[str] = None


class SetPermissionModeRequest(BaseModel):
    """Request to change the permission mode for a session."""

    mode: str  # "default", "acceptEdits", "plan", "bypassPermissions"


# Slide-specific models


class SlideData(BaseModel):
    """Represents a single slide with HTML content."""

    id: str
    index: int
    outline_content: str
    html: Optional[str] = None
    status: str = "pending"  # "pending", "generating", "ready", "error"
    modification_count: int = 0


class SlideCompleteEvent(BaseModel):
    """Event emitted when a slide is fully generated."""

    slide_index: int
    html: str
    timestamp: int
