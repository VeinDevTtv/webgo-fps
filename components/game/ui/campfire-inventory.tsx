"use client"

import { useEffect } from "react"
import { useCampfire } from "@/lib/campfire-context"
import { useInventory } from "@/lib/inventory-context"
import { useNotifications } from "@/lib/notification-context"
import Image from "next/image"
import type React from "react"

// Maximum stack size for stackable items
const MAX_STACK_SIZE = 100

interface CampfireInventoryProps {
  campfireId: string
  onClose: () => void
}

export default function CampfireInventory({ campfireId, onClose }: CampfireInventoryProps) {
  const { inventoryItems, setInventoryItems } = useInventory()
  const {
    getCampfire,
    addFuelToSlot,
    removeFuelFromSlot,
    moveItemBetweenSlots,
    igniteCampfire,
    extinguishCampfire,
    createCampfire,
  } = useCampfire()
  const { addNotification } = useNotifications()

  // Create campfire data if it doesn't exist
  useEffect(() => {
    const campfire = getCampfire(campfireId)
    if (!campfire) {
      createCampfire(campfireId)
    }
  }, [campfireId, getCampfire, createCampfire])

  const campfire = getCampfire(campfireId)

  if (!campfire) {
    return null
  }

  // Helper function to find the first empty slot in inventory
  const findFirstEmptySlot = (items: (any | null)[]) => {
    return items.findIndex((item) => item === null)
  }

  // Helper function to check if two items can stack
  const canStack = (item1: any, item2: any) => {
    return item1.name === item2.name && item1.quantity !== undefined && item2.quantity !== undefined
  }

  // Helper function to check if an item is wood
  const isWood = (item: any) => {
    return (
      item.id === "resource_wood" ||
      item.name === "Wood" ||
      item.name === "wood" ||
      item.id.includes("wood") ||
      item.icon?.includes("wood")
    )
  }

  // Handle drag start from fuel slot
  const handleFuelSlotDragStart = (e: React.DragEvent, slotIndex: number) => {
    const slot = campfire.fuelSlots[slotIndex]
    if (!slot.item) return

    // If this is the burning slot and there's only 1 wood, don't allow dragging
    const isCurrentlyBurning = campfire.isActive && campfire.currentBurningSlot === slotIndex
    if (isCurrentlyBurning && slot.item.quantity === 1) {
      e.preventDefault()
      addNotification({
        message: "Leave at least one wood in the burning slot",
        type: "warning",
      })
      return
    }

    // Calculate how many items to drag (all except 1 if it's the burning slot)
    const quantityToDrag = isCurrentlyBurning ? (slot.item.quantity || 1) - 1 : slot.item.quantity || 1

    console.log("Starting drag from fuel slot", slot.item.name, "at index", slotIndex, "quantity", quantityToDrag)

    // Create a copy of the item with the correct quantity for dragging
    const dragItem = { ...slot.item, quantity: quantityToDrag }

    e.dataTransfer.setData(
      "application/json",
      JSON.stringify({
        item: dragItem,
        source: "campfire",
        campfireId,
        index: slotIndex,
        isPartial: isCurrentlyBurning, // Flag to indicate we're only taking part of the stack
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

  // Handle drag over fuel slot
  const handleFuelSlotDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    e.dataTransfer.dropEffect = "move"
  }

  // Handle drop on fuel slot
  const handleFuelSlotDrop = (e: React.DragEvent, targetSlotIndex: number) => {
    e.preventDefault()

    try {
      const dataString = e.dataTransfer.getData("application/json")
      const data = JSON.parse(dataString)
      const { item, source, index: sourceIndex, isPartial } = data

      console.log("Dropping item:", item)
      console.log("Item ID:", item.id)
      console.log("Item name:", item.name)
      console.log("Dropping on fuel slot", targetSlotIndex, "from", source)

      // Check if it's wood
      if (!isWood(item)) {
        addNotification({
          message: `Only wood can be used as fuel`,
          type: "warning",
        })
        return
      }

      if (source === "inventory") {
        // Move from inventory to fuel slot with improved stacking
        const targetSlot = campfire.fuelSlots[targetSlotIndex]
        const sourceQuantity = item.quantity || 1

        // If target slot is empty, just add the wood
        if (!targetSlot.item) {
          const success = addFuelToSlot(campfireId, targetSlotIndex, item, sourceQuantity)

          if (success) {
            // Remove from inventory
            const newInventory = [...inventoryItems]
            newInventory[sourceIndex] = null
            setInventoryItems(newInventory)

            addNotification({
              message: `Added ${sourceQuantity} wood to campfire`,
              type: "info",
            })
          }
        }
        // If target slot already has wood, try to stack
        else if (targetSlot.item) {
          const targetQuantity = targetSlot.item.quantity || 1
          const totalQuantity = sourceQuantity + targetQuantity

          // If total quantity fits in one stack
          if (totalQuantity <= MAX_STACK_SIZE) {
            // Add all wood to the slot
            const success = addFuelToSlot(campfireId, targetSlotIndex, {
              ...targetSlot.item,
              quantity: totalQuantity,
            })

            if (success) {
              // Remove from inventory
              const newInventory = [...inventoryItems]
              newInventory[sourceIndex] = null
              setInventoryItems(newInventory)

              addNotification({
                message: `Added ${sourceQuantity} wood to campfire`,
                type: "info",
              })
            }
          }
          // If there's overflow
          else {
            // Fill the target slot to max
            const success = addFuelToSlot(campfireId, targetSlotIndex, {
              ...targetSlot.item,
              quantity: MAX_STACK_SIZE,
            })

            if (success) {
              // Calculate remaining quantity
              const remainingQuantity = totalQuantity - MAX_STACK_SIZE

              // Find first empty fuel slot for remainder
              let emptySlotFound = false
              for (let i = 0; i < campfire.fuelSlots.length; i++) {
                if (i !== targetSlotIndex && !campfire.fuelSlots[i].item) {
                  // Add remaining wood to this slot
                  addFuelToSlot(campfireId, i, {
                    ...item,
                    quantity: remainingQuantity,
                  })
                  emptySlotFound = true
                  break
                }
              }

              // Remove from inventory or update with remaining
              const newInventory = [...inventoryItems]

              if (emptySlotFound) {
                // All wood was added to campfire
                newInventory[sourceIndex] = null
                addNotification({
                  message: `Added ${sourceQuantity} wood to campfire (split across slots)`,
                  type: "info",
                })
              } else {
                // Some wood remains in inventory
                const addedQuantity = MAX_STACK_SIZE - targetQuantity
                newInventory[sourceIndex] = {
                  ...item,
                  quantity: sourceQuantity - addedQuantity,
                }
                addNotification({
                  message: `Added ${addedQuantity} wood to campfire. No space for remaining ${sourceQuantity - addedQuantity}.`,
                  type: "warning",
                })
              }

              setInventoryItems(newInventory)
            }
          }
        }
      } else if (source === "campfire") {
        // Move within fuel slots with improved stacking
        const sourceSlot = campfire.fuelSlots[sourceIndex]
        const targetSlot = campfire.fuelSlots[targetSlotIndex]

        // If source and target are the same, do nothing
        if (sourceIndex === targetSlotIndex) return

        // Check if source is burning slot with only 1 wood
        const isSourceBurning = campfire.isActive && campfire.currentBurningSlot === sourceIndex
        if (isSourceBurning && sourceSlot.item && sourceSlot.item.quantity === 1) {
          addNotification({
            message: "Leave at least one wood in the burning slot",
            type: "warning",
          })
          return
        }

        // If target slot is empty, just move the wood
        if (!targetSlot.item) {
          moveItemBetweenSlots(campfireId, sourceIndex, targetSlotIndex, isPartial)
        }
        // If target slot has wood, try to stack
        else if (targetSlot.item) {
          // If this is a partial move (from burning slot)
          if (isPartial && isSourceBurning && sourceSlot.item) {
            const quantityToMove = (sourceSlot.item.quantity || 1) - 1
            const targetQuantity = targetSlot.item.quantity || 1
            const totalQuantity = quantityToMove + targetQuantity

            // If total quantity fits in target slot
            if (totalQuantity <= MAX_STACK_SIZE) {
              // Update target slot
              addFuelToSlot(campfireId, targetSlotIndex, {
                ...targetSlot.item,
                quantity: totalQuantity,
              })

              // Update source slot to have only 1 wood
              addFuelToSlot(campfireId, sourceIndex, {
                ...sourceSlot.item,
                quantity: 1,
              })
            }
            // If there's overflow
            else {
              // Fill target slot to max
              addFuelToSlot(campfireId, targetSlotIndex, {
                ...targetSlot.item,
                quantity: MAX_STACK_SIZE,
              })

              // Calculate how much was actually moved
              const actuallyMoved = MAX_STACK_SIZE - targetQuantity

              // Update source slot
              addFuelToSlot(campfireId, sourceIndex, {
                ...sourceSlot.item,
                quantity: (sourceSlot.item.quantity || 1) - actuallyMoved,
              })

              addNotification({
                message: `Moved ${actuallyMoved} wood between slots. Target slot is now full.`,
                type: "info",
              })
            }
          }
          // Regular move between slots
          else {
            moveItemBetweenSlots(campfireId, sourceIndex, targetSlotIndex)
          }
        }
      }
    } catch (error) {
      console.error("Error handling fuel slot drop:", error)
    }
  }

  // Handle right-click to remove single item
  const handleFuelSlotRightClick = (e: React.MouseEvent, slotIndex: number) => {
    e.preventDefault()

    const slot = campfire.fuelSlots[slotIndex]
    if (!slot.item) return

    // If this is the burning slot and there's only 1 wood, don't allow removal
    const isCurrentlyBurning = campfire.isActive && campfire.currentBurningSlot === slotIndex
    if (isCurrentlyBurning && slot.item.quantity === 1) {
      addNotification({
        message: "Leave at least one wood in the burning slot",
        type: "warning",
      })
      return
    }

    // Remove 1 wood (or all if not burning)
    const removedItem = removeFuelFromSlot(campfireId, slotIndex, 1)
    if (removedItem) {
      // Try to add back to inventory with stacking
      const newInventory = [...inventoryItems]

      // Try to find a stack of wood first
      let added = false
      for (let i = 0; i < newInventory.length; i++) {
        const invItem = newInventory[i]
        if (invItem && canStack(invItem, removedItem)) {
          const currentQuantity = invItem.quantity || 1

          // If stack isn't full
          if (currentQuantity < MAX_STACK_SIZE) {
            newInventory[i] = {
              ...invItem,
              quantity: currentQuantity + 1,
            }
            setInventoryItems(newInventory)
            added = true

            addNotification({
              message: "Removed wood from campfire",
              type: "info",
            })
            break
          }
        }
      }

      // If not added to existing stack, find an empty slot
      if (!added) {
        const emptyIndex = newInventory.findIndex((slot) => slot === null)
        if (emptyIndex !== -1) {
          newInventory[emptyIndex] = removedItem
          setInventoryItems(newInventory)
          addNotification({
            message: "Removed wood from campfire",
            type: "info",
          })
        } else {
          // Inventory full, put it back
          addFuelToSlot(campfireId, slotIndex, removedItem, removedItem.quantity || 1)
          addNotification({
            message: "Inventory is full",
            type: "warning",
          })
        }
      }
    }
  }

  // Handle igniting or extinguishing the campfire
  const handleFireToggle = () => {
    if (campfire.isActive) {
      // Extinguish the fire
      extinguishCampfire(campfireId)
      addNotification({
        message: "Campfire extinguished",
        type: "info",
      })
    } else {
      // Check if there's at least one fuel item
      const hasFuel = campfire.fuelSlots.some((slot) => slot.item !== null && (slot.item.quantity || 0) > 0)
      if (!hasFuel) {
        addNotification({
          message: "Add wood to ignite the campfire",
          type: "warning",
        })
        return
      }

      // Make sure this function is working correctly
      const success = igniteCampfire(campfireId)
      if (success) {
        addNotification({
          message: "Campfire ignited!",
          type: "info",
          icon: "/campfire.png",
        })
      }
    }
  }

  // Calculate total burn time remaining
  const totalBurnTimeRemaining = campfire.fuelSlots.reduce((total, slot) => {
    if (slot.item && slot.item.quantity && slot.item.quantity > 0) {
      return total + (slot.burnTime || 0) + (slot.item.quantity - (slot.burnTime > 0 ? 1 : 0)) * 30000
    }
    return total + (slot.burnTime || 0)
  }, 0)

  const formatTime = (ms: number) => {
    const seconds = Math.ceil(ms / 1000)
    const minutes = Math.floor(seconds / 60)
    const remainingSeconds = seconds % 60
    return `${minutes}:${remainingSeconds.toString().padStart(2, "0")}`
  }

  return (
    <div
      className="absolute pointer-events-auto w-80"
      style={{
        top: "calc(50% - 200px + 5vh)", // Same position as crafting menu
        left: "70%", // Same horizontal position as crafting menu
        transformOrigin: "top center",
      }}
    >
      <div className="bg-gray-800/90 border border-gray-600/50 rounded-lg p-4 backdrop-blur-sm">
        <div className="mb-4">
          <h2 className="text-xl font-bold text-white mb-2">Campfire</h2>
          <p className="text-gray-300 text-sm">Status: {campfire.isActive ? "🔥 Burning" : "💨 Not lit"}</p>
          {campfire.isActive && totalBurnTimeRemaining > 0 && (
            <p className="text-orange-300 text-sm">Burn time: {formatTime(totalBurnTimeRemaining)}</p>
          )}
          {campfire.isActive && (
            <p className="text-yellow-300 text-xs">Burning slot: {campfire.currentBurningSlot + 1}</p>
          )}
        </div>

        <div className="mb-6">
          <h3 className="text-white mb-2">Fuel Slots:</h3>
          <div className="flex gap-2 justify-center">
            {campfire.fuelSlots.map((slot, index) => {
              const isCurrentlyBurning = campfire.isActive && campfire.currentBurningSlot === index

              return (
                <div
                  key={index}
                  className={`w-16 h-16 bg-gray-700/80 border-2 rounded flex items-center justify-center cursor-pointer hover:border-gray-500/70 transition-colors relative ${
                    isCurrentlyBurning ? "border-orange-500/70 bg-orange-900/20" : "border-gray-600/50"
                  }`}
                  onDragOver={handleFuelSlotDragOver}
                  onDrop={(e) => handleFuelSlotDrop(e, index)}
                  onContextMenu={(e) => handleFuelSlotRightClick(e, index)}
                  title={
                    slot.item
                      ? `${slot.item.name} x${slot.item.quantity || 1}${
                          isCurrentlyBurning ? ` - BURNING (${formatTime(slot.burnTime || 0)} remaining)` : ""
                        }`
                      : "Empty fuel slot - Right-click to remove"
                  }
                >
                  {slot.item && (
                    <div
                      className="w-14 h-14 relative"
                      draggable={!(isCurrentlyBurning && slot.item.quantity === 1)}
                      onDragStart={(e) => handleFuelSlotDragStart(e, index)}
                    >
                      <Image
                        src={slot.item.icon || "/wood-icon.png"}
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

                      {/* Burn time indicator - only show for currently burning slot */}
                      {isCurrentlyBurning && slot.burnTime && (
                        <div className="absolute top-0 right-0 bg-orange-600/80 text-white text-xs px-1 rounded-sm font-bold">
                          {Math.ceil(slot.burnTime / 1000)}s
                        </div>
                      )}

                      {/* Burning indicator */}
                      {isCurrentlyBurning && <div className="absolute top-0 left-0 text-orange-500 text-xs">🔥</div>}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
          <p className="text-sm text-gray-400 mt-2 text-center">Drag wood from inventory • Right-click to remove</p>
          {campfire.isActive && (
            <p className="text-sm text-orange-300 mt-1 text-center">One wood must remain in the burning slot</p>
          )}
        </div>

        <div className="flex justify-center">
          <button
            onClick={handleFireToggle}
            className={`py-2 px-6 rounded font-medium transition-colors ${
              campfire.isActive
                ? "bg-blue-600 hover:bg-blue-700 text-white"
                : "bg-orange-600 hover:bg-orange-700 text-white"
            }`}
          >
            {campfire.isActive ? "💧 Extinguish" : "🔥 Ignite"}
          </button>
        </div>

        <p className="text-xs text-gray-500 mt-3 text-center">Press Tab or ESC to close</p>
      </div>
    </div>
  )
}
