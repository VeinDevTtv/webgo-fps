"use client"

import type React from "react"

import { useEffect, useRef } from "react"
import { useToolbar } from "@/lib/toolbar-context"
import { useInventory, type InventoryItem } from "@/lib/inventory-context"
import { useNotifications } from "@/lib/notification-context"
import Image from "next/image"

// Maximum stack size for stackable items
const MAX_STACK_SIZE = 100

interface ToolbarProps {
  slots?: number
}

export default function Toolbar({ slots = 8 }: ToolbarProps) {
  const { selectedSlot, setSelectedSlot, items, setItems } = useToolbar()
  const { inventoryItems, setInventoryItems, isOpen } = useInventory()
  const { addNotification } = useNotifications()
  const toolbarRef = useRef<HTMLDivElement>(null)
  const dragInProgressRef = useRef(false)

  // Handle mouse wheel scrolling
  useEffect(() => {
    const handleWheel = (e: WheelEvent) => {
      e.preventDefault()
      e.stopPropagation()

      // Determine scroll direction (normalize for cross-browser compatibility)
      const direction = Math.sign(e.deltaY) > 0 ? 1 : -1

      // Calculate new slot
      let newSlot = selectedSlot + direction

      // Wrap around if needed
      if (newSlot < 0) newSlot = slots - 1
      if (newSlot >= slots) newSlot = 0

      setSelectedSlot(newSlot)
    }

    const toolbar = toolbarRef.current
    if (toolbar) {
      // Use capture phase to ensure we get the event first
      toolbar.addEventListener("wheel", handleWheel, { passive: false, capture: true })
    }

    return () => {
      if (toolbar) {
        toolbar.removeEventListener("wheel", handleWheel, { capture: true })
      }
    }
  }, [selectedSlot, setSelectedSlot, slots])

  // Helper function to find the first empty slot
  const findFirstEmptySlot = (itemArray: (InventoryItem | null)[]) => {
    return itemArray.findIndex((item) => item === null)
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
    itemArray: (InventoryItem | null)[],
    setItemArray: (items: (InventoryItem | null)[]) => void,
  ) => {
    const newItems = [...itemArray]

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

  // Handle drag over
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    e.dataTransfer.dropEffect = "move"
  }

  // Handle drop on toolbar slot
  const handleToolbarDrop = (e: React.DragEvent, targetIndex: number) => {
    e.preventDefault()
    e.stopPropagation()

    console.log("Drop on toolbar slot", targetIndex)
    dragInProgressRef.current = false

    try {
      const dataString = e.dataTransfer.getData("application/json")
      console.log("Drop data:", dataString)

      const data = JSON.parse(dataString)
      const { item, source, index: sourceIndex } = data

      console.log("Parsed drop data:", source, sourceIndex, "->", targetIndex)

      if (source === "inventory") {
        // Move from inventory to toolbar with improved stacking
        console.log("Moving from inventory to toolbar:", sourceIndex, "->", targetIndex)

        const {
          newItems: newToolbar,
          remainingQuantity,
          swappedItem,
        } = handleStacking(item, items[targetIndex], targetIndex, items, setItems)

        // Update toolbar
        setItems(newToolbar)

        // Update inventory
        const newInventory = [...inventoryItems]

        if (remainingQuantity === 0) {
          // If all items were moved, clear the inventory slot or put swapped item there
          newInventory[sourceIndex] = swappedItem || null
        } else {
          // If some items remain, update the inventory slot
          newInventory[sourceIndex] = {
            ...item,
            quantity: remainingQuantity,
          }

          addNotification({
            message: `Moved ${item.quantity! - remainingQuantity} ${item.name} to toolbar`,
            type: "info",
          })
        }

        setInventoryItems(newInventory)
      } else if (source === "toolbar") {
        // Move within toolbar with improved stacking
        console.log("Moving within toolbar:", sourceIndex, "->", targetIndex)

        const {
          newItems: newToolbar,
          remainingQuantity,
          swappedItem,
        } = handleStacking(item, items[targetIndex], targetIndex, items, setItems)

        // If we swapped items, put the target item in the source slot
        if (swappedItem) {
          newToolbar[sourceIndex] = swappedItem
        } else if (remainingQuantity === 0) {
          // If we moved all items, clear the source slot
          newToolbar[sourceIndex] = null
        } else {
          // If we have remaining items, update the source slot
          newToolbar[sourceIndex] = {
            ...item,
            quantity: remainingQuantity,
          }
        }

        setItems(newToolbar)

        if (remainingQuantity > 0) {
          addNotification({
            message: `Couldn't fit all items. ${remainingQuantity} ${item.name} remaining.`,
            type: "warning",
          })
        }
      }
    } catch (error) {
      console.error("Error handling drop:", error)
    }
  }

  // Handle drag start from toolbar
  const handleToolbarDragStart = (e: React.DragEvent, item: InventoryItem, index: number) => {
    if (!item) return

    console.log("Starting drag from toolbar", item.name, "at index", index)
    dragInProgressRef.current = true

    // Set drag data
    e.dataTransfer.setData(
      "application/json",
      JSON.stringify({
        item,
        source: "toolbar",
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
    console.log("Toolbar drag ended")
    dragInProgressRef.current = false
  }

  return (
    <div
      ref={toolbarRef}
      className="absolute bottom-6 left-1/2 transform -translate-x-1/2 flex justify-center pointer-events-auto"
    >
      <div className="grid grid-cols-8 gap-1 p-1 bg-black/40 rounded-md border border-gray-500/30 backdrop-blur-sm">
        {Array.from({ length: slots }).map((_, index) => {
          const item = items[index]
          const isSelected = index === selectedSlot

          return (
            <div
              key={index}
              className={`w-12 h-12 ${isSelected ? "bg-blue-500/50 border-blue-400/70" : "bg-gray-800/50 border-gray-600/50"} 
                border rounded flex items-center justify-center relative cursor-pointer transition-colors duration-150`}
              onClick={() => {
                console.log(`Selecting toolbar slot ${index}`)
                setSelectedSlot(index)
              }}
              onDragOver={handleDragOver}
              onDrop={(e) => handleToolbarDrop(e, index)}
            >
              {/* Number indicator (1-8) */}
              <div className="absolute -top-5 left-1/2 transform -translate-x-1/2 text-white text-xs font-bold">
                {index + 1}
              </div>

              {/* Item icon */}
              {item?.icon && (
                <div
                  className="w-8 h-8 relative"
                  draggable={true}
                  onDragStart={(e) => handleToolbarDragStart(e, item, index)}
                  onDragEnd={handleDragEnd}
                >
                  <Image
                    src={item.icon || "/placeholder.svg"}
                    alt={item.name}
                    fill
                    className="object-contain"
                    draggable={false}
                  />

                  {/* Quantity indicator */}
                  {item.quantity && item.quantity > 1 && (
                    <div className="absolute bottom-0 right-0 bg-blue-600/80 text-white text-xs px-1 rounded-sm font-bold min-w-[16px] text-center">
                      {item.quantity}
                    </div>
                  )}
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
