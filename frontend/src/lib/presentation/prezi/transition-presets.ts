/**
 * Transition Presets for Prezi Presentations
 *
 * Defines 15+ preset transition effects with GSAP-compatible configurations.
 * Each preset includes easing, duration, and advanced parameters like
 * multi-stage animations and bezier curves.
 */

import { type TransitionConfig, type TransitionType } from "@/types/prezi-types";

/**
 * Complete library of transition presets
 * Maps transition type to its full configuration
 */
export const TRANSITION_PRESETS: Record<TransitionType, TransitionConfig> = {
  // ==================== Basic Easing (Existing) ====================

  linear: {
    type: "linear",
    duration: 1,
    description: "Constant speed from start to finish",
  },

  ease: {
    type: "ease",
    duration: 1,
    description: "Smooth acceleration and deceleration",
  },

  "ease-in": {
    type: "ease-in",
    duration: 1,
    description: "Slow start, then accelerates",
  },

  "ease-out": {
    type: "ease-out",
    duration: 1,
    description: "Fast start, then decelerates",
  },

  "ease-in-out": {
    type: "ease-in-out",
    duration: 1,
    description: "Smooth start and smooth finish",
  },

  // ==================== Elastic Easing (Bouncy, Spring-like) ====================

  "elastic-in": {
    type: "elastic-in",
    duration: 1.2,
    intensity: 0.7,
    description: "Springs into place with elastic bounce at start",
  },

  "elastic-out": {
    type: "elastic-out",
    duration: 1.2,
    intensity: 0.7,
    description: "Springs into place with elastic bounce at end",
  },

  "elastic-in-out": {
    type: "elastic-in-out",
    duration: 1.5,
    intensity: 0.6,
    description: "Elastic bounce at both start and end",
  },

  // ==================== Bounce Easing (Bouncing Effect) ====================

  "bounce-in": {
    type: "bounce-in",
    duration: 1,
    intensity: 0.8,
    description: "Bounces in like a ball dropping",
  },

  "bounce-out": {
    type: "bounce-out",
    duration: 1,
    intensity: 0.8,
    description: "Bounces out like a ball bouncing away",
  },

  "bounce-in-out": {
    type: "bounce-in-out",
    duration: 1.3,
    intensity: 0.7,
    description: "Bounces at both start and end",
  },

  // ==================== Back Easing (Overshoots and Returns) ====================

  "back-in": {
    type: "back-in",
    duration: 0.8,
    intensity: 0.6,
    description: "Pulls back before moving forward",
  },

  "back-out": {
    type: "back-out",
    duration: 0.8,
    intensity: 0.6,
    description: "Overshoots target then settles back",
  },

  "back-in-out": {
    type: "back-in-out",
    duration: 1,
    intensity: 0.5,
    description: "Pulls back at start, overshoots at end",
  },

  // ==================== Cinematic Effects ====================

  swoop: {
    type: "swoop",
    duration: 2,
    intensity: 0.8,
    pathCurve: "bezier",
    description: "Elegant swooping motion from above",
    stages: [
      { percentage: 0, easing: "power2.in" },
      { percentage: 0.6, easing: "linear" },
      { percentage: 1, easing: "power2.out" },
    ],
  },

  dive: {
    type: "dive",
    duration: 1.5,
    intensity: 1,
    pathCurve: "arc",
    description: "Fast diving motion toward target",
    stages: [
      { percentage: 0, easing: "power3.in" },
      { percentage: 0.7, easing: "power2.out" },
      { percentage: 1, easing: "linear" },
    ],
  },

  orbit: {
    type: "orbit",
    duration: 3,
    pathCurve: "arc",
    description: "Circular orbiting motion around target",
    stages: [
      { percentage: 0, easing: "power1.inOut" },
      {
        percentage: 0.5,
        easing: "linear",
        cameraAdjustment: {
          rotation: { x: 0, y: Math.PI / 3, z: 0 }, // 60° rotation midway
        },
      },
      { percentage: 1, easing: "power1.inOut" },
    ],
  },

  spiral: {
    type: "spiral",
    duration: 2.5,
    pathCurve: "bezier",
    description: "Spiraling motion while approaching target",
    stages: [
      { percentage: 0, easing: "power2.in" },
      {
        percentage: 0.33,
        easing: "linear",
        cameraAdjustment: {
          rotation: { x: 0, y: Math.PI / 6, z: 0 },
        },
      },
      {
        percentage: 0.66,
        easing: "linear",
        cameraAdjustment: {
          rotation: { x: 0, y: -Math.PI / 6, z: 0 },
        },
      },
      { percentage: 1, easing: "power2.out" },
    ],
  },

  // ==================== Prezi-Style Signature Effects ====================

  "zoom-reveal": {
    type: "zoom-reveal",
    duration: 2,
    pathCurve: "arc",
    description: "Classic Prezi zoom: zoom out, pan, zoom in",
    stages: [
      {
        percentage: 0,
        easing: "power2.in",
      },
      {
        percentage: 0.3,
        easing: "linear",
      },
      {
        percentage: 1,
        easing: "back.out(1.2)",
      },
    ],
  },

  "pan-zoom": {
    type: "pan-zoom",
    duration: 1.8,
    pathCurve: "straight",
    description: "Smooth pan followed by zoom into detail",
    stages: [
      {
        percentage: 0,
        easing: "power1.inOut",
      },
      {
        percentage: 0.5,
        easing: "linear",
      },
      {
        percentage: 1,
        easing: "power3.out",
      },
    ],
  },

  "focus-shift": {
    type: "focus-shift",
    duration: 1.5,
    description: "Quick focus shift between elements",
    stages: [
      {
        percentage: 0,
        easing: "power3.in",
      },
      {
        percentage: 0.4,
        easing: "power1.out",
      },
      {
        percentage: 1,
        easing: "power2.out",
      },
    ],
  },
};

