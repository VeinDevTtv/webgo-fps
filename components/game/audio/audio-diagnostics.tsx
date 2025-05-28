"use client"

import { useState, useEffect } from "react"
import { useSoundManager } from "@/lib/sound-manager"

export default function AudioDiagnostics() {
  const [showDiagnostics, setShowDiagnostics] = useState(false)
  const [audioInfo, setAudioInfo] = useState<{
    context: boolean
    format: string
    duration: number
    loaded: boolean
  }>({
    context: false,
    format: "unknown",
    duration: 0,
    loaded: false,
  })
  const soundManager = useSoundManager()

  useEffect(() => {
    // Check if AudioContext is supported
    const hasAudioContext = typeof window !== "undefined" && (window.AudioContext || (window as any).webkitAudioContext)

    // Check audio format support
    const audio = new Audio()
    const formats = {
      mp3: audio.canPlayType("audio/mpeg"),
      ogg: audio.canPlayType("audio/ogg"),
      wav: audio.canPlayType("audio/wav"),
    }

    // Get the best supported format
    let bestFormat = "unknown"
    if (formats.mp3 === "probably") bestFormat = "mp3"
    else if (formats.ogg === "probably") bestFormat = "ogg"
    else if (formats.wav === "probably") bestFormat = "wav"
    else if (formats.mp3 === "maybe") bestFormat = "mp3 (maybe)"
    else if (formats.ogg === "maybe") bestFormat = "ogg (maybe)"
    else if (formats.wav === "maybe") bestFormat = "wav (maybe)"

    // Check shoot sound duration
    const shootDuration = soundManager.getAudioDuration("shoot")

    setAudioInfo({
      context: !!hasAudioContext,
      format: bestFormat,
      duration: shootDuration,
      loaded: shootDuration > 0,
    })
  }, [soundManager])

  if (!showDiagnostics) {
    return (
      <button
        className="fixed top-16 right-4 bg-red-600 text-white px-2 py-1 text-xs rounded"
        onClick={() => setShowDiagnostics(true)}
      >
        Audio Info
      </button>
    )
  }

  return (
    <div className="fixed top-16 right-4 bg-black/80 text-white p-3 rounded text-xs max-w-xs">
      <div className="flex justify-between mb-2">
        <h3 className="font-bold">Audio Diagnostics</h3>
        <button onClick={() => setShowDiagnostics(false)}>×</button>
      </div>
      <div className="space-y-1">
        <div>AudioContext: {audioInfo.context ? "Supported" : "Not supported"}</div>
        <div>Best format: {audioInfo.format}</div>
        <div>Shoot sound: {audioInfo.loaded ? `Loaded (${audioInfo.duration.toFixed(2)}s)` : "Not loaded"}</div>
      </div>
      <div className="mt-3 grid grid-cols-2 gap-1">
        <button
          className="bg-blue-600 px-2 py-1 rounded"
          onClick={() => {
            const audio = new Audio("/sounds/ak47-shot.mp3")
            audio.playbackRate = 0.5
            audio.play()
          }}
        >
          Test 0.5x
        </button>
        <button
          className="bg-blue-600 px-2 py-1 rounded"
          onClick={() => {
            const audio = new Audio("/sounds/ak47-shot.mp3")
            audio.playbackRate = 1.0
            audio.play()
          }}
        >
          Test 1.0x
        </button>
      </div>
    </div>
  )
}
