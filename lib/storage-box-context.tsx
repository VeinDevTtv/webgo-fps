"use client"

import type React from "react"
import { createContext, useContext, useState, useCallback } from "react"
import type { InventoryItem } from "./inventory-context"

// Define the structure of a storage box slot
interface StorageBoxSlot {
  item: InventoryItem | null
}

// Define the structure of a storage box
interface StorageBox {
  id: string
  slots: StorageBoxSlot[]
}

// Define the context interface
interface StorageBoxContextType {
  storageBoxes: Record<string, StorageBox>
  createStorageBox: (id: string) => void
  getStorageBox: (id: string) => StorageBox | undefined
  addItemToSlot: (boxId: string, slotIndex: number, item: InventoryItem) => boolean
  removeItemFromSlot: (boxId: string, slotIndex: number) => InventoryItem | null
}

// Create the context
const StorageBoxContext = createContext<StorageBoxContextType | undefined>(undefined)

// Create a provider component
export function StorageBoxProvider({ children }: { children: React.ReactNode }) {
  const [storageBoxes, setStorageBoxes] = useState<Record<string, StorageBox>>({})

  // Create a new storage box
  const createStorageBox = useCallback((id: string) => {
    console.log("Creating storage box with ID:", id)
    setStorageBoxes((prev) => {
      // If the storage box already exists, return the previous state
      if (prev[id]) {
        console.log("Storage box already exists:", prev[id])
        return prev
      }

      // Create a new storage box with 16 empty slots (2 rows x 8 columns)
      const newStorageBox: StorageBox = {
        id,
        slots: Array(16)
          .fill(null)
          .map(() => ({ item: null })),
      }

      console.log("Created new storage box:", newStorageBox)
      return {
        ...prev,
        [id]: newStorageBox,
      }
    })
  }, [])

  // Get a storage box by ID
  const getStorageBox = useCallback(
    (id: string) => {
      const box = storageBoxes[id]
      console.log("Getting storage box:", id, box ? "found" : "not found")
      return box
    },
    [storageBoxes],
  )

  // Add an item to a slot in a storage box
  const addItemToSlot = useCallback(
    (boxId: string, slotIndex: number, item: InventoryItem): boolean => {
      const box = storageBoxes[boxId]
      if (!box) {
        console.error("Storage box not found:", boxId)
        return false
      }

      if (slotIndex < 0 || slotIndex >= box.slots.length) {
        console.error("Invalid slot index:", slotIndex)
        return false
      }

      setStorageBoxes((prev) => {
        const updatedBox = { ...prev[boxId] }
        updatedBox.slots = [...updatedBox.slots]
        updatedBox.slots[slotIndex] = { item }

        return {
          ...prev,
          [boxId]: updatedBox,
        }
      })

      return true
    },
    [storageBoxes],
  )

  // Remove an item from a slot in a storage box
  const removeItemFromSlot = useCallback(
    (boxId: string, slotIndex: number): InventoryItem | null => {
      const box = storageBoxes[boxId]
      if (!box) {
        console.error("Storage box not found:", boxId)
        return null
      }

      if (slotIndex < 0 || slotIndex >= box.slots.length) {
        console.error("Invalid slot index:", slotIndex)
        return null
      }

      const item = box.slots[slotIndex].item
      if (!item) {
        return null
      }

      setStorageBoxes((prev) => {
        const updatedBox = { ...prev[boxId] }
        updatedBox.slots = [...updatedBox.slots]
        updatedBox.slots[slotIndex] = { item: null }

        return {
          ...prev,
          [boxId]: updatedBox,
        }
      })

      return item
    },
    [storageBoxes],
  )

  return (
    <StorageBoxContext.Provider
      value={{
        storageBoxes,
        createStorageBox,
        getStorageBox,
        addItemToSlot,
        removeItemFromSlot,
      }}
    >
      {children}
    </StorageBoxContext.Provider>
  )
}

// Create a custom hook to use the context
export function useStorageBox() {
  const context = useContext(StorageBoxContext)
  if (context === undefined) {
    throw new Error("useStorageBox must be used within a StorageBoxProvider")
  }
  return context
}
