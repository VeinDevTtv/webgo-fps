"use client"

import { useEffect } from "react"

import { createContext, useContext, useState, type ReactNode } from "react"
import { useInventory, type InventoryItem } from "./inventory-context"
import { NotificationContext } from "./notification-context"

// Define the structure of a crafting recipe
export interface CraftingRecipe {
  id: string
  name: string
  icon: string
  description: string
  result: InventoryItem
  ingredients: {
    itemType: string
    quantity: number
  }[]
  category: "tools" | "weapons" | "resources" | "structures"
}

// Define the structure of a crafting slot
export interface CraftingSlot {
  id: string
  item: InventoryItem | null
}

// Create a context to manage crafting state
interface CraftingContextType {
  isOpen: boolean
  setIsOpen: (open: boolean) => void
  craftingSlots: CraftingSlot[]
  setCraftingSlots: (slots: CraftingSlot[]) => void
  availableRecipes: CraftingRecipe[]
  selectedRecipe: CraftingRecipe | null
  setSelectedRecipe: (recipe: CraftingRecipe | null) => void
  addItemToCraftingSlot: (item: InventoryItem, slotIndex: number) => boolean
  removeItemFromCraftingSlot: (slotIndex: number) => InventoryItem | null
  canCraftSelectedRecipe: () => boolean
  craftSelectedRecipe: () => boolean
  clearCraftingSlots: () => void
  getIngredientStatus: (itemType: string, needed: number) => { current: number; hasEnough: boolean }
}

const CraftingContext = createContext<CraftingContextType | null>(null)

// Define crafting recipes
const CRAFTING_RECIPES: CraftingRecipe[] = [
  {
    id: "recipe_campfire",
    name: "Campfire",
    icon: "/campfire.png",
    description: "A basic campfire for cooking and warmth.",
    result: {
      id: "item_campfire",
      type: "item",
      name: "Campfire",
      icon: "/campfire.png",
    },
    ingredients: [{ itemType: "Wood", quantity: 100 }],
    category: "structures",
  },
  {
    id: "recipe_storage_box",
    name: "Storage Box",
    icon: "/storage-box-icon.png", // Updated to use the new icon
    description: "A wooden box for storing items.",
    result: {
      id: "item_storage_box",
      type: "item",
      name: "Storage Box",
      icon: "/storage-box-icon.png", // Updated to use the new icon
    },
    ingredients: [
      { itemType: "Wood", quantity: 150 },
      { itemType: "Stone", quantity: 20 },
    ],
    category: "structures",
  },
  {
    id: "recipe_hatchet",
    name: "Hatchet",
    icon: "/hatchet-basic.png",
    description: "A basic tool for chopping trees.",
    result: {
      id: "tool_hatchet",
      type: "tool",
      name: "Hatchet",
      icon: "/hatchet-basic.png",
    },
    ingredients: [
      { itemType: "Wood", quantity: 50 },
      { itemType: "Stone", quantity: 10 },
    ],
    category: "tools",
  },
  {
    id: "recipe_pickaxe",
    name: "Pickaxe",
    icon: "/pickaxe-basic.png",
    description: "A basic tool for mining stone.",
    result: {
      id: "tool_pickaxe",
      type: "tool",
      name: "Pickaxe",
      icon: "/pickaxe-basic.png",
    },
    ingredients: [
      { itemType: "Wood", quantity: 50 },
      { itemType: "Stone", quantity: 20 },
    ],
    category: "tools",
  },
  {
    id: "recipe_wooden_door",
    name: "Wooden Door",
    icon: "/door-wood.png",
    description: "A sturdy wooden door for buildings.",
    result: {
      id: "item_wooden_door",
      type: "item",
      name: "Wooden Door",
      icon: "/door-wood.png",
    },
    ingredients: [{ itemType: "Wood", quantity: 150 }],
    category: "structures",
  },
  {
    id: "recipe_building_plan",
    name: "Building Plan",
    icon: "/building-plan.png",
    description: "A blueprint for constructing buildings and structures.",
    result: {
      id: "tool_building_plan",
      type: "tool",
      name: "Building Plan",
      icon: "/building-plan.png",
    },
    ingredients: [
      { itemType: "Wood", quantity: 25 },
      { itemType: "Stone", quantity: 5 },
    ],
    category: "tools",
  },
]

