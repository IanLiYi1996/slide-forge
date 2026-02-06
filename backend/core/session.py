"""
Agent Session Management.

This module contains the AgentSession class which represents a single
interactive session with the Claude Agent SDK, managing the client
connection, permission callbacks, and conversation state.

Adapted from sample-claude-code-web-agent-on-bedrock-agentcore for slide generation.
"""

import asyncio
import os
import time
import uuid
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Optional

from fastapi import HTTPException

from claude_agent_sdk import (
    AssistantMessage,
    ClaudeAgentOptions,
    ClaudeSDKClient,
    CLIConnectionError,
    CLINotFoundError,
    PermissionResultAllow,
    PermissionResultDeny,
    ResultMessage,
    SystemMessage,
    TextBlock,
    ToolPermissionContext,
    ToolUseBlock,
    UserMessage,
)

from ..models import MessageBlock, PermissionRequest, SendMessageResponse, SessionStatus
from .slide_detector import SlideDetector


def load_custom_system_prompt() -> Optional[str]:
    """
    Load custom system prompt from backend/claude_system_prompt.md.

    Returns:
        The content of the file if it exists, None otherwise.
    """
    try:
        backend_dir = Path(__file__).parent.parent
        prompt_file = backend_dir / "claude_system_prompt.md"

        if prompt_file.exists():
            with open(prompt_file, encoding="utf-8") as f:
                content = f.read().strip()
                if content:
                    return content
    except Exception as e:
        import logging

        logging.warning(f"Failed to load custom system prompt: {e}")

    return None


