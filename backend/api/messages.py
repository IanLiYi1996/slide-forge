"""
Message and Status Endpoints.

Provides REST API endpoints for sending messages to sessions,
checking session status, and streaming responses with slide detection.
"""

import json
from fastapi import APIRouter
from fastapi.responses import StreamingResponse

from ..core import SessionManager
from ..models import (
    SendMessageRequest,
    SendMessageResponse,
    SessionStatus,
    SetPermissionModeRequest,
)

router = APIRouter()


def get_session_manager() -> SessionManager:
    """Get the global session manager instance."""
    from ..server import session_manager

    return session_manager


def safe_json_dumps(obj):
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


@router.get("/sessions/{session_id}/status", response_model=SessionStatus)
async def get_session_status(session_id: str):
    """
    Get the status of a session.

    Args:
        session_id: The session ID

    Returns:
        Session status including pending permissions
    """
    manager = get_session_manager()
    session = await manager.get_session(session_id)
    return session.get_status()


@router.post("/sessions/{session_id}/messages", response_model=SendMessageResponse)
async def send_message(session_id: str, request: SendMessageRequest):
    """
    Send a message in a session (non-streaming).

    Args:
        session_id: The session ID
        request: Message request

    Returns:
        Assistant's response
    """
    manager = get_session_manager()
    session = await manager.get_session(session_id)
    return await session.send_message(request.message)


@router.post("/sessions/{session_id}/messages/stream")
async def send_message_stream(session_id: str, request: SendMessageRequest):
    """
    Send a message in a session with streaming response (SSE).

    Includes slide detection - emits 'slide_complete' events when
    slides are fully generated with HTML content.

    Event types:
    - start: Stream started
    - status: Status update (connecting, ready, etc.)
    - text: Text content from assistant
    - tool_use: Tool being used by assistant
    - slide_complete: A slide was fully generated (includes HTML)
    - permission: Permission request from agent
    - result: Final result with cost/turn info
    - done: Stream completed
    - error: Error occurred

    Args:
        session_id: The session ID
        request: Message request

    Returns:
        Server-Sent Events stream with real-time updates
    """
    print(f"\n[API] send_message_stream START")
    print(f"[API] session_id: {session_id}")
    print(f"[API] message: {request.message[:100] if isinstance(request.message, str) else request.message}")

    manager = get_session_manager()
    session = await manager.get_session(session_id)

    async def event_generator():
        """Generate SSE events from the agent response."""
        event_count = 0
        try:
            async for event in session.send_message_stream(request.message):
                event_count += 1
                event_type = event.get("type", "unknown")
                print(f"[API] Event #{event_count}: type={event_type}")

                if event_type == "text":
                    content_preview = event.get("content", "")[:100]
                    print(f"[API]   text preview: {content_preview}...")
                elif event_type == "slide_complete":
                    print(f"[API]   slide_index: {event.get('slide_index')}")
                    print(f"[API]   html length: {len(event.get('html', ''))}")
                elif event_type == "tool_use":
                    print(f"[API]   tool: {event.get('tool_name')}")
                elif event_type == "result":
                    print(f"[API]   cost_usd: {event.get('cost_usd')}")
                elif event_type == "done":
                    print(f"[API]   slides_detected: {event.get('slides_detected')}")

                # Format as SSE
                yield f"data: {safe_json_dumps(event)}\n\n"

            print(f"[API] send_message_stream END (total events: {event_count})")
        except Exception as e:
            print(f"[API] send_message_stream ERROR: {type(e).__name__}: {str(e)}")
            import traceback

            print(f"[API] Traceback:\n{traceback.format_exc()}")
            error_event = {
                "type": "error",
                "error": str(e),
            }
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


@router.post("/sessions/{session_id}/interrupt")
async def interrupt_session(session_id: str):
    """
    Interrupt the current operation in a session.

    Args:
        session_id: The session ID

    Returns:
        Success message
    """
    manager = get_session_manager()
    session = await manager.get_session(session_id)
    await session.interrupt()
    return {"status": "interrupted"}


@router.post("/sessions/{session_id}/permission_mode")
async def set_permission_mode(session_id: str, request: SetPermissionModeRequest):
    """
    Change the permission mode for a session.

    Args:
        session_id: The session ID
        request: Permission mode change request

    Returns:
        Success message with new mode
    """
    manager = get_session_manager()
    session = await manager.get_session(session_id)
    await session.set_permission_mode(request.mode)
    return {"status": "ok", "mode": request.mode}
