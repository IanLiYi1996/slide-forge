/**
 * Type augmentation for GSAP VelocityTracker
 * Fixes type error in gsap@3.14.2 where the constructor's `this` type doesn't match VelocityTrackerInstance
 */

declare module "gsap/utils/VelocityTracker" {
  type VelocityType = "num" | "deg" | "rad";

  interface VelocityMap {
    [key: string]: number;
  }

  interface VelocityTrackerInstance {
    readonly target: object;
    add(property: string, type?: VelocityType): void;
    kill(shallow?: boolean): void;
    remove(property: string): void;
    getAll(): VelocityMap;
    get(property: string): number;
  }

  interface VelocityTrackerStatic {
    getByTarget(target: any): VelocityTrackerInstance;
    getVelocity(target: any, property: string): number;
    isTracking(target: any, property?: string): boolean;
    track(target: any, properties: string, type?: VelocityType): VelocityTrackerInstance[];
    untrack(target: any, properties?: string): void;
    register(core: any): void;
  }

  // Fix: Make VelocityTracker class properly implement VelocityTrackerInstance
  interface VelocityTrackerConstructor extends VelocityTrackerStatic {
    new(target: any, property?: string, type?: VelocityType, next?: VelocityTrackerInstance): VelocityTrackerInstance;
    prototype: VelocityTrackerInstance;
  }

  export const VelocityTracker: VelocityTrackerConstructor;
  export { VelocityTracker as default };
}

// Also augment the global gsap namespace
declare namespace gsap {
  type VelocityType = "num" | "deg" | "rad";

  interface VelocityMap {
    [key: string]: number;
  }

  interface VelocityTrackerInstance {
    readonly target: object;
    add(property: string, type?: VelocityType): void;
    kill(shallow?: boolean): void;
    remove(property: string): void;
    getAll(): VelocityMap;
    get(property: string): number;
  }

  interface VelocityTrackerStatic {
    getByTarget(target: any): VelocityTrackerInstance;
    getVelocity(target: any, property: string): number;
    isTracking(target: any, property?: string): boolean;
    track(target: any, properties: string, type?: VelocityType): VelocityTrackerInstance[];
    untrack(target: any, properties?: string): void;
    register(core: any): void;
  }

  interface VelocityTracker extends VelocityTrackerStatic {
    new(target: any, property?: string, type?: VelocityType, next?: VelocityTrackerInstance): VelocityTrackerInstance;
    prototype: VelocityTrackerInstance;
  }
}
