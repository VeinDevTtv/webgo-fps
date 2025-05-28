"use client"

import type React from "react"
import PlaceableItem from "./placeable-item"
import Campfire from "../items/campfire"
import { useItemManager } from "@/lib/item-manager-context"

// Define a constant for the vertical offset to keep campfires above ground
// Increased from 0.15 to 0.35 to account for the campfire's internal offset
export const CAMPFIRE_VERTICAL_OFFSET = 0.35

interface CampfirePlacerProps {
  isLocked: boolean
  terrainHeightData: number[][]
  placedCampfires: Array<{ id: string; position: [number, number, number]; normal?: [number, number, number] }>
  setPlacedCampfires: React.Dispatch<
    React.SetStateAction<Array<{ id: string; position: [number, number, number]; normal?: [number, number, number] }>>
  >
}

export default function CampfirePlacer({
  isLocked,
  terrainHeightData,
  placedCampfires,
  setPlacedCampfires,
}: CampfirePlacerProps) {
  const itemManager = useItemManager()

  const handlePlaceCampfire = (
    position: [number, number, number],
    normal: [number, number, number],
    itemId: string,
  ) => {
    console.log(`Placing campfire with ID: ${itemId} at position:`, position)

    // Create a new campfire object
    const newCampfire = {
      id: itemId,
      position,
      normal,
    }

    // Add to local state (for backward compatibility)
    setPlacedCampfires((prev) => [...prev, newCampfire])

    // Add to item manager
    itemManager.addItem("campfire", {
      id: itemId,
      type: "campfire",
      position,
      normal,
      isActive: false,
      properties: {},
    })

    console.log("Campfire added to item manager:", itemManager.items.campfire)
  }

  return (
    <PlaceableItem
      isLocked={isLocked}
      terrainHeightData={terrainHeightData}
      config={{
        itemType: "campfire",
        verticalOffset: CAMPFIRE_VERTICAL_OFFSET,
        placementSound: "reload",
        notificationIcon: "/campfire.png",
      }}
      onPlace={handlePlaceCampfire}
      renderGhost={(position, normal) => <Campfire position={position} normal={normal} isGhost={true} scale={1} />}
    />
  )
}
