"use client"

import { useRef, useState, useEffect } from "react"
import { useFrame, useThree } from "@react-three/fiber"
import * as THREE from "three"
import { useGameState } from "@/lib/game-state-context"
import { useSoundManager } from "@/lib/sound-manager"
import { CombatSystem } from "@/systems/combat-system"
import { GAME_CONFIG } from "@/lib/config/game-config"

interface EnhancedWeaponProps {
  isLocked: boolean
  combatSystem?: CombatSystem
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

export default function EnhancedWeapon({ isLocked, combatSystem, onAmmoChange }: EnhancedWeaponProps) {
  const { camera } = useThree()
  const weaponRef = useRef<THREE.Group>(null)
  const muzzleFlashRef = useRef<THREE.Mesh>(null)
  const [isShooting, setIsShooting] = useState(false)
  const { addBulletTrail } = useGameState()
  const clock = useThree((state) => state.clock)
  const soundManager = useSoundManager()
  const firstRender = useRef(true)

  // Current weapon data (default to rifle)
  const [currentWeapon] = useState(GAME_CONFIG.WEAPONS.TYPES.RIFLE)
  
  // Ammo state
  const [ammo, setAmmo] = useState({ 
    current: currentWeapon.ammo.current, 
    reserve: currentWeapon.ammo.reserve 
  })

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

  // Mouse event handlers
  useEffect(() => {
    if (!isLocked) return

    const handleMouseDown = (event: MouseEvent) => {
      if (event.button === 0) { // Left click
        isMouseDown.current = true
        fireWeapon()
      }
    }

    const handleMouseUp = (event: MouseEvent) => {
      if (event.button === 0) { // Left click
        isMouseDown.current = false
      }
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.code === "KeyR") {
        reloadWeapon()
      }
    }

    document.addEventListener("mousedown", handleMouseDown)
    document.addEventListener("mouseup", handleMouseUp)
    document.addEventListener("keydown", handleKeyDown)

    return () => {
      document.removeEventListener("mousedown", handleMouseDown)
      document.removeEventListener("mouseup", handleMouseUp)
      document.removeEventListener("keydown", handleKeyDown)
    }
  }, [isLocked])

  // Function to fire the weapon
  const fireWeapon = () => {
    if (isReloading.current) return

    const now = performance.now()
    if (now - lastFireTime.current < currentWeapon.fireRate) return

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
    const recoilIncrement = currentWeapon.recoil + Math.random() * GAME_CONFIG.WEAPONS.RECOIL_RANDOMNESS
    cameraRecoil.current = Math.min(GAME_CONFIG.WEAPONS.MAX_RECOIL, cameraRecoil.current + recoilIncrement)

    // Add visual recoil for the weapon model
    visualRecoil.current = 0.2

    // Show muzzle flash
    if (muzzleFlashRef.current) {
      muzzleFlashRef.current.visible = true
      setTimeout(() => {
        if (muzzleFlashRef.current) {
          muzzleFlashRef.current.visible = false
        }
      }, GAME_CONFIG.WEAPONS.MUZZLE_FLASH_DURATION)
    }

    // Fire weapon through combat system if available
    if (combatSystem && weaponRef.current) {
      const start = new THREE.Vector3()
      weaponRef.current.getWorldPosition(start)

      const direction = new THREE.Vector3(0, 0, -1)
      direction.applyQuaternion(camera.quaternion)

      const weaponData = {
        damage: currentWeapon.damage,
        range: currentWeapon.range,
        accuracy: currentWeapon.accuracy,
        weaponType: currentWeapon.id as 'rifle' | 'shotgun' | 'pistol'
      }

      const result = combatSystem.fireWeapon(start, direction, weaponData)
      
      // Create bullet trail using combat system result
      addBulletTrail({
        start: result.bulletTrail.start,
        end: result.bulletTrail.end,
        timestamp: Date.now(),
        intensity: result.hit ? 0.5 : 0.25, // Brighter trail if we hit something
      })
    } else {
      // Fallback: create basic bullet trail
      if (weaponRef.current) {
        const start = new THREE.Vector3()
        weaponRef.current.getWorldPosition(start)

        const direction = new THREE.Vector3(0, 0, -1)
        direction.applyQuaternion(camera.quaternion)

        const end = new THREE.Vector3()
        end.copy(start).add(direction.multiplyScalar(currentWeapon.range))

        addBulletTrail({
          start,
          end,
          timestamp: Date.now(),
          intensity: 0.25,
        })
      }
    }
  }

  // Function to handle weapon reloading
  const reloadWeapon = () => {
    const maxAmmo = currentWeapon.ammo.current
    if (isReloading.current || ammo.current >= maxAmmo || ammo.reserve <= 0) return

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
    const reloadTime = currentWeapon.id === 'shotgun' ? 2000 : 1500
    setTimeout(() => {
      const reloadAmount = Math.min(maxAmmo - ammo.current, ammo.reserve)

      const newAmmo = {
        current: ammo.current + reloadAmount,
        reserve: ammo.reserve - reloadAmount,
      }

      setAmmo(newAmmo)
      isReloading.current = false

      if (onAmmoChange) {
        onAmmoChange(newAmmo)
      }
    }, reloadTime)
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
      // Apply recoil to camera pitch (positive value to move upward in Three.js)
      euler.x = originalCameraPitch.current + cameraRecoil.current

      // Apply the updated rotation to camera
      camera.quaternion.setFromEuler(euler)

      // Recover from recoil
      isRecovering.current = true
      cameraRecoil.current = Math.max(0, cameraRecoil.current - deltaTime * GAME_CONFIG.WEAPONS.RECOIL_RECOVERY)

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