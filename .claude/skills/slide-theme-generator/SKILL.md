---
name: slide-theme-generator
description: Generate a cohesive slide theme (color palette, typography, layout tokens) from a user-provided keyword, brand color, or mood. Outputs a reusable CSS variable block that can be injected into every slide.
---

# Slide Theme Generator

When the user asks to create a presentation theme, set a color scheme, or define a visual style, generate a CSS custom-properties block that all subsequent slides can reference.

## Input

Accept any of the following:
- A keyword or mood (e.g. "corporate", "playful", "dark tech")
- A hex brand color (e.g. "#FF6B00")
- A reference image description

## Output Format

Return a single `<style>` block containing CSS custom properties on `:root`. The block must include **all** of the following tokens:

```css
:root {
  /* Palette */
  --slide-bg: <background>;
  --slide-bg-accent: <secondary background>;
  --slide-fg: <primary text>;
  --slide-fg-muted: <secondary text>;
  --slide-accent: <accent / highlight>;
  --slide-accent-hover: <accent variant>;

  /* Typography */
  --slide-font-title: <font stack for titles>;
  --slide-font-body: <font stack for body>;
  --slide-fs-title: 48px;
  --slide-fs-subtitle: 32px;
  --slide-fs-body: 22px;
  --slide-fs-caption: 16px;
  --slide-lh: 1.6;

  /* Spacing & Layout */
  --slide-pad: 60px;
  --slide-radius: 12px;
  --slide-shadow: 0 4px 24px rgba(0,0,0,0.1);
}
```

## Guidelines

1. Ensure WCAG AA contrast between `--slide-fg` and `--slide-bg` (ratio >= 4.5:1).
2. Pick complementary or analogous colors — avoid clashing hues.
3. Use Google Fonts that are commonly available; include `@import` if needed.
4. After outputting the theme block, briefly explain the palette choices (2-3 sentences).
5. If the user provides a brand color, derive the rest of the palette from it.
