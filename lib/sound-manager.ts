"use client"

import { useSettings } from "./settings-context"

// Sound categories
export type SoundCategory = "sfx" | "ambient"

// Sound IDs
export type SoundId =
  | "footstep_grass"
  | "footstep_dirt"
  | "jump"
  | "land"
  | "shoot"
  | "reload"
  | "empty"
  | "ambient_wind"
  | "chop"
  | "stone_hit"

// Sound configuration
interface SoundConfig {
  id: SoundId
  src: string
  volume: number
  category: SoundCategory
  loop?: boolean
  poolSize?: number
  playbackRate?: number
  minDuration?: number
  preload?: boolean
  useGeneratedOnly?: boolean
}

// Sound instance
interface SoundInstance {
  id: SoundId
  audio: HTMLAudioElement
  playing: boolean
  loaded: boolean
  playStartTime?: number
}

// Global flag to track if we're using generated sounds
const usingGeneratedSounds = true

class SoundManager {
  private static instance: SoundManager
  private sounds: Map<SoundId, SoundConfig> = new Map()
  private soundInstances: Map<SoundId, SoundInstance[]> = new Map()
  public initialized = false
  private masterVolume = 0.8
  private sfxVolume = 1.0
  private enabled = true
  private loadErrors: Record<string, boolean> = {}
  private audioContext: AudioContext | null = null
  private audioBuffers: Map<string, AudioBuffer> = new Map()
  private audioSources: Map<string, AudioBufferSourceNode[]> = new Map()
  private generatedSoundUrls: Map<SoundId, string> = new Map()

  // Sound configurations with fallback URLs
  private soundConfigs: SoundConfig[] = [
    {
      id: "footstep_grass",
      src: "/sounds/footstep_grass.mp3",
      volume: 0.3,
      category: "sfx",
      poolSize: 3,
      useGeneratedOnly: true,
    },
    {
      id: "footstep_dirt",
      src: "/sounds/footstep_dirt.mp3",
      volume: 0.3,
      category: "sfx",
      poolSize: 3,
      useGeneratedOnly: true,
    },
    {
      id: "jump",
      src: "/sounds/jump.mp3",
      volume: 0.4,
      category: "sfx",
      useGeneratedOnly: true,
    },
    {
      id: "land",
      src: "/sounds/land.mp3",
      volume: 0.4,
      category: "sfx",
      useGeneratedOnly: true,
    },
    {
      id: "shoot",
      src: "/sounds/ak47-shot.mp3",
      volume: 0.8,
      category: "sfx",
      poolSize: 3,
      playbackRate: 1.0,
      minDuration: 500,
      preload: true,
      useGeneratedOnly: true,
    },
    {
      id: "reload",
      src: "/sounds/reload.mp3",
      volume: 0.5,
      category: "sfx",
      useGeneratedOnly: true,
    },
    {
      id: "empty",
      src: "/sounds/empty.mp3",
      volume: 0.3,
      category: "sfx",
      useGeneratedOnly: true,
    },
    {
      id: "ambient_wind",
      src: "/sounds/ambient_wind.mp3",
      volume: 0.2,
      category: "ambient",
      loop: true,
      useGeneratedOnly: true,
    },
    {
      id: "chop",
      src: "/sounds/chop.mp3",
      volume: 0.5,
      category: "sfx",
      useGeneratedOnly: true, // Make sure this is true to use generated sound
    },
    {
      id: "stone_hit",
      src: "/sounds/stone-hit.mp3",
      volume: 0.5,
      category: "sfx",
      useGeneratedOnly: true,
    },
  ]

  private constructor() {
    if (typeof window !== "undefined") {
      this.initAudioContext()
    }
  }

  private initAudioContext() {
    if (typeof window !== "undefined") {
      try {
        this.audioContext = new (window.AudioContext || (window as any).webkitAudioContext)()
        console.log("AudioContext initialized")
      } catch (e) {
        console.error("Failed to initialize AudioContext:", e)
      }
    }
  }

  public static getInstance(): SoundManager {
    if (!SoundManager.instance) {
      SoundManager.instance = new SoundManager()
    }
    return SoundManager.instance
  }

