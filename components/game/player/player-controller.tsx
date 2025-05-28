"use client"

import { useRef, useEffect } from "react"
import { useFrame, useThree } from "@react-three/fiber"
import * as THREE from "three"
import { PlayerSystem, type KeyState } from "@/systems/player-system"
import { useGameStore } from "@/stores/simple-game-store"
import { GAME_CONFIG } from "@/lib/config/game-config"
import SoundManager from "@/lib/sound-manager"

interface PlayerControllerProps {
  terrainHeightData: number[][]
  obstacles?: any[]
  disabled?: boolean
}

export default function PlayerController({
  terrainHeightData,
  obstacles = [],
  disabled = false,
}: PlayerControllerProps) {
  const { camera, clock } = useThree()
  const playerSystemRef = useRef<PlayerSystem | null>(null)
  const soundManager = SoundManager.getInstance()
  
  // Zustand store
  const { player, isLocked, updatePlayerPosition } = useGameStore()
  
  // Key state tracking
  const keysRef = useRef<KeyState>({
    KeyW: false,
    KeyS: false,
    KeyA: false,
    KeyD: false,
    Space: false,
    ShiftLeft: false,
    KeyC: false,
  })

  // Initialize player system
  useEffect(() => {
    const spawnPoint = new THREE.Vector3(
      player.position.x,
      player.position.y,
      player.position.z
    )
    playerSystemRef.current = new PlayerSystem(spawnPoint)
  }, [player.position])

  // Handle keyboard input
  useEffect(() => {
    if (disabled || !isLocked) return

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.code in keysRef.current) {
        keysRef.current[e.code as keyof KeyState] = true
      }
    }

    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.code in keysRef.current) {
        keysRef.current[e.code as keyof KeyState] = false
      }
    }

    window.addEventListener("keydown", handleKeyDown)
    window.addEventListener("keyup", handleKeyUp)

    return () => {
      window.removeEventListener("keydown", handleKeyDown)
      window.removeEventListener("keyup", handleKeyUp)
    }
  }, [disabled, isLocked])

  // Update player movement
  useFrame(() => {
    if (!playerSystemRef.current || disabled || !isLocked) return

    const deltaTime = clock.getDelta()
    
    // Update player movement
    playerSystemRef.current.updateMovement(
      keysRef.current,
      camera,
      deltaTime,
      terrainHeightData,
      obstacles
    )

    // Get updated position
    const newPosition = playerSystemRef.current.getPosition()
    
    // Update camera position
    camera.position.copy(newPosition)
    
    // Update store
    updatePlayerPosition({
      x: newPosition.x,
      y: newPosition.y,
      z: newPosition.z,
    })

    // Handle footstep sounds
    const isMoving = Object.values(keysRef.current).slice(0, 4).some(Boolean) // W, A, S, D
    if (playerSystemRef.current.shouldPlayFootstep(isMoving)) {
      try {
        soundManager.play("footstep_grass")
      } catch (error) {
        console.warn("Error playing footstep sound:", error)
      }
    }
  })

  // This component doesn't render anything visible
  return null
} 