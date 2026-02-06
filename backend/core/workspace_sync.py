"""
Workspace synchronization utilities for S3.

Provides functions to sync user .claude directories from S3 to local filesystem
using s5cmd for high-performance parallel transfers.
"""

import asyncio
import logging
import os
import shutil
from pathlib import Path
from typing import Optional

from .s3_client import S3Client, S3ClientError

logger = logging.getLogger(__name__)


class WorkspaceSyncError(Exception):
    """Exception raised when workspace sync fails."""
    pass


def check_s5cmd_installed() -> bool:
    """
    Check if s5cmd is installed and available.

    Returns:
        bool: True if s5cmd is installed, False otherwise
    """
    return shutil.which("s5cmd") is not None


async def check_s3_directory_exists(
    bucket_name: str,
    s3_prefix: str,
) -> bool:
    """
    Check if a directory exists in S3.

    Args:
        bucket_name: S3 bucket name
        s3_prefix: S3 key prefix to check

    Returns:
        bool: True if directory exists and has objects, False otherwise
    """
    if not check_s5cmd_installed():
        logger.warning("s5cmd not installed, cannot check S3 directory")
        return False

    s3_path = f"s3://{bucket_name}/{s3_prefix}/"

    try:
        process = await asyncio.create_subprocess_exec(
            "s5cmd",
            "--log", "error",
            "ls",
            s3_path,
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE,
        )

        stdout, stderr = await process.communicate()
        stdout_text = stdout.decode() if stdout else ""

        return bool(stdout_text.strip())

    except Exception as e:
        logger.error(f"Failed to check S3 directory: {e}")
        return False


async def sync_claude_dir_from_s3(
    user_id: str,
    bucket_name: str,
    s3_prefix: str = "user_data",
    local_home: Optional[str] = None,
) -> dict:
    """
    Sync .claude directory from S3 to local ~/.claude for a user.

    Args:
        user_id: User ID
        bucket_name: S3 bucket name
        s3_prefix: S3 key prefix (default: "user_data")
        local_home: Local home directory (default: from HOME env var)

    Returns:
        dict: Sync result with status, local_path, files_synced, etc.

    Raises:
        WorkspaceSyncError: If sync fails
    """
    try:
        s3_client = S3Client(bucket_name, s3_prefix)
    except S3ClientError as e:
        raise WorkspaceSyncError(str(e)) from e

    # Get home directory
    if local_home is None:
        local_home = os.environ.get("HOME", "/root")

    local_claude_dir = Path(local_home) / ".claude"

    # Check if S3 directory exists
    s3_exists = await s3_client.check_exists(user_id, ".claude")
    s3_path = s3_client.build_s3_path(user_id, ".claude") + "/"

    logger.info(f"Checking if .claude data exists in S3: {s3_path}")

    if not s3_exists:
        logger.info(f"No .claude data found in S3 for user {user_id}")
        return {
            "status": "skipped",
            "user_id": user_id,
            "s3_path": s3_path,
            "local_path": str(local_claude_dir),
            "message": "No .claude data found in S3",
            "files_synced": 0,
        }

    try:
        result = await s3_client.sync_from_s3(
            [user_id, ".claude"],
            local_claude_dir,
        )

        result["user_id"] = user_id
        result["message"] = f"Successfully synced {result['files_synced']} files from S3"

        logger.info(f".claude sync completed: {result['files_synced']} files from S3")
        return result

    except S3ClientError as e:
        error_msg = f"Failed to sync .claude directory: {str(e)}"
        logger.error(error_msg)
        raise WorkspaceSyncError(error_msg) from e


async def backup_claude_dir_to_s3(
    user_id: str,
    bucket_name: str,
    s3_prefix: str = "user_data",
    local_home: Optional[str] = None,
) -> dict:
    """
    Backup .claude directory from local ~/.claude to S3.

    Args:
        user_id: User ID
        bucket_name: S3 bucket name
        s3_prefix: S3 key prefix (default: "user_data")
        local_home: Local home directory (default: from HOME env var)

    Returns:
        dict: Backup result with status, s3_path, files_synced, etc.

    Raises:
        WorkspaceSyncError: If backup fails
    """
    try:
        s3_client = S3Client(bucket_name, s3_prefix)
    except S3ClientError as e:
        raise WorkspaceSyncError(str(e)) from e

    # Get home directory
    if local_home is None:
        local_home = os.environ.get("HOME", "/root")

    local_claude_dir = Path(local_home) / ".claude"

    try:
        result = await s3_client.sync_to_s3(
            local_claude_dir,
            [user_id, ".claude"],
        )

        if result["status"] == "skipped":
            result["user_id"] = user_id
            logger.debug(f"No .claude directory found for user {user_id}")
            return result

        result["user_id"] = user_id
        result["message"] = f"Successfully backed up {result['files_synced']} files to S3"

        logger.info(f".claude backup completed: {result['files_synced']} files to S3")
        return result

    except S3ClientError as e:
        error_msg = f"Failed to backup .claude directory: {str(e)}"
        logger.error(error_msg)
        raise WorkspaceSyncError(error_msg) from e
