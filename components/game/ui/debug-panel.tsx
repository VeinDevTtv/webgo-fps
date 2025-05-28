"use client"

import type React from "react"

import { useState, useEffect, useRef } from "react"
import { useGameState } from "@/lib/game-context"
import { MAX_RENDER_DISTANCE } from "../game-scene"

interface DebugPanelProps {
  isLocked: boolean
  onCommand: (command: string) => void
}

export default function DebugPanel({ isLocked, onCommand }: DebugPanelProps) {
  const { playerPosition } = useGameState()
  const [keyStates, setKeyStates] = useState({
    KeyW: false,
    KeyS: false,
    KeyA: false,
    KeyD: false,
    Space: false,
    ShiftLeft: false,
  })
  const [frameRate, setFrameRate] = useState(0)
  const [frameCount, setFrameCount] = useState(0)
  const [terrainHeight, setTerrainHeight] = useState(0)
  const [command, setCommand] = useState("")
  const [commandHistory, setCommandHistory] = useState<string[]>([])
  const [historyIndex, setHistoryIndex] = useState(-1)
  const inputRef = useRef<HTMLInputElement>(null)

  // Track frame rate
  useEffect(() => {
    let lastTime = performance.now()
    let frames = 0

    const updateFrameRate = () => {
      const now = performance.now()
      frames++

      if (now >= lastTime + 1000) {
        setFrameRate(frames)
        setFrameCount((prev) => prev + frames)
        frames = 0
        lastTime = now
      }

      requestAnimationFrame(updateFrameRate)
    }

    requestAnimationFrame(updateFrameRate)

    return () => {
      // No way to cancel requestAnimationFrame in cleanup
    }
  }, [])

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.code in keyStates) {
        setKeyStates((prev) => ({ ...prev, [e.code]: true }))
      }
    }

    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.code in keyStates) {
        setKeyStates((prev) => ({ ...prev, [e.code]: false }))
      }
    }

    window.addEventListener("keydown", handleKeyDown)
    window.addEventListener("keyup", handleKeyUp)

    return () => {
      window.removeEventListener("keydown", handleKeyDown)
      window.removeEventListener("keyup", handleKeyUp)
    }
  }, [keyStates])

  const handleCommandSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!command.trim()) return

    // Add command to history
    setCommandHistory((prev) => [...prev, command])
    setHistoryIndex(-1)

    // Execute command
    onCommand(command.trim().toLowerCase())

    // Clear input
    setCommand("")
  }

  const handleCommandKeyDown = (e: React.KeyboardEvent) => {
    // Navigate command history with up/down arrows
    if (e.key === "ArrowUp") {
      e.preventDefault()
      if (historyIndex < commandHistory.length - 1) {
        const newIndex = historyIndex + 1
        setHistoryIndex(newIndex)
        setCommand(commandHistory[commandHistory.length - 1 - newIndex])
      }
    } else if (e.key === "ArrowDown") {
      e.preventDefault()
      if (historyIndex > 0) {
        const newIndex = historyIndex - 1
        setHistoryIndex(newIndex)
        setCommand(commandHistory[commandHistory.length - 1 - newIndex])
      } else if (historyIndex === 0) {
        setHistoryIndex(-1)
        setCommand("")
      }
    }
  }

  // Focus input when debug panel is shown
  useEffect(() => {
    if (inputRef.current) {
      inputRef.current.focus()
    }
  }, [])

  return (
    <div className="absolute bottom-0 left-0 bg-black/80 text-white p-4 font-mono text-xs max-w-xs">
      <h3 className="font-bold mb-2">Debug Info</h3>
      <div>Pointer Lock: {isLocked ? "Active" : "Inactive"}</div>
      <div>FPS: {frameRate}</div>
      <div>
        Position: X:{playerPosition.x.toFixed(2)} Y:{playerPosition.y.toFixed(2)} Z:{playerPosition.z.toFixed(2)}
      </div>
      <div>Height above terrain: {(playerPosition.y - terrainHeight).toFixed(2)}</div>
      <div>Max Render Distance: {MAX_RENDER_DISTANCE} units</div>
      <div className="mt-2">Key States:</div>
      <div className={keyStates.KeyW ? "text-green-400 font-bold" : ""}>W: {keyStates.KeyW ? "DOWN" : "up"}</div>
      <div className={keyStates.KeyA ? "text-green-400 font-bold" : ""}>A: {keyStates.KeyA ? "DOWN" : "up"}</div>
      <div className={keyStates.KeyS ? "text-green-400 font-bold" : ""}>S: {keyStates.KeyS ? "DOWN" : "up"}</div>
      <div className={keyStates.KeyD ? "text-green-400 font-bold" : ""}>D: {keyStates.KeyD ? "DOWN" : "up"}</div>
      <div className={keyStates.ShiftLeft ? "text-green-400 font-bold" : ""}>
        Shift: {keyStates.ShiftLeft ? "DOWN (Sprinting)" : "up (Walking)"}
      </div>
      <div className={keyStates.Space ? "text-green-400 font-bold" : ""}>
        Space: {keyStates.Space ? "DOWN (Jumping)" : "up"}
      </div>

      <div className="mt-4 border-t border-gray-700 pt-2">
        <div className="text-yellow-400 mb-1">Commands:</div>
        <div className="text-gray-400 text-xs mb-2">
          <div>fps_toggle - Toggle FPS counter</div>
          <div>help - Show available commands</div>
        </div>
        <form onSubmit={handleCommandSubmit} className="flex">
          <span className="text-green-400 mr-1">&gt;</span>
          <input
            ref={inputRef}
            type="text"
            value={command}
            onChange={(e) => setCommand(e.target.value)}
            onKeyDown={handleCommandKeyDown}
            className="flex-1 bg-transparent outline-none"
            placeholder="Type command..."
          />
        </form>
      </div>

      <div className="mt-2 text-yellow-400">Press ` (backtick) to toggle this panel</div>
    </div>
  )
}
