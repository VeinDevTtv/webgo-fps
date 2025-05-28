"use client"

import type React from "react"
import { usePlaceableItem } from "@/lib/hooks/use-placeable-item"
import StorageBox from "../items/storage-box"
import { useItemManager } from "@/lib/item-manager-context"
import { useNotifications } from "@/lib/notification-context"

export const STORAGE_BOX_VERTICAL_OFFSET = 0.25

interface StorageBoxPlacerProps {
  isLocked: boolean
  terrainHeightData: number[][]
  placedStorageBoxes: Array<{ id: string; position: [number, number, number]; normal?: [number, number, number] }>
  setPlacedStorageBoxes: React.Dispatch<
    React.SetStateAction<Array<{ id: string; position: [number, number, number]; normal?: [number, number, number] }>>
  >
}

export default function StorageBoxPlacer({
  isLocked,
  terrainHeightData,
  placedStorageBoxes,
  setPlacedStorageBoxes,
}: StorageBoxPlacerProps) {
  // Use the item manager to add the storage box to the game world
  const itemManager = useItemManager()
  const { addNotification } = useNotifications()

  const handlePlaceStorageBox = (
    position: [number, number, number],
    normal: [number, number, number],
    itemId: string,
  ) => {
    console.log("Placing storage box at:", position, "with ID:", itemId)

    // Add to local state for backward compatibility
    const newStorageBox = {
      id: itemId,
      position,
      normal,
    }
    setPlacedStorageBoxes((prev) => [...prev, newStorageBox])

    // Add to item manager
    itemManager.addItem("storage_box", {
      id: itemId,
      type: "storage_box",
      position,
      normal,
      properties: {
        items: [],
      },
    })

    // Show notification
    addNotification({
      message: "Storage Box placed",
      type: "success",
      icon: "/storage-box-icon.png",
    })

    console.log("Storage box added to item manager:", itemId)
  }

  const { ghostPosition, ghostNormal, showGhost } = usePlaceableItem({
    isLocked,
    terrainHeightData,
    config: {
      itemType: "storage_box",
      verticalOffset: STORAGE_BOX_VERTICAL_OFFSET,
      placementSound: "reload",
      notificationIcon: "/storage-box-icon.png",
    },
    onPlace: handlePlaceStorageBox,
  })

  return showGhost ? <StorageBox position={ghostPosition} normal={ghostNormal} isGhost={true} scale={1} /> : null
}
