/**
 * Element Animation Engine
 *
 * Manages element enter/exit animations using GSAP.
 * Supports multiple animation types: fade, scale, slide, rotate, zoom, bounce, flip.
 */

import gsap from "gsap";
import * as THREE from "three";
import type {
  ElementAnimation,
  PreziElement,
  Rotation3D,
} from "@/types/prezi-types";

/**
 * Element Animator Class
 *
 * Manages animations for Prezi elements using GSAP.
 */
export class ElementAnimator {
  private animations: Map<string, gsap.core.Tween | gsap.core.Timeline> = new Map();

  /**
   * Play element enter animation
   *
   * @param element - Prezi element
   * @param targetRef - THREE.js object (Group or Mesh)
   * @param onComplete - Callback when animation completes
   */
  playEnterAnimation(
    element: PreziElement,
    targetRef: THREE.Group | THREE.Mesh,
    onComplete?: () => void
  ): void {
    if (!element.animation || element.animation.direction === "out") return;

    const config = element.animation;
    const duration = config.duration || 1;
    const ease = config.easing || "power2.out";
    const delay = config.delay || 0;

    // Stop any existing animation for this element
    this.stopAnimation(element.id);

    // ✨ Set initial state using Three.js methods
    this.setInitialState(targetRef, element, config);

    // ✨ Animate to final state using Three.js-compatible properties
    const finalState = this.getFinalStateForGSAP(targetRef, element, config);
    const tween = gsap.to(targetRef, {
      ...finalState,
      duration,
      ease,
      delay,
      onComplete: () => {
        this.animations.delete(element.id);
        onComplete?.();
      },
    });

    this.animations.set(element.id, tween);
  }

  /**
   * Play element exit animation
   *
   * @param element - Prezi element
   * @param targetRef - THREE.js object (Group or Mesh)
   * @param onComplete - Callback when animation completes
   */
  playExitAnimation(
    element: PreziElement,
    targetRef: THREE.Group | THREE.Mesh,
    onComplete?: () => void
  ): void {
    if (!element.animation || element.animation.direction === "in") return;

    const config = element.animation;
    const duration = config.duration || 1;
    const ease = config.easing || "power2.in";
    const delay = config.delay || 0;

    // Stop any existing animation
    this.stopAnimation(element.id);

    // ✨ Animate to exit state using Three.js-compatible properties
    const exitState = this.getExitStateForGSAP(targetRef, element, config);
    const tween = gsap.to(targetRef, {
      ...exitState,
      duration,
      ease,
      delay,
      onComplete: () => {
        this.animations.delete(element.id);
        onComplete?.();
      },
    });

    this.animations.set(element.id, tween);
  }

  /**
   * Stop animation for a specific element
   */
  stopAnimation(elementId: string): void {
    const tween = this.animations.get(elementId);
    if (tween) {
      tween.kill();
      this.animations.delete(elementId);
    }
  }

  /**
   * Stop all animations
   */
  stopAll(): void {
    for (const tween of this.animations.values()) {
      tween.kill();
    }
    this.animations.clear();
  }

  /**
   * ✨ Set initial state using Three.js methods (not GSAP)
   */
  private setInitialState(
    targetRef: THREE.Group | THREE.Mesh,
    element: PreziElement,
    config: ElementAnimation
  ): void {
    const startScale = config.startScale ?? 0.1;
    const startOpacity = config.startOpacity ?? 0;

    switch (config.type) {
      case "fade":
        // Only change opacity (via material if available)
        this.setOpacity(targetRef, startOpacity);
        break;

      case "scale":
        // Set scale directly
        targetRef.scale.set(startScale, startScale, startScale);
        break;

      case "zoom":
        // Prezi classic: zoom in from small + fade in
        targetRef.scale.set(startScale, startScale, startScale);
        this.setOpacity(targetRef, startOpacity);
        break;

      case "slide":
        // Slide from left by default
        targetRef.position.set(
          element.position.x - 500,
          element.position.y,
          element.position.z
        );
        this.setOpacity(targetRef, startOpacity);
        break;

      case "rotate":
        // Start with rotation offset
        const startRotation = config.rotation || { x: 0, y: Math.PI, z: 0 };
        targetRef.rotation.set(
          element.rotation.x + startRotation.x,
          element.rotation.y + startRotation.y,
          element.rotation.z + startRotation.z
        );
        this.setOpacity(targetRef, startOpacity);
        break;

      case "bounce":
        // Similar to scale but will use bounce easing
        targetRef.scale.set(startScale, startScale, startScale);
        break;

      case "flip":
        // Flip animation (rotate around Y axis)
        targetRef.rotation.set(
          element.rotation.x,
          element.rotation.y + Math.PI,
          element.rotation.z
        );
        this.setOpacity(targetRef, startOpacity);
        break;
    }
  }

