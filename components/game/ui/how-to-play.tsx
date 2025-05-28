"use client"

import { useEffect } from "react"
import { useGameState } from "@/lib/game-state-context"
import { ArrowLeft } from 'lucide-react'

export default function HowToPlay() {
  const { setGameStatus } = useGameState()

  // Add ESC key handler to return to title
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.code === "Escape") {
        console.log("ESC pressed in How to Play, returning to title")
        setGameStatus("title")
      }
    }

    window.addEventListener("keydown", handleKeyDown)
    return () => window.removeEventListener("keydown", handleKeyDown)
  }, [setGameStatus])

  return (
    <div className="absolute inset-0 flex items-center justify-center bg-black/90 z-50">
      <div className="bg-gray-900 rounded-lg w-full max-w-2xl max-h-[90vh] overflow-auto">
        <div className="flex items-center justify-between p-4 border-b border-gray-800">
          <button
            onClick={() => setGameStatus("title")}
            className="flex items-center text-gray-400 hover:text-white transition-colors"
          >
            <ArrowLeft size={20} className="mr-2" />
            Back to Menu
          </button>
          <h2 className="text-xl font-bold text-white">How to Play</h2>
        </div>

        <div className="p-6">
          <div className="space-y-6">
            <section>
              <h3 className="text-xl font-bold text-white mb-3">Controls</h3>
              <div className="grid grid-cols-2 gap-2 text-sm">
                <div className="text-gray-400">Move Forward</div>
                <div className="text-white">W</div>
                <div className="text-gray-400">Move Left</div>
                <div className="text-white">A</div>
                <div className="text-gray-400">Move Backward</div>
                <div className="text-white">S</div>
                <div className="text-gray-400">Move Right</div>
                <div className="text-white">D</div>
                <div className="text-gray-400">Jump</div>
                <div className="text-white">SPACE</div>
                <div className="text-gray-400">Sprint</div>
                <div className="text-white">SHIFT</div>
                <div className="text-gray-400">Reload</div>
                <div className="text-white">R</div>
                <div className="text-gray-400">Menu</div>
                <div className="text-white">ESC</div>
                <div className="text-gray-400">Debug Panel</div>
                <div className="text-white">` (backtick)</div>
              </div>
            </section>

            <section>
              <h3 className="text-xl font-bold text-white mb-3">Gameplay</h3>
              <p className="text-gray-300 mb-2">
                Fe₂O₃ is a first-person shooter game where you explore a procedurally generated terrain.
              </p>
              <ul className="list-disc pl-5 text-gray-300 space-y-1">
                <li>Use WASD to move around the terrain</li>
                <li>Press SPACE to jump over obstacles</li>
                <li>Hold SHIFT to sprint</li>
                <li>Click to shoot your weapon</li>
                <li>Press R to reload your weapon when you run out of ammo</li>
                <li>Press ESC to access the menu at any time</li>
              </ul>
            </section>

            <section>
              <h3 className="text-xl font-bold text-white mb-3">Tips</h3>
              <ul className="list-disc pl-5 text-gray-300 space-y-1">
                <li>Adjust your render distance in settings if you experience performance issues</li>
                <li>You can toggle the FPS counter in the settings menu</li>
                <li>The debug panel (press `) shows additional information about your position and performance</li>
                <li>Trees have collision only on their trunks - you can walk through the foliage</li>
                <li>Water has no collision - you can walk through it</li>
              </ul>
            </section>
          </div>

          <div className="mt-8 flex justify-center">
            <button
              onClick={() => setGameStatus("title")}
              className="px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded transition-colors"
            >
              Back to Menu
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
