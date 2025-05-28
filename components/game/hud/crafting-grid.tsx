"use client"

import type React from "react"
import { useRef } from "react"
import Image from "next/image"
import { useCrafting, type CraftingRecipe } from "@/lib/crafting-context"
import { useInventory } from "@/lib/inventory-context"

interface CraftingGridProps {
  visible: boolean
}

export default function CraftingGrid({ visible }: CraftingGridProps) {
  const {
    isOpen,
    availableRecipes,
    selectedRecipe,
    setSelectedRecipe,
    canCraftSelectedRecipe,
    craftSelectedRecipe,
    getIngredientStatus,
  } = useCrafting()

  const { inventoryOpenedBy, saveCameraState, restoreCameraState } = useInventory()

  const craftingRef = useRef<HTMLDivElement>(null)

  // Don't render if not visible, crafting is not open, or inventory was opened via interaction
  if (!visible || !isOpen || inventoryOpenedBy === "interaction") {
    return null
  }

  // Prevent pointer lock only on background clicks
  const preventPointerLockRelease = (e: React.MouseEvent) => {
    e.stopPropagation()
    e.preventDefault()

    // Ensure we don't trigger any movement
    if (document.activeElement instanceof HTMLElement) {
      document.activeElement.blur()
    }
  }

  // Handle recipe selection
  const handleRecipeSelect = (recipe: CraftingRecipe, e: React.MouseEvent) => {
    // Prevent the click from propagating to avoid movement issues
    e.preventDefault()
    e.stopPropagation()

    setSelectedRecipe(recipe === selectedRecipe ? null : recipe)

    // Ensure we don't trigger any movement
    if (document.activeElement instanceof HTMLElement) {
      document.activeElement.blur()
    }
  }

  // Handle crafting button click
  const handleCraft = (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()

    if (canCraftSelectedRecipe()) {
      craftSelectedRecipe()
    }

    // Ensure we don't trigger any movement
    if (document.activeElement instanceof HTMLElement) {
      document.activeElement.blur()
    }
  }

  // Get icon for ingredient type
  const getIngredientIcon = (itemType: string): string => {
    switch (itemType) {
      case "Wood":
        return "/wood.png"
      case "Stone":
        return "/stone.png"
      default:
        return "/placeholder.svg"
    }
  }

  // Render recipe list
  const renderRecipeList = () => {
    // Add null check to prevent error
    if (!availableRecipes || !Array.isArray(availableRecipes)) {
      return <div className="text-white">No recipes available</div>
    }

    return (
      <div className="space-y-2">
        {availableRecipes.map((recipe) => (
          <div
            key={recipe.id}
            className={`p-2 rounded cursor-pointer flex items-center ${
              selectedRecipe?.id === recipe.id ? "bg-blue-900/50" : "bg-gray-800/50 hover:bg-gray-700/50"
            }`}
            onClick={(e) => handleRecipeSelect(recipe, e)}
          >
            <div className="w-8 h-8 relative mr-2 flex-shrink-0">
              <Image src={recipe.icon || "/placeholder.svg"} alt={recipe.name} fill className="object-contain" />
            </div>
            <div className="flex-grow">
              <div className="text-white text-sm">{recipe.name}</div>
            </div>
          </div>
        ))}
      </div>
    )
  }

  // Render recipe details with ingredient status
  const renderRecipeDetails = () => {
    if (!selectedRecipe) return null

    return (
      <div className="p-2 bg-gray-800/80 rounded mt-4">
        <h3 className="text-white text-sm font-bold mb-2">{selectedRecipe.name}</h3>
        <p className="text-gray-300 text-xs mb-3">{selectedRecipe.description}</p>

        <h4 className="text-gray-400 text-xs font-bold mb-2">Requires:</h4>
        <div className="space-y-2 mb-3">
          {selectedRecipe.ingredients.map((ingredient, index) => {
            const status = getIngredientStatus(ingredient.itemType, ingredient.quantity)
            const hasEnough = status.hasEnough
            const textColor = hasEnough ? "text-green-400" : "text-red-400"

            return (
              <div key={index} className="flex items-center space-x-2">
                {/* Ingredient icon */}
                <div className="w-4 h-4 relative flex-shrink-0">
                  <Image
                    src={getIngredientIcon(ingredient.itemType) || "/placeholder.svg"}
                    alt={ingredient.itemType}
                    fill
                    className="object-contain"
                  />
                </div>

                {/* Ingredient name and amount */}
                <span className={`text-xs ${textColor}`}>
                  {ingredient.itemType}: {status.current}/{ingredient.quantity}
                </span>
              </div>
            )
          })}
        </div>

        <button
          className={`w-full py-1 px-2 rounded text-white text-sm ${
            canCraftSelectedRecipe() ? "bg-blue-600 hover:bg-blue-700" : "bg-gray-600 cursor-not-allowed"
          }`}
          onClick={handleCraft}
          disabled={!canCraftSelectedRecipe()}
        >
          Craft
        </button>
      </div>
    )
  }

  return (
    <div
      ref={craftingRef}
      className="absolute pointer-events-auto"
      style={{
        top: "calc(50% - 200px + 5vh)", // Moved down by an additional 5% of viewport height
        left: "70%", // Keep horizontal position
        transformOrigin: "top center", // Ensure expansion happens from the top down
      }}
      onClick={preventPointerLockRelease}
    >
      <div
        className="p-3 bg-black/60 rounded-md border border-gray-500/30 backdrop-blur-sm w-[250px]"
        onClick={preventPointerLockRelease}
      >
        {/* Fixed header that doesn't move */}
        <div className="mb-3">
          <h2 className="text-white text-center font-bold">Crafting</h2>
        </div>

        {/* Recipe list with fixed height and scrolling */}
        <div>
          <h3 className="text-white text-sm font-bold mb-2">Recipes</h3>
          <div className="max-h-40 overflow-y-auto">{renderRecipeList()}</div>
        </div>

        {/* Recipe details that expand downward */}
        {renderRecipeDetails()}
      </div>
    </div>
  )
}
