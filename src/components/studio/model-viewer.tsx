"use client";

import React, { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { RotateCcw, ZoomIn, ZoomOut, SunMedium, Play, Pause } from "lucide-react";
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
  const [bgMode, setBgMode] = useState<"white" | "warm" | "transparent">("white");
  const [autoRotate, setAutoRotate] = useState(true);
  const autoRotateRef = useRef(autoRotate);

  const controlsRef = useRef<OrbitControls | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const initialCameraPos = useRef<THREE.Vector3>(new THREE.Vector3(1.6, 1.2, 1.9));

  useEffect(() => {
    const container = mountRef.current;
    if (!container) return;

    let isMounted = true;

    // 1. Scene setup
    const scene = new THREE.Scene();

    // 2. Camera setup
    const width = container.clientWidth || 800;
    const height = container.clientHeight || 550;
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
    renderer.toneMappingExposure = 1.15;

    container.replaceChildren(renderer.domElement);

    // 4. Photorealistic Studio Lighting
    const ambientLight = new THREE.AmbientLight(0xffffff, 1.4);
    scene.add(ambientLight);

    // Main Studio Key Light
    const keyLight = new THREE.DirectionalLight(0xfffdfa, 2.2);
    keyLight.position.set(3, 5, 4);
    keyLight.castShadow = true;
    keyLight.shadow.mapSize.width = 2048;
    keyLight.shadow.mapSize.height = 2048;
    keyLight.shadow.camera.near = 0.5;
    keyLight.shadow.camera.far = 15;
    keyLight.shadow.bias = -0.0004;
    scene.add(keyLight);

    // Soft Rim / Fill Light
    const fillLight = new THREE.DirectionalLight(0xf0f5ff, 1.2);
    fillLight.position.set(-3, 3, -2);
    scene.add(fillLight);

    // Top Overhead Light
    const topLight = new THREE.DirectionalLight(0xffffff, 0.8);
    topLight.position.set(0, 6, 0);
    scene.add(topLight);

    // Subtle Ground Shadow Plane
    const groundGeo = new THREE.PlaneGeometry(12, 12);
    const groundMat = new THREE.ShadowMaterial({ opacity: 0.12 });
    const ground = new THREE.Mesh(groundGeo, groundMat);
    ground.rotation.x = -Math.PI / 2;
    ground.position.y = 0;
    ground.receiveShadow = true;
    scene.add(ground);

    // 5. OrbitControls setup
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.05;
    controls.autoRotate = autoRotateRef.current;
    controls.autoRotateSpeed = 1.2;
    controls.maxPolarAngle = Math.PI / 2 + 0.05;
    controls.minDistance = 0.5;
    controls.maxDistance = 6.0;
    controls.target.set(0, 0.45, 0);
    controlsRef.current = controls;

    // 6. Load GLB Model
    const loader = new GLTFLoader();
    let currentModel: THREE.Group | null = null;

    setLoading(true);
    setLoadError(null);

    const resolvedUrl =
      modelUrl.startsWith("http://") || modelUrl.startsWith("https://")
        ? `/api/proxy-model?url=${encodeURIComponent(modelUrl)}`
        : modelUrl;

    loader.load(
      resolvedUrl,
      (gltf) => {
        if (!isMounted) return;

        currentModel = gltf.scene;

        const bbox = new THREE.Box3().setFromObject(currentModel);
        const size = bbox.getSize(new THREE.Vector3());
        const center = bbox.getCenter(new THREE.Vector3());

        const maxDim = Math.max(size.x, size.y, size.z);
        const targetScale = 1.05 / (maxDim || 1);
        currentModel.scale.setScalar(targetScale);

        currentModel.position.x = -center.x * targetScale;
        currentModel.position.z = -center.z * targetScale;
        currentModel.position.y = -bbox.min.y * targetScale;

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

    // 9. Cleanup
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

  useEffect(() => {
    autoRotateRef.current = autoRotate;
    if (controlsRef.current) {
      controlsRef.current.autoRotate = autoRotate;
    }
  }, [autoRotate]);

  const resetCamera = () => {
    if (controlsRef.current && cameraRef.current) {
      cameraRef.current.position.copy(initialCameraPos.current);
      controlsRef.current.target.set(0, 0.45, 0);
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
    <div className="relative w-full h-full min-h-[550px] flex flex-col rounded-2xl overflow-hidden border border-stone-200/90 bg-white shadow-sm">
      {/* 3D Canvas Viewport */}
      <div
        ref={mountRef}
        className={`w-full h-full flex-1 transition-colors duration-300 ${
          bgMode === "white"
            ? "bg-radial from-stone-50 via-stone-100/60 to-stone-200/50"
            : bgMode === "warm"
            ? "bg-radial from-amber-50/40 via-stone-100/70 to-stone-200/70"
            : "bg-transparent"
        }`}
      />

      {/* Loading Overlay */}
      {loading && (
        <div className="absolute inset-0 bg-white/85 backdrop-blur-xs flex flex-col items-center justify-center space-y-3 z-10">
          <div className="h-10 w-10 border-3 border-stone-900 border-t-transparent rounded-full animate-spin" />
          <p className="text-xs font-bold text-stone-900">
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
      <div className="absolute top-4 right-4 flex items-center gap-1.5 p-1 rounded-xl bg-white/95 backdrop-blur-md border border-stone-200/90 shadow-xs z-10">
        <Button
          size="icon"
          variant="ghost"
          className="h-8 w-8 text-stone-600 hover:text-stone-900"
          onClick={() => setAutoRotate((r) => !r)}
          title={autoRotate ? "Pause Rotation" : "Auto Rotate"}
        >
          {autoRotate ? <Pause className="h-3.5 w-3.5" /> : <Play className="h-3.5 w-3.5" />}
        </Button>
        <Button
          size="icon"
          variant="ghost"
          className="h-8 w-8 text-stone-600 hover:text-stone-900"
          onClick={resetCamera}
          title="Reset Camera"
        >
          <RotateCcw className="h-3.5 w-3.5" />
        </Button>
        <Button
          size="icon"
          variant="ghost"
          className="h-8 w-8 text-stone-600 hover:text-stone-900"
          onClick={() => handleZoom(0.35)}
          title="Zoom In"
        >
          <ZoomIn className="h-3.5 w-3.5" />
        </Button>
        <Button
          size="icon"
          variant="ghost"
          className="h-8 w-8 text-stone-600 hover:text-stone-900"
          onClick={() => handleZoom(-0.35)}
          title="Zoom Out"
        >
          <ZoomOut className="h-3.5 w-3.5" />
        </Button>
        <div className="w-px h-4 bg-stone-200" />
        <Button
          size="icon"
          variant="ghost"
          className="h-8 w-8 text-stone-600 hover:text-stone-900"
          onClick={() =>
            setBgMode((m) =>
              m === "white" ? "warm" : m === "warm" ? "transparent" : "white"
            )
          }
          title="Toggle Backdrop"
        >
          <SunMedium className="h-3.5 w-3.5" />
        </Button>
      </div>

      {/* Floating Real-world Dimensions Badge */}
      <div className="absolute bottom-4 left-4 bg-white/95 backdrop-blur-md px-3.5 py-1.5 rounded-xl border border-stone-200/90 shadow-2xs text-xs text-stone-700 flex items-center gap-2 z-10">
        <span className="font-bold text-stone-900">Real Scale:</span>
        <span className="font-medium">
          {(widthMm / 10).toFixed(0)} × {(depthMm / 10).toFixed(0)} × {(heightMm / 10).toFixed(0)} cm
        </span>
      </div>
    </div>
  );
}
