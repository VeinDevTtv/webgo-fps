"use client"

import { useEffect } from "react"
import { useInteractableItem } from "@/lib/hooks/use-interactable-item"
import { useInteraction } from "@/lib/interaction-context"

interface StorageBoxInteractionProps {
  id: string
  position: [number, number, number]
  rotation?: [number, number, number]
  onInteract?: (id: string) => void
  disabled?: boolean
}

export default function StorageBoxInteraction({
  id,
  position,
  rotation = [0, 0, 0],
  onInteract,
  disabled = false,
}: StorageBoxInteractionProps) {
  const { setInteractionPrompt } = useInteraction()

  const handleInteract = (storageBoxId: string) => {
    console.log(`Storage box interaction triggered for ${storageBoxId}`)
    if (onInteract) {
      onInteract(storageBoxId)
    } else {
      console.error("No onInteract handler provided to StorageBoxInteraction")
    }
  }

  const { isInteractable } = useInteractableItem({
    itemId: id,
    position,
    interactionRange: 2.5,
    lookAtThreshold: 0.9,
    onInteract: handleInteract,
    disabled,
    itemType: "storage box", // Add item type for better prompt message
  })

  // Update interaction prompt based on interactable state
  useEffect(() => {
    setInteractionPrompt(isInteractable, "Press E to open storage box", id)

    // Cleanup when component unmounts
    return () => {
      setInteractionPrompt(false)
    }
  }, [isInteractable, id, setInteractionPrompt])

  // This component doesn't render anything visible
  return null
}
