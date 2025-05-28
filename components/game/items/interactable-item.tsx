"use client"

import { useInteractableItem } from "@/lib/hooks/use-interactable-item"

interface InteractableItemProps {
  itemId: string
  position: [number, number, number]
  onInteract?: (itemId: string) => void
  onInteractionStateChange?: (state: { showPrompt: boolean; isInRange: boolean }) => void
  interactionRange?: number
  lookAtThreshold?: number
  disabled?: boolean
}

export default function InteractableItem({
  itemId,
  position,
  onInteract,
  onInteractionStateChange,
  interactionRange = 2.5,
  lookAtThreshold = 0.9,
  disabled = false,
}: InteractableItemProps) {
  useInteractableItem({
    itemId,
    position,
    interactionRange,
    lookAtThreshold,
    onInteract,
    onInteractionStateChange,
    disabled,
  })

  // This component doesn't render anything visible
  return null
}
