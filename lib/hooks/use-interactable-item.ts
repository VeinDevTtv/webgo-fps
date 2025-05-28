"use client"

import { useRef, useEffect, useState } from "react"
import * as THREE from "three"
import { useThree, useFrame } from "@react-three/fiber"
import { useInteraction } from "@/lib/interaction-context"

interface UseInteractableItemProps {
  itemId: string
  position: [number, number, number]
  interactionRange?: number
  lookAtThreshold?: number
  onInteract?: (itemId: string) => void
  disabled?: boolean
  itemType?: string
}

export function useInteractableItem({
  itemId,
  position,
  interactionRange = 2.5,
  lookAtThreshold = 0.9,
  onInteract,
  disabled = false,
  itemType = "item",
}: UseInteractableItemProps) {
  const { camera } = useThree()
  const [isInRange, setIsInRange] = useState(false)
  const [isLookingAt, setIsLookingAt] = useState(false)
  const [isInteractable, setIsInteractable] = useState(false)
  const lastInteractableState = useRef(false)
  const { setInteractionPrompt } = useInteraction()

  // Check if player is looking at and in range of the item
  useFrame(() => {
    if (disabled) {
      if (isInteractable) {
        setIsInteractable(false)
        setIsInRange(false)
        setIsLookingAt(false)
        setInteractionPrompt(false, "", itemId)
      }
      return
    }

    // Calculate distance from camera to item
    const itemPosition = new THREE.Vector3(...position)
    const distance = camera.position.distanceTo(itemPosition)
    const inRange = distance <= interactionRange

    // Only update if changed
    if (inRange !== isInRange) {
      setIsInRange(inRange)
    }

    // If not in range, not looking at
    if (!inRange) {
      if (isLookingAt) {
        setIsLookingAt(false)
      }
      if (isInteractable) {
        setIsInteractable(false)
        setInteractionPrompt(false, "", itemId)
      }
      return
    }

    // Check if player is looking at the item
    const direction = new THREE.Vector3()
    direction.subVectors(itemPosition, camera.position).normalize()

    // Get camera direction
    const cameraDirection = new THREE.Vector3()
    camera.getWorldDirection(cameraDirection)

    // Check if the item is roughly in the direction the camera is looking
    const dot = cameraDirection.dot(direction)
    const lookingAt = dot > lookAtThreshold

    // Only update if changed
    if (lookingAt !== isLookingAt) {
      setIsLookingAt(lookingAt)
    }

    // Update interactable state
    const shouldBeInteractable = inRange && lookingAt
    if (shouldBeInteractable !== isInteractable) {
      setIsInteractable(shouldBeInteractable)
      lastInteractableState.current = shouldBeInteractable

      // Update the interaction prompt
      if (shouldBeInteractable) {
        const promptMessage = `Press E to interact with ${itemType}`
        setInteractionPrompt(true, promptMessage, itemId)
      } else {
        setInteractionPrompt(false, "", itemId)
      }
    }
  })

  // Handle E key press for interaction
  useEffect(() => {
    if (disabled) return

    const handleKeyPress = (e: KeyboardEvent) => {
      if (e.code === "KeyE" && isInteractable) {
        console.log(`E key pressed while looking at ${itemType} ${itemId}, calling onInteract`)
        if (onInteract) {
          onInteract(itemId)
        } else {
          console.warn(`No onInteract handler provided for ${itemType} ${itemId}`)
        }
      }
    }

    window.addEventListener("keydown", handleKeyPress)
    return () => window.removeEventListener("keydown", handleKeyPress)
  }, [itemId, onInteract, disabled, isInteractable, itemType])

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      setInteractionPrompt(false, "", itemId)
    }
  }, [itemId, setInteractionPrompt])

  return {
    isInRange,
    isLookingAt,
    isInteractable,
  }
}
