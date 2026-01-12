/**
 * Element Ref Manager
 *
 * Manages mapping between Prezi element IDs and their corresponding THREE.js objects.
 * Used by ElementAnimator and PostProcessing systems to access Three.js objects.
 */

import * as THREE from "three";

/**
 * Element Ref Manager Class
 *
 * Centralized registry for element ID -> THREE.Object3D mappings.
 */
export class ElementRefManager {
  private refs: Map<string, THREE.Object3D> = new Map();

  /**
   * Register an element's Three.js object
   *
   * @param elementId - Prezi element ID
   * @param object - THREE.js object (Group, Mesh, etc.)
   */
  register(elementId: string, object: THREE.Object3D): void {
    this.refs.set(elementId, object);
  }

  /**
   * Unregister an element's Three.js object
   *
   * @param elementId - Prezi element ID
   */
  unregister(elementId: string): void {
    this.refs.delete(elementId);
  }

  /**
   * Get the Three.js object for an element
   *
   * @param elementId - Prezi element ID
   * @returns THREE.Object3D or undefined if not found
   */
  get(elementId: string): THREE.Object3D | undefined {
    return this.refs.get(elementId);
  }

  /**
   * Get multiple Three.js objects by element IDs
   *
   * @param elementIds - Array of Prezi element IDs
   * @returns Array of THREE.Object3D (only found elements)
   */
  getAll(elementIds: string[]): THREE.Object3D[] {
    const objects: THREE.Object3D[] = [];
    for (const id of elementIds) {
      const obj = this.refs.get(id);
      if (obj) {
        objects.push(obj);
      }
    }
    return objects;
  }

  /**
   * Check if an element is registered
   *
   * @param elementId - Prezi element ID
   * @returns true if element is registered
   */
  has(elementId: string): boolean {
    return this.refs.has(elementId);
  }

  /**
   * Get all registered element IDs
   *
   * @returns Array of element IDs
   */
  getAllIds(): string[] {
    return Array.from(this.refs.keys());
  }

  /**
   * Get number of registered elements
   *
   * @returns Count of registered elements
   */
  size(): number {
    return this.refs.size;
  }

  /**
   * Clear all registered elements
   */
  clear(): void {
    this.refs.clear();
  }
}

// ==================== Global Singleton ====================

const elementRefManager = new ElementRefManager();

export default elementRefManager;

// Named export for convenience
export { elementRefManager };
