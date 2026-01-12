/**
 * Standalone HTML Player Template
 *
 * Generates a complete, self-contained HTML file with embedded Three.js player.
 */

import type { PreziCanvasData } from "@/types/prezi-types";

/**
 * Generate standalone HTML file with embedded Prezi player
 *
 * @param canvasData Complete Prezi canvas data
 * @param title Presentation title
 * @returns HTML string
 */
export function generateStandaloneHTML(
  canvasData: PreziCanvasData,
  title: string
): string {
  // Escape data for safe embedding
  const safeCanvasData = JSON.stringify(canvasData)
    .replace(/</g, "\\u003c")
    .replace(/>/g, "\\u003e");

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title}</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      overflow: hidden;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
      background: #000;
    }
    #canvas { width: 100vw; height: 100vh; display: block; }
    #controls {
      position: fixed;
      bottom: 20px;
      left: 50%;
      transform: translateX(-50%);
      background: rgba(0, 0, 0, 0.8);
      padding: 12px 20px;
      border-radius: 30px;
      display: flex;
      gap: 10px;
      align-items: center;
      backdrop-filter: blur(10px);
      box-shadow: 0 4px 20px rgba(0, 0, 0, 0.5);
    }
    button {
      background: rgba(255, 255, 255, 0.1);
      border: 1px solid rgba(255, 255, 255, 0.2);
      color: white;
      padding: 8px 16px;
      border-radius: 20px;
      cursor: pointer;
      font-size: 14px;
      transition: all 0.2s;
      user-select: none;
    }
    button:hover:not(:disabled) { background: rgba(255, 255, 255, 0.2); transform: scale(1.05); }
    button:active:not(:disabled) { transform: scale(0.95); }
    button:disabled { opacity: 0.3; cursor: not-allowed; }
    #progress {
      color: white;
      font-size: 14px;
      min-width: 80px;
      text-align: center;
      font-variant-numeric: tabular-nums;
    }
  </style>
  <script src="https://cdn.jsdelivr.net/npm/three@0.182.0/build/three.min.js"></script>
  <script src="https://cdn.jsdelivr.net/npm/gsap@3.14.2/dist/gsap.min.js"></script>