  /**
   * ✨ Get final state for GSAP animation (references to Three.js properties)
   */
  private getFinalStateForGSAP(
    targetRef: THREE.Group | THREE.Mesh,
    element: PreziElement,
    config: ElementAnimation
  ): Record<string, any> {
    const endOpacity = config.endOpacity ?? element.opacity;

    // Return references to the actual Three.js properties
    // GSAP will animate these properties directly
    const finalState: Record<string, any> = {};

    // Always animate scale, rotation, position to final values
    finalState["scale.x"] = element.scale;
    finalState["scale.y"] = element.scale;
    finalState["scale.z"] = element.scale;

    finalState["rotation.x"] = element.rotation.x;
    finalState["rotation.y"] = element.rotation.y;
    finalState["rotation.z"] = element.rotation.z;

    finalState["position.x"] = element.position.x;
    finalState["position.y"] = element.position.y;
    finalState["position.z"] = element.position.z;

    // Handle opacity if material exists
    if ("material" in targetRef && targetRef.material) {
      if (Array.isArray(targetRef.material)) {
        // Multiple materials
        targetRef.material.forEach((mat, i) => {
          if (mat && "opacity" in mat) {
            finalState[`material[${i}].opacity`] = endOpacity;
          }
        });
      } else if ("opacity" in targetRef.material) {
        finalState["material.opacity"] = endOpacity;
      }
    }

    return finalState;
  }

  /**
   * ✨ Get exit state for GSAP animation
   */
  private getExitStateForGSAP(
    targetRef: THREE.Group | THREE.Mesh,
    element: PreziElement,
    config: ElementAnimation
  ): Record<string, any> {
    const endScale = config.endScale ?? 0.1;
    const endOpacity = config.endOpacity ?? 0;
    const exitState: Record<string, any> = {};

    switch (config.type) {
      case "fade":
        // Only opacity
        if ("material" in targetRef && targetRef.material) {
          if (Array.isArray(targetRef.material)) {
            targetRef.material.forEach((mat, i) => {
              if (mat && "opacity" in mat) {
                exitState[`material[${i}].opacity`] = endOpacity;
              }
            });
          } else if ("opacity" in targetRef.material) {
            exitState["material.opacity"] = endOpacity;
          }
        }
        break;

      case "scale":
        exitState["scale.x"] = endScale;
        exitState["scale.y"] = endScale;
        exitState["scale.z"] = endScale;
        break;

      case "zoom":
        exitState["scale.x"] = endScale;
        exitState["scale.y"] = endScale;
        exitState["scale.z"] = endScale;
        if ("material" in targetRef && targetRef.material) {
          if (Array.isArray(targetRef.material)) {
            targetRef.material.forEach((mat, i) => {
              if (mat && "opacity" in mat) {
                exitState[`material[${i}].opacity`] = endOpacity;
              }
            });
          } else if ("opacity" in targetRef.material) {
            exitState["material.opacity"] = endOpacity;
          }
        }
        break;

      case "slide":
        // Slide to right (opposite of enter)
        exitState["position.x"] = element.position.x + 500;
        exitState["position.y"] = element.position.y;
        exitState["position.z"] = element.position.z;
        if ("material" in targetRef && targetRef.material) {
          if (Array.isArray(targetRef.material)) {
            targetRef.material.forEach((mat, i) => {
              if (mat && "opacity" in mat) {
                exitState[`material[${i}].opacity`] = endOpacity;
              }
            });
          } else if ("opacity" in targetRef.material) {
            exitState["material.opacity"] = endOpacity;
          }
        }
        break;

      case "rotate":
        const exitRotation = config.rotation || { x: 0, y: Math.PI, z: 0 };
        exitState["rotation.x"] = element.rotation.x + exitRotation.x;
        exitState["rotation.y"] = element.rotation.y + exitRotation.y;
        exitState["rotation.z"] = element.rotation.z + exitRotation.z;
        if ("material" in targetRef && targetRef.material) {
          if (Array.isArray(targetRef.material)) {
            targetRef.material.forEach((mat, i) => {
              if (mat && "opacity" in mat) {
                exitState[`material[${i}].opacity`] = endOpacity;
              }
            });
          } else if ("opacity" in targetRef.material) {
            exitState["material.opacity"] = endOpacity;
          }
        }
        break;

      case "bounce":
        exitState["scale.x"] = endScale;
        exitState["scale.y"] = endScale;
        exitState["scale.z"] = endScale;
        break;

      case "flip":
        exitState["rotation.x"] = element.rotation.x;
        exitState["rotation.y"] = element.rotation.y + Math.PI;
        exitState["rotation.z"] = element.rotation.z;
        if ("material" in targetRef && targetRef.material) {
          if (Array.isArray(targetRef.material)) {
            targetRef.material.forEach((mat, i) => {
              if (mat && "opacity" in mat) {
                exitState[`material[${i}].opacity`] = endOpacity;
              }
            });
          } else if ("opacity" in targetRef.material) {
            exitState["material.opacity"] = endOpacity;
          }
        }
        break;

      default:
        // Default: just fade out
        if ("material" in targetRef && targetRef.material) {
          if (Array.isArray(targetRef.material)) {
            targetRef.material.forEach((mat, i) => {
              if (mat && "opacity" in mat) {
                exitState[`material[${i}].opacity`] = 0;
              }
            });
          } else if ("opacity" in targetRef.material) {
            exitState["material.opacity"] = 0;
          }
        }
    }

    return exitState;
  }

