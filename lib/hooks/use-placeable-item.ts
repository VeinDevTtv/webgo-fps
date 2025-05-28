"use client"

import { useState, useEffect } from "react"
import { useFrame, useThree } from "@react-three/fiber"
import * as THREE from "three"
import { useSoundManager } from "@/lib/sound-manager"
import { useNotifications } from "@/lib/notification-context"
import { useToolbar } from "@/lib/toolbar-context"
import { useItemManager } from "@/lib/item-manager-context"

export interface PlaceableItemConfig {
  itemType: string
  verticalOffset: number
  placementSound?: string
  notificationIcon?: string
}

export interface PlaceableItemResult {
  ghostPosition: [number, number, number]
  ghostNormal: [number, number, number]
  showGhost: boolean
}

interface UsePlaceableItemProps {
  isLocked: boolean
  terrainHeightData: number[][]
  config: PlaceableItemConfig
  onPlace: (position: [number, number, number], normal: [number, number, number], itemId: string) => void
}

export function usePlaceableItem({
  isLocked,
  terrainHeightData,
  config,
  onPlace,
}: UsePlaceableItemProps): PlaceableItemResult {
  const { camera } = useThree()
  const [ghostPosition, setGhostPosition] = useState<[number, number, number]>([0, 0, 0])
  const [ghostNormal, setGhostNormal] = useState<[number, number, number]>([0, 1, 0])
  const [showGhost, setShowGhost] = useState(false)
  const soundManager = useSoundManager()
  const { addNotification } = useNotifications()
  const { items: toolbarItems, setItems: setToolbarItems, selectedSlot } = useToolbar()
  const itemManager = useItemManager()

  const getTerrainHeight = (x: number, z: number): number => {
    if (!terrainHeightData || terrainHeightData.length === 0 || !terrainHeightData[0]) {
      return 0
    }

    const terrainSize = terrainHeightData.length
    const halfSize = terrainSize / 2

    const gridX = Math.floor(x + halfSize)
    const gridZ = Math.floor(z + halfSize)

    if (gridX < 0 || gridX >= terrainSize || gridZ < 0 || gridZ >= terrainSize) {
      return 0
    }

    if (!terrainHeightData[gridZ] || terrainHeightData[gridZ][gridX] === undefined) {
      return 0
    }

    return terrainHeightData[gridZ][gridX]
  }

  const calculateTerrainNormal = (x: number, z: number): [number, number, number] => {
    const h = getTerrainHeight(x, z)
    const hL = getTerrainHeight(x - 1, z)
    const hR = getTerrainHeight(x + 1, z)
    const hU = getTerrainHeight(x, z - 1)
    const hD = getTerrainHeight(x, z + 1)

    const dhdx = (hR - hL) / 2.0
    const dhdz = (hD - hU) / 2.0

    const normal = new THREE.Vector3(-dhdx, 1.0, -dhdz).normalize()
    return [normal.x, normal.y, normal.z]
  }

  useFrame(() => {
    if (!isLocked) {
      setShowGhost(false)
      return
    }

    const currentItem = toolbarItems[selectedSlot]
    if (!currentItem || !currentItem.id.includes(config.itemType)) {
      setShowGhost(false)
      return
    }

    setShowGhost(true)

    const direction = new THREE.Vector3()
    camera.getWorldDirection(direction)

    const rayOrigin = camera.position.clone()
    const rayDirection = direction.normalize()

    const maxDistance = 10
    const step = 0.1

    for (let distance = 1; distance <= maxDistance; distance += step) {
      const testPoint = rayOrigin.clone().add(rayDirection.clone().multiplyScalar(distance))
      const terrainHeight = getTerrainHeight(testPoint.x, testPoint.z)

      if (testPoint.y <= terrainHeight + 0.5) {
        setGhostPosition([testPoint.x, terrainHeight + config.verticalOffset, testPoint.z])
        setGhostNormal(calculateTerrainNormal(testPoint.x, testPoint.z))
        break
      }
    }
  })

  useEffect(() => {
    if (!isLocked) return

    const handleMouseDown = (e: MouseEvent) => {
      if (e.button === 0) {
        const currentItem = toolbarItems[selectedSlot]
        if (currentItem && currentItem.id.includes(config.itemType)) {
          // Generate a unique ID for the placed item
          const itemId = `${config.itemType}_${Date.now()}`

          console.log(`Placing ${config.itemType} with ID: ${itemId} at position:`, ghostPosition)

          // Call the onPlace callback with the position, normal, and ID
          onPlace(ghostPosition, ghostNormal, itemId)

          // Remove the item from the toolbar
          const newToolbarItems = [...toolbarItems]
          newToolbarItems[selectedSlot] = null
          setToolbarItems(newToolbarItems)

          // Play placement sound
          try {
            soundManager.play(config.placementSound || "reload")
          } catch (error) {
            console.warn("Error playing placement sound:", error)
          }

          // Show notification
          addNotification({
            message: `${currentItem.name} placed`,
            type: "info",
            icon: config.notificationIcon || currentItem.icon,
          })
        }
      }
    }

    window.addEventListener("mousedown", handleMouseDown)
    return () => {
      window.removeEventListener("mousedown", handleMouseDown)
    }
  }, [
    isLocked,
    ghostPosition,
    ghostNormal,
    soundManager,
    addNotification,
    toolbarItems,
    setToolbarItems,
    selectedSlot,
    config,
    onPlace,
    itemManager,
  ])

  return {
    ghostPosition,
    ghostNormal,
    showGhost,
  }
}