class AgentSession:
    """
    Represents a single Claude Agent session for slide generation.

    Manages the SDK client, permission callbacks, and conversation state
    for one interactive session. Includes slide detection for streaming
    slide HTML to clients in real-time.
    """

    def __init__(
        self,
        session_id: str,
        user_id: Optional[str] = None,
        model: Optional[str] = None,
        cwd: Optional[str] = None,
        mcp_server_ids: Optional[list[str]] = None,
    ):
        """
        Initialize an agent session.

        Args:
            session_id: Unique session identifier
            user_id: User ID for tracking
            model: Optional model name (defaults to ANTHROPIC_MODEL env var)
            cwd: Working directory for the session
            mcp_server_ids: List of MCP server names to enable
        """
        self.session_id = session_id
        self.user_id = user_id
        self.client: Optional[ClaudeSDKClient] = None
        self.created_at = datetime.now(timezone.utc)
        self.last_activity = datetime.now(timezone.utc)
        self.status = "initializing"
        self.message_count = 0

        # Permission management
        self.pending_permission: Optional[dict[str, Any]] = None
        self.permission_event: Optional[asyncio.Event] = None
        self.permission_result: Optional[Any] = None
        self.permission_queue: asyncio.Queue = asyncio.Queue()

        # Session configuration
        self.cwd = cwd
        self.model = model or os.environ.get("ANTHROPIC_MODEL")
        self.current_model = self.model

        # MCP servers configuration
        self.mcp_server_ids = mcp_server_ids or []

        # Slide detection
        self.slide_detector = SlideDetector()

    async def connect(self, resume_session_id: Optional[str] = None):
        """
        Connect the SDK client and initialize the session.

        Args:
            resume_session_id: Optional session ID to resume from
        """
        print(f"\n[Session] {'Resuming' if resume_session_id else 'Creating'} session {self.session_id}")
        print(f"[Session] user_id: {self.user_id}")
        print(f"[Session] cwd: {self.cwd}")
        print(f"[Session] model: {self.model}")

        # Load custom system prompt for slide generation
        custom_prompt = load_custom_system_prompt()

        # Build system prompt configuration
        if custom_prompt:
            system_prompt_config = {
                "type": "preset",
                "preset": "claude_code",
                "append": custom_prompt,
            }
        else:
            system_prompt_config = {
                "type": "preset",
                "preset": "claude_code",
            }

        # Configure allowed tools from environment variable
        default_tools = [
            "Read", "Write", "Edit",
            "Glob", "Grep",
            "Bash",
            "NotebookEdit",
            "WebFetch",
            "Task", "TodoWrite",
            "BashOutput", "KillShell",
            "AskUserQuestion",
            "Skill", "SlashCommand",
            "ExitPlanMode",
            "ListMcpResourcesTool", "ReadMcpResourceTool",
        ]

        allowed_tools_env = os.environ.get("ALLOWED_TOOLS", "").strip()
        if allowed_tools_env:
            allowed_tools = [tool.strip() for tool in allowed_tools_env.split(",") if tool.strip()]
        else:
            allowed_tools = default_tools

        options_dict = {
            "allowed_tools": allowed_tools,
            "system_prompt": system_prompt_config,
            "max_turns": 0,
            "can_use_tool": self.permission_callback,
            "permission_mode": "default",
            "setting_sources": ["user", "project"],
        }

        if resume_session_id:
            options_dict["resume"] = resume_session_id

        if self.model:
            options_dict["model"] = self.model

        if self.cwd:
            options_dict["cwd"] = self.cwd

        # Load MCP servers if specified
        if self.mcp_server_ids:
            print(f"[Session] Loading MCP servers: {self.mcp_server_ids}")
            mcp_servers = await self._load_mcp_servers()
            if mcp_servers:
                options_dict["mcp_servers"] = mcp_servers
                print(f"[Session] Loaded {len(mcp_servers)} MCP server(s)")
            else:
                print(f"[Session] No MCP servers loaded (config not found or invalid)")

        print(f"[Session] SDK options: {list(options_dict.keys())}")

        options = ClaudeAgentOptions(**options_dict)

        try:
            print(f"[Session] Connecting to Claude SDK...")
            self.client = ClaudeSDKClient(options=options)
            await self.client.connect()
            self.status = "connected"
            print(f"[Session] Connected successfully")
        except (CLINotFoundError, CLIConnectionError) as e:
            self.status = "error"
            raise HTTPException(status_code=500, detail=f"Failed to connect: {str(e)}")

    async def disconnect(self):
        """Disconnect the SDK client and cleanup."""
        if self.client:
            try:
                await self.client.disconnect()
            except RuntimeError as e:
                if "cancel scope" in str(e) or "different task" in str(e):
                    import logging

                    logging.warning(
                        f"Session {self.session_id}: Disconnect cleanup error (non-fatal): {e}"
                    )
                else:
                    raise
            finally:
                self.status = "disconnected"

    async def _load_mcp_servers(self) -> dict[str, Any]:
        """
        Load MCP servers configuration from ~/.claude/mcp.json.

        Returns:
            Dictionary of MCP server configurations keyed by server name
        """
        import json

        mcp_config_path = Path.home() / ".claude" / "mcp.json"

        if not mcp_config_path.exists():
            print(f"[Session] MCP config file not found: {mcp_config_path}")
            return {}

        try:
            with open(mcp_config_path, "r") as f:
                config_data = json.load(f)

            all_servers = config_data.get("mcpServers", {})
            mcp_servers = {}

            for server_name in self.mcp_server_ids:
                if server_name not in all_servers:
                    print(f"[Session] Warning: MCP server '{server_name}' not found in config")
                    continue

                server_config = all_servers[server_name]
                connection_type = server_config.get("type", "stdio")

                if connection_type == "stdio":
                    mcp_servers[server_name] = {
                        "type": "stdio",
                        "command": server_config.get("command"),
                        "args": server_config.get("args", []),
                        "env": server_config.get("env", {}),
                    }
                    print(f"[Session] Configured MCP server '{server_name}' (stdio)")
                elif connection_type == "sse":
                    mcp_servers[server_name] = {
                        "type": "sse",
                        "url": server_config.get("url"),
                    }
                    print(f"[Session] Configured MCP server '{server_name}' (sse)")
                elif connection_type == "http":
                    mcp_servers[server_name] = {
                        "type": "http",
                        "url": server_config.get("url"),
                    }
                    print(f"[Session] Configured MCP server '{server_name}' (http)")
                else:
                    print(f"[Session] Warning: Unknown MCP server type '{connection_type}' for '{server_name}'")

            return mcp_servers

        except json.JSONDecodeError as e:
            print(f"[Session] Error: Invalid JSON in MCP config file: {str(e)}")
            return {}
        except Exception as e:
            print(f"[Session] Error loading MCP servers: {str(e)}")
            return {}

    async def permission_callback(
        self, tool_name: str, input_data: dict, context: ToolPermissionContext
    ) -> PermissionResultAllow | PermissionResultDeny:
        """
        Permission callback for tool usage.

        Auto-allows most tools for slide generation workflow.

        Args:
            tool_name: Name of the tool requesting permission
            input_data: Tool input parameters
            context: Permission context with suggestions

        Returns:
            Permission result (allow or deny)
        """
        print(f"[Permission] Tool: {tool_name}")

        # Auto-allow all MCP tools (tools from MCP servers)
        if tool_name.startswith("mcp__"):
            print(f"[Permission] Auto-allow MCP tool: {tool_name}")
            return PermissionResultAllow()

        # Auto-allow tools based on environment variable
        auto_allow_tools_env = os.environ.get("AUTO_ALLOW_TOOLS", "").strip()
        if auto_allow_tools_env:
            auto_allow_tools = [tool.strip() for tool in auto_allow_tools_env.split(",") if tool.strip()]
        else:
            auto_allow_tools = [
                "Read", "Write", "Edit", "NotebookEdit",
                "Glob", "Grep",
                "Bash", "KillShell",
                "WebSearch", "WebFetch",
                "Task", "TaskOutput", "TodoWrite",
                "AskUserQuestion",
                "EnterPlanMode", "ExitPlanMode",
                "Skill",
            ]

        if tool_name in auto_allow_tools:
            print(f"[Permission] Auto-allow: {tool_name}")
            return PermissionResultAllow()

        # For other tools, create permission request
        print(f"[Permission] Requesting user approval for: {tool_name}")
        request_id = str(uuid.uuid4())
        self.pending_permission = {
            "request_id": request_id,
            "tool_name": tool_name,
            "tool_input": input_data,
            "suggestions": [
                s.__dict__ if hasattr(s, "__dict__") else s for s in context.suggestions
            ],
        }

        self.permission_event = asyncio.Event()
        self.permission_result = None

        try:
            self.permission_queue.put_nowait(self.pending_permission)
        except Exception as e:
            print(f"[Permission] Warning: Failed to queue permission: {e}")

        # Wait for response with timeout
        try:
            await asyncio.wait_for(self.permission_event.wait(), timeout=300)
        except asyncio.TimeoutError:
            print(f"[Permission] Timeout for: {tool_name}")
            self.pending_permission = None
            return PermissionResultDeny(message="Permission request timed out")

        result = self.permission_result
        self.pending_permission = None
        self.permission_event = None
        self.permission_result = None

        return result

    def respond_to_permission(
        self, request_id: str, allowed: bool, apply_suggestions: bool = False
    ):
        """
        Respond to a pending permission request.

        Args:
            request_id: The permission request ID
            allowed: Whether to allow the operation
            apply_suggestions: Whether to apply permission suggestions

        Raises:
            HTTPException: If no matching pending permission
        """
        if (
            not self.pending_permission
            or self.pending_permission["request_id"] != request_id
        ):
            raise HTTPException(
                status_code=404, detail="No matching permission request"
            )

        if allowed:
            if apply_suggestions and self.pending_permission["suggestions"]:
                from claude_agent_sdk import PermissionUpdate

                suggestions = []
                for s in self.pending_permission["suggestions"]:
                    suggestions.append(PermissionUpdate(**s))

                self.permission_result = PermissionResultAllow(
                    updated_permissions=suggestions
                )
            else:
                self.permission_result = PermissionResultAllow()
        else:
            self.permission_result = PermissionResultDeny(message="User denied")

        if self.permission_event:
            self.permission_event.set()

    async def send_message(self, message: str | dict) -> SendMessageResponse:
        """
        Send a message and get the response.

        Args:
            message: The user's message

        Returns:
            SendMessageResponse with assistant's reply

        Raises:
            HTTPException: If session not connected
        """
        if not self.client or self.status != "connected":
            raise HTTPException(status_code=400, detail="Session not connected")

        self.last_activity = datetime.now(timezone.utc)
        self.message_count += 1

        if isinstance(message, dict):
            wire_message = {
                "type": "user",
                "message": message,
                "parent_tool_use_id": None,
                "session_id": "default",
            }

            async def message_stream():
                yield wire_message

            await self.client.query(message_stream())
        else:
            await self.client.query(message)

        messages = []
        cost_usd = None
        num_turns = None

        async for msg in self.client.receive_response():
            if isinstance(msg, AssistantMessage):
                for block in msg.content:
                    if isinstance(block, TextBlock):
                        messages.append(MessageBlock(type="text", content=block.text))
                    elif isinstance(block, ToolUseBlock):
                        messages.append(
                            MessageBlock(
                                type="tool_use",
                                tool_name=block.name,
                                tool_input=block.input,
                            )
                        )
            elif isinstance(msg, ResultMessage):
                cost_usd = msg.total_cost_usd
                num_turns = msg.num_turns

        return SendMessageResponse(
            messages=messages,
            session_id=self.session_id,
            cost_usd=cost_usd,
            num_turns=num_turns,
        )

    async def send_message_stream(self, message: str | dict):
        """
        Send a message and stream the response in real-time.

        Includes slide detection - emits 'slide_complete' events when
        slides are fully generated.

        Args:
            message: The user's message

        Yields:
            Dictionary events with type and data for each step

        Raises:
            HTTPException: If session not connected
        """
        print(f"\n[Session] send_message_stream START")
        print(f"[Session] session_id: {self.session_id}")

        if not self.client or self.status != "connected":
            raise HTTPException(status_code=400, detail="Session not connected")

        self.last_activity = datetime.now(timezone.utc)
        self.message_count += 1

        # Reset slide detector for new message
        self.slide_detector.reset()

        # Send initial event
        yield {
            "type": "start",
            "session_id": self.session_id,
            "message": message if isinstance(message, str) else str(message),
        }

        # Send message to SDK
        if isinstance(message, dict):
            wire_message = {
                "type": "user",
                "message": message,
                "parent_tool_use_id": None,
                "session_id": "default",
            }

            async def message_stream():
                yield wire_message

            await self.client.query(message_stream())
        else:
            await self.client.query(message)

        # Track last reported permission
        last_permission_id = None
        response_iterator = self.client.receive_response()
        sdk_done = False
        real_session_id = self.session_id

        while not sdk_done:
            # Check permission queue
            try:
                permission = self.permission_queue.get_nowait()
                permission_id = permission.get("request_id")
                if permission_id != last_permission_id:
                    yield {
                        "type": "permission",
                        "permission": permission,
                    }
                    last_permission_id = permission_id
            except asyncio.QueueEmpty:
                pass

            # Get next SDK message
            try:
                msg = await anext(response_iterator)
            except StopAsyncIteration:
                sdk_done = True
                break

            if isinstance(msg, SystemMessage):
                continue
            elif isinstance(msg, UserMessage):
                yield {
                    "type": "user_message",
                    "content": msg.content,
                }
            elif isinstance(msg, AssistantMessage):
                for block in msg.content:
                    if isinstance(block, TextBlock):
                        # Feed to slide detector
                        new_slides = self.slide_detector.feed(block.text)

                        # Emit slide_complete events for detected slides
                        for slide in new_slides:
                            yield {
                                "type": "slide_complete",
                                "slide_index": slide.index,
                                "html": slide.html,
                                "timestamp": int(time.time() * 1000),
                            }
                            print(f"[Session] Slide {slide.index} detected and streamed")

                        # Also emit the text content
                        yield {
                            "type": "text",
                            "content": block.text,
                        }
                    elif isinstance(block, ToolUseBlock):
                        yield {
                            "type": "tool_use",
                            "tool_name": block.name,
                            "tool_input": block.input,
                            "tool_use_id": block.id,
                        }
            elif isinstance(msg, ResultMessage):
                real_session_id = msg.session_id if hasattr(msg, "session_id") else self.session_id

                # Update session ID if changed
                if real_session_id != self.session_id:
                    print(f"[Session] Session ID changed: {self.session_id} -> {real_session_id}")

                yield {
                    "type": "result",
                    "cost_usd": msg.total_cost_usd,
                    "num_turns": msg.num_turns,
                    "session_id": real_session_id,
                }

        # Check remaining permissions
        while True:
            try:
                permission = self.permission_queue.get_nowait()
                permission_id = permission.get("request_id")
                if permission_id != last_permission_id:
                    yield {
                        "type": "permission",
                        "permission": permission,
                    }
                    last_permission_id = permission_id
            except asyncio.QueueEmpty:
                break

        # Send completion event
        yield {
            "type": "done",
            "session_id": real_session_id,
            "slides_detected": len(self.slide_detector.get_all_slides()),
        }
        print(f"[Session] send_message_stream END")

        # Backup to S3 after task completion (if S3 sync is enabled)
        s3_sync_enabled = os.environ.get("ENABLE_S3_SYNC", "true").lower() in ["true", "1", "yes"]
        if s3_sync_enabled:
            from .claude_sync_manager import get_claude_sync_manager
            sync_manager = get_claude_sync_manager()
            if sync_manager:
                asyncio.create_task(sync_manager.backup_user_claude_dir(self.user_id))

    async def interrupt(self):
        """
        Interrupt the current operation.

        Raises:
            HTTPException: If session not connected or SDK call fails
        """
        if not self.client or self.status != "connected":
            raise HTTPException(status_code=400, detail="Session not connected")

        try:
            await self.client.interrupt()
            self.last_activity = datetime.now(timezone.utc)
        except Exception as e:
            raise HTTPException(
                status_code=500, detail=f"Failed to interrupt: {str(e)}"
            )

    async def set_permission_mode(self, mode: str):
        """
        Change the permission mode for this session.

        Args:
            mode: Permission mode ("default", "acceptEdits", "plan", "bypassPermissions")

        Raises:
            HTTPException: If session not connected or SDK call fails
        """
        if not self.client or self.status != "connected":
            raise HTTPException(status_code=400, detail="Session not connected")

        try:
            await self.client.set_permission_mode(mode)
            self.last_activity = datetime.now(timezone.utc)
        except Exception as e:
            raise HTTPException(
                status_code=500, detail=f"Failed to set permission mode: {str(e)}"
            )

    def get_status(self) -> SessionStatus:
        """
        Get current session status.

        Returns:
            SessionStatus object
        """
        pending_perm = None
        if self.pending_permission:
            pending_perm = PermissionRequest(**self.pending_permission)

        return SessionStatus(
            session_id=self.session_id,
            status=self.status,
            pending_permission=pending_perm,
            current_model=self.current_model,
        )
