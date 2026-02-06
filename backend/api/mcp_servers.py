"""
MCP servers management endpoints.

Provides API endpoints for reading and managing MCP server configurations
stored in ~/.claude/mcp.json.
"""

import json
import logging
from pathlib import Path

from fastapi import APIRouter, HTTPException

from ..models.schemas import (
    AddMCPServerRequest,
    AddMCPServerResponse,
    DeleteMCPServerResponse,
    ListMCPServersResponse,
    MCPServer,
)

logger = logging.getLogger(__name__)

router = APIRouter()

MCP_CONFIG_PATH = str(Path.home() / ".claude" / "mcp.json")


def _get_config_path() -> Path:
    """Get the path to the MCP config file."""
    return Path(MCP_CONFIG_PATH)


def _read_mcp_config() -> dict:
    """Read the MCP config file."""
    config_path = _get_config_path()

    if not config_path.exists():
        return {}

    try:
        with open(config_path, "r") as f:
            return json.load(f)
    except json.JSONDecodeError as e:
        logger.error(f"Invalid JSON in MCP config file: {e}")
        raise HTTPException(
            status_code=500,
            detail=f"Invalid JSON in MCP config file: {e}",
        )
    except Exception as e:
        logger.error(f"Error reading MCP config: {e}")
        raise HTTPException(
            status_code=500,
            detail=f"Failed to read MCP config: {e}",
        )


def _write_mcp_config(config_data: dict) -> None:
    """Write the MCP config file."""
    config_path = _get_config_path()

    try:
        config_path.parent.mkdir(parents=True, exist_ok=True)

        with open(config_path, "w") as f:
            json.dump(config_data, f, indent=2)
    except Exception as e:
        logger.error(f"Error writing MCP config: {e}")
        raise HTTPException(
            status_code=500,
            detail=f"Failed to write MCP config: {e}",
        )


@router.get("/mcp-servers", response_model=ListMCPServersResponse)
async def list_mcp_servers():
    """List all MCP servers from ~/.claude/mcp.json."""
    config_path = _get_config_path()

    if not config_path.exists():
        return ListMCPServersResponse(
            servers={},
            mcp_config_path=MCP_CONFIG_PATH,
            exists=False,
        )

    config_data = _read_mcp_config()
    mcp_servers_raw = config_data.get("mcpServers", {})

    servers = {}
    for name, config in mcp_servers_raw.items():
        try:
            servers[name] = MCPServer(
                type=config.get("type", "stdio"),
                command=config.get("command"),
                args=config.get("args"),
                env=config.get("env"),
                url=config.get("url"),
            )
        except Exception as e:
            logger.error(f"Failed to parse MCP server '{name}': {e}")

    return ListMCPServersResponse(
        servers=servers,
        mcp_config_path=MCP_CONFIG_PATH,
        exists=True,
    )


@router.post("/mcp-servers", response_model=AddMCPServerResponse)
async def add_mcp_server(request: AddMCPServerRequest):
    """Add a new MCP server to ~/.claude/mcp.json."""
    # Validate required fields based on type
    if request.type == "stdio":
        if not request.command:
            raise HTTPException(
                status_code=400,
                detail="'command' is required for stdio type",
            )
    elif request.type in ["sse", "http"]:
        if not request.url:
            raise HTTPException(
                status_code=400,
                detail=f"'url' is required for {request.type} type",
            )
    else:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid type '{request.type}'. Must be 'stdio', 'sse', or 'http'",
        )

    config_data = _read_mcp_config()

    if "mcpServers" not in config_data:
        config_data["mcpServers"] = {}

    if request.name in config_data["mcpServers"]:
        raise HTTPException(
            status_code=400,
            detail=f"MCP server '{request.name}' already exists",
        )

    # Build server config based on type
    server_config = {"type": request.type}

    if request.type == "stdio":
        server_config["command"] = request.command
        server_config["args"] = request.args if request.args else []
        server_config["env"] = request.env if request.env else {}
    elif request.type in ["sse", "http"]:
        server_config["url"] = request.url

    config_data["mcpServers"][request.name] = server_config
    _write_mcp_config(config_data)

    return AddMCPServerResponse(
        status="success",
        message=f"MCP server '{request.name}' added successfully",
        server_name=request.name,
    )


@router.delete("/mcp-servers/{server_name}", response_model=DeleteMCPServerResponse)
async def delete_mcp_server(server_name: str):
    """Delete an MCP server from ~/.claude/mcp.json."""
    config_path = _get_config_path()

    if not config_path.exists():
        raise HTTPException(status_code=404, detail="MCP config file not found")

    config_data = _read_mcp_config()

    if "mcpServers" not in config_data or server_name not in config_data["mcpServers"]:
        raise HTTPException(
            status_code=404,
            detail=f"MCP server '{server_name}' not found",
        )

    del config_data["mcpServers"][server_name]
    _write_mcp_config(config_data)

    return DeleteMCPServerResponse(
        status="success",
        message=f"MCP server '{server_name}' deleted successfully",
        server_name=server_name,
    )
