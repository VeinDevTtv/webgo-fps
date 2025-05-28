"use client"

import { useState, useEffect } from "react"

interface FPSCounterProps {
  visible: boolean
}

export default function FPSCounter({ visible }: FPSCounterProps) {
  const [fps, setFps] = useState(0)

  useEffect(() => {
    if (!visible) return

    let frameCount = 0
    let lastTime = performance.now()
    let animationFrameId: number

    const updateFPS = () => {
      frameCount++
      const now = performance.now()

      if (now >= lastTime + 1000) {
        setFps(frameCount)
        frameCount = 0
        lastTime = now
      }

      animationFrameId = requestAnimationFrame(updateFPS)
    }

    animationFrameId = requestAnimationFrame(updateFPS)

    return () => {
      cancelAnimationFrame(animationFrameId)
    }
  }, [visible])

  if (!visible) return null

  return (
    <div className="fixed top-2 left-2 bg-black/80 text-white px-2 py-1 rounded font-mono text-sm z-50">FPS: {fps}</div>
  )
}