  /**
   * ✨ Helper: Set opacity on object (handles Groups and Meshes)
   */
  private setOpacity(targetRef: THREE.Group | THREE.Mesh, opacity: number): void {
    if ("material" in targetRef && targetRef.material) {
      if (Array.isArray(targetRef.material)) {
        targetRef.material.forEach((mat) => {
          if (mat && "opacity" in mat) {
            mat.opacity = opacity;
            mat.transparent = true;
          }
        });
      } else if ("opacity" in targetRef.material) {
        targetRef.material.opacity = opacity;
        targetRef.material.transparent = true;
      }
    }

    // Also check children for Groups
    if (targetRef instanceof THREE.Group) {
      targetRef.traverse((child) => {
        if (child instanceof THREE.Mesh && child.material) {
          if (Array.isArray(child.material)) {
            child.material.forEach((mat) => {
              if (mat && "opacity" in mat) {
                mat.opacity = opacity;
                mat.transparent = true;
              }
            });
          } else if ("opacity" in child.material) {
            child.material.opacity = opacity;
            child.material.transparent = true;
          }
        }
      });
    }
  }

  /**
   * Get animation status
   */
  isAnimating(elementId: string): boolean {
    return this.animations.has(elementId);
  }

  /**
   * Get number of active animations
   */
  getActiveCount(): number {
    return this.animations.size;
  }

  /**
   * ✨ Play enter animation with camera progress synchronization
   *
   * @param element - Prezi element
   * @param targetRef - THREE.js object
   * @param cameraProgress - Camera progress in current transition (0-1)
   * @param onComplete - Callback when animation completes
   */
  playEnterAnimationWithProgress(
    element: PreziElement,
    targetRef: THREE.Group | THREE.Mesh,
    cameraProgress: number,
    onComplete?: () => void
  ): void {
    if (!element.animation || element.animation.direction === "out") return;

    const config = element.animation;

    // ✨ Zoom Reveal 效果（如果启用）
    if (config.type === "zoom" && config.zoomReveal) {
      // 根据相机进度计算延迟
      const triggerPoint = config.triggerPoint ?? 0.5; // 默认相机 50% 时触发
      const progressDelay = Math.max(0, (triggerPoint - cameraProgress));

      this.playZoomRevealAnimation(
        targetRef,
        element,
        config,
        progressDelay,
        onComplete
      );
      return;
    }

    // 标准动画（原有逻辑 + 进度延迟）
    const duration = config.duration || 1;
    const ease = config.easing || "power2.out";
    const triggerPoint = config.triggerPoint ?? 0.3; // 默认相机 30% 时触发
    const progressDelay = Math.max(0, (triggerPoint - cameraProgress) * duration);
    const delay = (config.delay || 0) + progressDelay;

    this.stopAnimation(element.id);
    this.setInitialState(targetRef, element, config);

    const finalState = this.getFinalStateForGSAP(targetRef, element, config);
    const tween = gsap.to(targetRef, {
      ...finalState,
      duration,
      ease,
      delay,
      onComplete: () => {
        this.animations.delete(element.id);
        onComplete?.();
      },
    });

    this.animations.set(element.id, tween);
  }

