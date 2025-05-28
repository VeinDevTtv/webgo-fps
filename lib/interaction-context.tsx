"use client"

import { createContext, useContext, useState, useEffect, type ReactNode } from "react"

interface InteractionContextType {
  showPrompt: boolean
  promptMessage: string
  setInteractionPrompt: (show: boolean, message?: string, itemId?: string) => void
  clearPrompt: () => void
}

const InteractionContext = createContext<InteractionContextType | undefined>(undefined)

export function InteractionProvider({ children }: { children: ReactNode }) {
  const [showPrompt, setShowPrompt] = useState(false)
  const [promptMessage, setPromptMessage] = useState("Press E to interact")
  const [activeItemId, setActiveItemId] = useState<string | null>(null)

  const setInteractionPrompt = (show: boolean, message = "Press E to interact", itemId?: string) => {
    console.log(`Setting interaction prompt: show=${show}, message=${message}, itemId=${itemId}`)

    if (show) {
      setShowPrompt(true)
      setPromptMessage(message)
      if (itemId) setActiveItemId(itemId)
    } else if (!itemId || activeItemId === itemId) {
      // Only clear if no itemId is provided (global clear) or if this is the same item that set the prompt
      setShowPrompt(false)
      setActiveItemId(null)
    }
  }

  const clearPrompt = () => {
    setShowPrompt(false)
    setActiveItemId(null)
  }

  // Clear prompt when component unmounts
  useEffect(() => {
    return () => {
      setShowPrompt(false)
      setActiveItemId(null)
    }
  }, [])

  return (
    <InteractionContext.Provider value={{ showPrompt, promptMessage, setInteractionPrompt, clearPrompt }}>
      {children}
    </InteractionContext.Provider>
  )
}

export function useInteraction() {
  const context = useContext(InteractionContext)
  if (!context) {
    throw new Error("useInteraction must be used within an InteractionProvider")
  }
  return context
}
