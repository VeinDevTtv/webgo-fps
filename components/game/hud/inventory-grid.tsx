"use client"

import type React from "react"
import { useState, useEffect, useRef } from "react"
import { useInventory, type InventoryItem } from "@/lib/inventory-context"
import { useToolbar } from "@/lib/toolbar-context"
import { useCampfire } from "@/lib/campfire-context"
import { useNotifications } from "@/lib/notification-context"
import { useCrafting } from "@/lib/crafting-context" // Import useCrafting hook
import { useStorageBox } from "@/lib/storage-box-context"
import Image from "next/image"

// Maximum stack size for stackable items
const MAX_STACK_SIZE = 100

interface InventoryGridProps {
  visible: boolean
}

export default function InventoryGrid({ visible }: InventoryGridProps) {
  const { inventoryItems, setInventoryItems, isOpen, activeCampfire } = useInventory()
  const { items: toolbarItems, setItems: setToolbarItems } = useToolbar()
  const { removeItemFromCraftingSlot } = useCrafting() // Declare useCrafting hook
  const { removeFuelFromSlot, getCampfire } = useCampfire()
  const { addNotification } = useNotifications()
  const inventoryRef = useRef<HTMLDivElement>(null)
  const dragInProgressRef = useRef(false)
  const [draggedItem, setDraggedItem] = useState<{ index: number; item: InventoryItem } | null>(null)
  const { activeStorageBox, addItemToSlot, removeItemFromSlot } = useStorageBox()

  // Prevent pointer lock when inventory is open
  useEffect(() => {
    if (!isOpen || !visible) return

    // Function to check if pointer lock was acquired while inventory is open
    const checkPointerLock = () => {
      if (isOpen && document.pointerLockElement) {
        console.log("Pointer lock was acquired while inventory is open, releasing it")
        document.exitPointerLock()
      }
    }

    // Add event listener for pointer lock changes
    document.addEventListener("pointerlockchange", checkPointerLock)

    // Initial check
    checkPointerLock()

    return () => {
      document.removeEventListener("pointerlockchange", checkPointerLock)
    }
  }, [isOpen, visible])

  if (!visible || !isOpen) {
    return null
  }

  // Helper function to find the first empty slot in inventory
  const findFirstEmptySlot = (items: (InventoryItem | null)[]) => {
    return items.findIndex((item) => item === null)
  }

  // Helper function to check if two items can stack
  const canStack = (item1: InventoryItem, item2: InventoryItem) => {
    return item1.name === item2.name && item1.quantity !== undefined && item2.quantity !== undefined
  }

  // Helper function to handle stacking logic
  const handleStacking = (
    sourceItem: InventoryItem,
    targetItem: InventoryItem | null,
    targetIndex: number,
    items: (InventoryItem | null)[],
    setItems: (items: (InventoryItem | null)[]) => void,
  ) => {
    const newItems = [...items]

    // If target slot is empty, just place the item there
    if (targetItem === null) {
      newItems[targetIndex] = sourceItem
      return { newItems, remainingQuantity: 0 }
    }

    // If items can stack
    if (canStack(sourceItem, targetItem)) {
      const sourceQuantity = sourceItem.quantity || 1
      const targetQuantity = targetItem.quantity || 1
      const totalQuantity = sourceQuantity + targetQuantity

      // If total quantity fits in one stack
      if (totalQuantity <= MAX_STACK_SIZE) {
        newItems[targetIndex] = {
          ...targetItem,
          quantity: totalQuantity,
        }
        return { newItems, remainingQuantity: 0 }
      }
      // If there's overflow
      else {
        // Fill the target stack to max
        newItems[targetIndex] = {
          ...targetItem,
          quantity: MAX_STACK_SIZE,
        }

        // Calculate remaining quantity
        const remainingQuantity = totalQuantity - MAX_STACK_SIZE

        // Find first empty slot for remainder
        const emptySlotIndex = findFirstEmptySlot(newItems)
        if (emptySlotIndex !== -1) {
          newItems[emptySlotIndex] = {
            ...sourceItem,
            quantity: remainingQuantity,
            id: `${sourceItem.id}_${Date.now()}`, // Generate a new unique ID
          }
          return { newItems, remainingQuantity: 0 }
        }

        // If no empty slot, return remaining quantity
        return { newItems, remainingQuantity }
      }
    }

    // If items can't stack, swap them
    newItems[targetIndex] = sourceItem
    return { newItems, remainingQuantity: 0, swappedItem: targetItem }
  }

  // Handle drag start from inventory
  const handleDragStart = (e: React.DragEvent, index: number) => {
    const item = inventoryItems[index]
    if (!item) return

    setDraggedItem({ index, item })

    console.log("Starting drag from inventory", item.name, "at index", index)
    dragInProgressRef.current = true

    // Set drag data
    e.dataTransfer.setData(
      "application/json",
      JSON.stringify({
        item,
        source: "inventory",
        index,
      }),
    )

    // Set drag image if possible
    if (e.target instanceof HTMLElement) {
      const img = e.target.querySelector("img")
      if (img) {
        e.dataTransfer.setDragImage(img, 15, 15)
      }
    }
  }

  // Handle drag end
  const handleDragEnd = (e: React.DragEvent) => {
    console.log("Drag ended")
    dragInProgressRef.current = false
    setDraggedItem(null)
  }

  // Handle drag over
  const handleDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault()
    e.dataTransfer.dropEffect = "move"
  }

  // Handle drop on inventory slot
  const handleDrop = (e: React.DragEvent, targetIndex: number) => {
    e.preventDefault()

    console.log("Dropping on inventory slot", targetIndex)
    dragInProgressRef.current = false

    try {
      const dataString = e.dataTransfer.getData("application/json")
      if (!dataString) return

      const data = JSON.parse(dataString)
      const { item, source, index: sourceIndex, campfireId, isPartial, storageBoxId } = data

      console.log("Dropping item in inventory:", item)
      console.log("Source:", source)
      console.log("Source index:", sourceIndex)
      console.log("Target index:", targetIndex)
      console.log("Is partial:", isPartial)

      if (source === "inventory") {
        // Move within inventory with improved stacking
        const { newItems, remainingQuantity, swappedItem } = handleStacking(
          item,
          inventoryItems[targetIndex],
          targetIndex,
          inventoryItems,
          setInventoryItems,
        )

        // If we swapped items, put the target item in the source slot
        if (swappedItem) {
          newItems[sourceIndex] = swappedItem
        } else if (remainingQuantity === 0) {
          // If we moved all items, clear the source slot
          newItems[sourceIndex] = null
        } else {
          // If we have remaining items, update the source slot
          newItems[sourceIndex] = {
            ...item,
            quantity: remainingQuantity,
          }
        }

        setInventoryItems(newItems)

        if (remainingQuantity > 0) {
          addNotification({
            message: `Couldn't fit all items. ${remainingQuantity} ${item.name} remaining.`,
            type: "warning",
          })
        }
      } else if (source === "toolbar") {
        // Move from toolbar to inventory with improved stacking
        const newInventory = [...inventoryItems]
        const newToolbar = [...toolbarItems]

        const {
          newItems: updatedInventory,
          remainingQuantity,
          swappedItem,
        } = handleStacking(item, inventoryItems[targetIndex], targetIndex, inventoryItems, setInventoryItems)

        // Update inventory
        setInventoryItems(updatedInventory)

        // Update toolbar
        if (remainingQuantity === 0) {
          // If all items were moved, clear the toolbar slot
          newToolbar[sourceIndex] = swappedItem || null
        } else {
          // If some items remain, update the toolbar slot
          newToolbar[sourceIndex] = {
            ...item,
            quantity: remainingQuantity,
          }
        }

        setToolbarItems(newToolbar)

        addNotification({
          message: `Moved ${item.name} to inventory`,
          type: "info",
        })
      } else if (source === "crafting") {
        // Move from crafting to inventory
        const craftingItem = removeItemFromCraftingSlot(sourceIndex)

        if (craftingItem) {
          // Add to inventory with stacking
          const { newItems, remainingQuantity } = handleStacking(
            craftingItem,
            inventoryItems[targetIndex],
            targetIndex,
            inventoryItems,
            setInventoryItems,
          )

          setInventoryItems(newItems)

          if (remainingQuantity > 0) {
            // If there's remaining quantity, try to find another empty slot
            const emptyIndex = findFirstEmptySlot(newItems)
            if (emptyIndex !== -1) {
              const finalItems = [...newItems]
              finalItems[emptyIndex] = {
                ...craftingItem,
                quantity: remainingQuantity,
                id: `${craftingItem.id}_${Date.now()}`,
              }
              setInventoryItems(finalItems)
            } else {
              addNotification({
                message: `Couldn't fit all items. ${remainingQuantity} ${craftingItem.name} remaining.`,
                type: "warning",
              })
            }
          }
        }
      } else if (source === "campfire") {
        // Move from campfire fuel slot to inventory
        if (!campfireId) {
          console.error("Missing campfire ID in drop data")
          return
        }

        // Add to inventory with stacking
        const { newItems, remainingQuantity } = handleStacking(
          item,
          inventoryItems[targetIndex],
          targetIndex,
          inventoryItems,
          setInventoryItems,
        )

        setInventoryItems(newItems)

        // Now remove from campfire - if it's a partial drag (from burning slot),
        // the removeFuelFromSlot function will handle leaving 1 wood behind
        if (isPartial) {
          // For partial drags, we need to remove the exact quantity that was dragged
          const quantityToRemove =
            remainingQuantity === 0 ? item.quantity || 1 : (item.quantity || 1) - remainingQuantity

          removeFuelFromSlot(campfireId, sourceIndex, quantityToRemove)
        } else {
          // For full drags, remove everything
          removeFuelFromSlot(campfireId, sourceIndex)
        }

        addNotification({
          message: `Added ${item.quantity || 1} wood to inventory`,
          type: "info",
        })

        if (remainingQuantity > 0) {
          // If there's remaining quantity, try to find another empty slot
          const emptyIndex = findFirstEmptySlot(newItems)
          if (emptyIndex !== -1) {
            const finalItems = [...newItems]
            finalItems[emptyIndex] = {
              ...item,
              quantity: remainingQuantity,
              id: `${item.id}_${Date.now()}`,
            }
            setInventoryItems(finalItems)
          } else {
            addNotification({
              message: `Couldn't fit all items. ${remainingQuantity} ${item.name} remaining.`,
              type: "warning",
            })
          }
        }
      } else if (source === "storage") {
        // Move from storage box to inventory
        if (!storageBoxId) {
          console.error("Missing storage box ID in drop data")
          return
        }

        // Remove from storage box first
        const removedItem = removeItemFromSlot(storageBoxId, sourceIndex)

        if (removedItem) {
          // Add to inventory with stacking
          const { newItems, remainingQuantity } = handleStacking(
            removedItem,
            inventoryItems[targetIndex],
            targetIndex,
            inventoryItems,
            setInventoryItems,
          )

          setInventoryItems(newItems)

          // If there's remaining quantity, try to find another empty slot
          if (remainingQuantity > 0) {
            const emptyIndex = findFirstEmptySlot(newItems)
            if (emptyIndex !== -1) {
              const finalItems = [...newItems]
              finalItems[emptyIndex] = {
                ...removedItem,
                quantity: remainingQuantity,
                id: `${removedItem.id}_${Date.now()}`,
              }
              setInventoryItems(finalItems)
            } else {
              // No empty slot, return remaining items to storage
              const returnItem = {
                ...removedItem,
                quantity: remainingQuantity,
              }
              addItemToSlot(storageBoxId, sourceIndex, returnItem)
              addNotification({
                message: `Couldn't fit all items. ${remainingQuantity} ${removedItem.name} returned to storage.`,
                type: "warning",
              })
            }
          }

          addNotification({
            message: `Moved ${removedItem.name} from storage box`,
            type: "info",
          })
        }
      }
    } catch (error) {
      console.error("Error handling drop:", error)
    }
  }

  // Handle double click to move to toolbar
  const handleDoubleClick = (index: number) => {
    const item = inventoryItems[index]
    if (!item) return

    // Find an empty slot in the toolbar
    const emptySlotIndex = toolbarItems.findIndex((slot) => slot === null)

    if (emptySlotIndex !== -1) {
      // Add to toolbar
      const newToolbar = [...toolbarItems]
      newToolbar[emptySlotIndex] = item

      // Remove from inventory
      const newInventory = [...inventoryItems]
      newInventory[index] = null

      setToolbarItems(newToolbar)
      setInventoryItems(newInventory)

      addNotification({
        message: `Equipped ${item.name} to slot ${emptySlotIndex + 1}`,
        type: "success",
      })
    } else {
      // No empty slot in toolbar
      addNotification({
        message: "No empty toolbar slot available",
        type: "warning",
      })
    }
  }

  // Handle right-click to split stack
  const handleRightClick = (e: React.MouseEvent, index: number) => {
    e.preventDefault()

    const item = inventoryItems[index]
    if (!item || !item.quantity || item.quantity <= 1) return

    // Split the stack in half
    const halfQuantity = Math.floor(item.quantity / 2)
    const remainingQuantity = item.quantity - halfQuantity

    // Create a new item with half the quantity
    const newItem = { ...item, quantity: halfQuantity, id: `${item.id}_${Date.now()}` }

    // Update the original item
    const updatedItem = { ...item, quantity: remainingQuantity }

    // Find an empty slot
    const emptyIndex = inventoryItems.findIndex((slot) => slot === null)
    if (emptyIndex === -1) {
      addNotification({
        message: "No empty slots to split stack",
        type: "warning",
      })
      return
    }

    // Update inventory
    const newInventory = [...inventoryItems]
    newInventory[index] = updatedItem
    newInventory[emptyIndex] = newItem
    setInventoryItems(newInventory)

    addNotification({
      message: `Split stack into ${remainingQuantity} and ${halfQuantity}`,
      type: "info",
    })
  }

  // Render 10x10 grid
  const renderInventoryGrid = () => {
    const rows = []

    for (let row = 0; row < 10; row++) {
      const cols = []

      for (let col = 0; col < 10; col++) {
        const index = row * 10 + col
        const item = inventoryItems[index]

        cols.push(
          <div
            key={`inv-${index}`}
            className={`w-12 h-12 bg-gray-700/80 border border-gray-600 rounded flex items-center justify-center cursor-pointer hover:border-gray-500 transition-colors ${
              item ? "cursor-grab" : "cursor-default"
            }`}
            onDragOver={(e) => handleDragOver(e, index)}
            onDrop={(e) => handleDrop(e, index)}
            onDoubleClick={() => handleDoubleClick(index)}
            onContextMenu={(e) => handleRightClick(e, index)}
            title={
              item ? `${item.name}${item.quantity ? ` x${item.quantity}` : ""} - Double-click to equip` : "Empty slot"
            }
          >
            {item && (
              <div
                className="w-10 h-10 relative"
                draggable={true}
                onDragStart={(e) => handleDragStart(e, index)}
                onDragEnd={handleDragEnd}
              >
                <Image
                  src={item.icon || "/placeholder.svg"}
                  alt={item.name}
                  fill
                  className="object-contain"
                  draggable={false}
                />
                {item.quantity && item.quantity > 1 && (
                  <div className="absolute bottom-0 right-0 bg-blue-600/80 text-white text-xs px-1 rounded-sm font-bold min-w-[16px] text-center">
                    {item.quantity}
                  </div>
                )}
              </div>
            )}
          </div>,
        )
      }

      rows.push(
        <div key={`row-${row}`} className="flex">
          {cols}
        </div>,
      )
    }

    return rows
  }

  return (
    <div
      ref={inventoryRef}
      className="absolute bottom-24 left-1/2 transform -translate-x-1/2 flex flex-col items-center pointer-events-auto"
    >
      {/* Inventory grid */}
      <div className="p-2 bg-black/60 rounded-md border border-gray-500/30 backdrop-blur-sm">
        <div className="flex flex-col">{renderInventoryGrid()}</div>
      </div>
      <p className="text-xs text-gray-400 mt-2">Double-click: equip • Right-click: split stack • Drag: move</p>
    </div>
  )
}
