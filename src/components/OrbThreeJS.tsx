'use client'

/**
 * OrbThreeJS — Three.js audio-reactive orb for pre-chat experience.
 * 
 * This is the raw Three.js implementation. Use `Orb3D` (the dynamic wrapper)
 * in Next.js pages to avoid SSR issues.
 */

import React, { useEffect, useRef } from 'react'
import * as THREE from 'three'
import { vertexShader, fragmentShader } from '@/utils/shaders'
import { cn } from '@/lib/utils'

interface OrbThreeJSProps {
  getFrequency: () => number
  getAmplitude?: () => number
  className?: string
}

const OrbThreeJS: React.FC<OrbThreeJSProps> = ({ getFrequency, getAmplitude, className }) => {
  const containerRef = useRef<HTMLDivElement>(null)
  
  const sceneRef = useRef<THREE.Scene | null>(null)
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null)
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null)
  const meshRef = useRef<THREE.Mesh | null>(null)
  const uniformsRef = useRef<{
    u_time: { value: number }
    u_frequency: { value: number }
  } | null>(null)
  const reqIdRef = useRef<number | null>(null)
  const currentScaleRef = useRef(1.0)

  useEffect(() => {
    if (!containerRef.current) return

    let width = containerRef.current.clientWidth
    let height = containerRef.current.clientHeight

    if (width === 0) width = 1
    if (height === 0) height = 1

    const scene = new THREE.Scene()
    const camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 100)
    camera.position.z = 2.2

    const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true })
    renderer.setSize(width, height)
    renderer.setPixelRatio(window.devicePixelRatio || 1)
    renderer.setClearColor(0x000000, 0)

    containerRef.current.appendChild(renderer.domElement)

    const uniforms = {
      u_time: { value: 0.0 },
      u_frequency: { value: 0.0 },
    }
    uniformsRef.current = uniforms

    const geo = new THREE.IcosahedronGeometry(1.35, 9)
    const mat = new THREE.ShaderMaterial({
      uniforms,
      vertexShader,
      fragmentShader,
    })

    const mesh = new THREE.Mesh(geo, mat)
    scene.add(mesh)

    sceneRef.current = scene
    cameraRef.current = camera
    rendererRef.current = renderer
    meshRef.current = mesh

    const animate = () => {
      reqIdRef.current = requestAnimationFrame(animate)

      const freq = getFrequency()
      const amp = getAmplitude ? getAmplitude() : 0
      
      if (uniformsRef.current) {
        uniformsRef.current.u_frequency.value = freq
        uniformsRef.current.u_time.value += 0.01 + freq * 0.02
      }

      if (meshRef.current) {
        meshRef.current.rotation.y += 0.002
        
        const targetScale = 1.0 + (amp * 0.15)
        currentScaleRef.current += (targetScale - currentScaleRef.current) * 0.1
        meshRef.current.scale.setScalar(currentScaleRef.current)
      }

      if (rendererRef.current && sceneRef.current && cameraRef.current) {
        rendererRef.current.render(sceneRef.current, cameraRef.current)
      }
    }

    animate()

    const resizeObserver = new ResizeObserver(() => {
      if (!containerRef.current || !cameraRef.current || !rendererRef.current) return
      const newWidth = containerRef.current.clientWidth
      const newHeight = containerRef.current.clientHeight
      if (newWidth === 0 || newHeight === 0) return
      cameraRef.current.aspect = newWidth / newHeight
      cameraRef.current.updateProjectionMatrix()
      rendererRef.current.setSize(newWidth, newHeight)
    })
    resizeObserver.observe(containerRef.current)

    return () => {
      resizeObserver.disconnect()
      if (reqIdRef.current) cancelAnimationFrame(reqIdRef.current)
      if (rendererRef.current) {
        rendererRef.current.dispose()
        if (containerRef.current) {
          try {
            containerRef.current.removeChild(rendererRef.current.domElement)
          } catch {}
        }
      }
      if (meshRef.current) {
        meshRef.current.geometry.dispose()
        ;(meshRef.current.material as THREE.Material).dispose()
      }
    }
  }, [getFrequency, getAmplitude])

  return (
    <div 
      ref={containerRef} 
      className={cn("w-full h-full origin-center", className)}
    />
  )
}

export default OrbThreeJS