// Create a provider for the crafting context
export function CraftingProvider({ children }: { children: ReactNode }) {
  const [isOpen, setIsOpen] = useState(false)
  const { inventoryItems, setInventoryItems, addItem, removeItem } = useInventory()

  // Get notifications context safely
  const notificationsContext = useContext(NotificationContext)
  const addNotification = notificationsContext?.addNotification || (() => {})

  // Initialize crafting slots (3x3 grid)
  const [craftingSlots, setCraftingSlots] = useState<CraftingSlot[]>(
    Array(9)
      .fill(null)
      .map((_, index) => ({
        id: `crafting-slot-${index}`,
        item: null,
      })),
  )

  // Track selected recipe
  const [selectedRecipe, setSelectedRecipe] = useState<CraftingRecipe | null>(null)

  // Get available recipes based on inventory
  const availableRecipes = CRAFTING_RECIPES

  // Get ingredient status from inventory
  const getIngredientStatus = (itemType: string, needed: number) => {
    const current = inventoryItems.reduce((total, item) => {
      if (item && item.name === itemType && item.quantity) {
        return total + item.quantity
      }
      return total
    }, 0)

    return {
      current,
      hasEnough: current >= needed,
    }
  }

  // Add item to crafting slot
  const addItemToCraftingSlot = (item: InventoryItem, slotIndex: number): boolean => {
    if (slotIndex < 0 || slotIndex >= craftingSlots.length) {
      return false
    }

    // If the slot already has an item, return false
    if (craftingSlots[slotIndex].item !== null) {
      return false
    }

    // Update crafting slots
    const newCraftingSlots = [...craftingSlots]
    newCraftingSlots[slotIndex] = {
      ...newCraftingSlots[slotIndex],
      item: { ...item },
    }
    setCraftingSlots(newCraftingSlots)
    return true
  }

  // Remove item from crafting slot
  const removeItemFromCraftingSlot = (slotIndex: number): InventoryItem | null => {
    if (slotIndex < 0 || slotIndex >= craftingSlots.length) {
      return null
    }

    const item = craftingSlots[slotIndex].item
    if (!item) {
      return null
    }

    // Update crafting slots
    const newCraftingSlots = [...craftingSlots]
    newCraftingSlots[slotIndex] = {
      ...newCraftingSlots[slotIndex],
      item: null,
    }
    setCraftingSlots(newCraftingSlots)
    return item
  }

  // Check if the selected recipe can be crafted
  const canCraftSelectedRecipe = (): boolean => {
    if (!selectedRecipe) {
      return false
    }

    // Check if we have all required ingredients in inventory
    for (const ingredient of selectedRecipe.ingredients) {
      const status = getIngredientStatus(ingredient.itemType, ingredient.quantity)
      if (!status.hasEnough) {
        return false
      }
    }

    return true
  }

  // Craft the selected recipe
  const craftSelectedRecipe = (): boolean => {
    if (!selectedRecipe || !canCraftSelectedRecipe()) {
      return false
    }

    // Create a copy of inventory to modify
    const newInventory = [...inventoryItems]

    // For each ingredient, consume the required quantity from inventory
    for (const ingredient of selectedRecipe.ingredients) {
      let remainingToConsume = ingredient.quantity

      // Go through inventory and consume items
      for (let i = 0; i < newInventory.length && remainingToConsume > 0; i++) {
        const item = newInventory[i]
        if (item && item.name === ingredient.itemType && item.quantity) {
          // Calculate how much to consume from this slot
          const toConsume = Math.min(remainingToConsume, item.quantity)
          remainingToConsume -= toConsume

          // Update or remove the item
          if (toConsume >= item.quantity) {
            // Remove the item completely
            newInventory[i] = null
          } else {
            // Reduce the quantity
            newInventory[i] = {
              ...item,
              quantity: item.quantity - toConsume,
            }
          }
        }
      }
    }

    // Update inventory
    setInventoryItems(newInventory)

    // Add the crafted item to inventory
    const craftedItem = {
      ...selectedRecipe.result,
      id: `${selectedRecipe.result.id}_${Date.now()}`,
      quantity: 1,
    }

    const added = addItem(craftedItem)

    if (added) {
      // Show notification
      addNotification({
        message: `Crafted ${selectedRecipe.name}`,
        type: "info",
        icon: selectedRecipe.icon,
      })

      return true
    }

    return false
  }

  // Clear all crafting slots and return items to inventory
  const clearCraftingSlots = () => {
    // Get all items from crafting slots
    const items = craftingSlots.filter((slot) => slot.item !== null).map((slot) => slot.item!)

    // Add items back to inventory
    items.forEach((item) => {
      if (item) {
        addItem(item)
      }
    })

    // Clear crafting slots
    setCraftingSlots(
      Array(9)
        .fill(null)
        .map((_, index) => ({
          id: `crafting-slot-${index}`,
          item: null,
        })),
    )
  }

  // Close crafting when inventory is closed
  useEffect(() => {
    if (!isOpen) {
      clearCraftingSlots()
    }
  }, [isOpen])

  return (
    <CraftingContext.Provider
      value={{
        isOpen,
        setIsOpen,
        craftingSlots,
        setCraftingSlots,
        availableRecipes,
        selectedRecipe,
        setSelectedRecipe,
        addItemToCraftingSlot,
        removeItemFromCraftingSlot,
        canCraftSelectedRecipe,
        craftSelectedRecipe,
        clearCraftingSlots,
        getIngredientStatus,
      }}
    >
      {children}
    </CraftingContext.Provider>
  )
}

// Hook for using crafting context
export function useCrafting() {
  const context = useContext(CraftingContext)
  if (!context) {
    throw new Error("useCrafting must be used within a CraftingProvider")
  }
  return context
}
