"""Core session management components."""

from .session import AgentSession
from .session_manager import SessionManager
from .slide_detector import SlideDetector

__all__ = ["AgentSession", "SessionManager", "SlideDetector"]
