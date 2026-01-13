/**
 * Animation Utilities for Modern UI
 *
 * Provides reusable animation variants for framer-motion
 * to create consistent, smooth animations across all Prezi components.
 */

/**
 * Standard animation variants for framer-motion
 * Use these with <motion.div variants={ANIMATION_VARIANTS.fadeIn}>
 */
export const ANIMATION_VARIANTS = {
  /**
   * Fade in from below
   * Perfect for: Cards, modals, tooltips
   */
  fadeIn: {
    initial: { opacity: 0, y: 10 },
    animate: { opacity: 1, y: 0 },
    exit: { opacity: 0, y: -10 },
    transition: { duration: 0.3, ease: [0.4, 0, 0.2, 1] },
  },

  /**
   * Scale in from center
   * Perfect for: Buttons, badges, icons
   */
  scaleIn: {
    initial: { opacity: 0, scale: 0.95 },
    animate: { opacity: 1, scale: 1 },
    exit: { opacity: 0, scale: 0.95 },
    transition: { duration: 0.2, ease: [0.4, 0, 0.2, 1] },
  },

  /**
   * Slide in from left
   * Perfect for: Sidebars, panels, notifications
   */
  slideIn: {
    initial: { opacity: 0, x: -20 },
    animate: { opacity: 1, x: 0 },
    exit: { opacity: 0, x: 20 },
    transition: { duration: 0.3, ease: [0.4, 0, 0.2, 1] },
  },

  /**
   * Slide in from right
   * Perfect for: Context menus, dropdowns
   */
  slideInRight: {
    initial: { opacity: 0, x: 20 },
    animate: { opacity: 1, x: 0 },
    exit: { opacity: 0, x: -20 },
    transition: { duration: 0.3, ease: [0.4, 0, 0.2, 1] },
  },

  /**
   * Expand from top
   * Perfect for: Accordions, collapsible sections
   */
  expand: {
    initial: { opacity: 0, height: 0 },
    animate: { opacity: 1, height: "auto" },
    exit: { opacity: 0, height: 0 },
    transition: { duration: 0.3, ease: [0.4, 0, 0.2, 1] },
  },

  /**
   * Bounce in
   * Perfect for: Success messages, celebrations
   */
  bounceIn: {
    initial: { opacity: 0, scale: 0.3 },
    animate: {
      opacity: 1,
      scale: 1,
      transition: {
        type: "spring",
        stiffness: 300,
        damping: 15,
      },
    },
    exit: { opacity: 0, scale: 0.8 },
  },

  /**
   * Rotate in
   * Perfect for: Loading spinners, refresh buttons
   */
  rotateIn: {
    initial: { opacity: 0, rotate: -180 },
    animate: { opacity: 1, rotate: 0 },
    exit: { opacity: 0, rotate: 180 },
    transition: { duration: 0.5, ease: [0.4, 0, 0.2, 1] },
  },
} as const;

/**
 * Hover animation variants
 * Use with whileHover prop: <motion.div whileHover="hover" variants={HOVER_VARIANTS.lift}>
 */
export const HOVER_VARIANTS = {
  /**
   * Lift up slightly
   * Perfect for: Cards, buttons
   */
  lift: {
    hover: {
      y: -2,
      scale: 1.02,
      transition: { duration: 0.2 },
    },
  },

  /**
   * Scale up
   * Perfect for: Icons, small buttons
   */
  scale: {
    hover: {
      scale: 1.1,
      transition: { duration: 0.2 },
    },
  },

  /**
   * Glow effect (increase shadow)
   * Perfect for: Primary actions, important elements
   */
  glow: {
    hover: {
      boxShadow: "0 8px 24px rgba(0, 0, 0, 0.15)",
      transition: { duration: 0.2 },
    },
  },

  /**
   * Tilt slightly
   * Perfect for: Interactive cards, playful elements
   */
  tilt: {
    hover: {
      rotateZ: 1,
      scale: 1.02,
      transition: { duration: 0.2 },
    },
  },
} as const;

/**
 * Tap/click animation variants
 * Use with whileTap prop: <motion.button whileTap="tap" variants={TAP_VARIANTS.shrink}>
 */
export const TAP_VARIANTS = {
  /**
   * Shrink on tap
   * Perfect for: All interactive elements
   */
  shrink: {
    tap: {
      scale: 0.95,
      transition: { duration: 0.1 },
    },
  },

  /**
   * Push down
   * Perfect for: Buttons
   */
  push: {
    tap: {
      y: 2,
      scale: 0.98,
      transition: { duration: 0.1 },
    },
  },
} as const;

/**
 * Stagger children animation
 * Use with staggerChildren in parent: <motion.div variants={staggerContainer}>
 */
export const staggerContainer = {
  initial: {},
  animate: {
    transition: {
      staggerChildren: 0.1,
      delayChildren: 0.1,
    },
  },
};

export const staggerItem = {
  initial: { opacity: 0, y: 10 },
  animate: { opacity: 1, y: 0 },
};

/**
 * Page transition variants
 * Use for route/page changes
 */
export const PAGE_TRANSITIONS = {
  fade: {
    initial: { opacity: 0 },
    animate: { opacity: 1 },
    exit: { opacity: 0 },
    transition: { duration: 0.3 },
  },

  slide: {
    initial: { opacity: 0, x: -20 },
    animate: { opacity: 1, x: 0 },
    exit: { opacity: 0, x: 20 },
    transition: { duration: 0.3, ease: [0.4, 0, 0.2, 1] },
  },

  scale: {
    initial: { opacity: 0, scale: 0.9 },
    animate: { opacity: 1, scale: 1 },
    exit: { opacity: 0, scale: 1.1 },
    transition: { duration: 0.3, ease: [0.4, 0, 0.2, 1] },
  },
} as const;

/**
 * Easing curves (cubic-bezier values)
 * Can be used in CSS transitions or JS animations
 */
export const EASING = {
  easeOut: [0.4, 0, 0.2, 1],
  easeIn: [0.4, 0, 1, 1],
  easeInOut: [0.4, 0, 0.2, 1],
  sharp: [0.4, 0, 0.6, 1],
  smooth: [0.25, 0.1, 0.25, 1],
} as const;

/**
 * Animation duration presets (in seconds)
 */
export const DURATION = {
  instant: 0.1,
  fast: 0.2,
  normal: 0.3,
  slow: 0.5,
  verySlow: 0.8,
} as const;

/**
 * Helper function to create custom animation variant
 */
export const createAnimationVariant = (config: {
  initial?: any;
  animate?: any;
  exit?: any;
  transition?: any;
}) => {
  return {
    initial: config.initial || {},
    animate: config.animate || {},
    exit: config.exit || {},
    transition: config.transition || { duration: DURATION.normal, ease: EASING.easeOut },
  };
};
