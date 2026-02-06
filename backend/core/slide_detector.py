"""
Slide Detection Module.

Extracts slide HTML content from agent responses using regex patterns.
Ported from the Next.js frontend implementation.
"""

import re
from dataclasses import dataclass
from typing import Optional


@dataclass
class DetectedSlide:
    """Represents a detected slide from agent output."""

    index: int
    html: str
    raw_content: str


class SlideDetector:
    """
    Detects and extracts slides from agent message content.

    Uses emoji markers to identify slide boundaries and extracts
    HTML content from code blocks within those boundaries.

    Patterns:
    - Slide markers: SLIDE_START:N ... SLIDE_END:N (with emoji markers)
    - HTML extraction: ```html-slide ... ``` or ```html ... ``` code blocks
    """

    # Pattern to match slide boundaries with emoji markers
    # Format: SLIDE_START:N ... SLIDE_END:N
    SLIDE_PATTERN = re.compile(
        r"\U0001F3AF"  # Target emoji
        r"SLIDE_START:(\d+)"
        r"\U0001F3AF"  # Target emoji
        r"([\s\S]*?)"
        r"\U0001F3AF"  # Target emoji
        r"SLIDE_END:\1"
        r"\U0001F3AF"  # Target emoji
    )

    # Pattern to extract HTML from html-slide code blocks (preferred)
    HTML_SLIDE_PATTERN = re.compile(r"```html-slide\s*([\s\S]*?)\s*```")

    # Fallback pattern for regular html code blocks
    HTML_PATTERN = re.compile(r"```html\s*([\s\S]*?)\s*```")

    def __init__(self):
        """Initialize the slide detector."""
        self._buffer = ""
        self._detected_slides: dict[int, DetectedSlide] = {}

    def reset(self):
        """Reset the detector state for a new message stream."""
        self._buffer = ""
        self._detected_slides.clear()

    def feed(self, content: str) -> list[DetectedSlide]:
        """
        Feed content to the detector and return any newly detected slides.

        Args:
            content: New content to process (can be partial)

        Returns:
            List of newly detected slides (may be empty)
        """
        self._buffer += content
        new_slides = []

        # Find all complete slide matches
        matches = list(self.SLIDE_PATTERN.finditer(self._buffer))

        for match in matches:
            slide_index = int(match.group(1))
            slide_content = match.group(2)

            # Skip if already detected
            if slide_index in self._detected_slides:
                continue

            # Extract HTML from the slide content
            html = self._extract_html(slide_content)

            if html:
                slide = DetectedSlide(
                    index=slide_index,
                    html=html,
                    raw_content=slide_content,
                )
                self._detected_slides[slide_index] = slide
                new_slides.append(slide)

        # Trim buffer to remove processed content
        if matches:
            last_match = matches[-1]
            self._buffer = self._buffer[last_match.end() :]

        return new_slides

    def _extract_html(self, content: str) -> Optional[str]:
        """
        Extract HTML from slide content.

        Tries html-slide code blocks first, then falls back to regular html blocks.

        Args:
            content: The slide content to extract HTML from

        Returns:
            Extracted HTML string or None if not found
        """
        # Try html-slide first (preferred format)
        match = self.HTML_SLIDE_PATTERN.search(content)
        if match:
            return match.group(1).strip()

        # Fallback to regular html blocks
        match = self.HTML_PATTERN.search(content)
        if match:
            html = match.group(1).strip()
            # Only accept if it looks like a complete HTML document or slide
            if html.startswith("<!DOCTYPE") or html.startswith("<html") or "<div" in html:
                return html

        return None

    def get_all_slides(self) -> list[DetectedSlide]:
        """
        Get all detected slides sorted by index.

        Returns:
            List of all detected slides in order
        """
        return sorted(self._detected_slides.values(), key=lambda s: s.index)

    def get_slide(self, index: int) -> Optional[DetectedSlide]:
        """
        Get a specific slide by index.

        Args:
            index: The slide index to retrieve

        Returns:
            The detected slide or None if not found
        """
        return self._detected_slides.get(index)

    @classmethod
    def extract_slides_from_text(cls, text: str) -> list[DetectedSlide]:
        """
        One-shot extraction of all slides from complete text.

        Useful for processing complete messages rather than streams.

        Args:
            text: Complete text to extract slides from

        Returns:
            List of detected slides
        """
        detector = cls()
        detector.feed(text)
        return detector.get_all_slides()

    @classmethod
    def extract_html_from_message(cls, content: str) -> Optional[str]:
        """
        Extract HTML from a single message content.

        Tries html-slide code blocks first, then falls back to regular html blocks.

        Args:
            content: The message content to extract HTML from

        Returns:
            Extracted HTML string or None if not found
        """
        # Try html-slide first (preferred format)
        match = cls.HTML_SLIDE_PATTERN.search(content)
        if match:
            return match.group(1).strip()

        # Fallback to regular html blocks
        match = cls.HTML_PATTERN.search(content)
        if match:
            html = match.group(1).strip()
            # Only accept if it looks like a complete HTML document or slide
            if html.startswith("<!DOCTYPE") or html.startswith("<html") or "<div" in html:
                return html

        return None
