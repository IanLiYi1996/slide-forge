/**
 * Demo Data Generator
 *
 * Generates sample Prezi presentations for testing and demonstration.
 */

import {
  type PreziCanvasData,
  type PreziTextElement,
  type PreziImageElement,
  type PathKeyframe,
  PREZI_DEFAULTS,
} from "@/types/prezi-types";

/**
 * Generate a complete demo presentation with elements and path
 */
export function generateDemoPresentation(): PreziCanvasData {
  // Create elements
  const titleElement: PreziTextElement = {
    id: "demo-title",
    type: "text",
    position: { x: 0, y: 0, z: 0 },
    rotation: { x: 0, y: 0, z: 0 },
    scale: 2,
    size: { width: 600, height: 150 },
    zIndex: 10,
    opacity: 1,
    locked: false,
    content: [
      {
        type: "p",
        children: [{ text: "Welcome to Prezi Editor" }],
      },
    ],
    backgroundColor: "#ffffff",
    padding: 30,
  };

  const subtitleElement: PreziTextElement = {
    id: "demo-subtitle",
    type: "text",
    position: { x: 0, y: 200, z: 0 },
    rotation: { x: 0, y: 0, z: 0 },
    scale: 1,
    size: { width: 500, height: 80 },
    zIndex: 9,
    opacity: 1,
    locked: false,
    content: [
      {
        type: "p",
        children: [{ text: "Create dynamic presentations with zoom and pan" }],
      },
    ],
    backgroundColor: "#f0f9ff",
    padding: 20,
  };

  const featureElement1: PreziTextElement = {
    id: "demo-feature-1",
    type: "text",
    position: { x: -500, y: -400, z: -100 },
    rotation: { x: 0, y: 0, z: 0 },
    scale: 1.2,
    size: { width: 350, height: 200 },
    zIndex: 5,
    opacity: 1,
    locked: false,
    content: [
      {
        type: "p",
        children: [{ text: "✨ Feature 1: Infinite Canvas" }],
      },
      {
        type: "p",
        children: [
          {
            text: "Place elements anywhere in 3D space with complete freedom.",
          },
        ],
      },
    ],
    backgroundColor: "#dbeafe",
    padding: 24,
  };

  const featureElement2: PreziTextElement = {
    id: "demo-feature-2",
    type: "text",
    position: { x: 500, y: -400, z: -100 },
    rotation: { x: 0, y: 0, z: 0 },
    scale: 1.2,
    size: { width: 350, height: 200 },
    zIndex: 5,
    opacity: 1,
    locked: false,
    content: [
      {
        type: "p",
        children: [{ text: "🎬 Feature 2: Zoom Paths" }],
      },
      {
        type: "p",
        children: [
          { text: "Create cinematic transitions between different views." },
        ],
      },
    ],
    backgroundColor: "#fef3c7",
    padding: 24,
  };

  const featureElement3: PreziTextElement = {
    id: "demo-feature-3",
    type: "text",
    position: { x: 0, y: -800, z: -100 },
    rotation: { x: 0, y: 0, z: 0 },
    scale: 1.2,
    size: { width: 350, height: 200 },
    zIndex: 5,
    opacity: 1,
    locked: false,
    content: [
      {
        type: "p",
        children: [{ text: "📤 Feature 3: Export Options" }],
      },
      {
        type: "p",
        children: [
          { text: "Export as PDF, interactive HTML, or video/GIF." },
        ],
      },
    ],
    backgroundColor: "#dcfce7",
    padding: 24,
  };

  const imageElement: PreziImageElement = {
    id: "demo-image",
    type: "image",
    position: { x: 800, y: 0, z: -200 },
    rotation: { x: 0, y: 0, z: 0.1 },
    scale: 1,
    size: { width: 500, height: 400 },
    zIndex: 3,
    opacity: 0.9,
    locked: false,
    url: "https://images.unsplash.com/photo-1557683316-973673baf926?w=800",
  };

  const conclusionElement: PreziTextElement = {
    id: "demo-conclusion",
    type: "text",
    position: { x: -800, y: 400, z: -300 },
    rotation: { x: 0, y: 0, z: -0.05 },
    scale: 1.5,
    size: { width: 400, height: 150 },
    zIndex: 8,
    opacity: 1,
    locked: false,
    content: [
      {
        type: "p",
        children: [{ text: "Ready to create?" }],
      },
      {
        type: "p",
        children: [{ text: "Start exploring now!" }],
      },
    ],
    backgroundColor: "#fce7f3",
    padding: 30,
  };

  // Create keyframes for demo path
  const keyframes: PathKeyframe[] = [
    {
      id: "keyframe-1",
      order: 0,
      camera: {
        position: { x: 0, y: 0, z: 1000 },
        target: { x: 0, y: 0, z: 0 },
        zoom: 1,
      },
      duration: 3,
      transition: { type: "ease-in-out", duration: 1.5 },
      title: "Title Slide",
    },
    {
      id: "keyframe-2",
      order: 1,
      camera: {
        position: { x: -500, y: -400, z: 600 },
        target: { x: -500, y: -400, z: -100 },
        zoom: 1.5,
      },
      duration: 2.5,
      transition: { type: "ease-in-out", duration: 1.2 },
      title: "Feature 1",
    },
    {
      id: "keyframe-3",
      order: 2,
      camera: {
        position: { x: 500, y: -400, z: 600 },
        target: { x: 500, y: -400, z: -100 },
        zoom: 1.5,
      },
      duration: 2.5,
      transition: { type: "ease-in-out", duration: 1.2 },
      title: "Feature 2",
    },
    {
      id: "keyframe-4",
      order: 3,
      camera: {
        position: { x: 0, y: -800, z: 600 },
        target: { x: 0, y: -800, z: -100 },
        zoom: 1.5,
      },
      duration: 2.5,
      transition: { type: "ease-in-out", duration: 1.2 },
      title: "Feature 3",
    },
    {
      id: "keyframe-5",
      order: 4,
      camera: {
        position: { x: 800, y: 0, z: 800 },
        target: { x: 800, y: 0, z: -200 },
        zoom: 1.2,
      },
      duration: 2,
      transition: { type: "ease-in-out", duration: 1.5 },
      title: "Visual Example",
    },
    {
      id: "keyframe-6",
      order: 5,
      camera: {
        position: { x: -800, y: 400, z: 700 },
        target: { x: -800, y: 400, z: -300 },
        zoom: 1.3,
      },
      duration: 2.5,
      transition: { type: "ease-in-out", duration: 1.5 },
      title: "Conclusion",
    },
    {
      id: "keyframe-7",
      order: 6,
      camera: {
        position: { x: 0, y: 0, z: 2000 },
        target: { x: 0, y: 0, z: 0 },
        zoom: 0.5,
      },
      duration: 3,
      transition: { type: "ease-out", duration: 2 },
      title: "Overview",
    },
  ];

  // Assemble canvas data
  const canvasData: PreziCanvasData = {
    version: "1.0",
    canvas: {
      backgroundColor: "#ffffff", // White background - will be overridden by theme
      gridEnabled: true,
      gridSize: 50,
    },
    elements: {
      [titleElement.id]: titleElement,
      [subtitleElement.id]: subtitleElement,
      [featureElement1.id]: featureElement1,
      [featureElement2.id]: featureElement2,
      [featureElement3.id]: featureElement3,
      [imageElement.id]: imageElement,
      [conclusionElement.id]: conclusionElement,
    },
    paths: [
      {
        id: "demo-path",
        name: "Demo Presentation Path",
        keyframes,
        loop: false,
      },
    ],
    activePath: "demo-path",
    camera: {
      defaultPosition: PREZI_DEFAULTS.CAMERA.POSITION,
      defaultZoom: PREZI_DEFAULTS.CAMERA.ZOOM,
    },
  };

  return canvasData;
}

/**
 * Generate minimal demo (for quick testing)
 */
export function generateMinimalDemo(): PreziCanvasData {
  const textElement: PreziTextElement = {
    id: "minimal-text",
    type: "text",
    position: { x: 0, y: 0, z: 0 },
    rotation: { x: 0, y: 0, z: 0 },
    scale: 1,
    size: { width: 400, height: 100 },
    zIndex: 1,
    opacity: 1,
    locked: false,
    content: [
      {
        type: "p",
        children: [{ text: "Hello Prezi!" }],
      },
    ],
    backgroundColor: "#ffffff",
    padding: 20,
  };

  return {
    version: "1.0",
    canvas: {
      backgroundColor: "#ffffff",
      gridEnabled: true,
      gridSize: 50,
    },
    elements: {
      [textElement.id]: textElement,
    },
    paths: [
      {
        id: "minimal-path",
        name: "Main Path",
        keyframes: [],
        loop: false,
      },
    ],
    activePath: "minimal-path",
    camera: {
      defaultPosition: PREZI_DEFAULTS.CAMERA.POSITION,
      defaultZoom: PREZI_DEFAULTS.CAMERA.ZOOM,
    },
  };
}
