"use client"

import { useRef, useState, useEffect } from "react"
import { useFrame, useThree } from "@react-three/fiber"
import * as THREE from "three"
import { useGameState } from "@/lib/game-context"
import { useSoundManager } from "@/lib/sound-manager"

interface WeaponProps {
  isLocked: boolean
  onAmmoChange?: (ammo: { current: number; reserve: number }) => void
}

// Create reusable geometries and materials
const barrelGeometry = new THREE.BoxGeometry(0.05, 0.05, 0.3)
const barrelMaterial = new THREE.MeshStandardMaterial({ color: "#333333" })

const gripGeometry = new THREE.BoxGeometry(0.04, 0.1, 0.2)
const gripMaterial = new THREE.MeshStandardMaterial({ color: "#222222" })

const muzzleGeometry = new THREE.BoxGeometry(0.03, 0.03, 0.1)
const muzzleMaterial = new THREE.MeshStandardMaterial({ color: "#111111" })

// Muzzle flash
const muzzleFlashGeometry = new THREE.ConeGeometry(0.05, 0.1, 8)
const muzzleFlashMaterial = new THREE.MeshBasicMaterial({
  color: "#ffaa00",
  transparent: true,
  opacity: 0.8,
})

// Weapon settings
const FIRE_RATE = 125 // 1/8th second in milliseconds
const MAX_RECOIL = 0.15 // Maximum recoil amount
const RECOIL_AMOUNT = 0.015 // Recoil per shot
const RECOIL_RECOVERY = 0.02 // Recovery rate
const RECOIL_RANDOMNESS = 0.003 // Random variation in recoil

