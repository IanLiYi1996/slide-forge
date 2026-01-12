/**
 * CameraAnimator (重构版)
 *
 * 核心改进：
 * 1. 虚拟相机对象 - GSAP 直接驱动相机属性
 * 2. 预创建模式 - 消除播放启动延迟
 * 3. 扩展缓动函数 - 20+ 种高级缓动
 * 4. 单关键帧支持 - 自动飞入动画
 */

import gsap from "gsap";
import { type CameraState, type PresentationPath } from "@/types/prezi-types";

/**
 * Camera Animator Class
 */
export class CameraAnimator {
  private timeline: gsap.core.Timeline | null = null;
  private isReady: boolean = false;
  private isPlaying: boolean = false;
  private isPaused: boolean = false;

  // ✨ 虚拟相机对象（GSAP 直接操作这些属性）
  private virtualCamera = {
    px: 0,
    py: 0,
    pz: 1000,
    tx: 0,
    ty: 0,
    tz: 0,
    zoom: 1,
    keyframeIndex: 0,
  };

  /**
   * ✨ 预创建 Timeline（path 变化时调用，不是播放时）
   *
   * 关键优化：Timeline 在 path 加载时立即创建（paused状态）
   * 当用户点击播放时，只需调用 play()，无需等待创建
   */
  prepareTimeline(
    path: PresentationPath,
    callbacks: {
      onKeyframeChange?: (index: number) => void;
      onProgress?: (index: number, progress: number) => void;
      onComplete?: () => void;
    } = {}
  ): void {
    // 清理旧 timeline
    if (this.timeline) {
      this.timeline.kill();
      this.timeline = null;
    }

    if (!path || path.keyframes.length === 0) {
      console.warn("[CameraAnimator] Path is empty, cannot prepare timeline");
      this.isReady = false;
      return;
    }

    // 设置初始虚拟相机状态
    const firstKf = path.keyframes[0];
    if (!firstKf) return;

    this.virtualCamera.px = firstKf.camera.position.x;
    this.virtualCamera.py = firstKf.camera.position.y;
    this.virtualCamera.pz = firstKf.camera.position.z;
    this.virtualCamera.tx = firstKf.camera.target.x;
    this.virtualCamera.ty = firstKf.camera.target.y;
    this.virtualCamera.tz = firstKf.camera.target.z;
    this.virtualCamera.zoom = firstKf.camera.zoom;
    this.virtualCamera.keyframeIndex = 0;

    // ✨ 特殊处理：单关键帧自动飞入
    if (path.keyframes.length === 1) {
      this.prepareSingleKeyframeTimeline(path, callbacks);
      return;
    }

    // 创建新 timeline（paused 状态）
    this.timeline = gsap.timeline({
      paused: true,
      onComplete: () => {
        if (callbacks.onComplete) callbacks.onComplete();
      },
    });

    // 构建关键帧动画
    path.keyframes.forEach((kf, i) => {
      const next = path.keyframes[i + 1];
      if (!next) return;

      // ✨ GSAP 直接驱动虚拟相机属性（不再动画空对象！）
      this.timeline!.to(
        this.virtualCamera,
        {
          px: next.camera.position.x,
          py: next.camera.position.y,
          pz: next.camera.position.z,
          tx: next.camera.target.x,
          ty: next.camera.target.y,
          tz: next.camera.target.z,
          zoom: next.camera.zoom,
          keyframeIndex: i + 1,
          duration: kf.transition?.duration || 1,
          ease: this.getEase(kf.transition?.type || "ease-in-out"),
          onStart: () => {
            if (callbacks.onKeyframeChange) {
              callbacks.onKeyframeChange(i + 1);
            }
          },
          onUpdate: () => {
            if (callbacks.onProgress) {
              callbacks.onProgress(
                Math.floor(this.virtualCamera.keyframeIndex),
                this.timeline!.progress()
              );
            }
          },
        },
        ">" // Sequential
      );

      // 停留时间
      if (kf.duration > 0) {
        this.timeline!.to({}, { duration: kf.duration }, ">");
      }
    });

    // Loop if needed
    if (path.loop) {
      this.timeline.repeat(-1);
    }

    this.isReady = true;
    console.log(`[CameraAnimator] Timeline prepared with ${path.keyframes.length} keyframes`);
  }

  /**
   * ✨ 单关键帧特殊处理：从远景飞入
   */
  private prepareSingleKeyframeTimeline(
    path: PresentationPath,
    callbacks: {
      onKeyframeChange?: (index: number) => void;
      onProgress?: (index: number, progress: number) => void;
      onComplete?: () => void;
    }
  ): void {
    const kf = path.keyframes[0];
    if (!kf) return;

    // 从远景起点
    this.virtualCamera.px = 0;
    this.virtualCamera.py = 0;
    this.virtualCamera.pz = 3000;
    this.virtualCamera.tx = 0;
    this.virtualCamera.ty = 0;
    this.virtualCamera.tz = 0;

    this.timeline = gsap.timeline({
      paused: true,
      onComplete: callbacks.onComplete,
    });

    // 飞入动画（2秒）
    this.timeline.to(this.virtualCamera, {
      px: kf.camera.position.x,
      py: kf.camera.position.y,
      pz: kf.camera.position.z,
      tx: kf.camera.target.x,
      ty: kf.camera.target.y,
      tz: kf.camera.target.z,
      zoom: kf.camera.zoom,
      keyframeIndex: 0,
      duration: 2,
      ease: "power2.inOut",
      onStart: () => {
        if (callbacks.onKeyframeChange) callbacks.onKeyframeChange(0);
      },
      onUpdate: () => {
        if (callbacks.onProgress) {
          callbacks.onProgress(0, this.timeline!.progress());
        }
      },
    });

    // 停留
    if (kf.duration > 0) {
      this.timeline.to({}, { duration: kf.duration });
    }

    this.isReady = true;
    console.log("[CameraAnimator] Single keyframe timeline prepared with fly-in animation");
  }