  public init(): void {
    if (this.initialized || typeof window === "undefined") return

    console.log("Initializing sound manager...")

    // Register all sounds
    this.soundConfigs.forEach((config) => {
      this.sounds.set(config.id, config)
      console.log(`Registering sound: ${config.id}`)

      // Create sound instances pool
      const poolSize = config.poolSize || 1
      const instances: SoundInstance[] = []

      for (let i = 0; i < poolSize; i++) {
        const audio = typeof window !== "undefined" ? new Audio() : ({} as HTMLAudioElement)

        if (typeof window !== "undefined") {
          audio.onerror = (e) => {
            console.error(`Failed to load sound: ${config.id}`, e)
            this.loadErrors[config.id] = true
          }

          audio.oncanplaythrough = () => {
            console.log(`Sound loaded successfully: ${config.id}`)
            instances.find((instance) => instance.audio === audio)!.loaded = true
          }

          if (config.playbackRate !== undefined) {
            audio.playbackRate = config.playbackRate
          }

          audio.volume = config.volume * this.getVolumeForCategory(config.category)

          if (config.loop) {
            audio.loop = true
          }
        }

        instances.push({
          id: config.id,
          audio,
          playing: false,
          loaded: false,
        })
      }

      this.soundInstances.set(config.id, instances)
    })

    this.initialized = true
    console.log("Sound manager initialized with", this.sounds.size, "sounds")
  }

  public setGeneratedSound(id: SoundId, url: string): void {
    console.log(`Setting generated sound for ${id}`)
    this.generatedSoundUrls.set(id, url)

    const instances = this.soundInstances.get(id)
    if (instances) {
      instances.forEach((instance) => {
        instance.audio.src = url
        instance.audio.load()
        instance.loaded = true
      })
      this.loadErrors[id] = false
    }
  }

  private playBufferedSound(id: SoundId): boolean {
    if (!this.audioContext || !this.audioBuffers.has(id)) {
      return false
    }

    try {
      const buffer = this.audioBuffers.get(id)!
      const source = this.audioContext.createBufferSource()
      source.buffer = buffer

      const gainNode = this.audioContext.createGain()
      const config = this.sounds.get(id)

      if (config) {
        gainNode.gain.value = config.volume * this.getVolumeForCategory(config.category)
        if (config.playbackRate !== undefined) {
          source.playbackRate.value = config.playbackRate
        }
      }

      source.connect(gainNode)
      gainNode.connect(this.audioContext.destination)

      source.start(0)

      if (!this.audioSources.has(id)) {
        this.audioSources.set(id, [])
      }
      this.audioSources.get(id)!.push(source)

      source.onended = () => {
        const sources = this.audioSources.get(id)
        if (sources) {
          const index = sources.indexOf(source)
          if (index !== -1) {
            sources.splice(index, 1)
          }
        }
      }

      console.log(`Playing buffered sound ${id}`)
      return true
    } catch (error) {
      console.error(`Error playing buffered sound ${id}:`, error)
      return false
    }
  }

  public setVolume(masterVolume: number, sfxVolume: number): void {
    this.masterVolume = masterVolume
    this.sfxVolume = sfxVolume

    this.soundInstances.forEach((instances, id) => {
      const config = this.sounds.get(id)
      if (config) {
        const categoryVolume = this.getVolumeForCategory(config.category)
        instances.forEach((instance) => {
          instance.audio.volume = config.volume * categoryVolume
        })
      }
    })
  }

  public setEnabled(enabled: boolean): void {
    this.enabled = enabled

    if (!enabled) {
      this.stopAll()
    }
  }