/**
 * Get preset by transition type
 * @param type - Transition type
 * @returns Transition configuration or default
 */
export const getTransitionPreset = (type: TransitionType): TransitionConfig => {
  return TRANSITION_PRESETS[type] || TRANSITION_PRESETS["ease-in-out"];
};

/**
 * Get all available transition types grouped by category
 */
export const TRANSITION_CATEGORIES = {
  basic: {
    label: "Basic Easing",
    types: ["linear", "ease", "ease-in", "ease-out", "ease-in-out"] as TransitionType[],
  },
  elastic: {
    label: "Elastic & Spring",
    types: ["elastic-in", "elastic-out", "elastic-in-out"] as TransitionType[],
  },
  bounce: {
    label: "Bounce",
    types: ["bounce-in", "bounce-out", "bounce-in-out"] as TransitionType[],
  },
  back: {
    label: "Back & Overshoot",
    types: ["back-in", "back-out", "back-in-out"] as TransitionType[],
  },
  cinematic: {
    label: "Cinematic",
    types: ["swoop", "dive", "orbit", "spiral"] as TransitionType[],
  },
  prezi: {
    label: "Prezi Signature",
    types: ["zoom-reveal", "pan-zoom", "focus-shift"] as TransitionType[],
  },
} as const;

/**
 * Map TransitionType to GSAP easing string
 * Used by CameraAnimator to convert preset types to GSAP-compatible easing
 */
export const TRANSITION_TYPE_TO_GSAP_EASING: Record<TransitionType, string> = {
  // Basic
  linear: "none",
  ease: "power1.inOut",
  "ease-in": "power2.in",
  "ease-out": "power2.out",
  "ease-in-out": "power2.inOut",

  // Elastic
  "elastic-in": "elastic.in(1, 0.7)",
  "elastic-out": "elastic.out(1, 0.7)",
  "elastic-in-out": "elastic.inOut(1, 0.6)",

  // Bounce
  "bounce-in": "bounce.in",
  "bounce-out": "bounce.out",
  "bounce-in-out": "bounce.inOut",

  // Back
  "back-in": "back.in(1.2)",
  "back-out": "back.out(1.2)",
  "back-in-out": "back.inOut(1)",

  // Cinematic (use stages instead)
  swoop: "power2.inOut",
  dive: "power3.in",
  orbit: "power1.inOut",
  spiral: "power2.inOut",

  // Prezi signature (use stages instead)
  "zoom-reveal": "power2.inOut",
  "pan-zoom": "power1.inOut",
  "focus-shift": "power2.out",
};

/**
 * Get recommended duration for a transition type
 * @param type - Transition type
 * @returns Recommended duration in seconds
 */
export const getRecommendedDuration = (type: TransitionType): number => {
  const preset = TRANSITION_PRESETS[type];
  return preset?.duration || 1;
};

/**
 * Check if transition supports multi-stage animation
 */
export const hasMultiStageAnimation = (type: TransitionType): boolean => {
  const preset = TRANSITION_PRESETS[type];
  return !!(preset.stages && preset.stages.length > 0);
};

/**
 * Check if transition uses bezier curve path
 */
export const usesBezierPath = (type: TransitionType): boolean => {
  const preset = TRANSITION_PRESETS[type];
  return preset.pathCurve === "bezier";
};
