/**
 * usePreziTheme Hook
 *
 * Unified theme management for Prezi editor.
 * Handles:
 * - Theme color resolution (light/dark mode)
 * - SSR hydration safety
 * - CSS variable synchronization
 * - Custom theme support
 */

import { useState, useEffect } from "react";
import { useTheme } from "next-themes";
import { usePresentationState } from "@/states/presentation-state";
import { themes, setThemeVariables } from "@/lib/presentation/themes";

interface ThemeColors {
  primary: string;
  secondary: string;
  accent: string;
  background: string;
  text: string;
  heading: string;
  muted: string;

  // ✨ Modern UI extensions
  gradientStart?: string;
  gradientEnd?: string;
  gradientAccent?: string;
  glassBackground?: string;
  glassBorder?: string;
  shadowColor?: string;
}

interface UsePreziThemeReturn {
  mounted: boolean;
  isDark: boolean;
  themeColors: ThemeColors;
  resolvedTheme: string | undefined;
}

/**
 * Hook to get Prezi editor theme colors
 *
 * Usage:
 * ```tsx
 * const { mounted, themeColors, isDark } = usePreziTheme();
 *
 * if (!mounted) {
 *   return <LoadingSkeleton />; // Avoid hydration mismatch
 * }
 * ```
 */
export function usePreziTheme(): UsePreziThemeReturn {
  const [mounted, setMounted] = useState(false);
  const { resolvedTheme } = useTheme();
  const presentationTheme = usePresentationState((s) => s.theme);
  const customThemeData = usePresentationState((s) => s.customThemeData);

  // Handle hydration
  useEffect(() => {
    setMounted(true);
  }, []);

  // Ensure theme variables are set whenever theme changes
  useEffect(() => {
    if (mounted && resolvedTheme) {
      const themeData =
        customThemeData ||
        themes[presentationTheme as keyof typeof themes] ||
        themes.mystique;
      const isDark = resolvedTheme === "dark";

      // Apply theme CSS variables
      setThemeVariables(themeData, isDark);

      // Debug logging (development only)
      if (process.env.NODE_ENV === "development") {
        console.log("[usePreziTheme] Theme applied:", {
          theme: presentationTheme,
          isDark,
          resolvedTheme,
          colors: isDark ? themeData.colors.dark : themeData.colors.light,
        });
      }
    }
  }, [mounted, resolvedTheme, presentationTheme, customThemeData]);

  // Determine dark mode (safe during SSR)
  const isDark = mounted ? resolvedTheme === "dark" : false;

  // Resolve theme colors
  const themeColors: ThemeColors = customThemeData
    ? isDark
      ? customThemeData.colors.dark
      : customThemeData.colors.light
    : themes[presentationTheme as keyof typeof themes]?.colors?.[
        isDark ? "dark" : "light"
      ] || themes.mystique.colors[isDark ? "dark" : "light"];

  // Warning for invalid theme (development only)
  useEffect(() => {
    if (
      process.env.NODE_ENV === "development" &&
      mounted &&
      !customThemeData &&
      !themes[presentationTheme as keyof typeof themes]
    ) {
      console.error(
        `[usePreziTheme] Invalid theme: ${presentationTheme}, using fallback`
      );
    }
  }, [mounted, presentationTheme, customThemeData]);

  return {
    mounted,
    isDark,
    themeColors,
    resolvedTheme,
  };
}
