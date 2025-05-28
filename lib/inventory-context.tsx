"use client"

import { createContext, useContext, useState, useEffect, type ReactNode } from "react"
import type { ToolbarItem } from "./toolbar-context"
import type * as THREE from "three"

// Define the structure of an inventory item (same as toolbar item for consistency)
export type InventoryItem = ToolbarItem & {
  quantity?: number
}

// Define how the inventory was opened
export type InventoryOpenedBy = "tab" | "interaction"

// Create a context to manage inventory state
interface InventoryContextType {
  isOpen: boolean
  setIsOpen: (open: boolean) => void
  inventoryItems: (InventoryItem | null)[]
  setInventoryItems: (items: (InventoryItem | null)[]) => void
  addItem: (item: InventoryItem) => boolean // Returns true if added successfully
  removeItem: (itemId: string) => InventoryItem | null // Returns the removed item or null
  moveItem: (fromIndex: number, toIndex: number) => void // Move items within inventory
  isTogglingInventory: boolean // Add this to track when we're in the middle of toggling
  savedCameraRotation: THREE.Euler | null // Store camera rotation when inventory is opened
  setSavedCameraRotation: (rotation: THREE.Euler | null) => void // Set saved camera rotation
  // Add campfire interaction state
  activeCampfire: string | null
  setActiveCampfire: (campfireId: string | null) => void
  // Add storage box interaction state
  activeStorageBox: string | null
  setActiveStorageBox: (storageBoxId: string | null) => void
  // Add inventory opened by tracking
  inventoryOpenedBy: InventoryOpenedBy
  openInventoryForInteraction: (interactionType: string) => void
  closeInventory: () => void // Add explicit close function
  closedByTab: boolean // Track if inventory was closed by Tab
}

const InventoryContext = createContext<InventoryContextType | null>(null)

// Create a 10x10 grid of empty slots
const createEmptyInventory = (): (InventoryItem | null)[] => {
  return Array(100).fill(null)
}

// Maximum stack size
const MAX_STACK_SIZE = 100

