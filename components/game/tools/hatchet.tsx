"use client"

import { useRef, useState, useEffect } from "react"
import { useFrame, useThree } from "@react-three/fiber"
import * as THREE from "three"
import { useGameState } from "@/lib/game-context"
import SoundManager from "@/lib/sound-manager"
import type { TreeInstance } from "@/lib/tree-generator"

interface HatchetProps {
  isLocked: boolean
}

// Create reusable geometries and materials
const handleGeometry = new THREE.CylinderGeometry(0.02, 0.02, 0.5, 8)
const handleMaterial = new THREE.MeshStandardMaterial({ color: "#8B4513" }) // Brown wood color

const bladeGeometry = new THREE.BoxGeometry(0.1, 0.2, 0.02)
const bladeMaterial = new THREE.MeshStandardMaterial({ color: "#A9A9A9", metalness: 0.8, roughness: 0.2 }) // Silver metal

const edgeGeometry = new THREE.BoxGeometry(0.02, 0.22, 0.04)
const edgeMaterial = new THREE.MeshStandardMaterial({ color: "#808080", metalness: 0.9, roughness: 0.1 }) // Darker metal for edge

// Animation constants
const CHOP_ANIMATION_SPEED = 5.0 // Full animation cycles per second
const IDLE_ANIMATION_FREQUENCY = 2.0 // Cycles per second

// Chopping range - increased to allow standing back from trees
const MAX_HIT_DISTANCE = 5 // Increased from 3 to 5 units

