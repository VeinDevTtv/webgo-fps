"use client"

import { useRef, useMemo, useState } from "react"
import { useFrame } from "@react-three/fiber"
import * as THREE from "three"

interface DoorProps {
  position: [number, number, number]
  normal?: [number, number, number]
  isGhost?: boolean
  scale?: number
  id?: string
  isOpen?: boolean
  rotation?: number // Additional rotation for the door orientation
}

export default function Door({
  position,
  normal = [0, 1, 0],
  isGhost = false,
  scale = 1,
  id,
  isOpen = false,
  rotation = 0,
}: DoorProps) {
  const doorRef = useRef<THREE.Group>(null)
  const [doorOpenAmount, setDoorOpenAmount] = useState(isOpen ? 1 : 0)

  // Calculate rotation to align with terrain normal
  const baseRotation = useMemo(() => {
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

    return [euler.x, euler.y + rotation, euler.z]
  }, [normal, rotation])

  // Animate door opening/closing
  useFrame((state) => {
    if (!doorRef.current) return

    // Smoothly animate door opening/closing
    const targetOpenAmount = isOpen ? 1 : 0
    const currentOpenAmount = doorOpenAmount

    if (Math.abs(targetOpenAmount - currentOpenAmount) > 0.01) {
      const newOpenAmount = THREE.MathUtils.lerp(currentOpenAmount, targetOpenAmount, 0.1)
      setDoorOpenAmount(newOpenAmount)

      // Apply rotation to door
      doorRef.current.rotation.y = newOpenAmount * Math.PI * 0.8 // Open up to ~145 degrees
    }
  })

  return (
    <group position={position} rotation={baseRotation} scale={scale}>
      {/* Door frame */}
      <group>
        {/* Top of frame */}
        <mesh position={[0, 1, 0]}>
          <boxGeometry args={[1.1, 0.1, 0.2]} />
          <meshStandardMaterial
            color={isGhost ? "#8B4513" : "#5d4e37"}
            transparent={isGhost}
            opacity={isGhost ? 0.5 : 1}
            roughness={0.8}
          />
        </mesh>

        {/* Left side of frame */}
        <mesh position={[-0.5, 0.5, 0]}>
          <boxGeometry args={[0.1, 1.1, 0.2]} />
          <meshStandardMaterial
            color={isGhost ? "#8B4513" : "#5d4e37"}
            transparent={isGhost}
            opacity={isGhost ? 0.5 : 1}
            roughness={0.8}
          />
        </mesh>

        {/* Right side of frame */}
        <mesh position={[0.5, 0.5, 0]}>
          <boxGeometry args={[0.1, 1.1, 0.2]} />
          <meshStandardMaterial
            color={isGhost ? "#8B4513" : "#5d4e37"}
            transparent={isGhost}
            opacity={isGhost ? 0.5 : 1}
            roughness={0.8}
          />
        </mesh>
      </group>

      {/* Door (pivots from the left side) */}
      <group ref={doorRef} position={[-0.45, 0.5, 0]}>
        <mesh position={[0.45, 0, 0]}>
          <boxGeometry args={[0.9, 0.98, 0.05]} />
          <meshStandardMaterial
            color={isGhost ? "#A0522D" : "#8B4513"}
            transparent={isGhost}
            opacity={isGhost ? 0.5 : 1}
            roughness={0.7}
          />
        </mesh>

        {/* Door handle */}
        <mesh position={[0.8, 0, 0.03]}>
          <cylinderGeometry args={[0.02, 0.02, 0.15, 8]} rotation={[Math.PI / 2, 0, 0]} />
          <meshStandardMaterial
            color={isGhost ? "#C0C0C0" : "#A9A9A9"}
            transparent={isGhost}
            opacity={isGhost ? 0.5 : 1}
            metalness={0.8}
            roughness={0.2}
          />
        </mesh>
      </group>
    </group>
  )
}
