"use client"

import { useEffect, useState } from "react"
import SoundManager from "@/lib/sound-manager"

export function AudioTest() {
  const [initialized, setInitialized] = useState(false)
  const soundManager = SoundManager.getInstance()

  useEffect(() => {
    if (!soundManager.initialized) {
      soundManager.init()
      setInitialized(true)
    } else {
      setInitialized(true)
    }

    // Set up sound files
    soundManager.setGeneratedSound("chop", "/sounds/chop.mp3")
    soundManager.setGeneratedSound("stone_hit", "/sounds/stone-hit.mp3")

    console.log("Audio test component mounted")
  }, [])

  const playSound = (soundId: string) => {
    console.log(`Attempting to play sound: ${soundId}`)
    soundManager.play(soundId as any)
  }

  return (
    <div className="fixed top-0 left-0 bg-black bg-opacity-50 text-white p-4 z-50">
      <h3>Audio Test</h3>
      <p>Sound Manager Initialized: {initialized ? "Yes" : "No"}</p>
      <div className="flex gap-2 mt-2">
        <button className="px-2 py-1 bg-blue-500 rounded" onClick={() => playSound("chop")}>
          Test Chop
        </button>
        <button className="px-2 py-1 bg-blue-500 rounded" onClick={() => playSound("stone_hit")}>
          Test Stone Hit
        </button>
      </div>
    </div>
  )
}
