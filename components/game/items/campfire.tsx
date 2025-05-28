"use client"

import { useRef, useMemo, useState } from "react"
import { useFrame } from "@react-three/fiber"
import * as THREE from "three"

interface CampfireProps {
  position: [number, number, number]
  normal?: [number, number, number]
  isGhost?: boolean
  scale?: number
  id?: string
  isActive?: boolean
}

export default function Campfire({
  position,
  normal = [0, 1, 0],
  isGhost = false,
  scale = 1,
  id,
  isActive = false,
}: CampfireProps) {
  const fireRef = useRef<THREE.Group>(null)
  const lightRef = useRef<THREE.PointLight>(null)
  const emberGroupRef = useRef<THREE.Group>(null)

  // Create embers
  const [embers] = useState(() =>
    Array.from({ length: 15 }, () => ({
      position: [(Math.random() - 0.5) * 0.2, Math.random() * 0.1, (Math.random() - 0.5) * 0.2],
      scale: 0.01 + Math.random() * 0.01,
      speed: 0.2 + Math.random() * 0.3,
      rotationSpeed: Math.random() * 0.1,
      lifetime: 1 + Math.random() * 2,
      initialLifetime: 1 + Math.random() * 2,
      horizontalSpeed: (Math.random() - 0.5) * 0.05,
    })),
  )

  // Calculate rotation to align with terrain normal
  const rotation = useMemo(() => {
    // Default up vector
    const up = new THREE.Vector3(0, 1, 0)
    // Convert normal to Vector3
    const normalVector = new THREE.Vector3(normal[0], normal[1], normal[2])

    // Create quaternion for rotation from up to normal
    const quaternion = new THREE.Quaternion()
    quaternion.setFromUnitVectors(up, normalVector)

    // Convert to Euler angles
    const euler = new THREE.Euler()
    euler.setFromQuaternion(quaternion)

    return [euler.x, euler.y, euler.z]
  }, [normal])

  // Animate the fire and embers
  useFrame((state) => {
    // Make sure the fire and ember refs exist
    if (!fireRef.current || !emberGroupRef.current) return

    // If not active, hide the fire elements but don't return early
    if (!isActive) {
      // Hide fire elements when not active
      if (fireRef.current) fireRef.current.visible = false
      if (emberGroupRef.current) emberGroupRef.current.visible = false
      if (lightRef.current) lightRef.current.intensity = 0
      return
    }

    // Show fire elements when active
    if (fireRef.current) fireRef.current.visible = true
    if (emberGroupRef.current) emberGroupRef.current.visible = true

    // Animate flames with enhanced pulsing
    if (fireRef.current) {
      fireRef.current.children.forEach((child, index) => {
        if (child instanceof THREE.Mesh) {
          const time = state.clock.elapsedTime

          // Create different frequencies for more natural movement
          const frequency1 = 2 + index * 0.3
          const frequency2 = 3 + index * 0.2
          const frequency3 = 1.5 + index * 0.4

          // Create more pronounced pulsing effect
          const pulseX = Math.sin(time * frequency1) * 0.25 + 0.75
          const pulseZ = Math.sin(time * frequency2 + Math.PI / 3) * 0.25 + 0.75
          const pulseY = Math.sin(time * frequency3 + Math.PI / 2) * 0.15 + 0.85

          // Apply pulsing to scale
          child.scale.x = pulseX
          child.scale.z = pulseZ
          child.scale.y = pulseY

          // Add some vertical movement
          child.position.y = 0.3 + Math.sin(time * (1 + index * 0.3)) * 0.05

          // Add some rotation for more dynamic effect
          child.rotation.y = Math.sin(time * (0.5 + index * 0.2)) * 0.3
        }
      })
    }

    // Animate embers
    if (emberGroupRef.current && isActive) {
      emberGroupRef.current.children.forEach((ember, i) => {
        if (ember instanceof THREE.Mesh) {
          // Update ember position
          ember.position.y += embers[i].speed * state.delta
          ember.position.x += embers[i].horizontalSpeed * Math.sin(state.clock.elapsedTime * 2) * state.delta
          ember.position.z += embers[i].horizontalSpeed * Math.cos(state.clock.elapsedTime * 2) * state.delta

          // Rotate ember
          ember.rotation.x += embers[i].rotationSpeed
          ember.rotation.z += embers[i].rotationSpeed * 0.7

          // Update lifetime and handle respawn
          embers[i].lifetime -= state.delta

          if (embers[i].lifetime <= 0) {
            // Reset ember
            ember.position.set((Math.random() - 0.5) * 0.2, 0.1 + Math.random() * 0.1, (Math.random() - 0.5) * 0.2)
            embers[i].lifetime = embers[i].initialLifetime
            ember.visible = true
            ember.scale.setScalar(0.01 + Math.random() * 0.01)
          }

          // Fade out near end of lifetime
          if (embers[i].lifetime < 0.5) {
            ember.scale.multiplyScalar(0.95)
          }
        }
      })
    }

    // Animate light
    if (lightRef.current) {
      // More dynamic light flickering
      const noise =
        Math.sin(state.clock.elapsedTime * 15) * 0.2 +
        Math.sin(state.clock.elapsedTime * 7.3) * 0.1 +
        Math.sin(state.clock.elapsedTime * 3.1) * 0.3

      lightRef.current.intensity = 2 + noise

      // Subtle color shift
      const hue = Math.sin(state.clock.elapsedTime * 0.5) * 0.05 + 0.1 // Subtle shift between orange and yellow
      lightRef.current.color.setHSL(hue, 1, 0.5)
    }
  })

  return (
    <group position={position} rotation={rotation} scale={scale}>
      {/* Natural wood pile arrangement - lowered to touch the ground */}
      <group position={[0, -0.17, 0]}>
        {/* Base layer - horizontal logs on the ground */}
        <mesh position={[-0.15, 0, 0.1]} rotation={[0, 0.3, Math.PI / 2]}>
          <cylinderGeometry args={[0.04, 0.035, 0.5, 6]} />
          <meshStandardMaterial
            color={isGhost ? "#8B4513" : "#4a3c28"}
            transparent={isGhost}
            opacity={isGhost ? 0.5 : 1}
          />
        </mesh>
        <mesh position={[0.15, 0, -0.1]} rotation={[0, -0.3, Math.PI / 2]}>
          <cylinderGeometry args={[0.035, 0.04, 0.45, 6]} />
          <meshStandardMaterial
            color={isGhost ? "#8B4513" : "#5d4e37"}
            transparent={isGhost}
            opacity={isGhost ? 0.5 : 1}
          />
        </mesh>

        {/* Second layer - crossed logs */}
        <mesh position={[-0.1, 0.03, -0.15]} rotation={[0.1, 0.8, Math.PI / 2]}>
          <cylinderGeometry args={[0.03, 0.035, 0.4, 6]} />
          <meshStandardMaterial
            color={isGhost ? "#8B4513" : "#3e2f1f"}
            transparent={isGhost}
            opacity={isGhost ? 0.5 : 1}
          />
        </mesh>
        <mesh position={[0.1, 0.03, 0.15]} rotation={[-0.1, -0.8, Math.PI / 2]}>
          <cylinderGeometry args={[0.035, 0.03, 0.4, 6]} />
          <meshStandardMaterial
            color={isGhost ? "#8B4513" : "#4a3c28"}
            transparent={isGhost}
            opacity={isGhost ? 0.5 : 1}
          />
        </mesh>

        {/* Teepee structure - main vertical logs */}
        <mesh position={[-0.12, 0.18, -0.12]} rotation={[0.4, 0, 0.4]}>
          <cylinderGeometry args={[0.025, 0.04, 0.4, 6]} />
          <meshStandardMaterial
            color={isGhost ? "#8B4513" : "#5d4e37"}
            transparent={isGhost}
            opacity={isGhost ? 0.5 : 1}
          />
        </mesh>
        <mesh position={[0.12, 0.18, -0.12]} rotation={[0.4, 0, -0.4]}>
          <cylinderGeometry args={[0.025, 0.04, 0.4, 6]} />
          <meshStandardMaterial
            color={isGhost ? "#8B4513" : "#4a3c28"}
            transparent={isGhost}
            opacity={isGhost ? 0.5 : 1}
          />
        </mesh>
        <mesh position={[0.12, 0.18, 0.12]} rotation={[-0.4, 0, -0.4]}>
          <cylinderGeometry args={[0.025, 0.04, 0.4, 6]} />
          <meshStandardMaterial
            color={isGhost ? "#8B4513" : "#3e2f1f"}
            transparent={isGhost}
            opacity={isGhost ? 0.5 : 1}
          />
        </mesh>
        <mesh position={[-0.12, 0.18, 0.12]} rotation={[-0.4, 0, 0.4]}>
          <cylinderGeometry args={[0.025, 0.04, 0.4, 6]} />
          <meshStandardMaterial
            color={isGhost ? "#8B4513" : "#5d4e37"}
            transparent={isGhost}
            opacity={isGhost ? 0.5 : 1}
          />
        </mesh>

        {/* Additional smaller logs for realism */}
        <mesh position={[0.08, 0.13, 0]} rotation={[0, 1.2, 0.3]}>
          <cylinderGeometry args={[0.02, 0.025, 0.3, 5]} />
          <meshStandardMaterial
            color={isGhost ? "#8B4513" : "#4a3c28"}
            transparent={isGhost}
            opacity={isGhost ? 0.5 : 1}
          />
        </mesh>
        <mesh position={[-0.08, 0.13, 0]} rotation={[0, -1.2, -0.3]}>
          <cylinderGeometry args={[0.02, 0.025, 0.3, 5]} />
          <meshStandardMaterial
            color={isGhost ? "#8B4513" : "#3e2f1f"}
            transparent={isGhost}
            opacity={isGhost ? 0.5 : 1}
          />
        </mesh>

        {/* Small kindling and twigs */}
        <mesh position={[0, -0.01, 0.05]} rotation={[0, 0.5, Math.PI / 2]}>
          <cylinderGeometry args={[0.01, 0.01, 0.15, 4]} />
          <meshStandardMaterial
            color={isGhost ? "#8B4513" : "#2d2416"}
            transparent={isGhost}
            opacity={isGhost ? 0.5 : 1}
          />
        </mesh>
        <mesh position={[0.05, -0.01, -0.05]} rotation={[0, -0.7, Math.PI / 2]}>
          <cylinderGeometry args={[0.01, 0.01, 0.12, 4]} />
          <meshStandardMaterial
            color={isGhost ? "#8B4513" : "#3e2f1f"}
            transparent={isGhost}
            opacity={isGhost ? 0.5 : 1}
          />
        </mesh>
        <mesh position={[-0.03, -0.01, 0.03]} rotation={[0, 1.2, Math.PI / 2]}>
          <cylinderGeometry args={[0.008, 0.008, 0.1, 4]} />
          <meshStandardMaterial
            color={isGhost ? "#8B4513" : "#2d2416"}
            transparent={isGhost}
            opacity={isGhost ? 0.5 : 1}
          />
        </mesh>

        {/* Charred/burnt pieces for added realism */}
        <mesh position={[0, -0.02, 0]}>
          <boxGeometry args={[0.15, 0.02, 0.15]} />
          <meshStandardMaterial
            color={isGhost ? "#8B4513" : "#1a1410"}
            transparent={isGhost}
            opacity={isGhost ? 0.5 : 1}
          />
        </mesh>
      </group>

      {/* Stone ring - fixed sizes, no random pulsating */}
      {Array.from({ length: 8 }).map((_, i) => {
        const angle = (i / 8) * Math.PI * 2
        const x = Math.cos(angle) * 0.6
        const z = Math.sin(angle) * 0.6
        // Use deterministic variation based on index instead of random
        const stoneScale = 0.8 + (i % 3) * 0.2
        return (
          <mesh key={i} position={[x, -0.17, z]}>
            <boxGeometry args={[0.15 * stoneScale, 0.15 * stoneScale, 0.15 * stoneScale]} />
            <meshStandardMaterial
              color={isGhost ? "#696969" : "#555555"}
              transparent={isGhost}
              opacity={isGhost ? 0.5 : 1}
              roughness={0.9}
            />
          </mesh>
        )
      })}

      {/* Enhanced fire effect - only visible when active */}
      {isActive && (
        <>
          {/* Main flames with enhanced pulsing - adjusted to match wood position */}
          <group ref={fireRef} position={[0, -0.17, 0]}>
            {/* Main flame - orange */}
            <mesh position={[0, 0.23, 0]}>
              <coneGeometry args={[0.15, 0.4, 8]} />
              <meshBasicMaterial color="#ff6b00" transparent opacity={0.8} />
            </mesh>

            {/* Inner flame - yellow */}
            <mesh position={[0, 0.13, 0]}>
              <coneGeometry args={[0.1, 0.3, 8]} />
              <meshBasicMaterial color="#ffcc00" transparent opacity={0.9} />
            </mesh>

            {/* Additional flame variations */}
            <mesh position={[0.05, 0.18, 0.05]}>
              <coneGeometry args={[0.05, 0.2, 5]} />
              <meshBasicMaterial color="#ff9500" transparent opacity={0.7} />
            </mesh>
            <mesh position={[-0.05, 0.18, -0.05]}>
              <coneGeometry args={[0.05, 0.2, 5]} />
              <meshBasicMaterial color="#ff9500" transparent opacity={0.7} />
            </mesh>

            {/* Small dancing flames */}
            <mesh position={[0.08, 0.15, 0.08]}>
              <coneGeometry args={[0.03, 0.15, 4]} />
              <meshBasicMaterial color="#ffcc00" transparent opacity={0.8} />
            </mesh>
            <mesh position={[-0.08, 0.15, -0.08]}>
              <coneGeometry args={[0.03, 0.15, 4]} />
              <meshBasicMaterial color="#ffcc00" transparent opacity={0.8} />
            </mesh>

            {/* Additional small flames for more variation */}
            <mesh position={[0.03, 0.2, -0.06]}>
              <coneGeometry args={[0.025, 0.12, 4]} />
              <meshBasicMaterial color="#ffcc00" transparent opacity={0.8} />
            </mesh>
            <mesh position={[-0.03, 0.2, 0.06]}>
              <coneGeometry args={[0.025, 0.12, 4]} />
              <meshBasicMaterial color="#ffcc00" transparent opacity={0.8} />
            </mesh>

            {/* Base glow */}
            <mesh position={[0, 0.05, 0]} rotation={[Math.PI / 2, 0, 0]}>
              <planeGeometry args={[0.3, 0.3]} />
              <meshBasicMaterial color="#ff6b00" transparent opacity={0.3} side={THREE.DoubleSide} />
            </mesh>
          </group>

          {/* Ember particles - adjusted to match wood position */}
          <group ref={emberGroupRef} position={[0, -0.17, 0]}>
            {embers.map((ember, i) => (
              <mesh
                key={`ember-${i}`}
                position={[ember.position[0], ember.position[1], ember.position[2]]}
                scale={ember.scale}
              >
                <octahedronGeometry args={[1, 0]} />
                <meshBasicMaterial color={i % 2 === 0 ? "#ff9500" : "#ffcc00"} />
              </mesh>
            ))}
          </group>

          {/* Dynamic light with more realistic flickering - adjusted to match wood position */}
          <pointLight ref={lightRef} position={[0, 0.26, 0]} color="#ff6b00" intensity={2} distance={10} decay={2} />

          {/* Ambient glow - adjusted to match wood position */}
          <pointLight position={[0, -0.04, 0]} color="#ffcc00" intensity={0.5} distance={5} decay={2} />

          {/* Ground illumination */}
          <pointLight position={[0, -0.27, 0]} color="#ff6b00" intensity={0.3} distance={3} decay={2} />
        </>
      )}
    </group>
  )
}
