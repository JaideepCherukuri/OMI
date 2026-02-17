import React, { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { vertexShader, fragmentShader } from '../utils/shaders';
import { cn } from '../lib/utils';

interface OrbProps {
  getFrequency: () => number;
  getAmplitude?: () => number;
  className?: string;
}

const Orb: React.FC<OrbProps> = ({ getFrequency, getAmplitude, className }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  
  // Refs for Three.js objects to persist across renders without causing re-renders
  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const meshRef = useRef<THREE.Mesh | null>(null);
  const uniformsRef = useRef<{
    u_time: { value: number };
    u_frequency: { value: number };
  } | null>(null);
  const reqIdRef = useRef<number | null>(null);
  
  // Ref for smoothing scale transition
  const currentScaleRef = useRef(1.0);

  useEffect(() => {
    if (!containerRef.current) return;

    // --- Init Three.js ---
    // Start with current dimensions
    let width = containerRef.current.clientWidth;
    let height = containerRef.current.clientHeight;

    // Fallback for zero dimensions (hidden/minimized initially)
    if (width === 0) width = 1;
    if (height === 0) height = 1;

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 100);
    camera.position.z = 2.2;

    const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true });
    renderer.setSize(width, height);
    renderer.setPixelRatio(window.devicePixelRatio || 1);
    renderer.setClearColor(0x000000, 0); // Transparent background

    containerRef.current.appendChild(renderer.domElement);

    // Uniforms
    const uniforms = {
      u_time: { value: 0.0 },
      u_frequency: { value: 0.0 },
    };
    uniformsRef.current = uniforms;

    // Geometry & Material
    const geo = new THREE.IcosahedronGeometry(1.35, 9); // High detail level 9
    const mat = new THREE.ShaderMaterial({
      uniforms,
      vertexShader,
      fragmentShader,
    });

    const mesh = new THREE.Mesh(geo, mat);
    scene.add(mesh);

    sceneRef.current = scene;
    cameraRef.current = camera;
    rendererRef.current = renderer;
    meshRef.current = mesh;

    // --- Animation Loop ---
    const animate = () => {
      reqIdRef.current = requestAnimationFrame(animate);

      // Get latest audio data
      const freq = getFrequency();
      const amp = getAmplitude ? getAmplitude() : 0;
      
      if (uniformsRef.current) {
        uniformsRef.current.u_frequency.value = freq;
        // u_time.value += 0.01 + uniforms.u_frequency.value * 0.02;
        uniformsRef.current.u_time.value += 0.01 + freq * 0.02;
      }

      if (meshRef.current) {
        meshRef.current.rotation.y += 0.002;
        
        // "Bounce" effect: scale mesh based on amplitude
        // We smooth the amplitude value to avoid jagged movements
        const targetScale = 1.0 + (amp * 0.15); 
        currentScaleRef.current += (targetScale - currentScaleRef.current) * 0.1;
        
        meshRef.current.scale.setScalar(currentScaleRef.current);
      }

      if (rendererRef.current && sceneRef.current && cameraRef.current) {
        rendererRef.current.render(sceneRef.current, cameraRef.current);
      }
    };

    animate();

    // --- Resize Handling ---
    const handleResize = () => {
      if (!containerRef.current || !cameraRef.current || !rendererRef.current) return;
      
      const newWidth = containerRef.current.clientWidth;
      const newHeight = containerRef.current.clientHeight;

      // Prevent resizing to 0
      if (newWidth === 0 || newHeight === 0) return;
      
      cameraRef.current.aspect = newWidth / newHeight;
      cameraRef.current.updateProjectionMatrix();
      rendererRef.current.setSize(newWidth, newHeight);
    };

    // Use ResizeObserver to detect container size changes (e.g. icon switch animation)
    const resizeObserver = new ResizeObserver(() => {
        handleResize();
    });
    resizeObserver.observe(containerRef.current);

    // Cleanup
    return () => {
      resizeObserver.disconnect();
      if (reqIdRef.current) cancelAnimationFrame(reqIdRef.current);
      
      // Dispose Three.js resources
      if (rendererRef.current) {
        rendererRef.current.dispose();
        if (containerRef.current) {
          try {
            containerRef.current.removeChild(rendererRef.current.domElement);
          } catch(e) {}
        }
      }
      if (meshRef.current) {
        meshRef.current.geometry.dispose();
        (meshRef.current.material as THREE.Material).dispose();
      }
    };
  }, [getFrequency, getAmplitude]); // Re-run if props change

  return (
    <div 
      ref={containerRef} 
      className={cn("w-full h-full origin-center", className)}
    />
  );
};

export default Orb;
