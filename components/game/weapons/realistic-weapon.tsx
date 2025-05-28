"use client"

import { useRef, useState, useEffect } from "react"
import { useFrame, useThree } from "@react-three/fiber"
import * as THREE from "three"
import { useGameState } from "@/lib/game-context"
import { useSoundManager } from "@/lib/sound-manager"
import { CombatSystem } from "@/systems/combat-system"
import { GAME_CONFIG } from "@/lib/config/game-config"

interface RealisticWeaponProps {
  isLocked: boolean
  combatSystem?: CombatSystem
  onAmmoChange?: (ammo: { current: number; reserve: number }) => void
  onScreenShake?: (intensity: number) => void
  onMuzzleFlash?: () => void
}

interface BulletDecal {
  id: string
  position: THREE.Vector3
  normal: THREE.Vector3
  timestamp: number
}

interface TracerRound {
  id: string
  start: THREE.Vector3
  end: THREE.Vector3
  currentPosition: THREE.Vector3
  velocity: THREE.Vector3
  timestamp: number
  lifetime: number
}

// Create reusable geometries and materials
const barrelGeometry = new THREE.BoxGeometry(0.05, 0.05, 0.3)
const barrelMaterial = new THREE.MeshStandardMaterial({ color: "#333333" })

const gripGeometry = new THREE.BoxGeometry(0.04, 0.1, 0.2)
const gripMaterial = new THREE.MeshStandardMaterial({ color: "#222222" })

const muzzleGeometry = new THREE.BoxGeometry(0.03, 0.03, 0.1)
const muzzleMaterial = new THREE.MeshStandardMaterial({ color: "#111111" })

// Enhanced muzzle flash
const muzzleFlashGeometry = new THREE.ConeGeometry(0.08, 0.15, 8)
const muzzleFlashMaterial = new THREE.MeshBasicMaterial({
  color: "#ffaa00",
  transparent: true,
  opacity: 0.9,
})

// Tracer material
const tracerMaterial = new THREE.MeshBasicMaterial({
  color: "#ffff00",
  transparent: true,
  opacity: 0.8,
})

