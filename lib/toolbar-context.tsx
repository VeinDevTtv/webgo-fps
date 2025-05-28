"use client"

import { createContext, useContext, useState, useEffect, type ReactNode } from "react"

// Define the types of items that can be in the toolbar
export type ToolbarItemType = "weapon" | "tool" | "item" | "empty"

// Define the structure of a toolbar item
export interface ToolbarItem {
  id: string
  type: ToolbarItemType
  name: string
  icon?: string // Path to icon image
}

// Create a context to manage toolbar state
interface ToolbarContextType {
  selectedSlot: number
  setSelectedSlot: (slot: number) => void
  items: (ToolbarItem | null)[]
  setItems: (items: (ToolbarItem | null)[]) => void
  addItemToToolbar: (item: ToolbarItem) => boolean
}

const ToolbarContext = createContext<ToolbarContextType | null>(null)

// Default items for the toolbar
const defaultItems: (ToolbarItem | null)[] = [
  {
    id: "weapon_primary",
    type: "weapon",
    name: "AK-47",
    icon: "/ak47.png",
  },
  {
    id: "tool_hatchet",
    type: "tool",
    name: "Hatchet",
    icon: "/hatchet-basic.png",
  },
  {
    id: "tool_pickaxe",
    type: "tool",
    name: "Pickaxe",
    icon: "/pickaxe-basic.png",
  },
  null, // Removed building plan from default items
  null,
  null,
  null,
  null,
]

export function ToolbarProvider({ children }: { children: ReactNode }) {
  const [selectedSlot, setSelectedSlot] = useState(0) // Default to first slot
  const [items, setItems] = useState<(ToolbarItem | null)[]>(defaultItems)

  // Add this useEffect to log when the selected slot changes
  useEffect(() => {
    console.log(`Toolbar: Selected slot changed to ${selectedSlot}`)
    console.log(`Current item in slot: ${items[selectedSlot]?.name || "none"}`)
  }, [selectedSlot, items])

  // Function to add an item to the toolbar
  const addItemToToolbar = (item: ToolbarItem): boolean => {
    let added = false

    setItems((prev) => {
      const newItems = [...prev]
      // Find the first empty slot
      const emptyIndex = newItems.findIndex((slot) => slot === null)

      if (emptyIndex !== -1) {
        newItems[emptyIndex] = item
        added = true
        return newItems
      }

      return prev
    })

    return added
  }

  // Handle keyboard shortcuts (1-8)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Check if key is a number between 1-8
      if (e.key >= "1" && e.key <= "8") {
        const slot = Number.parseInt(e.key) - 1 // Convert to 0-based index
        console.log(`Toolbar: Key ${e.key} pressed, selecting slot ${slot}`)
        setSelectedSlot(slot)
      }
    }

    window.addEventListener("keydown", handleKeyDown)
    return () => window.removeEventListener("keydown", handleKeyDown)
  }, [])

  return (
    <ToolbarContext.Provider
      value={{
        selectedSlot,
        setSelectedSlot,
        items,
        setItems,
        addItemToToolbar,
      }}
    >
      {children}
    </ToolbarContext.Provider>
  )
}

export function useToolbar() {
  const context = useContext(ToolbarContext)
  if (!context) {
    throw new Error("useToolbar must be used within a ToolbarProvider")
  }
  return context
}
