"use client"

import { useEffect } from "react"
import { useGameState } from "@/lib/game-state-context"
import { useInventory } from "@/lib/inventory-context"

interface WakeUpScreenProps {
  onWakeUp: () => void
}

export default function WakeUpScreen({ onWakeUp }: WakeUpScreenProps) {
  const { setGameStatus } = useGameState()
  const { isOpen, setIsOpen } = useInventory()

  // Handle ESC key to return to title
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.code === "Escape") {
        console.log("ESC pressed in wake-up screen, returning to title")
        // Ensure inventory is closed when going to title
        if (isOpen) {
          setIsOpen(false)
        }
        setGameStatus("title")
      } else if (e.code === "Space" || e.code === "Enter") {
        console.log("Space or Enter pressed, waking up")
        // Ensure inventory is closed when waking up
        if (isOpen) {
          setIsOpen(false)
        }
        onWakeUp()
      }
    }

    window.addEventListener("keydown", handleKeyDown)
    return () => window.removeEventListener("keydown", handleKeyDown)
  }, [onWakeUp, setGameStatus, isOpen, setIsOpen])

  // Handle wake up click
  const handleWakeUpClick = () => {
    console.log("Wake up screen clicked, calling onWakeUp")
    // Ensure inventory is closed when waking up
    if (isOpen) {
      setIsOpen(false)
    }
    onWakeUp()
  }

  return (
    <div
      className="absolute inset-0 flex flex-col items-center justify-center bg-black/80 z-40 cursor-pointer"
      onClick={handleWakeUpClick}
    >
      <div className="text-center p-6 bg-gray-900/80 rounded-lg max-w-md">
        <h2 className="text-3xl font-bold text-white mb-4">Game Paused</h2>
        <p className="text-gray-300 mb-6">Click anywhere or press Space to resume</p>
        <p className="text-gray-400 text-sm">Press ESC to return to main menu</p>
      </div>
    </div>
  )
}