export default function RealisticWeapon({ 
  isLocked, 
  combatSystem, 
  onAmmoChange, 
  onScreenShake,
  onMuzzleFlash 
}: RealisticWeaponProps) {
  const { camera, scene } = useThree()
  const weaponRef = useRef<THREE.Group>(null)
  const muzzleFlashRef = useRef<THREE.Mesh>(null)
  const [isShooting, setIsShooting] = useState(false)
  const { addBulletTrail } = useGameState()
  const clock = useThree((state) => state.clock)
  const soundManager = useSoundManager()
  const firstRender = useRef(true)

  // Current weapon data (default to rifle)
  const [currentWeapon] = useState(GAME_CONFIG.WEAPONS.TYPES.RIFLE)
  
  // Ammo state - fix type issue
  const [ammo, setAmmo] = useState<{ current: number; reserve: number }>({ 
    current: currentWeapon.ammo.current, 
    reserve: currentWeapon.ammo.reserve 
  })

  // Enhanced weapon state
  const [bulletDecals, setBulletDecals] = useState<BulletDecal[]>([])
  const [tracerRounds, setTracerRounds] = useState<TracerRound[]>([])

  // Refs for tracking firing state
  const isReloading = useRef(false)
  const isMouseDown = useRef(false)
  const lastFireTime = useRef(0)
  const lastFrameTime = useRef(0)

  // Enhanced recoil tracking
  const cameraRecoil = useRef({ x: 0, y: 0 })
  const visualRecoil = useRef({ x: 0, y: 0, z: 0 })
  const originalCameraRotation = useRef({ x: 0, y: 0 })
  const isRecovering = useRef(false)
  const recoilPattern = useRef(0) // Track recoil pattern progression

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
        // Reset recoil pattern when stopping fire
        recoilPattern.current = 0
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

  // Function to fire the weapon with enhanced physics
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

    // Enhanced recoil with pattern
    const baseRecoil = currentWeapon.recoil
    const patternMultiplier = 1 + (recoilPattern.current * 0.1) // Increase recoil with sustained fire
    const horizontalRecoil = (Math.random() - 0.5) * baseRecoil * 0.5
    const verticalRecoil = baseRecoil * patternMultiplier

    cameraRecoil.current.x += horizontalRecoil
    cameraRecoil.current.y += verticalRecoil
    recoilPattern.current = Math.min(recoilPattern.current + 1, 10)

    // Enhanced visual recoil
    visualRecoil.current.x = 0.3
    visualRecoil.current.y = 0.1
    visualRecoil.current.z = 0.2

    // Screen shake
    if (onScreenShake) {
      onScreenShake(baseRecoil * 2)
    }

    // Enhanced muzzle flash
    if (muzzleFlashRef.current) {
      muzzleFlashRef.current.visible = true
      muzzleFlashRef.current.scale.setScalar(0.8 + Math.random() * 0.4)
      muzzleFlashRef.current.rotation.z = Math.random() * Math.PI * 2
      
      if (onMuzzleFlash) {
        onMuzzleFlash()
      }

      setTimeout(() => {
        if (muzzleFlashRef.current) {
          muzzleFlashRef.current.visible = false
        }
      }, GAME_CONFIG.WEAPONS.MUZZLE_FLASH_DURATION)
    }

    // Create projectile with physics
    if (weaponRef.current) {
      const start = new THREE.Vector3()
      weaponRef.current.getWorldPosition(start)

      // Apply weapon spread
      const spread = (1 - currentWeapon.accuracy) * 0.02
      const direction = new THREE.Vector3(0, 0, -1)
      direction.applyQuaternion(camera.quaternion)
      
      // Add spread
      direction.x += (Math.random() - 0.5) * spread
      direction.y += (Math.random() - 0.5) * spread
      direction.z += (Math.random() - 0.5) * spread
      direction.normalize()

      // Create tracer round (every 5th shot)
      if (Math.random() < 0.2) {
        const tracerId = `tracer_${Date.now()}_${Math.random()}`
        const tracerEnd = start.clone().add(direction.clone().multiplyScalar(currentWeapon.range))
        
        setTracerRounds(prev => [...prev, {
          id: tracerId,
          start: start.clone(),
          end: tracerEnd,
          currentPosition: start.clone(),
          velocity: direction.clone().multiplyScalar(200), // m/s
          timestamp: now,
          lifetime: 2000 // 2 seconds
        }])
      }

      // Fire weapon through combat system if available
      if (combatSystem) {
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
          intensity: result.hit ? 0.7 : 0.4, // Brighter trail if we hit something
        })

        // Create bullet decal if hit something
        if (result.hit && result.hits.length > 0) {
          const hit = result.hits[0]
          const decalId = `decal_${Date.now()}_${Math.random()}`
          
          setBulletDecals(prev => [...prev, {
            id: decalId,
            position: hit.position,
            normal: new THREE.Vector3(0, 1, 0), // Simplified normal
            timestamp: now
          }])
        }
      } else {
        // Fallback: create basic bullet trail
        const end = new THREE.Vector3()
        end.copy(start).add(direction.multiplyScalar(currentWeapon.range))

        addBulletTrail({
          start,
          end,
          timestamp: Date.now(),
          intensity: 0.4,
        })
      }
    }
  }

  // Reload function
  const reloadWeapon = () => {
    if (isReloading.current || ammo.current === currentWeapon.ammo.current || ammo.reserve === 0) return

    isReloading.current = true
    
    try {
      soundManager.play("reload")
    } catch (error) {
      console.warn("Error playing reload sound:", error)
    }

    setTimeout(() => {
      const ammoNeeded = currentWeapon.ammo.current - ammo.current
      const ammoToReload = Math.min(ammoNeeded, ammo.reserve)
      
      const newAmmo = {
        current: ammo.current + ammoToReload,
        reserve: ammo.reserve - ammoToReload,
      }
      
      setAmmo(newAmmo)
      if (onAmmoChange) {
        onAmmoChange(newAmmo)
      }
      
      isReloading.current = false
    }, 2000) // 2 second reload time
  }

  // Handle weapon positioning, recoil, and auto-fire in the animation frame
  useFrame((state, delta) => {
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

    // Store original rotation when not in recoil
    if (cameraRecoil.current.x === 0 && cameraRecoil.current.y === 0 && !isRecovering.current) {
      originalCameraRotation.current.x = euler.x
      originalCameraRotation.current.y = euler.y
    }

    // Apply enhanced camera recoil
    if (cameraRecoil.current.x !== 0 || cameraRecoil.current.y !== 0) {
      euler.x = originalCameraRotation.current.x + cameraRecoil.current.y
      euler.y = originalCameraRotation.current.y + cameraRecoil.current.x

      // Apply the updated rotation to camera
      camera.quaternion.setFromEuler(euler)

      // Recover from recoil
      isRecovering.current = true
      const recoverySpeed = GAME_CONFIG.WEAPONS.RECOIL_RECOVERY * 2
      cameraRecoil.current.x = THREE.MathUtils.lerp(cameraRecoil.current.x, 0, recoverySpeed * deltaTime)
      cameraRecoil.current.y = THREE.MathUtils.lerp(cameraRecoil.current.y, 0, recoverySpeed * deltaTime)

      // Reset recovery flag when recoil is complete
      if (Math.abs(cameraRecoil.current.x) < 0.001 && Math.abs(cameraRecoil.current.y) < 0.001) {
        cameraRecoil.current.x = 0
        cameraRecoil.current.y = 0
        isRecovering.current = false
      }
    }

    // Position weapon in front of camera
    const offset = new THREE.Vector3(0.3, -0.3, -0.5)
    offset.applyQuaternion(camera.quaternion)
    weaponRef.current.position.copy(camera.position).add(offset)

    // Base weapon orientation follows camera
    weaponRef.current.quaternion.copy(camera.quaternion)

    // Apply enhanced visual recoil to weapon
    if (visualRecoil.current.x > 0 || visualRecoil.current.y > 0 || visualRecoil.current.z > 0) {
      weaponRef.current.rotateX(-visualRecoil.current.x)
      weaponRef.current.rotateY(visualRecoil.current.y)
      weaponRef.current.position.z += visualRecoil.current.z

      // Recover from visual recoil
      const visualRecoverySpeed = 3.0
      visualRecoil.current.x = Math.max(0, visualRecoil.current.x - deltaTime * visualRecoverySpeed)
      visualRecoil.current.y = Math.max(0, visualRecoil.current.y - deltaTime * visualRecoverySpeed)
      visualRecoil.current.z = Math.max(0, visualRecoil.current.z - deltaTime * visualRecoverySpeed)
    }

    // Apply weapon sway
    weaponRef.current.position.y += Math.sin(time * 2) * 0.002
    weaponRef.current.rotation.z += Math.sin(time * 1.5) * 0.001

    // Update tracer rounds
    setTracerRounds(prev => prev.filter(tracer => {
      const age = performance.now() - tracer.timestamp
      if (age > tracer.lifetime) return false

      // Update tracer position with physics
      tracer.currentPosition.add(tracer.velocity.clone().multiplyScalar(delta))
      
      // Apply gravity (simplified)
      tracer.velocity.y -= 9.81 * delta

      return true
    }))

    // Cleanup old bullet decals (after 30 seconds)
    setBulletDecals(prev => prev.filter(decal => {
      const age = performance.now() - decal.timestamp
      return age < 30000
    }))
  })

  return (
    <group ref={weaponRef}>
      {/* Enhanced weapon model */}
      <mesh position={[0, 0, 0]} geometry={barrelGeometry} material={barrelMaterial} />
      <mesh position={[0, -0.06, 0.05]} geometry={gripGeometry} material={gripMaterial} />
      <mesh position={[0, 0, -0.2]} geometry={muzzleGeometry} material={muzzleMaterial} />

      {/* Enhanced muzzle flash */}
      <mesh
        ref={muzzleFlashRef}
        position={[0, 0, -0.25]}
        rotation={[0, 0, 0]}
        geometry={muzzleFlashGeometry}
        material={muzzleFlashMaterial}
        visible={false}
      />

      {/* Render tracer rounds */}
      {tracerRounds.map(tracer => (
        <mesh
          key={tracer.id}
          position={[tracer.currentPosition.x, tracer.currentPosition.y, tracer.currentPosition.z]}
          material={tracerMaterial}
        >
          <sphereGeometry args={[0.02, 4, 4]} />
        </mesh>
      ))}

      {/* Render bullet decals */}
      {bulletDecals.map(decal => (
        <mesh
          key={decal.id}
          position={[decal.position.x, decal.position.y, decal.position.z]}
        >
          <circleGeometry args={[0.05, 8]} />
          <meshBasicMaterial color="#333333" transparent opacity={0.6} />
        </mesh>
      ))}
    </group>
  )
} 