"use client"

import { useEffect } from "react"
import { useInteractableItem } from "@/lib/hooks/use-interactable-item"
import { useInteraction } from "@/lib/interaction-context"

interface CampfireInteractionProps {
  id: string
  position: [number, number, number]
  rotation?: [number, number, number]
  onInteract?: (id: string) => void
  disabled?: boolean
}

export default function CampfireInteraction({
  id,
  position,
  rotation = [0, 0, 0],
  onInteract,
  disabled = false,
}: CampfireInteractionProps) {
  const { setInteractionPrompt } = useInteraction()

  const handleInteract = (campfireId: string) => {
    console.log(`Campfire interaction triggered for ${campfireId}`)
    if (onInteract) {
      onInteract(campfireId)
    } else {
      console.error("No onInteract handler provided to CampfireInteraction")
    }
  }

  const { isInteractable } = useInteractableItem({
    itemId: id,
    position,
    interactionRange: 3,
    lookAtThreshold: 0.9,
    onInteract: handleInteract,
    disabled,
    itemType: "campfire", // Add item type for better prompt message
  })

  // Update interaction prompt based on interactable state
  useEffect(() => {
    if (isInteractable) {
      setInteractionPrompt(true, "Press E to interact with campfire", id)
    } else {
      // Only clear if this is for our campfire
      setInteractionPrompt(false, undefined, id)
    }

    // Cleanup when component unmounts
    return () => {
      setInteractionPrompt(false, undefined, id)
    }
  }, [isInteractable, id, setInteractionPrompt])

  // This component doesn't render anything visible
  return null
}
