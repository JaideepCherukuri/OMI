'use client'

/**
 * Orb3D — Dynamic import wrapper for the Three.js Orb.
 * 
 * MUST use dynamic import with ssr:false to avoid SSR issues 
 * with Three.js in Next.js.
 */

import dynamic from 'next/dynamic'

const Orb3D = dynamic(() => import('./OrbThreeJS'), {
  ssr: false,
  loading: () => (
    <div className="w-full h-full rounded-full bg-gradient-to-br from-olive/30 to-forest/20 animate-pulse" />
  ),
})

export default Orb3D
