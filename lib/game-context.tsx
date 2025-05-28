"use client"

import { createContext, useContext, useState, useCallback, type ReactNode } from "react"
import type * as THREE from "three"

export interface BulletTrail {
  start: THREE.Vector3
  end: THREE.Vector3
  timestamp: number
  intensity?: number // Added intensity property
}

interface GameState {
  playerPosition: { x: number; y: number; z: number }
  setPlayerPosition: (position: { x: number; y: number; z: number }) => void
  bulletTrails: BulletTrail[]
  addBulletTrail: (trail: BulletTrail) => void
}

const GameContext = createContext<GameState | null>(null)

export function GameProvider({ children }: { children: ReactNode }) {
  const [playerPosition, setPlayerPosition] = useState({ x: 0, y: 1.7, z: 0 })
  const [bulletTrails, setBulletTrails] = useState<BulletTrail[]>([])

  // Use useCallback to prevent unnecessary re-renders
  const addBulletTrail = useCallback((trail: BulletTrail) => {
    setBulletTrails((prev) => {
      // Limit the number of trails to prevent performance issues
      const newTrails = [trail, ...prev]
      if (newTrails.length > 10) {
        return newTrails.slice(0, 10)
      }
      return newTrails
    })
  }, [])

  return (
    <GameContext.Provider
      value={{
        playerPosition,
        setPlayerPosition,
        bulletTrails,
        addBulletTrail,
      }}
    >
      {children}
    </GameContext.Provider>
  )
}

export function useGameState() {
  const context = useContext(GameContext)
  if (!context) {
    throw new Error("useGameState must be used within a GameProvider")
  }
  return context
}

// Remove the additional context and hook that was causing the error
