"use client"

import { useEffect, useRef, useState } from "react"
import * as THREE from "three"
import { useTheme } from "next-themes"

export function WebGLShader() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const { resolvedTheme } = useTheme()
  const [mounted, setMounted] = useState(false)
  const sceneRef = useRef<{
    scene: THREE.Scene | null
    camera: THREE.OrthographicCamera | null
    renderer: THREE.WebGLRenderer | null
    mesh: THREE.Mesh | null
    uniforms: any
    animationId: number | null
  }>({
    scene: null,
    camera: null,
    renderer: null,
    mesh: null,
    uniforms: null,
    animationId: null,
  })

  useEffect(() => {
    setMounted(true)
  }, [])

  const getBackgroundColor = () => {
    // Directly use theme to determine background color
    const isDark = resolvedTheme === 'dark' || !resolvedTheme

    if (isDark) {
      // Dark theme: very dark gray (almost black)
      return new THREE.Color(0x0a0a0a)  // HSL 0 0% 3.9% ≈ #0a0a0a
    } else {
      // Light theme: white
      return new THREE.Color(0xffffff)  // HSL 0 0% 100% = #ffffff
    }
  }

  useEffect(() => {
    if (!canvasRef.current) return

    const canvas = canvasRef.current
    const { current: refs } = sceneRef

    const vertexShader = `
      attribute vec3 position;
      void main() {
        gl_Position = vec4(position, 1.0);
      }
    `

    const fragmentShader = `
      precision highp float;
      uniform vec2 resolution;
      uniform float time;
      uniform float xScale;
      uniform float yScale;
      uniform float distortion;
      uniform vec3 backgroundColor;
      uniform float waveIntensity;

      void main() {
        vec2 p = (gl_FragCoord.xy * 2.0 - resolution) / min(resolution.x, resolution.y);

        float d = length(p) * distortion;

        float rx = p.x * (1.0 + d);
        float gx = p.x;
        float bx = p.x * (1.0 - d);

        float wave1 = 0.03 / abs(p.y + sin((rx + time) * xScale) * yScale);
        float wave2 = 0.03 / abs(p.y + sin((gx + time * 0.8) * xScale) * yScale);
        float wave3 = 0.03 / abs(p.y + sin((bx + time * 0.6) * xScale) * yScale);

        // Determine if background is light or dark
        float bgLuminance = (backgroundColor.r + backgroundColor.g + backgroundColor.b) / 3.0;

        vec3 color1, color2, color3;

        if (bgLuminance < 0.5) {
          // Dark background: bright vibrant colors
          // Orange: rgb(249, 115, 22) = (0.976, 0.451, 0.086)
          // Purple: rgb(168, 85, 247) = (0.659, 0.333, 0.969)
          // Pink: rgb(236, 72, 153) = (0.925, 0.282, 0.600)
          color1 = vec3(0.976, 0.451, 0.086) * wave1; // Orange
          color2 = vec3(0.659, 0.333, 0.969) * wave2; // Purple
          color3 = vec3(0.925, 0.282, 0.600) * wave3; // Pink
        } else {
          // Light background: softer, deeper colors
          // Deep Coral: rgb(230, 90, 60) = (0.902, 0.353, 0.235)
          // Deep Purple: rgb(120, 60, 180) = (0.471, 0.235, 0.706)
          // Deep Rose: rgb(190, 60, 120) = (0.745, 0.235, 0.471)
          color1 = vec3(0.902, 0.353, 0.235) * wave1; // Deep Coral
          color2 = vec3(0.471, 0.235, 0.706) * wave2; // Deep Purple
          color3 = vec3(0.745, 0.235, 0.471) * wave3; // Deep Rose
        }

        vec3 waveColor = color1 + color2 + color3;

        // Use uniform for dynamic wave intensity
        waveColor *= waveIntensity;

        vec3 finalColor;

        if (bgLuminance < 0.5) {
          // Dark background: add waves (glow effect)
          finalColor = backgroundColor + waveColor;
        } else {
          // Light background: show colored waves by blending
          // Calculate total wave intensity
          float totalWaveIntensity = wave1 + wave2 + wave3;

          // Blend background with wave color based on wave intensity
          // Use stronger blending where waves are present
          float blendFactor = min(totalWaveIntensity * waveIntensity * 0.15, 1.0);
          finalColor = mix(backgroundColor, waveColor, blendFactor);
        }

        gl_FragColor = vec4(finalColor, 1.0);
      }
    `

    const initScene = () => {
      refs.scene = new THREE.Scene()
      refs.renderer = new THREE.WebGLRenderer({ canvas })
      refs.renderer.setPixelRatio(window.devicePixelRatio)

      refs.camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, -1)

      refs.uniforms = {
        resolution: { value: [window.innerWidth, window.innerHeight] },
        time: { value: 0.0 },
        xScale: { value: 1.0 },
        yScale: { value: 0.5 },
        distortion: { value: 0.05 },
        backgroundColor: { value: new THREE.Color(0x000000) },
        waveIntensity: { value: 0.5 },
      }

      const position = [
        -1.0, -1.0, 0.0,
         1.0, -1.0, 0.0,
        -1.0,  1.0, 0.0,
         1.0, -1.0, 0.0,
        -1.0,  1.0, 0.0,
         1.0,  1.0, 0.0,
      ]

      const positions = new THREE.BufferAttribute(new Float32Array(position), 3)
      const geometry = new THREE.BufferGeometry()
      geometry.setAttribute("position", positions)

      const material = new THREE.RawShaderMaterial({
        vertexShader,
        fragmentShader,
        uniforms: refs.uniforms,
        side: THREE.DoubleSide,
      })

      refs.mesh = new THREE.Mesh(geometry, material)
      refs.scene.add(refs.mesh)

      handleResize()
    }

    const animate = () => {
      if (refs.uniforms) refs.uniforms.time.value += 0.01
      if (refs.renderer && refs.scene && refs.camera) {
        refs.renderer.render(refs.scene, refs.camera)
      }
      refs.animationId = requestAnimationFrame(animate)
    }

    const handleResize = () => {
      if (!refs.renderer || !refs.uniforms) return
      const width = window.innerWidth
      const height = window.innerHeight
      refs.renderer.setSize(width, height, false)
      refs.uniforms.resolution.value = [width, height]
    }

    initScene()
    animate()
    window.addEventListener("resize", handleResize)

    return () => {
      if (refs.animationId) cancelAnimationFrame(refs.animationId)
      window.removeEventListener("resize", handleResize)
      if (refs.mesh) {
        refs.scene?.remove(refs.mesh)
        refs.mesh.geometry.dispose()
        if (refs.mesh.material instanceof THREE.Material) {
          refs.mesh.material.dispose()
        }
      }
      refs.renderer?.dispose()
    }
  }, [])

  useEffect(() => {
    if (!mounted || !sceneRef.current.uniforms) return

    const isDark = resolvedTheme === 'dark' || !resolvedTheme
    const refs = sceneRef.current

    // Update background color
    refs.uniforms.backgroundColor.value = getBackgroundColor()

    // Update wave intensity
    // Dark: 0.5 (bright waves added to dark background)
    // Light: 0.6 (waves shown by darkening light background)
    refs.uniforms.waveIntensity.value = isDark ? 0.5 : 0.6

  }, [mounted, resolvedTheme])

  return (
    <canvas
      ref={canvasRef}
      className="absolute top-0 left-0 w-full h-full block"
    />
  )
}