</head>
<body>
  <canvas id="canvas"></canvas>
  <div id="controls">
    <button id="prev" title="Previous Keyframe">◀</button>
    <button id="play" title="Play/Pause">▶ Play</button>
    <button id="next" title="Next Keyframe">▶</button>
    <span id="progress">1 / 1</span>
  </div>

  <script>
    (function() {
      // Parse embedded canvas data
      const canvasData = JSON.parse('${safeCanvasData}');

      // Three.js scene setup
      const scene = new THREE.Scene();
      scene.background = new THREE.Color(canvasData.canvas.backgroundColor);

      const camera = new THREE.PerspectiveCamera(
        50,
        window.innerWidth / window.innerHeight,
        1,
        20000
      );

      const renderer = new THREE.WebGLRenderer({
        canvas: document.getElementById('canvas'),
        antialias: true,
        alpha: false
      });
      renderer.setSize(window.innerWidth, window.innerHeight);
      renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

      // Lighting
      scene.add(new THREE.AmbientLight(0xffffff, 0.6));
      const dirLight = new THREE.DirectionalLight(0xffffff, 0.4);
      dirLight.position.set(10, 10, 5);
      scene.add(dirLight);

      // Load elements
      const elementMeshes = {};

      Object.values(canvasData.elements).forEach(element => {
        if (element.visible === false) return; // Skip hidden elements

        let mesh;

        if (element.type === 'text') {
          // Create text plane using Canvas 2D
          const canvas = document.createElement('canvas');
          canvas.width = element.size.width;
          canvas.height = element.size.height;
          const ctx = canvas.getContext('2d');

          // Background
          ctx.fillStyle = element.backgroundColor || '#ffffff';
          ctx.fillRect(0, 0, canvas.width, canvas.height);

          // Text
          ctx.fillStyle = '#000000';
          ctx.font = 'bold 48px sans-serif'; // ✨ 48px 粗体
          ctx.textAlign = 'left';
          ctx.textBaseline = 'top';

          // Extract text content
          const text = element.content
            .map(node => {
              if (node.children) {
                return node.children.map(c => c.text || '').join('');
              }
              return '';
            })
            .join('\\n');

          const padding = element.padding || 20;
          const lineHeight = 60; // ✨ 适配 48px 字体的行高
          const lines = text.split('\\n');
          lines.forEach((line, i) => {
            ctx.fillText(line, padding, padding + i * lineHeight, canvas.width - padding * 2);
          });

          // Create texture
          const texture = new THREE.CanvasTexture(canvas);
          const geometry = new THREE.PlaneGeometry(element.size.width, element.size.height);
          const material = new THREE.MeshBasicMaterial({
            map: texture,
            transparent: true,
            opacity: element.opacity || 1
          });
          mesh = new THREE.Mesh(geometry, material);

        } else if (element.type === 'image') {
          // Load image texture (async)
          const loader = new THREE.TextureLoader();
          loader.load(element.url || '', (texture) => {
            const geometry = new THREE.PlaneGeometry(element.size.width, element.size.height);
            const material = new THREE.MeshBasicMaterial({
              map: texture,
              transparent: true,
              opacity: element.opacity || 1
            });
            const imgMesh = new THREE.Mesh(geometry, material);
            imgMesh.position.set(element.position.x, element.position.y, element.position.z);
            imgMesh.rotation.set(element.rotation.x, element.rotation.y, element.rotation.z);
            imgMesh.scale.set(element.scale, element.scale, element.scale);
            scene.add(imgMesh);
            elementMeshes[element.id] = imgMesh;
          }, undefined, (error) => {
            console.error('Failed to load image:', element.url, error);
          });
          return; // Skip synchronous mesh creation
        }

        if (mesh) {
          mesh.position.set(element.position.x, element.position.y, element.position.z);
          mesh.rotation.set(element.rotation.x, element.rotation.y, element.rotation.z);
          mesh.scale.set(element.scale, element.scale, element.scale);
          scene.add(mesh);
          elementMeshes[element.id] = mesh;
        }
      });

      // Playback system
      const path = canvasData.paths.find(p => p.id === canvasData.activePath);
      if (!path || path.keyframes.length === 0) {
        console.error('No active path found');
        return;
      }

      let currentKeyframe = 0;
      let timeline = null;

      // Virtual camera object
      const virtualCamera = {
        px: 0, py: 0, pz: 1000,
        tx: 0, ty: 0, tz: 0
      };

      function createTimeline() {
        const tl = gsap.timeline({ paused: true });

        // Set initial state
        const first = path.keyframes[0];
        virtualCamera.px = first.camera.position.x;
        virtualCamera.py = first.camera.position.y;
        virtualCamera.pz = first.camera.position.z;
        virtualCamera.tx = first.camera.target.x;
        virtualCamera.ty = first.camera.target.y;
        virtualCamera.tz = first.camera.target.z;

        path.keyframes.forEach((kf, i) => {
          const next = path.keyframes[i + 1];
          if (!next) return;

          tl.to(virtualCamera, {
            px: next.camera.position.x,
            py: next.camera.position.y,
            pz: next.camera.position.z,
            tx: next.camera.target.x,
            ty: next.camera.target.y,
            tz: next.camera.target.z,
            duration: kf.transition?.duration || 1,
            ease: kf.transition?.type || 'power2.inOut',
            onStart: () => {
              currentKeyframe = i + 1;
              updateUI();
            }
          });

          // Pause at keyframe
          if (kf.duration > 0) {
            tl.to({}, { duration: kf.duration });
          }
        });

        return tl;
      }

      timeline = createTimeline();

      // UI Controls
      const playBtn = document.getElementById('play');
      const prevBtn = document.getElementById('prev');
      const nextBtn = document.getElementById('next');

      playBtn.onclick = () => {
        if (timeline.paused()) {
          timeline.play();
          playBtn.textContent = '⏸ Pause';
        } else {
          timeline.pause();
          playBtn.textContent = '▶ Play';
        }
      };

      nextBtn.onclick = () => {
        if (currentKeyframe < path.keyframes.length - 1) {
          timeline.pause();
          playBtn.textContent = '▶ Play';

          currentKeyframe++;

          // Calculate target time
          let targetTime = 0;
          for (let i = 0; i < currentKeyframe; i++) {
            const kf = path.keyframes[i];
            const next = path.keyframes[i + 1];
            if (kf && next) {
              targetTime += (kf.transition?.duration || 1) + kf.duration;
            }
          }

          timeline.seek(targetTime);
          updateUI();
        }
      };

      prevBtn.onclick = () => {
        if (currentKeyframe > 0) {
          timeline.pause();
          playBtn.textContent = '▶ Play';

          currentKeyframe--;

          // Calculate target time
          let targetTime = 0;
          for (let i = 0; i < currentKeyframe; i++) {
            const kf = path.keyframes[i];
            const next = path.keyframes[i + 1];
            if (kf && next) {
              targetTime += (kf.transition?.duration || 1) + kf.duration;
            }
          }

          timeline.seek(targetTime);
          updateUI();
        }
      };

      function updateUI() {
        document.getElementById('progress').textContent =
          (currentKeyframe + 1) + ' / ' + path.keyframes.length;

        prevBtn.disabled = currentKeyframe === 0;
        nextBtn.disabled = currentKeyframe === path.keyframes.length - 1;
      }

      // Render loop
      function animate() {
        requestAnimationFrame(animate);

        // Apply virtual camera to Three.js camera
        camera.position.set(virtualCamera.px, virtualCamera.py, virtualCamera.pz);
        camera.lookAt(virtualCamera.tx, virtualCamera.ty, virtualCamera.tz);

        renderer.render(scene, camera);
      }
      animate();

      // Handle window resize
      window.addEventListener('resize', () => {
        camera.aspect = window.innerWidth / window.innerHeight;
        camera.updateProjectionMatrix();
        renderer.setSize(window.innerWidth, window.innerHeight);
      });

      // Initialize UI
      updateUI();

      console.log('Prezi player initialized with', path.keyframes.length, 'keyframes');
    })();
  </script>
</body>
</html>`;
}
