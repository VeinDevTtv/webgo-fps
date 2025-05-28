"use client"

import { useRef, useState, useEffect } from "react"
import { useFrame, useThree } from "@react-three/fiber"
import * as THREE from "three"
import { useGameState } from "@/lib/game-context"
import { useSoundManager } from "@/lib/sound-manager"

interface PickaxeProps {
  isLocked: boolean
}

// Create reusable geometries and materials
const handleGeometry = new THREE.CylinderGeometry(0.02, 0.02, 0.5, 8)
const handleMaterial = new THREE.MeshStandardMaterial({ color: "#8B4513" }) // Brown wood color

const headGeometry = new THREE.BoxGeometry(0.1, 0.1, 0.1)
const headMaterial = new THREE.MeshStandardMaterial({ color: "#A9A9A9", metalness: 0.8, roughness: 0.2 }) // Silver metal

const pickGeometry = new THREE.ConeGeometry(0.05, 0.2, 8)
const pickMaterial = new THREE.MeshStandardMaterial({ color: "#808080", metalness: 0.9, roughness: 0.1 }) // Darker metal for edge

// Animation constants
const MINE_ANIMATION_SPEED = 5.0 // Full animation cycles per second
const IDLE_ANIMATION_FREQUENCY = 2.0 // Cycles per second

// Mining range
const MAX_HIT_DISTANCE = 3