  /**
   * ✨ 获取当前虚拟相机状态（PreziCamera 直接读取）
   */
  getVirtualCameraState(): CameraState {
    return {
      position: {
        x: this.virtualCamera.px,
        y: this.virtualCamera.py,
        z: this.virtualCamera.pz,
      },
      target: {
        x: this.virtualCamera.tx,
        y: this.virtualCamera.ty,
        z: this.virtualCamera.tz,
      },
      zoom: this.virtualCamera.zoom,
    };
  }

  /**
   * Get current keyframe index
   */
  getCurrentKeyframeIndex(): number {
    return Math.floor(this.virtualCamera.keyframeIndex);
  }

  /**
   * ✨ 即时播放（无延迟）
   */
  play(): boolean {
    if (!this.isReady || !this.timeline) {
      console.warn("[CameraAnimator] Timeline not ready, cannot play");
      return false;
    }

    this.timeline.play();
    this.isPlaying = true;
    this.isPaused = false;
    return true;
  }

  /**
   * Pause playback
   */
  pause(): void {
    if (this.timeline) {
      this.timeline.pause();
      this.isPaused = true;
      this.isPlaying = false;
    }
  }

  /**
   * Stop playback (pause + reset to start)
   */
  stop(): void {
    if (this.timeline) {
      this.timeline.pause();
      this.timeline.progress(0);
      this.isPaused = false;
      this.isPlaying = false;
    }
  }

  /**
   * Resume playback
   */
  resume(): void {
    if (this.timeline && this.isPaused) {
      this.timeline.resume();
      this.isPlaying = true;
      this.isPaused = false;
    }
  }

  /**
   * ✨ 跳转到指定关键帧（支持逐帧切换）
   */
  jumpToKeyframe(index: number, path: PresentationPath): void {
    if (!this.timeline || index < 0 || index >= path.keyframes.length) {
      console.warn(`[CameraAnimator] Cannot jump to keyframe ${index}`);
      return;
    }

    // 计算该关键帧在 timeline 中的时间点
    let targetTime = 0;
    for (let i = 0; i < index; i++) {
      const kf = path.keyframes[i];
      const next = path.keyframes[i + 1];
      if (kf && next) {
        targetTime += (kf.transition?.duration || 1) + kf.duration;
      }
    }

    // 跳转到该时间点
    this.timeline.seek(targetTime);
    this.virtualCamera.keyframeIndex = index;

    console.log(`[CameraAnimator] Jumped to keyframe ${index} at time ${targetTime}s`);
  }

  /**
   * Get current state
   */
  getState() {
    return {
      isPlaying: this.isPlaying,
      isPaused: this.isPaused,
      progress: this.timeline?.progress() || 0,
      duration: this.timeline?.duration() || 0,
      currentTime: this.timeline?.time() || 0,
      currentKeyframeIndex: this.getCurrentKeyframeIndex(),
    };
  }

  /**
   * ✨ 扩展缓动函数（20+ 种）
   */
  private getEase(type: string): string {
    const easings: Record<string, string> = {
      // 基础
      linear: "none",
      ease: "power1.inOut",
      "ease-in": "power2.in",
      "ease-out": "power2.out",
      "ease-in-out": "power2.inOut",

      // ✨ 高级缓动
      "elastic-in": "elastic.in(1, 0.3)",
      "elastic-out": "elastic.out(1, 0.3)",
      "elastic-in-out": "elastic.inOut(1, 0.3)",
      "back-in": "back.in(1.7)",
      "back-out": "back.out(1.7)",
      "back-in-out": "back.inOut(1.7)",
      "bounce-in": "bounce.in",
      "bounce-out": "bounce.out",
      "bounce-in-out": "bounce.inOut",
      "circ-in": "circ.in",
      "circ-out": "circ.out",
      "circ-in-out": "circ.inOut",
      "expo-in": "expo.in",
      "expo-out": "expo.out",
      "expo-in-out": "expo.inOut",
      "sine-in": "sine.in",
      "sine-out": "sine.out",
      "sine-in-out": "sine.inOut",
      "power3-in": "power3.in",
      "power3-out": "power3.out",
      "power3-in-out": "power3.inOut",
      "power4-in": "power4.in",
      "power4-out": "power4.out",
      "power4-in-out": "power4.inOut",

      // Prezi 特色
      "prezi-signature": "power2.inOut",
    };

    return easings[type] || "power2.inOut";
  }
}

// ==================== Global Singleton ====================

let globalAnimator: CameraAnimator | null = null;

/**
 * Get global camera animator instance (singleton)
 */
export function getCameraAnimator(): CameraAnimator {
  if (!globalAnimator) {
    globalAnimator = new CameraAnimator();
  }
  return globalAnimator;
}

/**
 * Reset global animator (useful for cleanup/testing)
 */
export function resetCameraAnimator(): void {
  if (globalAnimator) {
    globalAnimator.stop();
    globalAnimator = null;
  }
}
