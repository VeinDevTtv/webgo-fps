"use client"

import { useInteraction } from "@/lib/interaction-context"

export default function InteractionPrompt() {
  const { showPrompt, promptMessage } = useInteraction()

  if (!showPrompt) return null

  return (
    <div className="fixed top-1/2 left-1/2 transform -translate-x-1/2 translate-y-16 pointer-events-none z-50">
      <div className="bg-black/70 text-white px-4 py-2 rounded-lg shadow-lg">
        <div className="flex items-center gap-2">
          <kbd className="bg-gray-600 px-2 py-1 rounded text-sm font-mono">E</kbd>
          <span>{promptMessage}</span>
        </div>
      </div>
    </div>
  )
}
