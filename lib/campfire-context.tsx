"use client"

import { createContext, useContext, useState, useEffect, type ReactNode } from "react"
import type { InventoryItem } from "./inventory-context"

interface FuelSlot {
  id: string
  item: InventoryItem | null
  burnTime: number // in milliseconds
  maxBurnTime: number // in milliseconds
}

interface CampfireData {
  id: string
  isActive: boolean
  fuelSlots: FuelSlot[]
  totalBurnTimeRemaining: number
  currentBurningSlot: number // Index of currently burning slot
}

interface CampfireContextType {
  campfires: Map<string, CampfireData>
  createCampfire: (campfireId: string) => void
  getCampfire: (campfireId: string) => CampfireData | undefined
  addFuelToSlot: (campfireId: string, slotIndex: number, item: InventoryItem, quantity?: number) => boolean
  removeFuelFromSlot: (campfireId: string, slotIndex: number, quantity?: number) => InventoryItem | null
  moveItemBetweenSlots: (campfireId: string, fromIndex: number, toIndex: number, isPartial?: boolean) => void
  igniteCampfire: (campfireId: string) => boolean
  extinguishCampfire: (campfireId: string) => void
}

const CampfireContext = createContext<CampfireContextType | null>(null)

const WOOD_BURN_TIME = 30000 // 30 seconds per wood
const FUEL_SLOTS_COUNT = 3 // Reduced to 3 slots
const MAX_STACK_SIZE = 100

