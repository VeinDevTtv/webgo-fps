# Adding New Items to the Game

This guide explains how to add new placeable and interactable items to the game using our consolidated system.

## Table of Contents

1. [Overview](#overview)
2. [Adding a Placeable Item](#adding-a-placeable-item)
3. [Adding an Interactable Item](#adding-an-interactable-item)
4. [Combining Placeable and Interactable Items](#combining-placeable-and-interactable-items)
5. [Managing Items with ItemManager](#managing-items-with-itemmanager)

## Overview

Our game uses a consolidated system for placeable and interactable items:

- **Placeable Items**: Items that can be placed in the world (campfires, storage boxes, etc.)
- **Interactable Items**: Items that can be interacted with (opening a storage box, lighting a campfire, etc.)
- **Item Manager**: A central system for managing all items in the game

## Adding a Placeable Item

To add a new placeable item:

1. Create a 3D model component for your item:

\`\`\`tsx
// components/game/items/my-item.tsx
"use client"

import { useMemo } from "react"
import * as THREE from "three"

interface MyItemProps {
  position: [number, number, number]
  normal?: [number, number, number]
  isGhost?: boolean
  scale?: number
  id?: string
}

export default function MyItem({ position, normal = [0, 1, 0], isGhost = false, scale = 1, id }: MyItemProps) {
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
      {/* Your 3D model here */}
      <mesh>
        <boxGeometry args={[1, 0.5, 1]} />
        <meshStandardMaterial
          color={isGhost ? "#8B6914" : "#654321"}
          transparent={isGhost}
          opacity={isGhost ? 0.5 : 1}
        />
      </mesh>
    </group>
  )
}
\`\`\`

2. Create a placer component for your item:

\`\`\`tsx
// components/game/tools/my-item-placer.tsx
"use client"

import type React from "react"
import PlaceableItem from "./placeable-item"
import MyItem from "../items/my-item"

export const MY_ITEM_VERTICAL_OFFSET = 0.25

interface MyItemPlacerProps {
  isLocked: boolean
  terrainHeightData: number[][]
  placedMyItems: Array<{ id: string; position: [number, number, number]; normal?: [number, number, number] }>
  setPlacedMyItems: React.Dispatch<
    React.SetStateAction<Array<{ id: string; position: [number, number, number]; normal?: [number, number, number] }>>
  >
}

export default function MyItemPlacer({
  isLocked,
  terrainHeightData,
  placedMyItems,
  setPlacedMyItems,
}: MyItemPlacerProps) {
  const handlePlaceMyItem = (
    position: [number, number, number],
    normal: [number, number, number],
    itemId: string,
  ) => {
    const newMyItem = {
      id: itemId,
      position,
      normal,
    }
    setPlacedMyItems((prev) => [...prev, newMyItem])
  }

  return (
    <PlaceableItem
      isLocked={isLocked}
      terrainHeightData={terrainHeightData}
      config={{
        itemType: "my_item",
        verticalOffset: MY_ITEM_VERTICAL_OFFSET,
        placementSound: "reload",
        notificationIcon: "/my-item-icon.png",
      }}
      onPlace={handlePlaceMyItem}
      renderGhost={(position, normal) => <MyItem position={position} normal={normal} isGhost={true} scale={1} />}
    />
  )
}
\`\`\`

3. Add your item to the ItemManager:

\`\`\`tsx
// lib/item-manager-context.tsx
// Update the ItemType to include your new item type
export type ItemType = "campfire" | "storage_box" | "my_item" | "door" | "wall" | "foundation" | "ceiling" | "window"

// Then update the initial state in the provider
const [items, setItems] = useState<Record<ItemType, ManagedItem[]>>({
  campfire: [],
  storage_box: [],
  my_item: [], // Add your new item type here
  door: [],
  wall: [],
  foundation: [],
  ceiling: [],
  window: [],
})
\`\`\`

## Adding an Interactable Item

To make your item interactable:

1. Create an interaction component:

\`\`\`tsx
// components/game/items/my-item-interaction.tsx
"use client"

import { useInteractableItem } from "@/lib/hooks/use-interactable-item"

interface MyItemInteractionProps {
  myItemId: string
  position: [number, number, number]
  onInteract: (myItemId: string) => void
  onInteractionStateChange: (state: { showPrompt: boolean; isInRange: boolean }) => void
  disabled?: boolean
}

export default function MyItemInteraction({
  myItemId,
  position,
  onInteract,
  onInteractionStateChange,
  disabled = false,
}: MyItemInteractionProps) {
  useInteractableItem({
    itemId: myItemId,
    position,
    interactionRange: 2.5,
    lookAtThreshold: 0.9,
    onInteract,
    onInteractionStateChange,
    disabled,
  })

  // This component doesn't render anything visible
  return null
}
\`\`\`

2. Add interaction handling in the GameScene component:

\`\`\`tsx
// components/game/game-scene.tsx
// Add a handler for your item type
const handleMyItemInteract = (myItemId: string) => {
  if (isInventoryOpen || gameStatus !== "playing") return
  onMyItemInteraction?.(myItemId)
  if (document.exitPointerLock) {
    document.exitPointerLock()
  }
}

const handleMyItemInteractionStateChange = (state: { showPrompt: boolean; isInRange: boolean }) => {
  const shouldShowPrompt = state.showPrompt && state.isInRange
  onMyItemPromptChange?.(shouldShowPrompt)
}

// Then add your interaction components to the render
{/* My Item interactions */}
{managedItems.my_item.map((item) => (
  <InteractableItem
    key={`interaction-${item.id}`}
    itemId={item.id}
    position={item.position}
    onInteract={(id) => handleItemInteract(id, "my_item")}
    onInteractionStateChange={(state) => handleItemInteractionStateChange(state, "my_item")}
    disabled={!!activeItemProp}
  />
))}
\`\`\`

## Combining Placeable and Interactable Items

Most items will be both placeable and interactable. To create such an item:

1. Create the item model component as shown above
2. Create the placer component as shown above
3. Use the InteractableItem component for interaction
4. Update the GameScene to handle both placement and interaction

## Managing Items with ItemManager

The ItemManager provides a central place to manage all items in the game:

\`\`\`tsx
// Example of using ItemManager
import { useItemManager } from "@/lib/item-manager-context"

function MyComponent() {
  const { items, addItem, removeItem, updateItem, getItem } = useItemManager()

  // Add a new item
  const handleAddItem = () => {
    addItem("my_item", {
      id: `my_item_${Date.now()}`,
      type: "my_item",
      position: [0, 0, 0],
      normal: [0, 1, 0],
      properties: {
        customProperty: "value",
      },
    })
  }

  // Get all items of a specific type
  const myItems = items.my_item

  // Update an item
  const handleUpdateItem = (itemId: string) => {
    updateItem("my_item", itemId, {
      position: [1, 1, 1],
      properties: {
        customProperty: "new value",
      },
    })
  }

  // Remove an item
  const handleRemoveItem = (itemId: string) => {
    removeItem("my_item", itemId)
  }

  return (
    <div>
      {/* Your component JSX */}
    </div>
  )
}
\`\`\`

By following this guide, you can easily add new placeable and interactable items to the game!
\`\`\`

Let's create an example of a new item type - a door:
