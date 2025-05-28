"use client"

import { useMemo } from "react"
import * as THREE from "three"

interface StorageBoxProps {
  position: [number, number, number]
  normal?: [number, number, number]
  isGhost?: boolean
  scale?: number
  id?: string
}

export default function StorageBox({ position, normal = [0, 1, 0], isGhost = false, scale = 1, id }: StorageBoxProps) {
  // Calculate rotation to align with terrain normal
  const rotation = useMemo(() => {
    const up = new THREE.Vector3(0, 1, 0)
    const normalVector = new THREE.Vector3(normal[0], normal[1], normal[2])
    const quaternion = new THREE.Quaternion()
    quaternion.setFromUnitVectors(up, normalVector)
    const euler = new THREE.Euler()
    euler.setFromQuaternion(quaternion)
    return [euler.x, euler.y, euler.z]
  }, [normal])

  return (
    <group position={position} rotation={rotation} scale={scale}>
      {/* Main box body */}
      <mesh position={[0, 0.25, 0]}>
        <boxGeometry args={[1.2, 0.5, 0.8]} />
        <meshStandardMaterial
          color={isGhost ? "#8B6914" : "#654321"}
          transparent={isGhost}
          opacity={isGhost ? 0.5 : 1}
          roughness={0.8}
          metalness={0.1}
        />
      </mesh>

      {/* Box lid */}
      <mesh position={[0, 0.51, 0]}>
        <boxGeometry args={[1.15, 0.08, 0.75]} />
        <meshStandardMaterial
          color={isGhost ? "#A0522D" : "#8B4513"}
          transparent={isGhost}
          opacity={isGhost ? 0.5 : 1}
          roughness={0.7}
          metalness={0.1}
        />
      </mesh>

      {/* Metal reinforcements - corners */}
      {[
        [-0.55, 0.25, -0.35],
        [0.55, 0.25, -0.35],
        [-0.55, 0.25, 0.35],
        [0.55, 0.25, 0.35],
      ].map((pos, i) => (
        <mesh key={`corner-${i}`} position={pos as [number, number, number]}>
          <boxGeometry args={[0.1, 0.5, 0.1]} />
          <meshStandardMaterial
            color={isGhost ? "#696969" : "#2F4F4F"}
            transparent={isGhost}
            opacity={isGhost ? 0.5 : 1}
            roughness={0.3}
            metalness={0.8}
          />
        </mesh>
      ))}

      {/* Lock/latch */}
      <mesh position={[0, 0.35, -0.41]}>
        <boxGeometry args={[0.15, 0.1, 0.05]} />
        <meshStandardMaterial
          color={isGhost ? "#FFD700" : "#B8860B"}
          transparent={isGhost}
          opacity={isGhost ? 0.5 : 1}
          roughness={0.2}
          metalness={0.9}
        />
      </mesh>

      {/* Handles on sides */}
      <mesh position={[-0.61, 0.35, 0]}>
        <torusGeometry args={[0.08, 0.02, 8, 16, Math.PI]} />
        <meshStandardMaterial
          color={isGhost ? "#696969" : "#2F4F4F"}
          transparent={isGhost}
          opacity={isGhost ? 0.5 : 1}
          roughness={0.3}
          metalness={0.8}
        />
      </mesh>
      <mesh position={[0.61, 0.35, 0]} rotation={[0, Math.PI, 0]}>
        <torusGeometry args={[0.08, 0.02, 8, 16, Math.PI]} />
        <meshStandardMaterial
          color={isGhost ? "#696969" : "#2F4F4F"}
          transparent={isGhost}
          opacity={isGhost ? 0.5 : 1}
          roughness={0.3}
          metalness={0.8}
        />
      </mesh>

      {/* Wood grain details */}
      {Array.from({ length: 5 }).map((_, i) => (
        <mesh key={`grain-${i}`} position={[0, 0.25, -0.4 + i * 0.2]}>
          <boxGeometry args={[1.18, 0.48, 0.01]} />
          <meshStandardMaterial
            color={isGhost ? "#654321" : "#4A3C28"}
            transparent={true}
            opacity={isGhost ? 0.3 : 0.2}
          />
        </mesh>
      ))}
    </group>
  )
}