  /**
   * ✨ Zoom Reveal Animation (Prezi signature effect)
   *
   * 3-stage animation:
   * - Stage 1: Fast zoom in (120% overshoot)
   * - Stage 2: Bounce back to normal
   * - Stage 3: Fade in (parallel)
   *
   * @param targetRef - THREE.js object
   * @param element - Prezi element
   * @param config - Animation configuration
   * @param delay - Delay in seconds
   * @param onComplete - Callback when complete
   */
  private playZoomRevealAnimation(
    targetRef: THREE.Group | THREE.Mesh,
    element: PreziElement,
    config: ElementAnimation,
    delay: number,
    onComplete?: () => void
  ): void {
    // Initial state: tiny + fully transparent
    targetRef.scale.set(0.1, 0.1, 0.1);
    this.setOpacity(targetRef, 0);

    // Create master timeline
    const masterTimeline = gsap.timeline({
      onComplete: () => {
        this.animations.delete(element.id);
        onComplete?.();
      },
    });

    // Stage 1: Fast Zoom In (0.3s) - overshoot to 120%
    masterTimeline.to(
      targetRef.scale,
      {
        x: element.scale * 1.2,
        y: element.scale * 1.2,
        z: element.scale * 1.2,
        duration: 0.3,
        ease: "power2.in",
        delay,
      },
      0
    );

    // Stage 2: Bounce back to normal (0.4s) - elastic effect
    masterTimeline.to(
      targetRef.scale,
      {
        x: element.scale,
        y: element.scale,
        z: element.scale,
        duration: 0.4,
        ease: "back.out(2)", // Parameter 2 = bounce strength
      },
      0.3
    );

    // Stage 3: Fade In (0.5s) - parallel with stages 1-2
    const opacityTimeline = gsap.timeline();

    // Quick fade to 50%
    opacityTimeline.to(
      {},
      {
        duration: 0.2,
        ease: "power1.in",
        onUpdate: () => {
          this.setOpacity(targetRef, 0.5 * opacityTimeline.progress());
        },
      }
    );

    // Slow fade to 100%
    opacityTimeline.to(
      {},
      {
        duration: 0.3,
        ease: "power1.out",
        onUpdate: () => {
          this.setOpacity(targetRef, 0.5 + 0.5 * opacityTimeline.progress());
        },
      }
    );

    masterTimeline.add(opacityTimeline, 0.2); // Start fading 0.2s after zoom

    // Optional: Slight rotation for dynamic feel
    if (config.rotation) {
      masterTimeline.to(
        targetRef.rotation,
        {
          x: element.rotation.x,
          y: element.rotation.y,
          z: element.rotation.z,
          duration: 0.5,
          ease: "power2.out",
        },
        0
      );
    }

    this.animations.set(element.id, masterTimeline);
  }
}

// ==================== Global Singleton ====================

let globalAnimator: ElementAnimator | null = null;

/**
 * Get global element animator instance (singleton)
 */
export function getElementAnimator(): ElementAnimator {
  if (!globalAnimator) {
    globalAnimator = new ElementAnimator();
  }
  return globalAnimator;
}

/**
 * Reset global animator (useful for cleanup/testing)
 */
export function resetElementAnimator(): void {
  if (globalAnimator) {
    globalAnimator.stopAll();
    globalAnimator = null;
  }
}
