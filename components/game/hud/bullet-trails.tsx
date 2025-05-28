"use client"

import { useEffect, useState, useMemo } from "react"
import type { BulletTrail } from "@/lib/game-context"

interface BulletTrailsProps {
  trails: BulletTrail[]
}

export default function BulletTrails({ trails }: BulletTrailsProps) {
  const [visibleTrails, setVisibleTrails] = useState<BulletTrail[]>([])

  // Optimize by limiting the number of trails and using useMemo
  const limitedTrails = useMemo(() => {
    return trails.slice(0, 5) // Only show the 5 most recent trails
  }, [trails])

  useEffect(() => {
    // Update visible trails
    setVisibleTrails(limitedTrails)

    // Remove trails after 100ms
    const timer = setTimeout(() => {
      setVisibleTrails([])
    }, 100)

    return () => clearTimeout(timer)
  }, [limitedTrails])

  // Don't render anything if no trails
  if (visibleTrails.length === 0) return null

  return (
    <div className="absolute inset-0 pointer-events-none">
      <svg className="w-full h-full">
        {visibleTrails.map((trail, index) => {
          // Default intensity to 1 if not specified, or use the provided value
          const intensity = trail.intensity !== undefined ? trail.intensity : 1

          return (
            <line
              key={index}
              x1={window.innerWidth / 2}
              y1={window.innerHeight / 2}
              x2={window.innerWidth / 2 + Math.random() * 100 * intensity - 50 * intensity}
              y2={window.innerHeight / 2 + Math.random() * 100 * intensity - 50 * intensity}
              stroke={`rgba(255, 200, 0, ${0.8 * intensity})`}
              strokeWidth={Math.max(1, 2 * intensity)}
            />
          )
        })}
      </svg>
    </div>
  )
}