export default function Weapon({ isLocked, onAmmoChange }: WeaponProps) {
  const { camera } = useThree()
  const weaponRef = useRef<THREE.Group>(null)
  const muzzleFlashRef = useRef<THREE.Mesh>(null)
  const [isShooting, setIsShooting] = useState(false)
  const { addBulletTrail } = useGameState()
  const clock = useThree((state) => state.clock)
  const soundManager = useSoundManager()
  const firstRender = useRef(true)

  // Ammo state
  const [ammo, setAmmo] = useState({ current: 30, reserve: 90 })

  // Refs for tracking firing state
  const isReloading = useRef(false)
  const isMouseDown = useRef(false)
  const lastFireTime = useRef(0)
  const lastFrameTime = useRef(0)

  // Recoil tracking
  const cameraRecoil = useRef(0)
  const visualRecoil = useRef(0)
  const originalCameraPitch = useRef(0)
  const isRecovering = useRef(false)

  // Preload and warm up audio on first render
  useEffect(() => {
    if (firstRender.current) {
      firstRender.current = false
      soundManager.warmup()
      soundManager.preloadSound("shoot").catch((e) => console.warn("Failed to preload shoot sound:", e))
    }
  }, [soundManager])

  // Handle mouse events for firing
  useEffect(() => {
    if (!isLocked) return

    const handleMouseDown = (e: MouseEvent) => {
      if (e.button === 0) {
        // Left mouse button
        isMouseDown.current = true
      }
    }

    const handleMouseUp = (e: MouseEvent) => {
      if (e.button === 0) {
        // Left mouse button
        isMouseDown.current = false
      }
    }

    const handleKeyDown = (e: KeyboardEvent) => {
      // Handle reload with R key
      if (e.code === "KeyR" && !isReloading.current && ammo.current < 30 && ammo.reserve > 0) {
        reloadWeapon()
      }
    }

    window.addEventListener("mousedown", handleMouseDown)
    window.addEventListener("mouseup", handleMouseUp)
    window.addEventListener("keydown", handleKeyDown)

    return () => {
      window.removeEventListener("mousedown", handleMouseDown)
      window.removeEventListener("mouseup", handleMouseUp)
      window.removeEventListener("keydown", handleKeyDown)
    }
  }, [isLocked, ammo])

  // Function to fire the weapon
  const fireWeapon = () => {
    if (isReloading.current) return

    const now = performance.now()
    if (now - lastFireTime.current < FIRE_RATE) return

    // Check ammo
    if (ammo.current <= 0) {
      try {
        soundManager.play("empty")
      } catch (error) {
        console.warn("Error playing empty sound:", error)
      }
      lastFireTime.current = now
      return
    }

    // Reduce ammo
    const newAmmo = {
      current: ammo.current - 1,
      reserve: ammo.reserve,
    }
    setAmmo(newAmmo)

    // Update parent component
    if (onAmmoChange) {
      onAmmoChange(newAmmo)
    }

    setIsShooting(true)
    lastFireTime.current = now

    // Play shoot sound
    if (typeof window !== "undefined") {
      try {
        soundManager.play("shoot")
      } catch (error) {
        console.warn("Error playing shoot sound:", error)
      }
    }

    // Add recoil with some randomness
    const recoilIncrement = 0.03 + Math.random() * 0.01
    cameraRecoil.current = Math.min(0.15, cameraRecoil.current + recoilIncrement)

    // Add visual recoil for the weapon model
    visualRecoil.current = 0.2

    // Show muzzle flash
    if (muzzleFlashRef.current) {
      muzzleFlashRef.current.visible = true
      setTimeout(() => {
        if (muzzleFlashRef.current) {
          muzzleFlashRef.current.visible = false
        }
      }, 50) // Flash duration in ms
    }

    // Create bullet trail
    if (weaponRef.current) {
      const start = new THREE.Vector3()
      weaponRef.current.getWorldPosition(start)

      const direction = new THREE.Vector3(0, 0, -1)
      direction.applyQuaternion(camera.quaternion)

      const end = new THREE.Vector3()
      end.copy(start).add(direction.multiplyScalar(100))

      addBulletTrail({
        start,
        end,
        timestamp: Date.now(),
        intensity: 0.25, // Reduced effect to 1/4
      })
    }
  }

  // Function to handle weapon reloading
  const reloadWeapon = () => {
    if (isReloading.current || ammo.current >= 30 || ammo.reserve <= 0) return

    isReloading.current = true

    // Play reload sound
    if (typeof window !== "undefined") {
      try {
        soundManager.play("reload")
      } catch (error) {
        console.warn("Error playing reload sound:", error)
      }
    }

    // Reload after a delay
    setTimeout(() => {
      const reloadAmount = Math.min(30 - ammo.current, ammo.reserve)

      setAmmo((prev) => ({
        current: prev.current + reloadAmount,
        reserve: prev.reserve - reloadAmount,
      }))

      isReloading.current = false
    }, 1500) // 1.5 second reload time

    if (onAmmoChange) {
      onAmmoChange({
        current: Math.min(ammo.current + (30 - ammo.current), 30),
        reserve: ammo.reserve - Math.min(30 - ammo.current, ammo.reserve),
      })
    }
  }

  // Handle weapon positioning, recoil, and auto-fire in the animation frame
  useFrame(() => {
    if (!weaponRef.current || !isLocked) return

    const time = clock.getElapsedTime()
    const deltaTime = time - lastFrameTime.current
    lastFrameTime.current = time

    // Check for auto-fire if mouse is down
    if (isMouseDown.current && !isReloading.current) {
      fireWeapon()
    }

    // Get current camera rotation
    const euler = new THREE.Euler().setFromQuaternion(camera.quaternion, "YXZ")

    // Store original pitch when not in recoil
    if (cameraRecoil.current === 0 && !isRecovering.current) {
      originalCameraPitch.current = euler.x
    }

    // Apply camera recoil (screen movement)
    if (cameraRecoil.current > 0) {
      // REVERSED: Apply recoil to camera pitch (positive value to move upward in Three.js)
      euler.x = originalCameraPitch.current + cameraRecoil.current

      // Apply the updated rotation to camera
      camera.quaternion.setFromEuler(euler)

      // Recover from recoil
      isRecovering.current = true
      cameraRecoil.current = Math.max(0, cameraRecoil.current - deltaTime * 0.3)

      // Reset recovery flag when recoil is complete
      if (cameraRecoil.current === 0) {
        isRecovering.current = false
      }
    }

    // Position weapon in front of camera
    const offset = new THREE.Vector3(0.3, -0.3, -0.5)
    offset.applyQuaternion(camera.quaternion)
    weaponRef.current.position.copy(camera.position).add(offset)

    // Base weapon orientation follows camera
    weaponRef.current.quaternion.copy(camera.quaternion)

    // Apply visual recoil to weapon (kicks upward)
    if (visualRecoil.current > 0) {
      // Apply rotation to the weapon model
      weaponRef.current.rotateX(-visualRecoil.current) // Negative to pitch up

      // Recover from visual recoil
      visualRecoil.current = Math.max(0, visualRecoil.current - deltaTime * 1.5)
    }

    // Apply weapon sway
    weaponRef.current.position.y += Math.sin(time * 2) * 0.002
  })

  return (
    <group ref={weaponRef}>
      {/* Simple weapon model using instanced meshes */}
      <mesh position={[0, 0, 0]} geometry={barrelGeometry} material={barrelMaterial} />
      <mesh position={[0, -0.06, 0.05]} geometry={gripGeometry} material={gripMaterial} />
      <mesh position={[0, 0, -0.2]} geometry={muzzleGeometry} material={muzzleMaterial} />

      {/* Muzzle flash */}
      <mesh
        ref={muzzleFlashRef}
        position={[0, 0, -0.25]}
        rotation={[0, 0, 0]}
        geometry={muzzleFlashGeometry}
        material={muzzleFlashMaterial}
        visible={false}
      />
    </group>
  )
}
