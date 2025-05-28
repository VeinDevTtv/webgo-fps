"use client"

import React from "react"

import PlaceableItem from "./placeable-item"
import Door from "../items/door"
import { useState } from "react"
import { useThree } from "@react-three/fiber"
import * as THREE from "three"

export const DOOR_VERTICAL_OFFSET = 0.5

interface DoorPlacerProps {
  isLocked: boolean
  terrainHeightData: number[][]
  placedDoors: Array<{
    id: string
    position: [number, number, number]
    normal?: [number, number, number]
    rotation?: number
    isOpen?: boolean
  }>
  setPlacedDoors: React.Dispatch<
    React.SetStateAction<
      Array<{
        id: string
        position: [number, number, number]
        normal?: [number, number, number]
        rotation?: number
        isOpen?: boolean
      }>
    >
  >
}

export default function DoorPlacer({ isLocked, terrainHeightData, placedDoors, setPlacedDoors }: DoorPlacerProps) {
  const { camera } = useThree()
  const [doorRotation, setDoorRotation] = useState(0)

  // Handle rotation with R key
  const handleKeyDown = (e: KeyboardEvent) => {
    if (e.code === "KeyR") {
      setDoorRotation((prev) => (prev + Math.PI / 4) % (Math.PI * 2))
    }
  }

  React.useEffect(() => {
    if (!isLocked) return

    window.addEventListener("keydown", handleKeyDown)
    return () => window.removeEventListener("keydown", handleKeyDown)
  }, [isLocked])

  const handlePlaceDoor = (position: [number, number, number], normal: [number, number, number], itemId: string) => {
    // Calculate door orientation based on camera direction
    const cameraDirection = new THREE.Vector3()
    camera.getWorldDirection(cameraDirection)

    // Project camera direction onto horizontal plane
    cameraDirection.y = 0
    cameraDirection.normalize()

    // Calculate angle from world forward (0,0,-1) to camera direction
    const worldForward = new THREE.Vector3(0, 0, -1)
    let angle = Math.atan2(cameraDirection.x, cameraDirection.z)

    // Add the manual rotation
    angle += doorRotation

    const newDoor = {
      id: itemId,
      position,
      normal,
      rotation: angle,
      isOpen: false,
    }

    setPlacedDoors((prev) => [...prev, newDoor])
  }

  return (
    <PlaceableItem
      isLocked={isLocked}
      terrainHeightData={terrainHeightData}
      config={{
        itemType: "door",
        verticalOffset: DOOR_VERTICAL_OFFSET,
        placementSound: "reload",
        notificationIcon: "/door-wood.png",
      }}
      onPlace={handlePlaceDoor}
      renderGhost={(position, normal) => (
        <Door position={position} normal={normal} isGhost={true} scale={1} rotation={doorRotation} />
      )}
    />
  )
}
