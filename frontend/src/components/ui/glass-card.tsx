/**
 * GlassCard Component
 *
 * Modern glass morphism card with backdrop blur and transparency.
 * Provides a premium, modern look for UI elements.
 */

import * as React from "react";
import { cn } from "@/lib/utils";
import { Card } from "@/components/ui/card";

export interface GlassCardProps extends React.HTMLAttributes<HTMLDivElement> {
  /**
   * Blur intensity (0-24px)
   * @default 12
   */
  blur?: number;

  /**
   * Background opacity (0-1)
   * @default 0.7
   */
  opacity?: number;

  /**
   * Border opacity (0-1)
   * @default 0.2
   */
  borderOpacity?: number;

  /**
   * Enable hover effect
   * @default true
   */
  hoverable?: boolean;

  /**
   * Custom glass background color (rgba)
   */
  glassBackground?: string;

  /**
   * Custom border color (rgba)
   */
  glassBorder?: string;
}

/**
 * GlassCard - Glass morphism card component
 */
const GlassCard = React.forwardRef<HTMLDivElement, GlassCardProps>(
  (
    {
      className,
      blur = 12,
      opacity = 0.7,
      borderOpacity = 0.2,
      hoverable = true,
      glassBackground,
      glassBorder,
      style,
      children,
      ...props
    },
    ref
  ) => {
    // Default glass colors (fallback if not provided by theme)
    const defaultGlassBackground = glassBackground || `rgba(255, 255, 255, ${opacity})`;
    const defaultGlassBorder = glassBorder || `rgba(255, 255, 255, ${borderOpacity})`;

    return (
      <Card
        ref={ref}
        className={cn(
          "transition-all duration-300",
          hoverable && "hover:scale-[1.02] hover:shadow-lg",
          className
        )}
        style={{
          background: defaultGlassBackground,
          backdropFilter: `blur(${blur}px) saturate(180%)`,
          WebkitBackdropFilter: `blur(${blur}px) saturate(180%)`, // Safari support
          border: `1px solid ${defaultGlassBorder}`,
          ...style,
        }}
        {...props}
      >
        {children}
      </Card>
    );
  }
);

GlassCard.displayName = "GlassCard";

export { GlassCard };
