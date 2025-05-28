"use client"

import { useState, useEffect } from "react"

interface PointerLockFallbackProps {
  isActive: boolean
  onFallbackControls: (dx: number, dy: number) => void
}

/**
 * A fallback component that simulates pointer lock controls
 * when the browser's Pointer Lock API is unavailable
 */
export default function PointerLockFallback({ isActive, onFallbackControls }: PointerLockFallbackProps) {
  const [mousePosition, setMousePosition] = useState({ x: 0, y: 0 })
  const [centerPosition, setCenterPosition] = useState({ x: 0, y: 0 })
  const [isInitialized, setIsInitialized] = useState(false)

  // Initialize center position
  useEffect(() => {
    if (isActive && !isInitialized && typeof window !== "undefined") {
      const centerX = window.innerWidth / 2
      const centerY = window.innerHeight / 2
      setCenterPosition({ x: centerX, y: centerY })
      setMousePosition({ x: centerX, y: centerY })
      setIsInitialized(true)
    }
  }, [isActive, isInitialized])

  // Handle mouse movement
  useEffect(() => {
    if (!isActive) return

    const handleMouseMove = (e: MouseEvent) => {
      // Calculate delta from current position
      const dx = e.clientX - mousePosition.x
      const dy = e.clientY - mousePosition.y

      // Update mouse position
      setMousePosition({ x: e.clientX, y: e.clientY })

      // Call the callback with movement deltas
      onFallbackControls(dx, dy)

      // If mouse gets too far from center, reset it
      const distanceFromCenter = Math.sqrt(
        Math.pow(e.clientX - centerPosition.x, 2) + Math.pow(e.clientY - centerPosition.y, 2),
      )

      if (distanceFromCenter > 200) {
        // Reset mouse position to center (visually only)
        setMousePosition({ x: centerPosition.x, y: centerPosition.y })
      }
    }

    window.addEventListener("mousemove", handleMouseMove)
    return () => window.removeEventListener("mousemove", handleMouseMove)
  }, [isActive, mousePosition, centerPosition, onFallbackControls])

  // Don't render anything visible
  return null
}