export default function Hatchet({ isLocked }: HatchetProps) {
  const { camera } = useThree()
  const { playerPosition } = useGameState()
  const hatchetRef = useRef<THREE.Group>(null)
  const firstRender = useRef(true)

  // Get sound manager instance
  const soundManager = SoundManager.getInstance()

  // Animation state
  const [isChopping, setIsChopping] = useState(false)
  const chopAnimationRef = useRef({
    active: false,
    progress: 0,
    direction: 1, // 1 for forward, -1 for backward
    hitRegistered: false, // Track if we've registered a hit in this cycle
  })

  // Track mouse state
  const isMouseDown = useRef(false)
  const lastChopTime = useRef(0)
  const CHOP_COOLDOWN = 200 // ms between chops (reduced for more responsive continuous chopping)

  // Raycaster for tree detection
  const raycaster = useRef(new THREE.Raycaster())
  const rayDirection = useRef(new THREE.Vector3())

  // Debug state
  const [debugText, setDebugText] = useState<string>("")

  // Preload and warm up audio on first render
  useEffect(() => {
    if (firstRender.current) {
      firstRender.current = false
      console.log("Initializing sound manager for hatchet")

      // Initialize sound manager if not already done
      if (!soundManager.initialized) {
        soundManager.init()
      }

      // Preload the chop sound
      try {
        soundManager.preloadSound("chop")
      } catch (error) {
        console.error("Error preloading chop sound:", error)
      }

      soundManager.warmup()
    }
  }, [])

  // Handle mouse events for chopping
  useEffect(() => {
    if (!isLocked) return

    const handleMouseDown = (e: MouseEvent) => {
      if (e.button === 0) {
        // Left mouse button
        isMouseDown.current = true
        startChop()
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

  // Function to start a chop animation
  const startChop = () => {
    const now = performance.now()

    // If already chopping, don't start a new chop
    if (chopAnimationRef.current.active) return

    // Check cooldown
    if (now - lastChopTime.current < CHOP_COOLDOWN) return

    setIsChopping(true)
    chopAnimationRef.current.active = true
    chopAnimationRef.current.progress = 0
    chopAnimationRef.current.direction = 1
    chopAnimationRef.current.hitRegistered = false
    lastChopTime.current = now
  }

  // Check if hatchet hit a tree
  const checkTreeHit = () => {
    if (!camera || !playerPosition) return

    // Get camera direction
    camera.getWorldDirection(rayDirection.current)

    // Set raycaster origin and direction
    raycaster.current.set(camera.position, rayDirection.current)

    // Get tree instances from window (set by Trees component)
    // @ts-ignore
    const treeInstances: TreeInstance[] = window.treeInstances || []

    if (treeInstances.length === 0) {
      console.warn("No tree instances found for hit detection")
      return
    }

    // Debug info
    let closestTree = null
    let closestDistance = Number.POSITIVE_INFINITY
    let hitDetected = false

    // Check each tree for hit
    for (const tree of treeInstances) {
      if (tree.isChopped) continue

      // Calculate distance to tree
      const distSq = Math.pow(tree.position.x - playerPosition.x, 2) + Math.pow(tree.position.z - playerPosition.z, 2)

      // Track closest tree for debugging
      if (distSq < closestDistance) {
        closestDistance = distSq
        closestTree = tree
      }

      // Skip if too far away - using increased MAX_HIT_DISTANCE
      if (distSq > MAX_HIT_DISTANCE * MAX_HIT_DISTANCE) continue

      // Create collision objects for the tree
      const trunkRadius = tree.trunkRadius || 0.3 * tree.scale
      const trunkHeight = tree.trunkHeight || 2 * tree.scale

      // Create a cylinder for the trunk
      const trunkBottom = new THREE.Vector3(tree.position.x, tree.position.y, tree.position.z)
      const trunkTop = new THREE.Vector3(tree.position.x, tree.position.y + trunkHeight, tree.position.z)

      // Calculate distance from ray to trunk axis
      const ray = new THREE.Ray(camera.position, rayDirection.current)

      // Check if ray intersects with trunk cylinder
      // First, find the closest point on the ray to the trunk axis
      const v1 = new THREE.Vector3().subVectors(trunkTop, trunkBottom).normalize()
      const v2 = new THREE.Vector3().subVectors(ray.origin, trunkBottom)

      const dot = v2.dot(v1)
      const closestPointOnAxis = new THREE.Vector3().copy(trunkBottom).addScaledVector(v1, dot)

      // Check if this point is within the trunk height
      const withinHeight = dot >= 0 && dot <= trunkHeight

      // Calculate distance from ray to trunk axis
      const distanceToAxis = ray.distanceToPoint(closestPointOnAxis)

      // If within radius and height, we have a hit - using increased hit radius for better detection
      if (withinHeight && distanceToAxis <= trunkRadius * 2.0) {
        console.log(
          `Hit tree ${tree.id} - distance: ${Math.sqrt(distSq).toFixed(2)}, radius: ${trunkRadius.toFixed(2)}`,
        )

        // Play chop sound ONLY when tree is hit
        try {
          console.log("Playing chop sound on tree hit")
          soundManager.play("chop") // Use chop sound for tree hits
        } catch (error) {
          console.error("Error playing chop sound on tree hit:", error)
        }

        hitDetected = true

        // Call the tree hit handler
        // @ts-ignore
        if (typeof window.handleTreeHit === "function") {
          // @ts-ignore
          window.handleTreeHit(tree.id, 1)
          return // Exit after successful hit
        }
      }
    }

    // If no hit was detected, don't play any sound
    if (!hitDetected && closestTree) {
      const dist = Math.sqrt(closestDistance).toFixed(2)
      console.log(`No hit detected. Closest tree: ${closestTree.id} at distance ${dist}`)
    }
  }

  // Handle hatchet positioning and chopping animation
  useFrame((state, delta) => {
    if (!hatchetRef.current || !isLocked) return

    // Cap delta time to prevent huge jumps if the game freezes temporarily
    const cappedDelta = Math.min(delta, 0.1)

    // Position hatchet in front of camera
    const offset = new THREE.Vector3(0.3, -0.3, -0.5)
    offset.applyQuaternion(camera.quaternion)
    hatchetRef.current.position.copy(camera.position).add(offset)

    // IMPORTANT: Fully align the hatchet with the camera's quaternion
    // This ensures the hatchet and its blade always face forward from player's perspective
    hatchetRef.current.quaternion.copy(camera.quaternion)

    // Apply slight weapon sway - using time-based animation
    const time = state.clock.elapsedTime
    hatchetRef.current.position.y += Math.sin(time * IDLE_ANIMATION_FREQUENCY * Math.PI) * 0.002

    // Handle chopping animation with delta time
    if (chopAnimationRef.current.active) {
      const { progress, direction, hitRegistered } = chopAnimationRef.current

      // Create a chopping motion that preserves the forward orientation
      // We'll use a separate quaternion for the chop animation
      const chopAngle = -Math.sin(progress * Math.PI) * 0.5

      // Create a quaternion for the chop rotation around the RIGHT axis (not X)
      // This ensures the hatchet chops up and down while keeping the blade forward
      const rightAxis = new THREE.Vector3(1, 0, 0).applyQuaternion(camera.quaternion)
      const chopRotation = new THREE.Quaternion().setFromAxisAngle(rightAxis, chopAngle)

      // Apply the chop rotation while preserving the camera alignment
      hatchetRef.current.quaternion.premultiply(chopRotation)

      // Update animation progress using delta time
      chopAnimationRef.current.progress += CHOP_ANIMATION_SPEED * direction * cappedDelta

      // Check if we need to register a hit at the peak of the animation
      if (progress >= 0.5 && progress < 0.6 && direction === 1 && !hitRegistered) {
        // Register hit at the peak of the forward swing
        chopAnimationRef.current.hitRegistered = true
        checkTreeHit()
      }

      // Check if we need to reverse or end the animation
      if (progress >= 1) {
        chopAnimationRef.current.direction = -1 // Start moving back
      } else if (progress <= 0 && direction === -1) {
        // Animation complete
        chopAnimationRef.current.active = false
        setIsChopping(false)

        // If mouse is still down, start a new chop immediately
        if (isMouseDown.current) {
          startChop()
        }
      }
    } else if (isMouseDown.current && !chopAnimationRef.current.active) {
      // If mouse is down but we're not chopping, try to start a chop
      startChop()
    }
  })

  return (
    <group ref={hatchetRef}>
      {/* Handle */}
      <mesh geometry={handleGeometry} material={handleMaterial} position={[0, -0.1, 0]} rotation={[0.2, 0, 0]} />

      {/* Blade - positioned to ensure it faces forward from player perspective */}
      <mesh geometry={bladeGeometry} material={bladeMaterial} position={[0, 0.15, 0]} rotation={[0, Math.PI / 2, 0]} />

      {/* Cutting edge */}
      <mesh geometry={edgeGeometry} material={edgeMaterial} position={[0, 0.15, 0.06]} rotation={[0, Math.PI / 2, 0]} />
    </group>
  )
}
