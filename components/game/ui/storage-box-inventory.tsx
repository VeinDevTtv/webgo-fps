"use client"

import { useEffect } from "react"
import { useStorageBox } from "@/lib/storage-box-context"
import { useInventory } from "@/lib/inventory-context"
import { useNotifications } from "@/lib/notification-context"
import Image from "next/image"
import type React from "react"

// Maximum stack size for stackable items
const MAX_STACK_SIZE = 100

interface StorageBoxInventoryProps {
  storageBoxId: string
  onClose: () => void
}

export default function StorageBoxInventory({ storageBoxId, onClose }: StorageBoxInventoryProps) {
  const { inventoryItems, setInventoryItems } = useInventory()
  const { getStorageBox, addItemToSlot, removeItemFromSlot, createStorageBox } = useStorageBox()
  const { addNotification } = useNotifications()

  // Create storage box data if it doesn't exist
  useEffect(() => {
    const storageBox = getStorageBox(storageBoxId)
    if (!storageBox) {
      createStorageBox(storageBoxId)
    }
  }, [storageBoxId, getStorageBox, createStorageBox])

  const storageBox = getStorageBox(storageBoxId)

  if (!storageBox) {
    return null
  }

  // Helper function to find the first empty slot
  const findFirstEmptySlot = (slots: any[]) => {
    return slots.findIndex((slot) => slot.item === null)
  }

  // Helper function to check if two items can stack
  const canStack = (item1: any, item2: any) => {
    return item1.name === item2.name && item1.quantity !== undefined && item2.quantity !== undefined
  }

  // Handle drag start from storage slot
  const handleStorageSlotDragStart = (e: React.DragEvent, slotIndex: number) => {
    const slot = storageBox.slots[slotIndex]
    if (!slot.item) return

    console.log("Starting drag from storage slot", slot.item.name, "at index", slotIndex)

    e.dataTransfer.setData(
      "application/json",
      JSON.stringify({
        item: slot.item,
        source: "storage",
        storageBoxId,
        index: slotIndex,
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

  // Handle drag over storage slot
  const handleStorageSlotDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    e.dataTransfer.dropEffect = "move"
  }

  // Handle drop on storage slot
  const handleStorageSlotDrop = (e: React.DragEvent, targetSlotIndex: number) => {
    e.preventDefault()

    try {
      const dataString = e.dataTransfer.getData("application/json")
      const data = JSON.parse(dataString)
      const { item, source, index: sourceIndex } = data

      console.log("Dropping item:", item)
      console.log("Dropping on storage slot", targetSlotIndex, "from", source)

      if (source === "inventory") {
        // Move from inventory to storage slot with improved stacking
        const targetSlot = storageBox.slots[targetSlotIndex]

        // If target slot is empty, just add the item
        if (!targetSlot.item) {
          const success = addItemToSlot(storageBoxId, targetSlotIndex, item)

          if (success) {
            // Remove from inventory
            const newInventory = [...inventoryItems]
            newInventory[sourceIndex] = null
            setInventoryItems(newInventory)

            addNotification({
              message: `Added ${item.name} to storage box`,
              type: "info",
            })
          }
        }
        // If target slot has the same item type, try to stack
        else if (canStack(item, targetSlot.item)) {
          const sourceQuantity = item.quantity || 1
          const targetQuantity = targetSlot.item.quantity || 1
          const totalQuantity = sourceQuantity + targetQuantity

          // If total quantity fits in one stack
          if (totalQuantity <= MAX_STACK_SIZE) {
            // Update target slot
            const updatedItem = { ...targetSlot.item, quantity: totalQuantity }
            addItemToSlot(storageBoxId, targetSlotIndex, updatedItem)

            // Remove from inventory
            const newInventory = [...inventoryItems]
            newInventory[sourceIndex] = null
            setInventoryItems(newInventory)

            addNotification({
              message: `Added ${item.name} to storage box`,
              type: "info",
            })
          }
          // If there's overflow
          else {
            // Fill the target slot to max
            const updatedTargetItem = { ...targetSlot.item, quantity: MAX_STACK_SIZE }
            addItemToSlot(storageBoxId, targetSlotIndex, updatedTargetItem)

            // Calculate remaining quantity
            const remainingQuantity = totalQuantity - MAX_STACK_SIZE

            // Find first empty slot for remainder
            const emptySlotIndex = findFirstEmptySlot(storageBox.slots)
            if (emptySlotIndex !== -1) {
              const remainingItem = { ...item, quantity: remainingQuantity }
              addItemToSlot(storageBoxId, emptySlotIndex, remainingItem)

              // Remove from inventory
              const newInventory = [...inventoryItems]
              newInventory[sourceIndex] = null
              setInventoryItems(newInventory)

              addNotification({
                message: `Added ${item.name} to storage box (split across slots)`,
                type: "info",
              })
            } else {
              // If no empty slot, update inventory with remaining
              const newInventory = [...inventoryItems]
              newInventory[sourceIndex] = { ...item, quantity: remainingQuantity }
              setInventoryItems(newInventory)

              addNotification({
                message: `Storage box full. Added ${MAX_STACK_SIZE - targetQuantity} ${item.name} to storage.`,
                type: "warning",
              })
            }
          }
        }
        // Different item types, swap them
        else {
          // Remove current item from storage
          const removedItem = removeItemFromSlot(storageBoxId, targetSlotIndex)

          // Add new item to storage
          addItemToSlot(storageBoxId, targetSlotIndex, item)

          // Update inventory
          const newInventory = [...inventoryItems]
          newInventory[sourceIndex] = removedItem
          setInventoryItems(newInventory)

          addNotification({
            message: `Swapped ${item.name} with ${removedItem?.name || "empty slot"}`,
            type: "info",
          })
        }
      } else if (source === "storage") {
        // Move within storage slots with improved stacking
        const sourceSlot = storageBox.slots[sourceIndex]
        const targetSlot = storageBox.slots[targetSlotIndex]

        // If source and target are the same, do nothing
        if (sourceIndex === targetSlotIndex) return

        // If target slot is empty, just move the item
        if (!targetSlot.item) {
          const sourceItem = removeItemFromSlot(storageBoxId, sourceIndex)
          if (sourceItem) {
            addItemToSlot(storageBoxId, targetSlotIndex, sourceItem)
          }
        }
        // If target slot has the same item type, try to stack
        else if (canStack(sourceSlot.item!, targetSlot.item)) {
          const sourceQuantity = sourceSlot.item!.quantity || 1
          const targetQuantity = targetSlot.item.quantity || 1
          const totalQuantity = sourceQuantity + targetQuantity

          // If total quantity fits in one stack
          if (totalQuantity <= MAX_STACK_SIZE) {
            // Update target slot
            const updatedItem = { ...targetSlot.item, quantity: totalQuantity }
            addItemToSlot(storageBoxId, targetSlotIndex, updatedItem)

            // Remove source slot
            removeItemFromSlot(storageBoxId, sourceIndex)
          }
          // If there's overflow
          else {
            // Fill the target slot to max
            const updatedTargetItem = { ...targetSlot.item, quantity: MAX_STACK_SIZE }
            addItemToSlot(storageBoxId, targetSlotIndex, updatedTargetItem)

            // Update source slot with remaining
            const remainingQuantity = totalQuantity - MAX_STACK_SIZE
            const updatedSourceItem = { ...sourceSlot.item!, quantity: remainingQuantity }

            // Remove old item first
            removeItemFromSlot(storageBoxId, sourceIndex)

            // Add updated item
            addItemToSlot(storageBoxId, sourceIndex, updatedSourceItem)
          }
        }
        // Different item types, swap them
        else {
          const fromItem = removeItemFromSlot(storageBoxId, sourceIndex)
          const toItem = removeItemFromSlot(storageBoxId, targetSlotIndex)

          if (fromItem) addItemToSlot(storageBoxId, targetSlotIndex, fromItem)
          if (toItem) addItemToSlot(storageBoxId, sourceIndex, toItem)
        }
      }
    } catch (error) {
      console.error("Error handling storage slot drop:", error)
    }
  }

  // Handle right-click to remove single item
  const handleStorageSlotRightClick = (e: React.MouseEvent, slotIndex: number) => {
    e.preventDefault()

    const slot = storageBox.slots[slotIndex]
    if (!slot.item) return

    // Remove item from storage
    const removedItem = removeItemFromSlot(storageBoxId, slotIndex)
    if (removedItem) {
      // Try to add back to inventory
      const newInventory = [...inventoryItems]

      // Try to find a stack of the same item type first
      let added = false
      if (removedItem.quantity) {
        for (let i = 0; i < newInventory.length; i++) {
          const invItem = newInventory[i]
          if (invItem && canStack(invItem, removedItem)) {
            const currentQuantity = invItem.quantity || 1
            const newQuantity = Math.min(MAX_STACK_SIZE, currentQuantity + (removedItem.quantity || 1))

            // If we can add at least some
            if (newQuantity > currentQuantity) {
              const addedQuantity = newQuantity - currentQuantity

              // Update inventory slot
              newInventory[i] = { ...invItem, quantity: newQuantity }

              // If we added all items
              if (addedQuantity >= (removedItem.quantity || 1)) {
                added = true
                setInventoryItems(newInventory)
                addNotification({
                  message: "Removed item from storage box",
                  type: "info",
                })
                break
              }
              // If we added some items
              else {
                // Create a new item with remaining quantity
                const remainingItem = {
                  ...removedItem,
                  quantity: (removedItem.quantity || 1) - addedQuantity,
                }

                // Find an empty slot for remainder
                const emptyIndex = newInventory.findIndex((slot) => slot === null)
                if (emptyIndex !== -1) {
                  newInventory[emptyIndex] = remainingItem
                  added = true
                  setInventoryItems(newInventory)
                  addNotification({
                    message: "Removed item from storage box",
                    type: "info",
                  })
                  break
                } else {
                  // No empty slot for remainder, put it back
                  addItemToSlot(storageBoxId, slotIndex, remainingItem)
                  setInventoryItems(newInventory)
                  addNotification({
                    message: `Added ${addedQuantity} to inventory, but couldn't fit the rest`,
                    type: "warning",
                  })
                  added = true
                  break
                }
              }
            }
          }
        }
      }

      // If not added yet, try to find an empty slot
      if (!added) {
        const emptyIndex = newInventory.findIndex((slot) => slot === null)
        if (emptyIndex !== -1) {
          newInventory[emptyIndex] = removedItem
          setInventoryItems(newInventory)
          addNotification({
            message: "Removed item from storage box",
            type: "info",
          })
        } else {
          // Inventory full, put it back
          addItemToSlot(storageBoxId, slotIndex, removedItem)
          addNotification({
            message: "Inventory is full",
            type: "warning",
          })
        }
      }
    }
  }

  return (
    <div
      className="absolute pointer-events-auto"
      style={{
        top: "calc(50% - 200px + 5vh)", // Same position as crafting menu
        left: "calc(70% - 20px)", // Moved 20px to the left from the crafting menu position
        transformOrigin: "top center",
      }}
    >
      <div className="bg-gray-800/90 border border-gray-600/50 rounded-lg p-4 backdrop-blur-sm w-[440px]">
        <div className="mb-4">
          <h2 className="text-xl font-bold text-white text-center">Storage Box</h2>
        </div>

        <div className="mb-6">
          <h3 className="text-white mb-2">Storage Slots:</h3>
          <div className="space-y-2">
            {/* Row 1 */}
            <div className="flex gap-1 justify-center">
              {Array.from({ length: 8 }, (_, colIndex) => {
                const index = colIndex
                const slot = storageBox.slots[index]

                return (
                  <div
                    key={index}
                    className="w-12 h-12 min-w-[48px] min-h-[48px] bg-gray-700/80 border border-gray-600 rounded flex items-center justify-center cursor-pointer hover:border-gray-500 transition-colors relative"
                    onDragOver={handleStorageSlotDragOver}
                    onDrop={(e) => handleStorageSlotDrop(e, index)}
                    onContextMenu={(e) => handleStorageSlotRightClick(e, index)}
                    title={
                      slot.item
                        ? `${slot.item.name}${slot.item.quantity ? ` x${slot.item.quantity}` : ""}`
                        : "Empty storage slot - Right-click to remove"
                    }
                  >
                    {slot.item && (
                      <div
                        className="w-10 h-10 relative"
                        draggable
                        onDragStart={(e) => handleStorageSlotDragStart(e, index)}
                      >
                        <Image
                          src={slot.item.icon || "/placeholder.svg"}
                          alt={slot.item.name}
                          fill
                          className="object-contain"
                          draggable={false}
                        />

                        {/* Quantity indicator */}
                        {slot.item.quantity && slot.item.quantity > 1 && (
                          <div className="absolute bottom-0 right-0 bg-blue-600/80 text-white text-xs px-1 rounded-sm font-bold min-w-[16px] text-center">
                            {slot.item.quantity}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>

            {/* Row 2 */}
            <div className="flex gap-1 justify-center">
              {Array.from({ length: 8 }, (_, colIndex) => {
                const index = 8 + colIndex
                const slot = storageBox.slots[index]

                return (
                  <div
                    key={index}
                    className="w-12 h-12 min-w-[48px] min-h-[48px] bg-gray-700/80 border border-gray-600 rounded flex items-center justify-center cursor-pointer hover:border-gray-500 transition-colors relative"
                    onDragOver={handleStorageSlotDragOver}
                    onDrop={(e) => handleStorageSlotDrop(e, index)}
                    onContextMenu={(e) => handleStorageSlotRightClick(e, index)}
                    title={
                      slot.item
                        ? `${slot.item.name}${slot.item.quantity ? ` x${slot.item.quantity}` : ""}`
                        : "Empty storage slot - Right-click to remove"
                    }
                  >
                    {slot.item && (
                      <div
                        className="w-10 h-10 relative"
                        draggable
                        onDragStart={(e) => handleStorageSlotDragStart(e, index)}
                      >
                        <Image
                          src={slot.item.icon || "/placeholder.svg"}
                          alt={slot.item.name}
                          fill
                          className="object-contain"
                          draggable={false}
                        />

                        {/* Quantity indicator */}
                        {slot.item.quantity && slot.item.quantity > 1 && (
                          <div className="absolute bottom-0 right-0 bg-blue-600/80 text-white text-xs px-1 rounded-sm font-bold min-w-[16px] text-center">
                            {slot.item.quantity}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </div>
          <p className="text-sm text-gray-400 mt-2 text-center">Drag items from inventory • Right-click to remove</p>
        </div>

        <p className="text-xs text-gray-500 text-center">Press Tab or ESC to close</p>
      </div>
    </div>
  )
}