export default function Pickaxe({ isLocked }: PickaxeProps) {
  const { camera } = useThree()
  const { playerPosition } = useGameState()
  const pickaxeRef = useRef<THREE.Group>(null)
  const soundManager = useSoundManager()
  const firstRender = useRef(true)

  // Animation state
  const [isMining, setIsMining] = useState(false)
  const mineAnimationRef = useRef({
    active: false,
    progress: 0,
    direction: 1, // 1 for forward, -1 for backward
    hitRegistered: false, // Track if we've registered a hit in this cycle
  })

  // Track mouse state
  const isMouseDown = useRef(false)
  const lastMineTime = useRef(0)
  const MINE_COOLDOWN = 200 // ms between mines

  // Raycaster for stone detection
  const raycaster = useRef(new THREE.Raycaster())
  const rayDirection = useRef(new THREE.Vector3())

  // Preload and warm up audio on first render
  useEffect(() => {
    if (firstRender.current) {
      firstRender.current = false
      soundManager.warmup()
    }
  }, [soundManager])

  // Handle mouse events for mining
  useEffect(() => {
    if (!isLocked) return

    const handleMouseDown = (e: MouseEvent) => {
      if (e.button === 0) {
        // Left mouse button
        isMouseDown.current = true
        startMine()
      }
    }

    const handleMouseUp = (e: MouseEvent) => {
      if (e.button === 0) {
        // Left mouse button
        isMouseDown.current = false
      }
    }

    window.addEventListener("mousedown", handleMouseDown)
    window.addEventListener("mouseup", handleMouseUp)

    return () => {
      window.removeEventListener("mousedown", handleMouseDown)
      window.removeEventListener("mouseup", handleMouseUp)
    }
  }, [isLocked])

  // Function to start a mine animation
  const startMine = () => {
    const now = performance.now()

    // If already mining, don't start a new mine
    if (mineAnimationRef.current.active) return

    // Check cooldown
    if (now - lastMineTime.current < MINE_COOLDOWN) return

    setIsMining(true)
    mineAnimationRef.current.active = true
    mineAnimationRef.current.progress = 0
    mineAnimationRef.current.direction = 1
    mineAnimationRef.current.hitRegistered = false
    lastMineTime.current = now
  }

  // Check if pickaxe hit a stone
  const checkStoneHit = () => {
    if (!camera || !playerPosition) return

    // Get camera direction
    camera.getWorldDirection(rayDirection.current)

    // Set raycaster origin and direction
    raycaster.current.set(camera.position, rayDirection.current)

    // Get stone instances from window (set by StoneNodes component)
    // @ts-ignore
    const stoneInstances = window.stoneInstances || []

    if (stoneInstances.length === 0) {
      console.warn("No stone instances found for hit detection")
      return
    }

    // Check each stone for hit
    for (const stone of stoneInstances) {
      if (stone.isMined) continue

      // Calculate distance to stone
      const distSq = Math.pow(stone.position.x - playerPosition.x, 2) + Math.pow(stone.position.z - playerPosition.z, 2)

      // Skip if too far away
      if (distSq > MAX_HIT_DISTANCE * MAX_HIT_DISTANCE) continue

      // Create a sphere for the stone
      const stoneSphere = new THREE.Sphere(stone.position, stone.radius)

      // Check if ray intersects with stone sphere
      const ray = new THREE.Ray(camera.position, rayDirection.current)
      const intersects = ray.intersectsSphere(stoneSphere)

      if (intersects) {
        console.log(
          `Hit stone ${stone.id} - distance: ${Math.sqrt(distSq).toFixed(2)}, radius: ${stone.radius.toFixed(2)}`,
        )

        // Play stone hit sound when stone is hit
        try {
          soundManager.play("stone_hit")
        } catch (error) {
          console.warn("Error playing stone hit sound:", error)
        }

        // Call the stone hit handler
        // @ts-ignore
        if (typeof window.handleStoneHit === "function") {
          // @ts-ignore
          window.handleStoneHit(stone.id, 1)
          return // Exit after successful hit
        }
      }
    }
  }

  // Handle pickaxe positioning and mining animation
  useFrame((state, delta) => {
    if (!pickaxeRef.current || !isLocked) return

    // Cap delta time to prevent huge jumps if the game freezes temporarily
    const cappedDelta = Math.min(delta, 0.1)

    // Position pickaxe in front of camera
    const offset = new THREE.Vector3(0.3, -0.3, -0.5)
    offset.applyQuaternion(camera.quaternion)
    pickaxeRef.current.position.copy(camera.position).add(offset)

    // IMPORTANT: Fully align the pickaxe with the camera's quaternion
    // This ensures the pickaxe and its blade always face forward from player's perspective
    pickaxeRef.current.quaternion.copy(camera.quaternion)

    // Apply slight weapon sway - using time-based animation
    const time = state.clock.elapsedTime
    pickaxeRef.current.position.y += Math.sin(time * IDLE_ANIMATION_FREQUENCY * Math.PI) * 0.002

    // Handle mining animation with delta time
    if (mineAnimationRef.current.active) {
      const { progress, direction, hitRegistered } = mineAnimationRef.current

      // Create a mining motion that preserves the forward orientation
      // We'll use a separate quaternion for the mine animation
      const mineAngle = -Math.sin(progress * Math.PI) * 0.5

      // Create a quaternion for the mine rotation around the RIGHT axis (not X)
      // This ensures the pickaxe mines up and down while keeping the blade forward
      const rightAxis = new THREE.Vector3(1, 0, 0).applyQuaternion(camera.quaternion)
      const mineRotation = new THREE.Quaternion().setFromAxisAngle(rightAxis, mineAngle)

      // Apply the mine rotation while preserving the camera alignment
      pickaxeRef.current.quaternion.premultiply(mineRotation)

      // Update animation progress using delta time
      mineAnimationRef.current.progress += MINE_ANIMATION_SPEED * direction * cappedDelta

      // Check if we need to register a hit at the peak of the animation
      if (progress >= 0.5 && progress < 0.6 && direction === 1 && !hitRegistered) {
        // Register hit at the peak of the forward swing
        mineAnimationRef.current.hitRegistered = true
        checkStoneHit()
      }

      // Check if we need to reverse or end the animation
      if (progress >= 1) {
        mineAnimationRef.current.direction = -1 // Start moving back
      } else if (progress <= 0 && direction === -1) {
        // Animation complete
        mineAnimationRef.current.active = false
        setIsMining(false)

        // If mouse is still down, start a new mine immediately
        if (isMouseDown.current) {
          startMine()
        }
      }
    } else if (isMouseDown.current && !mineAnimationRef.current.active) {
      // If mouse is down but we're not mining, try to start a mine
      startMine()
    }
  })

  return (
    <group ref={pickaxeRef}>
      {/* Handle */}
      <mesh geometry={handleGeometry} material={handleMaterial} position={[0, -0.1, 0]} rotation={[0.2, 0, 0]} />

      {/* Head */}
      <mesh geometry={headGeometry} material={headMaterial} position={[0, 0.15, 0]} rotation={[0, Math.PI / 2, 0]} />

      {/* Pick */}
      <mesh
        geometry={pickGeometry}
        material={pickMaterial}
        position={[0, 0.15, -0.15]}
        rotation={[-Math.PI / 2, Math.PI / 2, 0]}
      />
    </group>
  )
}
