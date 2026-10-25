"use client";

import React, { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { DRACOLoader } from "three/examples/jsm/loaders/DRACOLoader.js";
import { RoomEnvironment } from "three/examples/jsm/environments/RoomEnvironment.js";
import { RotateCcw, ZoomIn, ZoomOut, Palette, Camera, Download, X, Play, Pause } from "lucide-react";
import { Button } from "@/components/ui/button";
import { worldUnitsPerCm } from "@/lib/scenes/scale";
import type { ViewerContext } from "./viewer-context";
import { BackdropMenu } from "./backdrop-menu";
import {
  applyBackdrop,
  disposeBackdrop,
  extractProductTone,
  type BackdropMode,
  type ProductTone,
} from "./backdrop";

interface ModelViewerProps {
  modelUrl: string;
  widthMm: number;
  depthMm: number;
  heightMm: number;
  captureName?: string;
  onFirstFrame?: (image: Blob) => void;
  onUseAsThumbnail?: (image: Blob) => Promise<void>;
  initialBackdrop?: BackdropMode;
  onBackdropChange?: (mode: BackdropMode) => void;
  onReady?: (context: ViewerContext) => void | (() => void);
  renderOverlay?: (context: ViewerContext | null) => React.ReactNode;
  captureReady?: boolean;
  showBackdropMenu?: boolean;
  showCapture?: boolean;
}

const THUMBNAIL_MAX_SIDE = 720;

async function resizeImageBlob(blob: Blob, maxSide: number): Promise<Blob> {
  const bitmap = await createImageBitmap(blob);
  const scale = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  canvas.getContext("2d")?.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  return new Promise((resolve, reject) =>
    canvas.toBlob((out) => (out ? resolve(out) : reject(new Error("Could not encode image"))), "image/png")
  );
}

interface Capture {
  blob: Blob;
  url: string;
}

export function ModelViewer({
  modelUrl,
  widthMm,
  depthMm,
  heightMm,
  captureName = "product",
  onFirstFrame,
  onUseAsThumbnail,
  initialBackdrop,
  onBackdropChange,
  onReady,
  renderOverlay,
  captureReady = true,
  showBackdropMenu = true,
  showCapture = true,
}: ModelViewerProps) {
  const mountRef = useRef<HTMLDivElement>(null);
  const [loading, setLoading] = useState(true);
  const [progress, setProgress] = useState(0);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [bgMode, setBgMode] = useState<BackdropMode>(initialBackdrop ?? "auto");
  const [menuOpen, setMenuOpen] = useState(false);
  const [productTone, setProductTone] = useState<ProductTone | null>(null);
  const [autoRotate, setAutoRotate] = useState(true);
  const autoRotateRef = useRef(autoRotate);
  const bgModeRef = useRef(bgMode);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const onFirstFrameRef = useRef(onFirstFrame);
  const onReadyRef = useRef(onReady);
  const readyCleanupRef = useRef<(() => void) | null>(null);
  const [viewerContext, setViewerContext] = useState<ViewerContext | null>(null);
  const firstFrameSent = useRef(false);
  const [capture, setCapture] = useState<Capture | null>(null);
  const [savingThumb, setSavingThumb] = useState(false);
  const [thumbError, setThumbError] = useState<string | null>(null);

  const controlsRef = useRef<OrbitControls | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const initialCameraPos = useRef<THREE.Vector3>(new THREE.Vector3(1.6, 1.2, 1.9));

  useEffect(() => {
    const container = mountRef.current;
    if (!container) return;

    let isMounted = true;

    // 1. Scene setup
    const scene = new THREE.Scene();
    sceneRef.current = scene;
    firstFrameSent.current = false;
    setProductTone(null);
    applyBackdrop(scene, bgModeRef.current, null);

    // 2. Camera setup
    const width = container.clientWidth || 800;
    const height = container.clientHeight || 550;
    const camera = new THREE.PerspectiveCamera(45, width / height, 0.05, 100);
    camera.position.copy(initialCameraPos.current);
    cameraRef.current = camera;

    // 3. Renderer setup - Authentic Color Fidelity (No Filter / No Tone-Mapping Distortion)
    const renderer = new THREE.WebGLRenderer({
      antialias: true,
      alpha: true,
      powerPreference: "high-performance",
    });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFShadowMap;
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    // Khronos Group PBR Neutral Tone Mapping: Preserves true color hue without filter while smoothly preventing highlight clipping on white surfaces
    renderer.toneMapping = THREE.NeutralToneMapping;
    renderer.toneMappingExposure = 1.0;

    rendererRef.current = renderer;
    container.replaceChildren(renderer.domElement);

    // 4. Photorealistic Neutral Studio Environment (Khronos RoomEnvironment IBL)
    const pmremGenerator = new THREE.PMREMGenerator(renderer);
    pmremGenerator.compileEquirectangularShader();
    const envTexture = pmremGenerator.fromScene(new RoomEnvironment()).texture;
    scene.environment = envTexture;

    // 5. Balanced Studio Lighting (Crafted to reveal textures & subtle shading on bright/white objects)
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.3);
    scene.add(ambientLight);

    // Balanced Directional Key Light for soft shadows and depth
    const keyLight = new THREE.DirectionalLight(0xffffff, 0.7);
    keyLight.position.set(2.5, 4.5, 3.5);
    keyLight.castShadow = true;
    keyLight.shadow.mapSize.width = 2048;
    keyLight.shadow.mapSize.height = 2048;
    keyLight.shadow.camera.near = 0.5;
    keyLight.shadow.camera.far = 15;
    keyLight.shadow.bias = -0.0002;
    scene.add(keyLight);

    // Subtle Fill Light from the side
    const fillLight = new THREE.DirectionalLight(0xffffff, 0.3);
    fillLight.position.set(-2.5, 2.5, -2);
    scene.add(fillLight);

    // Overhead Top Light
    const topLight = new THREE.DirectionalLight(0xffffff, 0.2);
    topLight.position.set(0, 5, 0);
    scene.add(topLight);

    // Subtle Ground Shadow Plane
    const groundGeo = new THREE.PlaneGeometry(12, 12);
    const groundMat = new THREE.ShadowMaterial({ opacity: 0.12 });
    const ground = new THREE.Mesh(groundGeo, groundMat);
    ground.rotation.x = -Math.PI / 2;
    ground.position.y = 0;
    ground.receiveShadow = true;
    scene.add(ground);

    // 6. OrbitControls setup
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

    // 7. Load GLB Model (with Draco decompressor support)
    const loader = new GLTFLoader();
    const dracoLoader = new DRACOLoader();
    dracoLoader.setDecoderPath("/draco/");
    loader.setDRACOLoader(dracoLoader);

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

        const maxAnisotropy = renderer.capabilities.getMaxAnisotropy();

        currentModel.traverse((child) => {
          if ((child as THREE.Mesh).isMesh) {
            const mesh = child as THREE.Mesh;
            mesh.castShadow = true;
            mesh.receiveShadow = true;

            // Preserve authentic texture colors and maximize texture sharpness from all angles
            const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
            materials.forEach((mat) => {
              if (mat) {
                if ("map" in mat && mat.map instanceof THREE.Texture) {
                  mat.map.colorSpace = THREE.SRGBColorSpace;
                  mat.map.anisotropy = maxAnisotropy;
                  mat.map.needsUpdate = true;
                }
                if ("normalMap" in mat && mat.normalMap instanceof THREE.Texture) {
                  mat.normalMap.anisotropy = maxAnisotropy;
                  mat.normalMap.needsUpdate = true;
                }
                if ("roughnessMap" in mat && mat.roughnessMap instanceof THREE.Texture) {
                  mat.roughnessMap.anisotropy = maxAnisotropy;
                  mat.roughnessMap.needsUpdate = true;
                }
                if ("metalnessMap" in mat && mat.metalnessMap instanceof THREE.Texture) {
                  mat.metalnessMap.anisotropy = maxAnisotropy;
                  mat.metalnessMap.needsUpdate = true;
                }
                if ("aoMap" in mat && mat.aoMap instanceof THREE.Texture) {
                  mat.aoMap.anisotropy = maxAnisotropy;
                  mat.aoMap.needsUpdate = true;
                }
                // Enhance tactile relief on standard PBR materials
                if ("isMeshStandardMaterial" in mat && mat.isMeshStandardMaterial) {
                  const stdMat = mat as THREE.MeshStandardMaterial;
                  if (stdMat.normalMap) {
                    stdMat.normalScale.set(1.5, 1.5);
                  }
                  stdMat.envMapIntensity = 0.85;
                  stdMat.needsUpdate = true;
                }
              }
            });
          }
        });

        scene.add(currentModel);

        const tone = extractProductTone(currentModel);
        const context: ViewerContext = {
          scene,
          camera,
          renderer,
          controls,
          container,
          worldPerCm: worldUnitsPerCm({ widthMm, depthMm, heightMm }),
          ground,
          productTone: tone,
        };
        const cleanup = onReadyRef.current?.(context);
        readyCleanupRef.current = typeof cleanup === "function" ? cleanup : null;
        setViewerContext(context);
        setProductTone(tone);
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
      readyCleanupRef.current?.();
      readyCleanupRef.current = null;
      setViewerContext(null);
      window.removeEventListener("resize", handleResize);
      cancelAnimationFrame(animationFrameId);

      controls.dispose();
      renderer.dispose();
      dracoLoader.dispose();
      pmremGenerator.dispose();
      envTexture.dispose();
      disposeBackdrop(scene);
      sceneRef.current = null;
      rendererRef.current = null;

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
  }, [modelUrl, widthMm, depthMm, heightMm]);

  useEffect(() => {
    bgModeRef.current = bgMode;
    if (sceneRef.current) applyBackdrop(sceneRef.current, bgMode, productTone);
  }, [bgMode, productTone]);

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

  const closeCapture = () => {
    setCapture((c) => {
      if (c) URL.revokeObjectURL(c.url);
      return null;
    });
    setThumbError(null);
  };

  useEffect(() => () => {
    if (capture) URL.revokeObjectURL(capture.url);
  }, [capture]);

  const renderToBlob = (): Promise<Blob | null> => {
    const renderer = rendererRef.current;
    const scene = sceneRef.current;
    const camera = cameraRef.current;
    if (!renderer || !scene || !camera) return Promise.resolve(null);

    renderer.render(scene, camera);
    return new Promise((resolve) => renderer.domElement.toBlob(resolve, "image/png"));
  };

  const takeScreenshot = async () => {
    const blob = await renderToBlob();
    if (blob) setCapture({ blob, url: URL.createObjectURL(blob) });
  };

  useEffect(() => {
    onFirstFrameRef.current = onFirstFrame;
  }, [onFirstFrame]);

  useEffect(() => {
    onReadyRef.current = onReady;
  }, [onReady]);

  useEffect(() => {
    if (loading || loadError || !captureReady || !onFirstFrameRef.current) return;
    const frame = requestAnimationFrame(() =>
      requestAnimationFrame(async () => {
        if (firstFrameSent.current) return;
        firstFrameSent.current = true;
        const blob = await renderToBlob();
        if (blob) onFirstFrameRef.current?.(await resizeImageBlob(blob, THUMBNAIL_MAX_SIDE));
      })
    );
    return () => cancelAnimationFrame(frame);
  }, [loading, loadError, captureReady]);

  const downloadCapture = () => {
    if (!capture) return;
    const link = document.createElement("a");
    link.href = capture.url;
    link.download = `${captureName.replace(/\s+/g, "-").toLowerCase()}-3d.png`;
    link.click();
  };

  const useCaptureAsThumbnail = async () => {
    if (!capture || !onUseAsThumbnail) return;
    setSavingThumb(true);
    setThumbError(null);
    try {
      await onUseAsThumbnail(await resizeImageBlob(capture.blob, THUMBNAIL_MAX_SIDE));
      closeCapture();
    } catch (err) {
      setThumbError(err instanceof Error ? err.message : "Could not save thumbnail");
    } finally {
      setSavingThumb(false);
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
        className="w-full h-full flex-1"
      />

      {renderOverlay?.(viewerContext)}

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
        {showBackdropMenu && (
          <>
            <div className="w-px h-4 bg-stone-200" />
            <div className="relative">
              <Button
                size="icon"
                variant="ghost"
                className="h-8 w-8 text-stone-600 hover:text-stone-900"
                onClick={() => setMenuOpen((o) => !o)}
                title="Change backdrop"
                aria-label="Change backdrop"
                aria-haspopup="menu"
                aria-expanded={menuOpen}
              >
                <Palette className="h-3.5 w-3.5" />
              </Button>
              {menuOpen && (
                <BackdropMenu
                  value={bgMode}
                  onSelect={(mode) => {
                    setBgMode(mode);
                    onBackdropChange?.(mode);
                    setMenuOpen(false);
                  }}
                />
              )}
            </div>
          </>
        )}
        {showCapture && (
          <Button
            size="icon"
            variant="ghost"
            className="h-8 w-8 text-stone-600 hover:text-stone-900"
            onClick={takeScreenshot}
            disabled={loading || !!loadError}
            title="Capture screenshot"
            aria-label="Capture screenshot"
          >
            <Camera className="h-3.5 w-3.5" />
          </Button>
        )}
      </div>

      {capture && (
        <div className="absolute inset-0 z-20 flex items-center justify-center bg-stone-900/60 p-4 backdrop-blur-xs">
          <div className="w-full max-w-md rounded-2xl bg-white p-3 shadow-xl space-y-3">
            <div className="flex items-center justify-between px-1">
              <p className="text-sm font-bold text-stone-900">Screenshot</p>
              <Button
                size="icon"
                variant="ghost"
                className="h-7 w-7 text-stone-500"
                onClick={closeCapture}
                title="Close"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={capture.url}
              alt="Captured 3D view"
              className="w-full rounded-xl border border-stone-200 bg-stone-50 object-contain"
            />
            {thumbError && <p className="px-1 text-xs font-medium text-rose-600">{thumbError}</p>}
            <div className="flex gap-2">
              <Button variant="outline" className="flex-1 gap-2" onClick={downloadCapture}>
                <Download className="h-4 w-4" />
                Download
              </Button>
              {onUseAsThumbnail && (
                <Button className="flex-1" onClick={useCaptureAsThumbnail} disabled={savingThumb}>
                  {savingThumb ? "Saving..." : "Use as thumbnail"}
                </Button>
              )}
            </div>
          </div>
        </div>
      )}

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