export function CampfireProvider({ children }: { children: ReactNode }) {
  const [campfires, setCampfires] = useState<Map<string, CampfireData>>(new Map())

  // Update burn times every second
  useEffect(() => {
    const interval = setInterval(() => {
      setCampfires((prev) => {
        const newCampfires = new Map(prev)
        let hasChanges = false

        for (const [campfireId, campfire] of newCampfires) {
          if (!campfire.isActive) continue

          const updatedSlots = [...campfire.fuelSlots]
          let currentBurningSlot = campfire.currentBurningSlot
          let isStillActive = false

          // Find the first slot with fuel to burn (leftmost non-empty slot)
          let foundNewBurningSlot = false
          for (let i = 0; i < updatedSlots.length; i++) {
            const slot = updatedSlots[i]
            if (slot.item && slot.item.quantity && slot.item.quantity > 0) {
              currentBurningSlot = i
              foundNewBurningSlot = true
              break
            }
          }

          // If no slot with fuel was found, extinguish the fire
          if (!foundNewBurningSlot) {
            newCampfires.set(campfireId, {
              ...campfire,
              isActive: false,
              totalBurnTimeRemaining: 0,
            })
            hasChanges = true
            continue
          }

          // Only burn the current slot
          const slot = updatedSlots[currentBurningSlot]
          if (slot.item && slot.item.quantity && slot.item.quantity > 0) {
            if (slot.burnTime <= 0) {
              // Start burning this slot
              updatedSlots[currentBurningSlot] = {
                ...slot,
                burnTime: WOOD_BURN_TIME,
                maxBurnTime: WOOD_BURN_TIME,
              }
              isStillActive = true
            } else {
              // Continue burning this slot
              const newBurnTime = Math.max(0, slot.burnTime - 1000)
              if (newBurnTime === 0) {
                // One wood consumed, reduce quantity
                const newQuantity = slot.item.quantity - 1
                if (newQuantity <= 0) {
                  // Stack is empty, move to next slot
                  updatedSlots[currentBurningSlot] = {
                    ...slot,
                    item: null,
                    burnTime: 0,
                    maxBurnTime: 0,
                  }

                  // Find next slot with fuel
                  let nextSlotFound = false
                  for (let i = 0; i < updatedSlots.length; i++) {
                    if (i !== currentBurningSlot && updatedSlots[i].item && updatedSlots[i].item!.quantity! > 0) {
                      currentBurningSlot = i
                      nextSlotFound = true
                      isStillActive = true
                      break
                    }
                  }

                  if (!nextSlotFound) {
                    isStillActive = false
                  }
                } else {
                  // Still has wood, start burning next piece
                  updatedSlots[currentBurningSlot] = {
                    ...slot,
                    item: { ...slot.item, quantity: newQuantity },
                    burnTime: WOOD_BURN_TIME,
                    maxBurnTime: WOOD_BURN_TIME,
                  }
                  isStillActive = true
                }
              } else {
                updatedSlots[currentBurningSlot] = {
                  ...slot,
                  burnTime: newBurnTime,
                }
                isStillActive = true
              }
            }
          }

          // Calculate total burn time (only from slots with fuel)
          const totalBurnTime = updatedSlots.reduce((total, slot) => {
            if (slot.item && slot.item.quantity && slot.item.quantity > 0) {
              return total + (slot.burnTime || 0) + (slot.item.quantity - 1) * WOOD_BURN_TIME
            }
            return total + (slot.burnTime || 0)
          }, 0)

          newCampfires.set(campfireId, {
            ...campfire,
            fuelSlots: updatedSlots,
            totalBurnTimeRemaining: totalBurnTime,
            isActive: isStillActive,
            currentBurningSlot,
          })

          hasChanges = true
        }

        return hasChanges ? newCampfires : prev
      })
    }, 1000)

    return () => clearInterval(interval)
  }, [])

  const createCampfire = (campfireId: string) => {
    setCampfires((prev) => {
      if (prev.has(campfireId)) return prev

      const newCampfires = new Map(prev)
      const fuelSlots: FuelSlot[] = Array.from({ length: FUEL_SLOTS_COUNT }, (_, index) => ({
        id: `${campfireId}_slot_${index}`,
        item: null,
        burnTime: 0,
        maxBurnTime: 0,
      }))

      newCampfires.set(campfireId, {
        id: campfireId,
        isActive: false,
        fuelSlots,
        totalBurnTimeRemaining: 0,
        currentBurningSlot: 0,
      })

      return newCampfires
    })
  }

  const getCampfire = (campfireId: string): CampfireData | undefined => {
    return campfires.get(campfireId)
  }

  const addFuelToSlot = (campfireId: string, slotIndex: number, item: InventoryItem, quantity = 1): boolean => {
    // Check if it's wood - be more flexible with the check
    const isWood =
      item.id === "resource_wood" ||
      item.name === "Wood" ||
      item.name === "wood" ||
      item.id.includes("wood") ||
      item.icon?.includes("wood")

    if (!isWood) {
      console.log("Item is not wood:", item)
      return false
    }

    setCampfires((prev) => {
      const campfire = prev.get(campfireId)
      if (!campfire || slotIndex >= campfire.fuelSlots.length) return prev

      const slot = campfire.fuelSlots[slotIndex]
      const newCampfires = new Map(prev)
      const updatedSlots = [...campfire.fuelSlots]

      if (slot.item === null) {
        // Empty slot - add new stack
        updatedSlots[slotIndex] = {
          ...slot,
          item: { ...item, quantity },
          burnTime: 0, // Don't start burning immediately
          maxBurnTime: WOOD_BURN_TIME,
        }
      } else if (slot.item.name === item.name) {
        // Same item type - try to stack
        const currentQuantity = slot.item.quantity || 0
        const newQuantity = Math.min(MAX_STACK_SIZE, currentQuantity + quantity)
        const actualAdded = newQuantity - currentQuantity

        if (actualAdded > 0) {
          updatedSlots[slotIndex] = {
            ...slot,
            item: { ...slot.item, quantity: newQuantity },
          }
        } else {
          return prev // Can't add any more
        }
      } else {
        return prev // Different item type, can't stack
      }

      // Calculate total burn time
      const totalBurnTime = updatedSlots.reduce((total, slot) => {
        if (slot.item && slot.item.quantity && slot.item.quantity > 0) {
          return total + (slot.burnTime || 0) + (slot.item.quantity - (slot.burnTime > 0 ? 1 : 0)) * WOOD_BURN_TIME
        }
        return total + (slot.burnTime || 0)
      }, 0)

      newCampfires.set(campfireId, {
        ...campfire,
        fuelSlots: updatedSlots,
        totalBurnTimeRemaining: totalBurnTime,
      })

      return newCampfires
    })

    return true
  }

  const removeFuelFromSlot = (
    campfireId: string,
    slotIndex: number,
    quantity = Number.POSITIVE_INFINITY,
  ): InventoryItem | null => {
    let removedItem: InventoryItem | null = null

    setCampfires((prev) => {
      const campfire = prev.get(campfireId)
      if (!campfire || slotIndex >= campfire.fuelSlots.length) return prev

      const slot = campfire.fuelSlots[slotIndex]
      if (slot.item === null) return prev

      // Create a snapshot of the current state
      const currentItem = { ...slot.item }
      const currentQuantity = currentItem.quantity || 1

      // Check if this is the burning slot
      const isCurrentlyBurning = campfire.isActive && campfire.currentBurningSlot === slotIndex

      // Calculate how many to remove
      let quantityToRemove = Math.min(quantity, currentQuantity)

      // If this is the burning slot, ensure we leave at least 1 wood
      if (isCurrentlyBurning) {
        quantityToRemove = Math.min(quantityToRemove, currentQuantity - 1)
        if (quantityToRemove <= 0) {
          return prev // Nothing to remove
        }
      }

      const remainingQuantity = currentQuantity - quantityToRemove

      // Create the removed item with the exact quantity being removed
      removedItem = { ...currentItem, quantity: quantityToRemove }

      const newCampfires = new Map(prev)
      const updatedSlots = [...campfire.fuelSlots]

      if (remainingQuantity <= 0 && !isCurrentlyBurning) {
        // Remove entire stack (only if not burning)
        updatedSlots[slotIndex] = {
          ...slot,
          item: null,
          burnTime: 0,
          maxBurnTime: 0,
        }
      } else {
        // Reduce quantity but keep the item
        updatedSlots[slotIndex] = {
          ...slot,
          item: { ...slot.item, quantity: remainingQuantity },
          // Keep the burn time if it was burning
          burnTime: isCurrentlyBurning ? slot.burnTime : 0,
        }
      }

      // Calculate total burn time
      const totalBurnTime = updatedSlots.reduce((total, slot) => {
        if (slot.item && slot.item.quantity && slot.item.quantity > 0) {
          return total + (slot.burnTime || 0) + (slot.item.quantity - (slot.burnTime > 0 ? 1 : 0)) * WOOD_BURN_TIME
        }
        return total + (slot.burnTime || 0)
      }, 0)

      newCampfires.set(campfireId, {
        ...campfire,
        fuelSlots: updatedSlots,
        totalBurnTimeRemaining: totalBurnTime,
      })

      return newCampfires
    })

    return removedItem
  }

  const moveItemBetweenSlots = (campfireId: string, fromIndex: number, toIndex: number, isPartial = false) => {
    if (fromIndex === toIndex) return

    setCampfires((prev) => {
      const campfire = prev.get(campfireId)
      if (!campfire) return prev

      const newCampfires = new Map(prev)
      const updatedSlots = [...campfire.fuelSlots]
      const fromSlot = { ...updatedSlots[fromIndex] }
      const toSlot = { ...updatedSlots[toIndex] }

      // Check if this is the burning slot
      const isFromBurning = campfire.isActive && campfire.currentBurningSlot === fromIndex

      // If this is a partial move (from burning slot), handle differently
      if (isPartial && isFromBurning && fromSlot.item) {
        // We're moving all except 1 wood from the burning slot
        const quantityToMove = (fromSlot.item.quantity || 1) - 1

        if (quantityToMove <= 0) {
          return prev // Nothing to move
        }

        // Create a new item with the quantity to move
        const itemToMove = { ...fromSlot.item, quantity: quantityToMove }

        // Update the from slot to have only 1 wood
        updatedSlots[fromIndex] = {
          ...fromSlot,
          item: { ...fromSlot.item, quantity: 1 },
        }

        // Add to the destination slot
        if (toSlot.item === null) {
          // Empty destination slot
          updatedSlots[toIndex] = {
            ...toSlot,
            item: itemToMove,
          }
        } else if (toSlot.item.name === itemToMove.name) {
          // Same item type - stack
          const newQuantity = Math.min(MAX_STACK_SIZE, (toSlot.item.quantity || 0) + quantityToMove)
          updatedSlots[toIndex] = {
            ...toSlot,
            item: { ...toSlot.item, quantity: newQuantity },
          }
        } else {
          // Different item type - can't stack
          return prev
        }
      } else {
        // Regular move (swap slots)
        // If from slot is burning and has only 1 wood, don't allow the move
        if (isFromBurning && fromSlot.item && fromSlot.item.quantity === 1) {
          return prev
        }

        // Swap items
        updatedSlots[fromIndex] = toSlot
        updatedSlots[toIndex] = fromSlot

        // If we're moving the burning slot, update the burning slot index
        if (isFromBurning) {
          newCampfires.set(campfireId, {
            ...campfire,
            fuelSlots: updatedSlots,
            currentBurningSlot: toIndex,
          })
          return newCampfires
        }
      }

      newCampfires.set(campfireId, {
        ...campfire,
        fuelSlots: updatedSlots,
      })

      return newCampfires
    })
  }

  // Make sure the igniteCampfire function is properly updating the isActive state
  const igniteCampfire = (campfireId: string): boolean => {
    console.log(`Igniting campfire ${campfireId}`)

    setCampfires((prev) => {
      const campfire = prev.get(campfireId)
      if (!campfire) {
        console.error(`Campfire ${campfireId} not found`)
        return prev
      }

      if (campfire.isActive) {
        console.log(`Campfire ${campfireId} is already active`)
        return prev
      }

      const hasFuel = campfire.fuelSlots.some((slot) => slot.item !== null && (slot.item.quantity || 0) > 0)
      if (!hasFuel) {
        console.log(`Campfire ${campfireId} has no fuel`)
        return prev
      }

      // Find first slot with fuel to start burning (leftmost non-empty slot)
      let firstFuelSlot = -1
      for (let i = 0; i < campfire.fuelSlots.length; i++) {
        if (campfire.fuelSlots[i].item && (campfire.fuelSlots[i].item!.quantity || 0) > 0) {
          firstFuelSlot = i
          break
        }
      }

      if (firstFuelSlot === -1) {
        console.log(`Campfire ${campfireId} has no valid fuel slot`)
        return prev
      }

      console.log(`Campfire ${campfireId} igniting with fuel in slot ${firstFuelSlot}`)

      const newCampfires = new Map(prev)
      const updatedSlots = [...campfire.fuelSlots]

      // Start burning the first slot with fuel
      if (updatedSlots[firstFuelSlot].item) {
        updatedSlots[firstFuelSlot] = {
          ...updatedSlots[firstFuelSlot],
          burnTime: WOOD_BURN_TIME,
          maxBurnTime: WOOD_BURN_TIME,
        }
      }

      // Make sure we're setting isActive to true
      newCampfires.set(campfireId, {
        ...campfire,
        fuelSlots: updatedSlots,
        isActive: true,
        currentBurningSlot: firstFuelSlot,
      })

      console.log(`Campfire ${campfireId} is now active`)
      return newCampfires
    })

    return true
  }

  const extinguishCampfire = (campfireId: string) => {
    setCampfires((prev) => {
      const campfire = prev.get(campfireId)
      if (!campfire) return prev

      const newCampfires = new Map(prev)
      const updatedSlots = campfire.fuelSlots.map((slot) => ({
        ...slot,
        burnTime: 0,
      }))

      newCampfires.set(campfireId, {
        ...campfire,
        fuelSlots: updatedSlots,
        isActive: false,
      })

      return newCampfires
    })
  }

  return (
    <CampfireContext.Provider
      value={{
        campfires,
        createCampfire,
        getCampfire,
        addFuelToSlot,
        removeFuelFromSlot,
        moveItemBetweenSlots,
        igniteCampfire,
        extinguishCampfire,
      }}
    >
      {children}
    </CampfireContext.Provider>
  )
}

export function useCampfire() {
  const context = useContext(CampfireContext)
  if (!context) {
    throw new Error("useCampfire must be used within a CampfireProvider")
  }
  return context
}