  public play(id: SoundId): void {
    if (!this.initialized || !this.enabled) {
      console.warn(`Cannot play sound ${id}: Sound manager not initialized or disabled`)
      return
    }

    if (usingGeneratedSounds && !this.generatedSoundUrls.has(id)) {
      console.warn(`Cannot play sound ${id}: No generated sound available yet`)
      return
    }

    if (this.playBufferedSound(id)) {
      return
    }

    const instances = this.soundInstances.get(id)
    if (!instances) {
      console.warn(`Cannot play sound ${id}: No instances found`)
      return
    }

    const config = this.sounds.get(id)
    if (!config) {
      console.warn(`Cannot play sound ${id}: No configuration found`)
      return
    }

    console.log(`Attempting to play sound: ${id}`)

    let availableInstance = instances.find((instance) => !instance.playing && instance.loaded)

    if (!availableInstance && config.minDuration) {
      const now = Date.now()
      availableInstance = instances.find(
        (instance) => instance.playStartTime && now - instance.playStartTime > config.minDuration && instance.loaded,
      )
    }

    if (availableInstance) {
      console.log(`Playing sound ${id} with loaded instance`)
      availableInstance.playing = true
      availableInstance.audio.currentTime = 0
      availableInstance.playStartTime = Date.now()

      if (config.playbackRate !== undefined) {
        availableInstance.audio.playbackRate = config.playbackRate
      }

      availableInstance.audio
        .play()
        .then(() => {
          console.log(`Sound ${id} started playing successfully`)
          availableInstance!.audio.onended = () => {
            availableInstance!.playing = false
          }
        })
        .catch((error) => {
          console.error(`Error playing sound ${id}:`, error)
          availableInstance!.playing = false

          if (error.name === "NotSupportedError" || error.name === "NotAllowedError") {
            this.loadErrors[id] = true
          }
        })
    } else {
      const anyInstance = instances.find((instance) => !instance.playing)

      if (anyInstance) {
        console.log(`Playing sound ${id} with non-loaded instance`)
        anyInstance.playing = true
        anyInstance.audio.currentTime = 0
        anyInstance.playStartTime = Date.now()

        if (config.playbackRate !== undefined) {
          anyInstance.audio.playbackRate = config.playbackRate
        }

        anyInstance.audio.play().catch((error) => {
          console.error(`Error playing sound ${id}:`, error)
          anyInstance.playing = false

          if (error.name === "NotSupportedError" || error.name === "NotAllowedError") {
            this.loadErrors[id] = true
          }
        })
      } else if (instances.length > 0) {
        console.log(`All instances of ${id} are playing, reusing the first one`)
        const instance = instances[0]
        instance.audio.currentTime = 0
        instance.playStartTime = Date.now()

        if (config.playbackRate !== undefined) {
          instance.audio.playbackRate = config.playbackRate
        }

        instance.audio.play().catch((error) => {
          console.error(`Error playing sound ${id}:`, error)

          if (error.name === "NotSupportedError" || error.name === "NotAllowedError") {
            this.loadErrors[id] = true
          }
        })
      }
    }
  }

  public stop(id: SoundId): void {
    if (!this.initialized) return

    if (this.audioSources.has(id)) {
      const sources = this.audioSources.get(id)!
      sources.forEach((source) => {
        try {
          source.stop()
        } catch (e) {
          // Ignore errors from already stopped sources
        }
      })
      this.audioSources.set(id, [])
    }

    const instances = this.soundInstances.get(id)
    if (!instances) return

    instances.forEach((instance) => {
      try {
        instance.audio.pause()
        instance.audio.currentTime = 0
        instance.playing = false
      } catch (error) {
        console.error(`Error stopping sound ${id}:`, error)
      }
    })
  }

  public stopAll(): void {
    if (!this.initialized) return

    this.audioSources.forEach((sources) => {
      sources.forEach((source) => {
        try {
          source.stop()
        } catch (e) {
          // Ignore errors from already stopped sources
        }
      })
    })
    this.audioSources.clear()

    this.soundInstances.forEach((instances) => {
      instances.forEach((instance) => {
        try {
          instance.audio.pause()
          instance.audio.currentTime = 0
          instance.playing = false
        } catch (error) {
          console.error(`Error stopping sound ${instance.id}:`, error)
        }
      })
    })
  }

  public isPlaying(id: SoundId): boolean {
    if (!this.initialized) return false

    if (this.audioSources.has(id) && this.audioSources.get(id)!.length > 0) {
      return true
    }

    const instances = this.soundInstances.get(id)
    if (!instances) return false

    return instances.some((instance) => instance.playing)
  }

