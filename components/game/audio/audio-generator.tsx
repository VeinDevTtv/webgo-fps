"use client"

import { useEffect, useRef, useState } from "react"
import { useSoundManager, type SoundId } from "@/lib/sound-manager"

// This component generates simple audio files programmatically
// as a fallback when the actual audio files can't be loaded
const AudioGenerator = () => {
  const audioContext = useRef<AudioContext | null>(null)
  const soundManager = useSoundManager()
  const [generated, setGenerated] = useState(false)

  useEffect(() => {
    // Create audio context on first render - only in browser
    if (typeof window !== "undefined" && !audioContext.current) {
      try {
        audioContext.current = new (window.AudioContext || (window as any).webkitAudioContext)()
        console.log("AudioGenerator: Audio context initialized")

        // Generate and cache audio files immediately
        if (!generated) {
          generateAudioFiles()
          setGenerated(true)
        }
      } catch (e) {
        console.error("AudioGenerator: Web Audio API not supported:", e)
      }
    }

    return () => {
      // Clean up audio context on unmount
      if (audioContext.current) {
        audioContext.current.close().catch(console.error)
      }
    }
  }, [generated])

  const generateAudioFiles = async () => {
    if (!audioContext.current) return

    console.log("AudioGenerator: Generating all audio files")

    // Generate simple audio for each sound type
    await generateFootstepSound("footstep_grass")
    await generateFootstepSound("footstep_dirt")
    await generateJumpSound("jump")
    await generateLandSound("land")
    await generateShootSound("shoot")
    await generateReloadSound("reload")
    await generateEmptySound("empty")
    await generateAmbientSound("ambient_wind")
    await generateChopSound("chop") // Add the chop sound generation
    await generateStoneHitSound("stone_hit")

    console.log("AudioGenerator: All audio files generated")
  }

  const generateFootstepSound = async (id: SoundId) => {
    if (!audioContext.current) return

    try {
      const ctx = audioContext.current
      const duration = 0.15
      const buffer = ctx.createBuffer(1, ctx.sampleRate * duration, ctx.sampleRate)
      const data = buffer.getChannelData(0)

      // Create a short noise burst
      for (let i = 0; i < buffer.length; i++) {
        // Fade in and out
        const fadeIn = Math.min(1, i / (ctx.sampleRate * 0.01))
        const fadeOut = Math.min(1, (buffer.length - i) / (ctx.sampleRate * 0.1))
        data[i] = (Math.random() * 2 - 1) * 0.3 * fadeIn * fadeOut
      }

      // Convert to WAV and create blob URL
      const blob = await bufferToWav(buffer, ctx.sampleRate)
      const url = URL.createObjectURL(blob)

      // Update the sound manager with this generated sound
      soundManager.setGeneratedSound(id, url)
      console.log(`AudioGenerator: Generated ${id} sound`)
    } catch (e) {
      console.error(`Failed to generate ${id} sound:`, e)
    }
  }

  const generateJumpSound = async (id: SoundId) => {
    if (!audioContext.current) return

    try {
      const ctx = audioContext.current
      const duration = 0.3
      const buffer = ctx.createBuffer(1, ctx.sampleRate * duration, ctx.sampleRate)
      const data = buffer.getChannelData(0)

      // Create a swoosh sound
      for (let i = 0; i < buffer.length; i++) {
        const t = i / buffer.length
        const freq = 400 - 300 * t
        data[i] = Math.sin(((i * freq) / ctx.sampleRate) * Math.PI * 2) * 0.5 * (1 - t)
      }

      const blob = await bufferToWav(buffer, ctx.sampleRate)
      const url = URL.createObjectURL(blob)

      // Update the sound manager with this generated sound
      soundManager.setGeneratedSound(id, url)
      console.log(`AudioGenerator: Generated ${id} sound`)
    } catch (e) {
      console.error(`Failed to generate ${id} sound:`, e)
    }
  }

  const generateLandSound = async (id: SoundId) => {
    if (!audioContext.current) return

    try {
      const ctx = audioContext.current
      const duration = 0.2
      const buffer = ctx.createBuffer(1, ctx.sampleRate * duration, ctx.sampleRate)
      const data = buffer.getChannelData(0)

      // Create a thud sound
      for (let i = 0; i < buffer.length; i++) {
        const t = i / buffer.length
        const freq = 100 + 50 * t
        data[i] = Math.sin(((i * freq) / ctx.sampleRate) * Math.PI * 2) * 0.7 * Math.exp(-5 * t)
      }

      const blob = await bufferToWav(buffer, ctx.sampleRate)
      const url = URL.createObjectURL(blob)

      // Update the sound manager with this generated sound
      soundManager.setGeneratedSound(id, url)
      console.log(`AudioGenerator: Generated ${id} sound`)
    } catch (e) {
      console.error(`Failed to generate ${id} sound:`, e)
    }
  }

  const generateShootSound = async (id: SoundId) => {
    if (!audioContext.current) return

    try {
      const ctx = audioContext.current
      const duration = 0.3
      const buffer = ctx.createBuffer(1, ctx.sampleRate * duration, ctx.sampleRate)
      const data = buffer.getChannelData(0)

      // Create a gunshot sound
      for (let i = 0; i < buffer.length; i++) {
        const t = i / buffer.length
        // Sharp attack with quick decay
        data[i] = (Math.random() * 2 - 1) * Math.exp(-20 * t)
      }

      const blob = await bufferToWav(buffer, ctx.sampleRate)
      const url = URL.createObjectURL(blob)

      // Update the sound manager with this generated sound
      soundManager.setGeneratedSound(id, url)
      console.log(`AudioGenerator: Generated ${id} sound`)
    } catch (e) {
      console.error(`Failed to generate ${id} sound:`, e)
    }
  }

  const generateReloadSound = async (id: SoundId) => {
    if (!audioContext.current) return

    try {
      const ctx = audioContext.current
      const duration = 0.5
      const buffer = ctx.createBuffer(1, ctx.sampleRate * duration, ctx.sampleRate)
      const data = buffer.getChannelData(0)

      // Create a mechanical click sound
      for (let i = 0; i < buffer.length; i++) {
        const t = i / buffer.length

        // First click
        if (t < 0.2) {
          data[i] = Math.sin(((i * 800) / ctx.sampleRate) * Math.PI * 2) * 0.5 * Math.exp(-20 * (t - 0.1) * (t - 0.1))
        }
        // Second click
        else if (t > 0.3 && t < 0.5) {
          data[i] = Math.sin(((i * 1200) / ctx.sampleRate) * Math.PI * 2) * 0.5 * Math.exp(-20 * (t - 0.4) * (t - 0.4))
        }
      }

      const blob = await bufferToWav(buffer, ctx.sampleRate)
      const url = URL.createObjectURL(blob)

      // Update the sound manager with this generated sound
      soundManager.setGeneratedSound(id, url)
      console.log(`AudioGenerator: Generated ${id} sound`)
    } catch (e) {
      console.error(`Failed to generate ${id} sound:`, e)
    }
  }

  const generateEmptySound = async (id: SoundId) => {
    if (!audioContext.current) return

    try {
      const ctx = audioContext.current
      const duration = 0.1
      const buffer = ctx.createBuffer(1, ctx.sampleRate * duration, ctx.sampleRate)
      const data = buffer.getChannelData(0)

      // Create a click sound
      for (let i = 0; i < buffer.length; i++) {
        const t = i / buffer.length
        data[i] = Math.sin(((i * 600) / ctx.sampleRate) * Math.PI * 2) * 0.3 * Math.exp(-30 * t)
      }

      const blob = await bufferToWav(buffer, ctx.sampleRate)
      const url = URL.createObjectURL(blob)

      // Update the sound manager with this generated sound
      soundManager.setGeneratedSound(id, url)
      console.log(`AudioGenerator: Generated ${id} sound`)
    } catch (e) {
      console.error(`Failed to generate ${id} sound:`, e)
    }
  }

  const generateAmbientSound = async (id: SoundId) => {
    if (!audioContext.current) return

    try {
      const ctx = audioContext.current
      const duration = 5.0 // Longer for ambient
      const buffer = ctx.createBuffer(1, ctx.sampleRate * duration, ctx.sampleRate)
      const data = buffer.getChannelData(0)

      // Create a wind sound
      for (let i = 0; i < buffer.length; i++) {
        const t = i / ctx.sampleRate

        // Use noise with filtering for wind effect
        const noise = (Math.random() * 2 - 1) * 0.15

        // Add some slow modulation
        const modulation = 0.5 + 0.5 * Math.sin(t * 0.5)

        data[i] = noise * modulation

        // Simple low-pass filter
        if (i > 0) {
          data[i] = data[i] * 0.2 + data[i - 1] * 0.8
        }
      }

      const blob = await bufferToWav(buffer, ctx.sampleRate)
      const url = URL.createObjectURL(blob)

      // Update the sound manager with this generated sound
      soundManager.setGeneratedSound(id, url)
      console.log(`AudioGenerator: Generated ${id} sound`)
    } catch (e) {
      console.error(`Failed to generate ${id} sound:`, e)
    }
  }

  const generateChopSound = async (id: SoundId) => {
    if (!audioContext.current) return

    try {
      const ctx = audioContext.current
      const duration = 0.3
      const buffer = ctx.createBuffer(1, ctx.sampleRate * duration, ctx.sampleRate)
      const data = buffer.getChannelData(0)

      // Create a wood chopping sound - sharp attack with quick decay
      for (let i = 0; i < buffer.length; i++) {
        const t = i / buffer.length
        // Mix noise with some tonal components for a wood chop sound
        const noise = (Math.random() * 2 - 1) * 0.4 * Math.exp(-8 * t)
        const thud = Math.sin(((i * 80) / ctx.sampleRate) * Math.PI * 2) * 0.6 * Math.exp(-15 * t)
        const crack = Math.sin(((i * 400) / ctx.sampleRate) * Math.PI * 2) * 0.3 * Math.exp(-25 * t)

        data[i] = noise + thud + crack
      }

      const blob = await bufferToWav(buffer, ctx.sampleRate)
      const url = URL.createObjectURL(blob)

      // Update the sound manager with this generated sound
      soundManager.setGeneratedSound(id, url)
      console.log(`AudioGenerator: Generated ${id} sound`)
    } catch (e) {
      console.error(`Failed to generate ${id} sound:`, e)
    }
  }

  const generateStoneHitSound = async (id: SoundId) => {
    if (!audioContext.current) return

    try {
      const ctx = audioContext.current
      const duration = 0.2
      const buffer = ctx.createBuffer(1, ctx.sampleRate * duration, ctx.sampleRate)
      const data = buffer.getChannelData(0)

      // Create a stone hit sound - higher pitched than chop
      for (let i = 0; i < buffer.length; i++) {
        const t = i / buffer.length
        // Mix noise with some tonal components for a stone hit sound
        const noise = (Math.random() * 2 - 1) * 0.5 * Math.exp(-10 * t)
        const tone1 = Math.sin(((i * 1200) / ctx.sampleRate) * Math.PI * 2) * 0.3 * Math.exp(-15 * t)
        const tone2 = Math.sin(((i * 800) / ctx.sampleRate) * Math.PI * 2) * 0.2 * Math.exp(-20 * t)

        data[i] = noise + tone1 + tone2
      }

      const blob = await bufferToWav(buffer, ctx.sampleRate)
      const url = URL.createObjectURL(blob)

      // Update the sound manager with this generated sound
      soundManager.setGeneratedSound(id, url)
      console.log(`AudioGenerator: Generated ${id} sound`)
    } catch (e) {
      console.error(`Failed to generate ${id} sound:`, e)
    }
  }

  // Helper to convert AudioBuffer to WAV format
  const bufferToWav = (buffer: AudioBuffer, sampleRate: number): Promise<Blob> => {
    return new Promise((resolve) => {
      const numChannels = buffer.numberOfChannels
      const length = buffer.length * numChannels * 2
      const data = new DataView(new ArrayBuffer(44 + length))

      // WAV header
      writeString(data, 0, "RIFF")
      data.setUint32(4, 36 + length, true)
      writeString(data, 8, "WAVE")
      writeString(data, 12, "fmt ")
      data.setUint32(16, 16, true)
      data.setUint16(20, 1, true)
      data.setUint16(22, numChannels, true)
      data.setUint32(24, sampleRate, true)
      data.setUint32(28, sampleRate * numChannels * 2, true)
      data.setUint16(32, numChannels * 2, true)
      data.setUint16(34, 16, true)
      writeString(data, 36, "data")
      data.setUint32(40, length, true)

      // Write audio data
      const channelData = []
      for (let i = 0; i < numChannels; i++) {
        channelData.push(buffer.getChannelData(i))
      }

      let offset = 44
      for (let i = 0; i < buffer.length; i++) {
        for (let channel = 0; channel < numChannels; channel++) {
          const sample = Math.max(-1, Math.min(1, channelData[channel][i]))
          data.setInt16(offset, sample < 0 ? sample * 0x8000 : sample * 0x7fff, true)
          offset += 2
        }
      }

      resolve(new Blob([data], { type: "audio/wav" }))
    })
  }

  const writeString = (dataView: DataView, offset: number, string: string) => {
    for (let i = 0; i < string.length; i++) {
      dataView.setUint8(offset + i, string.charCodeAt(i))
    }
  }

  return null // This component doesn't render anything
}

export default AudioGenerator
