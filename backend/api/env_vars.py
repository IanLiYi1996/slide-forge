"""
Environment variables management endpoints.

Provides API endpoints for reading and managing environment variables
stored in ~/.claude/settings.json under the "env" key.
"""

import json
import logging
from pathlib import Path

from fastapi import APIRouter, HTTPException

from ..models.schemas import (
    DeleteEnvVarResponse,
    GetEnvVarsResponse,
    SetAllEnvVarsRequest,
    SetAllEnvVarsResponse,
    SetEnvVarRequest,
    SetEnvVarResponse,
)

logger = logging.getLogger(__name__)

router = APIRouter()

CLAUDE_SETTINGS_PATH = str(Path.home() / ".claude" / "settings.json")


def _get_settings_path() -> Path:
    """Get the path to the Claude settings file."""
    return Path(CLAUDE_SETTINGS_PATH)


def _read_settings() -> dict:
    """Read the Claude settings file."""
    settings_path = _get_settings_path()

    if not settings_path.exists():
        return {}

    try:
        with open(settings_path, "r") as f:
            return json.load(f)
    except json.JSONDecodeError as e:
        logger.error(f"Invalid JSON in settings file: {e}")
        raise HTTPException(
            status_code=500,
            detail=f"Invalid JSON in settings file: {e}",
        )
    except Exception as e:
        logger.error(f"Error reading settings file: {e}")
        raise HTTPException(
            status_code=500,
            detail=f"Failed to read settings file: {e}",
        )


def _write_settings(settings: dict) -> None:
    """Write the Claude settings file."""
    settings_path = _get_settings_path()

    try:
        settings_path.parent.mkdir(parents=True, exist_ok=True)

        with open(settings_path, "w") as f:
            json.dump(settings, f, indent=2)
    except Exception as e:
        logger.error(f"Error writing settings file: {e}")
        raise HTTPException(
            status_code=500,
            detail=f"Failed to write settings file: {e}",
        )


@router.get("/env-vars", response_model=GetEnvVarsResponse)
async def get_env_vars():
    """Get all environment variables from ~/.claude/settings.json."""
    settings_path = _get_settings_path()

    if not settings_path.exists():
        return GetEnvVarsResponse(
            env_vars={},
            settings_path=CLAUDE_SETTINGS_PATH,
            exists=False,
        )

    settings = _read_settings()
    env_vars = settings.get("env", {})

    return GetEnvVarsResponse(
        env_vars=env_vars,
        settings_path=CLAUDE_SETTINGS_PATH,
        exists=True,
    )


@router.post("/env-vars", response_model=SetEnvVarResponse)
async def set_env_var(request: SetEnvVarRequest):
    """Set a single environment variable in ~/.claude/settings.json."""
    if not request.key or not request.key.strip():
        raise HTTPException(
            status_code=400,
            detail="Environment variable key cannot be empty",
        )

    settings = _read_settings()

    if "env" not in settings:
        settings["env"] = {}

    settings["env"][request.key] = request.value
    _write_settings(settings)

    return SetEnvVarResponse(
        status="success",
        message=f"Environment variable '{request.key}' set successfully",
        key=request.key,
    )


@router.delete("/env-vars/{key}", response_model=DeleteEnvVarResponse)
async def delete_env_var(key: str):
    """Delete an environment variable from ~/.claude/settings.json."""
    settings_path = _get_settings_path()

    if not settings_path.exists():
        raise HTTPException(status_code=404, detail="Settings file not found")

    settings = _read_settings()

    if "env" not in settings or key not in settings["env"]:
        raise HTTPException(
            status_code=404,
            detail=f"Environment variable '{key}' not found",
        )

    del settings["env"][key]
    _write_settings(settings)

    return DeleteEnvVarResponse(
        status="success",
        message=f"Environment variable '{key}' deleted successfully",
        key=key,
    )


@router.put("/env-vars", response_model=SetAllEnvVarsResponse)
async def set_all_env_vars(request: SetAllEnvVarsRequest):
    """Replace all environment variables in ~/.claude/settings.json."""
    settings = _read_settings()
    settings["env"] = request.env_vars
    _write_settings(settings)

    return SetAllEnvVarsResponse(
        status="success",
        message=f"Successfully set {len(request.env_vars)} environment variables",
        count=len(request.env_vars),
    )
