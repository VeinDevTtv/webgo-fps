"use client"

import type React from "react"
import { createContext, useContext, useState } from "react"

// Define the structure of an item
export interface ManagedItem {
  id: string
  type: string
  position: [number, number, number]
  normal?: [number, number, number]
  isActive?: boolean
  properties?: Record<string, any>
}

// Define the types of items we support
export type ItemType = "campfire" | "storage_box" | "door" | "wall" | "foundation" | "ceiling" | "window"

// Define the structure of our item manager
interface ItemManagerContextType {
  items: Record<ItemType, ManagedItem[]>
  addItem: (type: ItemType, item: ManagedItem) => void
  removeItem: (type: ItemType, itemId: string) => void
  updateItem: (type: ItemType, itemId: string, updates: Partial<ManagedItem>) => void
  getItem: (type: ItemType, itemId: string) => ManagedItem | undefined
}

// Create the context
const ItemManagerContext = createContext<ItemManagerContextType | null>(null)

// Create a provider component
export function ItemManagerProvider({ children }: { children: React.ReactNode }) {
  // Initialize with empty arrays for each item type
  const [items, setItems] = useState<Record<ItemType, ManagedItem[]>>({
    campfire: [],
    storage_box: [],
    door: [],
    wall: [],
    foundation: [],
    ceiling: [],
    window: [],
  })

  // Add an item
  const addItem = (type: ItemType, item: ManagedItem) => {
    setItems((prev) => ({
      ...prev,
      [type]: [...prev[type], item],
    }))
  }

  // Remove an item
  const removeItem = (type: ItemType, itemId: string) => {
    setItems((prev) => ({
      ...prev,
      [type]: prev[type].filter((item) => item.id !== itemId),
    }))
  }

  // Update an item
  const updateItem = (type: ItemType, itemId: string, updates: Partial<ManagedItem>) => {
    setItems((prev) => ({
      ...prev,
      [type]: prev[type].map((item) => (item.id === itemId ? { ...item, ...updates } : item)),
    }))
  }

  // Get an item
  const getItem = (type: ItemType, itemId: string) => {
    return items[type].find((item) => item.id === itemId)
  }

  return (
    <ItemManagerContext.Provider
      value={{
        items,
        addItem,
        removeItem,
        updateItem,
        getItem,
      }}
    >
      {children}
    </ItemManagerContext.Provider>
  )
}

// Create a custom hook to use the context
export function useItemManager() {
  const context = useContext(ItemManagerContext)
  if (!context) {
    throw new Error("useItemManager must be used within an ItemManagerProvider")
  }
  return context
}
