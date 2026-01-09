/**
 * Theme Utilities for Prezi Editor
 *
 * Provides color conversion and CSS variable management for theme integration.
 */

interface ThemeColors {
  primary: string;
  secondary: string;
  accent: string;
  background: string;
  text: string;
  heading: string;
  muted: string;
}

/**
 * Convert hex color to HSL format for CSS variables
 * Returns format: "220 70% 50%" (H S% L%)
 */
export function hexToHSL(hex: string): string {
  // Remove # if present
  hex = hex.replace("#", "");

  // Convert to RGB (0-1 range)
  const r = parseInt(hex.substring(0, 2), 16) / 255;
  const g = parseInt(hex.substring(2, 4), 16) / 255;
  const b = parseInt(hex.substring(4, 6), 16) / 255;

  // Calculate HSL
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  let h = 0,
    s = 0,
    l = (max + min) / 2;

  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);

    switch (max) {
      case r:
        h = ((g - b) / d + (g < b ? 6 : 0)) / 6;
        break;
      case g:
        h = ((b - r) / d + 2) / 6;
        break;
      case b:
        h = ((r - g) / d + 4) / 6;
        break;
    }
  }

  // Convert to CSS format: "H S% L%"
  return `${Math.round(h * 360)} ${Math.round(s * 100)}% ${Math.round(l * 100)}%`;
}

/**
 * Update Prezi editor UI CSS variables
 * Maps theme colors to --prezi-ui-* CSS variables
 */
export function updatePreziUIVariables(themeColors: ThemeColors): void {
  if (typeof window === "undefined") return; // SSR check

  const root = document.documentElement;

  // Convert and set UI variables
  root.style.setProperty("--prezi-ui-bg", hexToHSL(themeColors.background));
  root.style.setProperty("--prezi-ui-fg", hexToHSL(themeColors.text));
  root.style.setProperty("--prezi-ui-primary", hexToHSL(themeColors.primary));
  root.style.setProperty(
    "--prezi-ui-secondary",
    hexToHSL(themeColors.secondary)
  );
  root.style.setProperty("--prezi-ui-accent", hexToHSL(themeColors.accent));
  root.style.setProperty("--prezi-ui-muted", hexToHSL(themeColors.muted));
  root.style.setProperty("--prezi-ui-heading", hexToHSL(themeColors.heading));

  // Set active state (same as primary)
  root.style.setProperty("--prezi-ui-active", hexToHSL(themeColors.primary));

  // Set hover state (same as accent)
  root.style.setProperty("--prezi-ui-hover", hexToHSL(themeColors.accent));
}

/**
 * Get danger color (red) - consistent across all themes
 */
export function getDangerColor(): string {
  return "0 84.2% 60.2%"; // HSL for red-600
}

/**
 * Get warning color (orange) - consistent across all themes
 */
export function getWarningColor(): string {
  return "25 95% 53%"; // HSL for orange-500
}

/**
 * Get success color (green) - consistent across all themes
 */
export function getSuccessColor(): string {
  return "142 76% 36%"; // HSL for green-600
}

/**
 * Adjust color opacity (for inline styles)
 * Converts hex to rgba
 */
export function adjustColorOpacity(color: string, opacity: number): string {
  let r = 0,
    g = 0,
    b = 0;

  if (color.startsWith("#")) {
    const hex = color.substring(1);
    if (hex.length === 6) {
      r = parseInt(hex.substring(0, 2), 16);
      g = parseInt(hex.substring(2, 4), 16);
      b = parseInt(hex.substring(4, 6), 16);
    } else if (hex.length === 3) {
      r = parseInt(hex[0]! + hex[0], 16);
      g = parseInt(hex[1]! + hex[1], 16);
      b = parseInt(hex[2]! + hex[2], 16);
    }
  }

  return `rgba(${r}, ${g}, ${b}, ${opacity})`;
}