  private getVolumeForCategory(category: SoundCategory): number {
    switch (category) {
      case "sfx":
        return this.masterVolume * this.sfxVolume
      case "ambient":
        return this.masterVolume
      default:
        return this.masterVolume
    }
  }

  public preloadSound(id: SoundId): Promise<void> {
    if (!this.initialized) {
      return Promise.reject(new Error("Sound manager not initialized"))
    }

    if (usingGeneratedSounds) {
      return Promise.resolve()
    }

    const instances = this.soundInstances.get(id)
    if (!instances || instances.length === 0) {
      return Promise.reject(new Error(`Sound ${id} not found`))
    }

    console.log(`Preloading sound: ${id}`)

    return new Promise((resolve, reject) => {
      const instance = instances[0]

      if (instance.loaded) {
        console.log(`Sound ${id} already loaded`)
        resolve()
        return
      }

      const audio = instance.audio

      const loadHandler = () => {
        console.log(`Sound ${id} preloaded successfully`)
        instance.loaded = true
        audio.removeEventListener("canplaythrough", loadHandler)
        resolve()
      }

      const errorHandler = (e: Event) => {
        console.error(`Failed to preload sound ${id}:`, e)
        audio.removeEventListener("error", errorHandler)
        this.loadErrors[id] = true
        reject(new Error(`Failed to load sound ${id}`))
      }

      audio.addEventListener("canplaythrough", loadHandler)
      audio.addEventListener("error", errorHandler)

      audio.load()
    })
  }

  public testPlaySound(url: string, playbackRate = 1.0): void {
    console.log(`Test playing sound from URL: ${url} with playback rate: ${playbackRate}`)

    if (this.audioContext) {
      fetch(url)
        .then((response) => response.arrayBuffer())
        .then((arrayBuffer) => this.audioContext!.decodeAudioData(arrayBuffer))
        .then((audioBuffer) => {
          const source = this.audioContext!.createBufferSource()
          source.buffer = audioBuffer
          source.playbackRate.value = playbackRate
          source.connect(this.audioContext!.destination)
          source.start(0)
          console.log("Test sound played via Web Audio API")
        })
        .catch((error) => {
          console.error("Error playing test sound via Web Audio API:", error)
          this.fallbackTestPlay(url, playbackRate)
        })
    } else {
      this.fallbackTestPlay(url, playbackRate)
    }
  }

  private fallbackTestPlay(url: string, playbackRate: number): void {
    const audio = new Audio(url)
    audio.volume = this.masterVolume * this.sfxVolume
    audio.playbackRate = playbackRate

    audio.oncanplaythrough = () => {
      console.log(`Test sound loaded, attempting to play`)
      audio
        .play()
        .then(() => console.log(`Test sound started playing`))
        .catch((e) => console.error(`Error playing test sound:`, e))
    }

    audio.onerror = (e) => {
      console.error(`Error loading test sound:`, e)
    }

    audio.load()
  }

  public getAudioDuration(id: SoundId): number {
    if (!this.initialized) return 0

    if (this.audioBuffers.has(id)) {
      return this.audioBuffers.get(id)!.duration
    }

    const instances = this.soundInstances.get(id)
    if (!instances || instances.length === 0) return 0

    const instance = instances[0]
    return instance.audio.duration || 0
  }

  public warmup(): void {
    if (!this.audioContext) {
      this.initAudioContext()
    }

    if (this.audioContext) {
      const buffer = this.audioContext.createBuffer(1, 1, 22050)
      const source = this.audioContext.createBufferSource()
      source.buffer = buffer
      source.connect(this.audioContext.destination)
      source.start(0)
      console.log("Audio context warmed up")
    }
  }
}

// Hook for using sound manager in components
export function useSoundManager() {
  const { settings } = useSettings()
  const soundManager = SoundManager.getInstance()

  // Initialize sound manager
  if (!soundManager.initialized) {
    soundManager.init()
  }

  // Update volume based on settings
  soundManager.setVolume(settings.audio.masterVolume, settings.audio.sfxVolume)

  return soundManager
}

export default SoundManager