export function InventoryProvider({ children }: { children: ReactNode }) {
  const [isOpen, setIsOpen] = useState(false)
  const [inventoryItems, setInventoryItems] = useState<(InventoryItem | null)[]>(createEmptyInventory)
  const [isTogglingInventory, setIsTogglingInventory] = useState(false)
  const [savedCameraRotation, setSavedCameraRotation] = useState<THREE.Euler | null>(null)
  const [activeCampfire, setActiveCampfire] = useState<string | null>(null)
  const [activeStorageBox, setActiveStorageBox] = useState<string | null>(null)
  const [inventoryOpenedBy, setInventoryOpenedBy] = useState<InventoryOpenedBy>("tab")
  const [closedByTab, setClosedByTab] = useState(false)

  // Initialize inventory with empty slots (no default items)
  useEffect(() => {
    setInventoryItems(createEmptyInventory())
  }, [])

  // Function to exit pointer lock
  const exitPointerLock = () => {
    if (document.exitPointerLock) {
      try {
        document.exitPointerLock()
        console.log("Exited pointer lock for inventory")
      } catch (error) {
        console.error("Error exiting pointer lock:", error)
      }
    }
  }

  // Function to request pointer lock
  const requestPointerLock = () => {
    const canvas = document.querySelector("canvas")
    if (!canvas) {
      console.error("Canvas element not found when trying to request pointer lock")
      return
    }

    try {
      // Try to request pointer lock with proper error handling
      if (canvas.requestPointerLock) {
        // Modern browsers - use Promise-based approach if available
        const requestMethod = canvas.requestPointerLock as any

        if (requestMethod.call && typeof requestMethod.call(canvas).then === "function") {
          requestMethod
            .call(canvas)
            .then(() => {
              console.log("Pointer lock successfully acquired after closing inventory")
            })
            .catch((error: any) => {
              console.warn("Error requesting pointer lock after closing inventory:", error)
            })
        } else {
          // Fallback for browsers without Promise support
          canvas.requestPointerLock()
        }
      } else if ((canvas as any).mozRequestPointerLock) {
        // Firefox fallback
        ;(canvas as any).mozRequestPointerLock()
      } else if ((canvas as any).webkitRequestPointerLock) {
        // Webkit fallback
        ;(canvas as any).webkitRequestPointerLock()
      }
    } catch (error) {
      console.error("Exception requesting pointer lock after closing inventory:", error)
    }
  }

  // Function to close inventory and clean up
  const closeInventory = () => {
    console.log("Explicitly closing inventory and resetting campfire")
    setIsOpen(false)
    setActiveCampfire(null)
    setActiveStorageBox(null)
    setClosedByTab(false) // Reset the flag

    // Ensure focus is removed from any element to prevent movement issues
    if (document.activeElement instanceof HTMLElement) {
      document.activeElement.blur()
    }

    // Request pointer lock immediately
    requestPointerLock()
  }

  // Monitor pointer lock state when inventory is open
  useEffect(() => {
    if (!isOpen) return

    // Function to check if pointer lock was acquired while inventory is open
    const checkPointerLock = () => {
      if (isOpen && document.pointerLockElement) {
        console.log("Pointer lock was acquired while inventory is open, releasing it")
        exitPointerLock()
      }
    }

    // Add event listener for pointer lock changes
    document.addEventListener("pointerlockchange", checkPointerLock)

    // Initial check
    checkPointerLock()

    return () => {
      document.removeEventListener("pointerlockchange", checkPointerLock)
    }
  }, [isOpen])

  // Function to open inventory for interaction
  const openInventoryForInteraction = (interactionType: string) => {
    console.log(`Opening inventory for ${interactionType} interaction`)
    setInventoryOpenedBy("interaction")
    setIsOpen(true)
    exitPointerLock()
  }

  // Simplified Tab key handler to toggle inventory
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Handle Tab key to toggle inventory
      if (e.key === "Tab") {
        e.preventDefault()
        e.stopPropagation()

        console.log("Tab key pressed, current inventory state:", isOpen)

        // Set toggling flag
        setIsTogglingInventory(true)

        // Toggle inventory state
        if (isOpen) {
          // If inventory is open, close it and mark it as closed by Tab
          console.log("Closing inventory via Tab")
          setClosedByTab(true)

          // Close both inventory and campfire/storage box dialog
          setIsOpen(false)
          setActiveCampfire(null)
          setActiveStorageBox(null)

          // Ensure focus is removed from any element to prevent movement issues
          if (document.activeElement instanceof HTMLElement) {
            document.activeElement.blur()
          }

          // Request pointer lock immediately
          requestPointerLock()
        } else {
          // If inventory is closed, open it
          console.log("Opening inventory via Tab")
          setInventoryOpenedBy("tab")
          setIsOpen(true)
          exitPointerLock()
        }

        // Clear toggling flag after a short delay
        setTimeout(() => {
          setIsTogglingInventory(false)
        }, 100)
      }
      // Handle ESC key to close inventory and go to sleep screen
      else if (e.key === "Escape" && (isOpen || activeCampfire || activeStorageBox)) {
        e.preventDefault()
        e.stopPropagation()

        console.log("ESC key pressed, closing inventory/campfire/storage box")

        // Close inventory and clear campfire/storage box
        setIsOpen(false)
        setActiveCampfire(null)
        setActiveStorageBox(null)
        setClosedByTab(false) // Not closed by Tab

        // Ensure focus is removed from any element to prevent movement issues
        if (document.activeElement instanceof HTMLElement) {
          document.activeElement.blur()
        }

        // Don't request pointer lock here - let the game container handle it
      }
    }

    window.addEventListener("keydown", handleKeyDown)
    return () => {
      window.removeEventListener("keydown", handleKeyDown)
    }
  }, [isOpen, activeCampfire, activeStorageBox])

  // Add an item to the inventory with stacking up to MAX_STACK_SIZE
  const addItem = (item: InventoryItem): boolean => {
    console.log("Adding item to inventory:", item)

    if (!item) {
      console.warn("Attempted to add null/undefined item to inventory")
      return false
    }

    let added = false

    setInventoryItems((prev) => {
      const newItems = [...prev]

      // If the item has a quantity, try to stack it
      if (item.quantity !== undefined) {
        console.log(`Item has quantity: ${item.quantity}`)

        // Find all existing stacks of this item type
        const existingStacks = newItems
          .map((slot, index) => ({ slot, index }))
          .filter(({ slot }) => slot !== null && slot.name === item.name && slot.quantity !== undefined)
          .sort((a, b) => (a.slot!.quantity || 0) - (b.slot!.quantity || 0)) // Sort by quantity (ascending)

        let remainingQuantity = item.quantity

        // Try to add to existing stacks first
        for (const { slot, index } of existingStacks) {
          if (remainingQuantity <= 0) break

          const currentQuantity = slot!.quantity || 0

          // Skip full stacks
          if (currentQuantity >= MAX_STACK_SIZE) continue

          // Calculate how much we can add to this stack
          const spaceInStack = MAX_STACK_SIZE - currentQuantity
          const quantityToAdd = Math.min(spaceInStack, remainingQuantity)

          // Update the stack
          newItems[index] = {
            ...slot!,
            quantity: currentQuantity + quantityToAdd,
          }

          remainingQuantity -= quantityToAdd
          added = true

          console.log(`Added ${quantityToAdd} to existing stack at index ${index}, remaining: ${remainingQuantity}`)
        }

        // If we still have items to add, create new stacks
        while (remainingQuantity > 0) {
          const emptyIndex = newItems.findIndex((slot) => slot === null)

          if (emptyIndex === -1) {
            console.warn(`Inventory full, couldn't add remaining ${remainingQuantity} items`)
            break
          }

          const quantityForNewStack = Math.min(remainingQuantity, MAX_STACK_SIZE)

          newItems[emptyIndex] = {
            ...item,
            id: `${item.id}_${Date.now()}_${emptyIndex}`, // Ensure unique ID
            quantity: quantityForNewStack,
          }

          remainingQuantity -= quantityForNewStack
          added = true

          console.log(
            `Created new stack at index ${emptyIndex} with quantity ${quantityForNewStack}, remaining: ${remainingQuantity}`,
          )
        }

        return newItems
      }

      // For non-stackable items, just find an empty slot
      const emptyIndex = newItems.findIndex((slot) => slot === null)

      if (emptyIndex !== -1) {
        console.log(`Adding non-stackable item to empty slot at index ${emptyIndex}`)
        newItems[emptyIndex] = { ...item }
        added = true
      } else {
        console.warn("No empty slots available in inventory")
      }

      return newItems
    })

    return added
  }

  // Remove an item by ID and return it
  const removeItem = (itemId: string): InventoryItem | null => {
    let removedItem: InventoryItem | null = null

    setInventoryItems((prev) => {
      const newItems = [...prev]
      const itemIndex = newItems.findIndex((item) => item?.id === itemId)

      if (itemIndex !== -1) {
        removedItem = newItems[itemIndex]
        newItems[itemIndex] = null
      }

      return newItems
    })

    return removedItem
  }

  // Move an item within the inventory
  const moveItem = (fromIndex: number, toIndex: number) => {
    if (fromIndex === toIndex) return

    setInventoryItems((prev) => {
      const newItems = [...prev]
      const itemToMove = newItems[fromIndex]

      // Swap items
      newItems[fromIndex] = newItems[toIndex]
      newItems[toIndex] = itemToMove

      return newItems
    })
  }

  return (
    <InventoryContext.Provider
      value={{
        isOpen,
        setIsOpen,
        inventoryItems,
        setInventoryItems,
        addItem,
        removeItem,
        moveItem,
        isTogglingInventory,
        savedCameraRotation,
        setSavedCameraRotation,
        activeCampfire,
        setActiveCampfire,
        activeStorageBox,
        setActiveStorageBox,
        inventoryOpenedBy,
        openInventoryForInteraction,
        closeInventory,
        closedByTab,
      }}
    >
      {children}
    </InventoryContext.Provider>
  )
}

export function useInventory() {
  const context = useContext(InventoryContext)
  if (!context) {
    throw new Error("useInventory must be used within an InventoryProvider")
  }
  return context
}
