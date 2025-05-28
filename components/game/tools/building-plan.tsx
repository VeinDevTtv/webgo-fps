"use client"

import { useRef } from "react"
import { useFrame, useThree } from "@react-three/fiber"
import * as THREE from "three"

interface BuildingPlanProps {
  isLocked: boolean
}

export default function BuildingPlan({ isLocked }: BuildingPlanProps) {
  const { camera } = useThree()
  const planRef = useRef<THREE.Group>(null)
  const clock = useThree((state) => state.clock)

  // Create materials
  const paperMaterial = new THREE.MeshStandardMaterial({
    color: "#4a90e2",
    transparent: true,
    opacity: 0.9,
    side: THREE.DoubleSide,
  })

  const outlineMaterial = new THREE.LineBasicMaterial({
    color: "#ffffff",
    linewidth: 2,
    transparent: true,
    opacity: 0.9,
  })

  // Create building outline
  const createBuildingOutline = () => {
    const outlineGroup = new THREE.Group()

    // Simple house outline
    const housePoints = [
      new THREE.Vector3(-0.08, -0.06, 0.002),
      new THREE.Vector3(0.08, -0.06, 0.002),
      new THREE.Vector3(0.08, 0.04, 0.002),
      new THREE.Vector3(0.04, 0.09, 0.002),
      new THREE.Vector3(-0.04, 0.09, 0.002),
      new THREE.Vector3(-0.08, 0.04, 0.002),
      new THREE.Vector3(-0.08, -0.06, 0.002),
    ]

    const houseGeometry = new THREE.BufferGeometry().setFromPoints(housePoints)
    const houseLine = new THREE.Line(houseGeometry, outlineMaterial)
    outlineGroup.add(houseLine)

    // Door outline
    const doorPoints = [
      new THREE.Vector3(-0.015, -0.06, 0.002),
      new THREE.Vector3(-0.015, -0.015, 0.002),
      new THREE.Vector3(0.015, -0.015, 0.002),
      new THREE.Vector3(0.015, -0.06, 0.002),
    ]

    const doorGeometry = new THREE.BufferGeometry().setFromPoints(doorPoints)
    const doorLine = new THREE.Line(doorGeometry, outlineMaterial)
    outlineGroup.add(doorLine)

    // Window outlines
    const windowPoints1 = [
      new THREE.Vector3(-0.06, 0.01, 0.002),
      new THREE.Vector3(-0.03, 0.01, 0.002),
      new THREE.Vector3(-0.03, 0.03, 0.002),
      new THREE.Vector3(-0.06, 0.03, 0.002),
      new THREE.Vector3(-0.06, 0.01, 0.002),
    ]

    const windowPoints2 = [
      new THREE.Vector3(0.03, 0.01, 0.002),
      new THREE.Vector3(0.06, 0.01, 0.002),
      new THREE.Vector3(0.06, 0.03, 0.002),
      new THREE.Vector3(0.03, 0.03, 0.002),
      new THREE.Vector3(0.03, 0.01, 0.002),
    ]

    const window1Geometry = new THREE.BufferGeometry().setFromPoints(windowPoints1)
    const window2Geometry = new THREE.BufferGeometry().setFromPoints(windowPoints2)
    const window1Line = new THREE.Line(window1Geometry, outlineMaterial)
    const window2Line = new THREE.Line(window2Geometry, outlineMaterial)

    outlineGroup.add(window1Line)
    outlineGroup.add(window2Line)

    return outlineGroup
  }

  // Handle positioning and animation in the frame loop
  useFrame(() => {
    if (!planRef.current || !isLocked) return

    const time = clock.getElapsedTime()

    // Position building plan in front of camera
    const offset = new THREE.Vector3(0.25, -0.15, -0.4)
    offset.applyQuaternion(camera.quaternion)
    planRef.current.position.copy(camera.position).add(offset)

    // Base orientation follows camera
    planRef.current.quaternion.copy(camera.quaternion)

    // Add gentle swaying motion
    planRef.current.position.y += Math.sin(time * 1.2) * 0.002
    planRef.current.rotation.z += Math.sin(time * 1.8) * 0.008

    // Slight tilt for better visibility
    planRef.current.rotateX(-Math.PI / 8) // Tilt slightly toward player
    planRef.current.rotateY(Math.PI / 12) // Slight angle for depth
  })

  // Create paper geometry
  const paperGeometry = new THREE.PlaneGeometry(0.32, 0.24)

  return (
    <group ref={planRef}>
      {/* Main paper surface */}
      <mesh geometry={paperGeometry} material={paperMaterial} />

      {/* Always show building outline */}
      <primitive object={createBuildingOutline()} />

      {/* Paper border/edge effect */}
      <lineLoop>
        <bufferGeometry>
          <bufferAttribute
            attach="attributes-position"
            count={4}
            array={new Float32Array([-0.16, -0.12, 0.001, 0.16, -0.12, 0.001, 0.16, 0.12, 0.001, -0.16, 0.12, 0.001])}
            itemSize={3}
          />
        </bufferGeometry>
        <lineBasicMaterial color="#2c5aa0" linewidth={2} />
      </lineLoop>
    </group>
  )
}
