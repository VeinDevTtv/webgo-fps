"use client"

import { useEffect, useState } from "react"
import SoundManager from "@/lib/sound-manager"

export default function SoundTest() {
  const [message, setMessage] = useState("")
  const soundManager = SoundManager.getInstance()

  useEffect(() => {
    if (!soundManager.initialized) {
      soundManager.init()
    }
  }, [])

  const playSound = (soundId: string) => {
    try {
      setMessage(`Playing sound: ${soundId}`)
      console.log(`Test playing sound: ${soundId}`)
      soundManager.play(soundId as any)
    } catch (error) {
      setMessage(`Error playing ${soundId}: ${error}`)
      console.error(`Error playing ${soundId}:`, error)
    }
  }

  return (
    <div className="fixed top-4 right-4 bg-black bg-opacity-70 p-4 rounded text-white z-50">
      <h3 className="text-lg font-bold mb-2">Sound Test</h3>
      <div className="flex flex-col gap-2">
        <button className="px-3 py-1 bg-blue-600 rounded hover:bg-blue-700" onClick={() => playSound("chop")}>
          Test Chop Sound
        </button>
        <button className="px-3 py-1 bg-blue-600 rounded hover:bg-blue-700" onClick={() => playSound("stone_hit")}>
          Test Stone Hit Sound
        </button>
        <button className="px-3 py-1 bg-blue-600 rounded hover:bg-blue-700" onClick={() => playSound("shoot")}>
          Test Shoot Sound
        </button>
      </div>
      {message && <p className="mt-2">{message}</p>}
    </div>
  )
}
