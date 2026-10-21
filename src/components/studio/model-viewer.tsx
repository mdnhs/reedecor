"use client";

import React, { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { RotateCcw, ZoomIn, ZoomOut, SunMedium } from "lucide-react";
import { Button } from "@/components/ui/button";

interface ModelViewerProps {
  modelUrl: string;
  widthMm: number;
  depthMm: number;
  heightMm: number;
}

export function ModelViewer({
  modelUrl,
  widthMm,
  depthMm,
  heightMm,
}: ModelViewerProps) {
  const mountRef = useRef<HTMLDivElement>(null);
  const [loading, setLoading] = useState(true);
  const [progress, setProgress] = useState(0);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [bgMode, setBgMode] = useState<"neutral" | "dark" | "transparent">("neutral");

  // Three.js instances ref
  const controlsRef = useRef<OrbitControls | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const initialCameraPos = useRef<THREE.Vector3>(new THREE.Vector3(1.5, 1.2, 1.8));

  useEffect(() => {
    const container = mountRef.current;
    if (!container) return;

    let isMounted = true;

    // 1. Scene setup
    const scene = new THREE.Scene();

    // 2. Camera setup
    const width = container.clientWidth || 800;
    const height = container.clientHeight || 500;
    const camera = new THREE.PerspectiveCamera(45, width / height, 0.05, 100);
    camera.position.copy(initialCameraPos.current);
    cameraRef.current = camera;

    // 3. Renderer setup
    const renderer = new THREE.WebGLRenderer({
      antialias: true,
      alpha: true,
      powerPreference: "high-performance",
    });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.1;

    container.replaceChildren(renderer.domElement);

    // 4. Studio Lighting
    const ambientLight = new THREE.AmbientLight(0xffffff, 1.2);
    scene.add(ambientLight);

    const keyLight = new THREE.DirectionalLight(0xfff8ee, 2.0);
    keyLight.position.set(3, 5, 4);
    keyLight.castShadow = true;
    keyLight.shadow.mapSize.width = 1024;
    keyLight.shadow.mapSize.height = 1024;
    keyLight.shadow.camera.near = 0.5;
    keyLight.shadow.camera.far = 15;
    keyLight.shadow.bias = -0.0005;
    scene.add(keyLight);

    const fillLight = new THREE.DirectionalLight(0xe8f0ff, 1.0);
    fillLight.position.set(-3, 3, -2);
    scene.add(fillLight);

    // Subtle Ground Shadow Plane
    const groundGeo = new THREE.PlaneGeometry(10, 10);
    const groundMat = new THREE.ShadowMaterial({ opacity: 0.15 });
    const ground = new THREE.Mesh(groundGeo, groundMat);
    ground.rotation.x = -Math.PI / 2;
    ground.position.y = 0;
    ground.receiveShadow = true;
    scene.add(ground);

    // 5. OrbitControls setup
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.05;
    controls.maxPolarAngle = Math.PI / 2 + 0.05; // Prevent camera dipping below floor
    controls.minDistance = 0.5;
    controls.maxDistance = 6.0;
    controls.target.set(0, 0.4, 0);
    controlsRef.current = controls;

    // 6. Load GLB Model
    const loader = new GLTFLoader();
    let currentModel: THREE.Group | null = null;

    setLoading(true);
    setLoadError(null);

    loader.load(
      modelUrl,
      (gltf) => {
        if (!isMounted) return;

        currentModel = gltf.scene;

        // Auto-center & normalize scale based on bounding box
        const bbox = new THREE.Box3().setFromObject(currentModel);
        const size = bbox.getSize(new THREE.Vector3());
        const center = bbox.getCenter(new THREE.Vector3());

        const maxDim = Math.max(size.x, size.y, size.z);
        const targetScale = 1.0 / (maxDim || 1);
        currentModel.scale.setScalar(targetScale);

        // Center on floor
        currentModel.position.x = -center.x * targetScale;
        currentModel.position.z = -center.z * targetScale;
        currentModel.position.y = -bbox.min.y * targetScale;

        // Shadows & PBR materials enhancements
        currentModel.traverse((child) => {
          if ((child as THREE.Mesh).isMesh) {
            const mesh = child as THREE.Mesh;
            mesh.castShadow = true;
            mesh.receiveShadow = true;
          }
        });

        scene.add(currentModel);
        setLoading(false);
      },
      (xhr) => {
        if (xhr.total > 0) {
          setProgress(Math.round((xhr.loaded / xhr.total) * 100));
        }
      },
      (err) => {
        console.error("GLTF load error:", err);
        if (isMounted) {
          setLoadError("Could not load 3D GLB model. The file might still be generating or format is invalid.");
          setLoading(false);
        }
      }
    );

    // 7. Render Loop
    let animationFrameId: number;
    const animate = () => {
      animationFrameId = requestAnimationFrame(animate);
      controls.update();
      renderer.render(scene, camera);
    };
    animate();

    // 8. Resize Handler
    const handleResize = () => {
      if (!container) return;
      const w = container.clientWidth;
      const h = container.clientHeight;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    };
    window.addEventListener("resize", handleResize);

    // 9. Cleanup & memory leak prevention
    return () => {
      isMounted = false;
      window.removeEventListener("resize", handleResize);
      cancelAnimationFrame(animationFrameId);

      controls.dispose();
      renderer.dispose();

      if (currentModel) {
        currentModel.traverse((child) => {
          if ((child as THREE.Mesh).isMesh) {
            const mesh = child as THREE.Mesh;
            mesh.geometry?.dispose();
            if (Array.isArray(mesh.material)) {
              mesh.material.forEach((mat) => mat.dispose());
            } else if (mesh.material) {
              mesh.material.dispose();
            }
          }
        });
      }

      if (renderer.domElement && container.contains(renderer.domElement)) {
        container.removeChild(renderer.domElement);
      }
    };
  }, [modelUrl]);

  const resetCamera = () => {
    if (controlsRef.current && cameraRef.current) {
      cameraRef.current.position.copy(initialCameraPos.current);
      controlsRef.current.target.set(0, 0.4, 0);
      controlsRef.current.update();
    }
  };

  const handleZoom = (delta: number) => {
    if (cameraRef.current && controlsRef.current) {
      const dir = new THREE.Vector3();
      cameraRef.current.getWorldDirection(dir);
      cameraRef.current.position.addScaledVector(dir, delta);
      controlsRef.current.update();
    }
  };

  return (
    <div className="relative w-full h-full min-h-[500px] flex flex-col rounded-xl overflow-hidden border border-stone-200/80 bg-white shadow-xs">
      {/* 3D Canvas Viewport */}
      <div
        ref={mountRef}
        className={`w-full h-full flex-1 transition-colors duration-300 ${
          bgMode === "neutral"
            ? "bg-radial from-stone-100 to-stone-200/60"
            : bgMode === "dark"
            ? "bg-stone-900"
            : "bg-transparent"
        }`}
      />

      {/* Loading Overlay */}
      {loading && (
        <div className="absolute inset-0 bg-white/80 backdrop-blur-xs flex flex-col items-center justify-center space-y-3 z-10">
          <div className="h-10 w-10 border-3 border-amber-600 border-t-transparent rounded-full animate-spin" />
          <p className="text-xs font-semibold text-stone-800">
            Loading 3D Studio Model... {progress > 0 && `${progress}%`}
          </p>
        </div>
      )}

      {/* Error Overlay */}
      {loadError && (
        <div className="absolute inset-0 bg-white/90 p-6 flex flex-col items-center justify-center text-center space-y-3 z-10">
          <p className="text-sm font-semibold text-rose-600">{loadError}</p>
        </div>
      )}

      {/* Floating Studio Controls Bar */}
      <div className="absolute top-4 right-4 flex items-center gap-1.5 p-1 rounded-lg bg-white/80 backdrop-blur-md border border-stone-200 shadow-xs z-10">
        <Button
          size="icon"
          variant="ghost"
          className="h-8 w-8"
          onClick={resetCamera}
          title="Reset Camera"
        >
          <RotateCcw className="h-4 w-4" />
        </Button>
        <Button
          size="icon"
          variant="ghost"
          className="h-8 w-8"
          onClick={() => handleZoom(0.3)}
          title="Zoom In"
        >
          <ZoomIn className="h-4 w-4" />
        </Button>
        <Button
          size="icon"
          variant="ghost"
          className="h-8 w-8"
          onClick={() => handleZoom(-0.3)}
          title="Zoom Out"
        >
          <ZoomOut className="h-4 w-4" />
        </Button>
        <div className="w-px h-4 bg-stone-200" />
        <Button
          size="icon"
          variant="ghost"
          className="h-8 w-8"
          onClick={() =>
            setBgMode((m) =>
              m === "neutral" ? "dark" : m === "dark" ? "transparent" : "neutral"
            )
          }
          title="Toggle Backdrop"
        >
          <SunMedium className="h-4 w-4" />
        </Button>
      </div>

      {/* Floating Real-world Dimensions Badge */}
      <div className="absolute bottom-4 left-4 bg-white/90 backdrop-blur-md px-3 py-1.5 rounded-lg border border-stone-200/80 shadow-xs text-xs text-stone-700 flex items-center gap-2 z-10">
        <span className="font-semibold text-stone-900">Scale:</span>
        <span>
          {(widthMm / 10).toFixed(0)} × {(depthMm / 10).toFixed(0)} × {(heightMm / 10).toFixed(0)} cm
        </span>
      </div>
    </div>
  );
}
