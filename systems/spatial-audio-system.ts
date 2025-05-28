import * as THREE from 'three'
import { GAME_CONFIG } from '@/lib/config/game-config'

export interface AudioSource {
  id: string
  audio: THREE.PositionalAudio | THREE.Audio
  buffer: AudioBuffer | null
  category: AudioCategory
  isLooping: boolean
  volume: number
  isPlaying: boolean
  position?: THREE.Vector3
  lastPlayTime: number
}

export interface AudioPool {
  [key: string]: {
    instances: AudioSource[]
    buffer: AudioBuffer | null
    maxInstances: number
  }
}

export type AudioCategory = 'SFX' | 'MUSIC' | 'UI' | 'AMBIENT'

export interface VolumeSettings {
  master: number
  sfx: number
  music: number
  ui: number
  ambient: number
}

export class SpatialAudioSystem {
  private listener: THREE.AudioListener
  private audioLoader: THREE.AudioLoader
  private audioContext: AudioContext | null = null
  private audioPool: AudioPool = {}
  private activeAudio: Map<string, AudioSource> = new Map()
  private volumeSettings: VolumeSettings
  private isInitialized = false
  private cleanupInterval: number | null = null
  
  // Event callbacks
  private onVolumeChange?: (category: AudioCategory, volume: number) => void
  private onAudioLoad?: (soundId: string, success: boolean) => void
  private onAudioError?: (error: string) => void

  constructor(camera: THREE.Camera) {
    this.listener = new THREE.AudioListener()
    this.audioLoader = new THREE.AudioLoader()
    
    // Add listener to camera
    camera.add(this.listener)
    
    // Load volume settings from localStorage
    this.volumeSettings = this.loadVolumeSettings()
    
    this.initializeAudioContext()
    this.startCleanupInterval()
  }

  private async initializeAudioContext(): Promise<void> {
    try {
      // Check for Web Audio API support
      if (!window.AudioContext && !(window as any).webkitAudioContext) {
        throw new Error('Web Audio API not supported')
      }

      this.audioContext = new (window.AudioContext || (window as any).webkitAudioContext)()
      
      // Handle audio context state
      if (this.audioContext.state === 'suspended') {
        // Wait for user interaction to resume audio context
        document.addEventListener('click', this.resumeAudioContext.bind(this), { once: true })
        document.addEventListener('keydown', this.resumeAudioContext.bind(this), { once: true })
      }

      this.isInitialized = true
      console.log('Spatial audio system initialized')
      
      // Preload priority sounds
      this.preloadPrioritySounds()
      
    } catch (error) {
      console.error('Failed to initialize audio context:', error)
      this.onAudioError?.('Failed to initialize audio system')
    }
  }

  private async resumeAudioContext(): Promise<void> {
    if (this.audioContext && this.audioContext.state === 'suspended') {
      try {
        await this.audioContext.resume()
        console.log('Audio context resumed')
      } catch (error) {
        console.error('Failed to resume audio context:', error)
      }
    }
  }

  private preloadPrioritySounds(): void {
    const priorityCategories = GAME_CONFIG.AUDIO.POOL.PRELOAD_PRIORITY
    
    priorityCategories.forEach(category => {
      if (category === 'WEAPONS') {
        Object.values(GAME_CONFIG.AUDIO.SFX.WEAPONS).forEach(path => {
          if (typeof path === 'string') {
            this.preloadSound(path, 'SFX')
          }
        })
      } else if (category === 'UI') {
        Object.values(GAME_CONFIG.AUDIO.SFX.UI).forEach(path => {
          this.preloadSound(path, 'UI')
        })
      } else if (category === 'FOOTSTEPS') {
        Object.values(GAME_CONFIG.AUDIO.SFX.FOOTSTEPS).forEach(paths => {
          if (Array.isArray(paths)) {
            paths.forEach(path => this.preloadSound(path, 'SFX'))
          }
        })
      }
    })
  }

  private async preloadSound(path: string, category: AudioCategory): Promise<void> {
    try {
      const buffer = await this.loadAudioBuffer(path)
      this.initializeAudioPool(path, buffer, category)
      this.onAudioLoad?.(path, true)
    } catch (error) {
      console.error(`Failed to preload sound: ${path}`, error)
      this.onAudioLoad?.(path, false)
    }
  }

  private loadAudioBuffer(path: string): Promise<AudioBuffer> {
    return new Promise((resolve, reject) => {
      this.audioLoader.load(
        path,
        (buffer) => resolve(buffer),
        undefined,
        (error) => reject(error)
      )
    })
  }

  private initializeAudioPool(soundId: string, buffer: AudioBuffer, category: AudioCategory): void {
    if (!this.audioPool[soundId]) {
      this.audioPool[soundId] = {
        instances: [],
        buffer,
        maxInstances: GAME_CONFIG.AUDIO.POOL.MAX_INSTANCES,
      }
    }
  }

  private getPooledAudio(soundId: string, category: AudioCategory, isPositional: boolean = false): AudioSource | null {
    const pool = this.audioPool[soundId]
    if (!pool || !pool.buffer) return null

    // Find available instance
    let audioSource = pool.instances.find(instance => !instance.isPlaying) || null
    
    if (!audioSource && pool.instances.length < pool.maxInstances) {
      // Create new instance
      const audio = isPositional 
        ? new THREE.PositionalAudio(this.listener)
        : new THREE.Audio(this.listener)
      
      audio.setBuffer(pool.buffer)
      
      // Configure positional audio
      if (isPositional && audio instanceof THREE.PositionalAudio) {
        audio.setRefDistance(GAME_CONFIG.AUDIO.SPATIAL.REF_DISTANCE)
        audio.setMaxDistance(GAME_CONFIG.AUDIO.SPATIAL.MAX_DISTANCE)
        audio.setRolloffFactor(GAME_CONFIG.AUDIO.SPATIAL.ROLLOFF_FACTOR)
        audio.setDirectionalCone(
          GAME_CONFIG.AUDIO.SPATIAL.CONE_INNER_ANGLE,
          GAME_CONFIG.AUDIO.SPATIAL.CONE_OUTER_ANGLE,
          GAME_CONFIG.AUDIO.SPATIAL.CONE_OUTER_GAIN
        )
      }

      audioSource = {
        id: `${soundId}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        audio,
        buffer: pool.buffer,
        category,
        isLooping: false,
        volume: 1.0,
        isPlaying: false,
        lastPlayTime: 0,
      }

      pool.instances.push(audioSource)
    }

    return audioSource
  }

  public async playSound(
    soundId: string,
    category: AudioCategory,
    options: {
      position?: THREE.Vector3
      volume?: number
      loop?: boolean
      pitch?: number
    } = {}
  ): Promise<string | null> {
    if (!this.isInitialized) {
      console.warn('Audio system not initialized')
      return null
    }

    try {
      // Load sound if not in pool
      if (!this.audioPool[soundId]) {
        const buffer = await this.loadAudioBuffer(soundId)
        this.initializeAudioPool(soundId, buffer, category)
      }

      const isPositional = !!options.position
      const audioSource = this.getPooledAudio(soundId, category, isPositional)
      
      if (!audioSource) {
        console.warn(`No available audio instance for: ${soundId}`)
        return null
      }

      // Configure audio
      const finalVolume = this.calculateFinalVolume(category, options.volume || 1.0)
      audioSource.audio.setVolume(finalVolume)
      audioSource.volume = options.volume || 1.0
      audioSource.isLooping = options.loop || false
      audioSource.audio.setLoop(audioSource.isLooping)

      // Set position for spatial audio
      if (options.position && audioSource.audio instanceof THREE.PositionalAudio) {
        audioSource.position = options.position.clone()
        // Position will be set by the object that owns this audio
      }

      // Set pitch/playback rate
      if (options.pitch && audioSource.audio.source && 'playbackRate' in audioSource.audio.source) {
        (audioSource.audio.source as any).playbackRate.setValueAtTime(
          options.pitch,
          this.audioContext!.currentTime
        )
      }

      // Play audio
      audioSource.audio.play()
      audioSource.isPlaying = true
      audioSource.lastPlayTime = Date.now()

      // Track active audio
      this.activeAudio.set(audioSource.id, audioSource)

      // Set up end callback for non-looping sounds
      if (!audioSource.isLooping) {
        audioSource.audio.onEnded = () => {
          this.stopSound(audioSource.id)
        }
      }

      return audioSource.id

    } catch (error) {
      console.error(`Failed to play sound: ${soundId}`, error)
      this.onAudioError?.(`Failed to play sound: ${soundId}`)
      return null
    }
  }

  public stopSound(audioId: string): void {
    const audioSource = this.activeAudio.get(audioId)
    if (audioSource) {
      audioSource.audio.stop()
      audioSource.isPlaying = false
      this.activeAudio.delete(audioId)
    }
  }

  public stopAllSounds(category?: AudioCategory): void {
    for (const [id, audioSource] of this.activeAudio) {
      if (!category || audioSource.category === category) {
        this.stopSound(id)
      }
    }
  }

  public updateAudioPosition(audioId: string, position: THREE.Vector3): void {
    const audioSource = this.activeAudio.get(audioId)
    if (audioSource && audioSource.audio instanceof THREE.PositionalAudio) {
      audioSource.position = position.clone()
      // The audio position will be updated by the parent object
    }
  }

  public setVolume(category: AudioCategory, volume: number): void {
    volume = Math.max(0, Math.min(1, volume))
    this.volumeSettings[category.toLowerCase() as keyof VolumeSettings] = volume
    
    // Save to localStorage
    const key = GAME_CONFIG.AUDIO.CATEGORIES[category].key
    localStorage.setItem(key, volume.toString())
    
    // Update all active audio of this category
    for (const audioSource of this.activeAudio.values()) {
      if (audioSource.category === category) {
        const finalVolume = this.calculateFinalVolume(category, audioSource.volume)
        audioSource.audio.setVolume(finalVolume)
      }
    }

    this.onVolumeChange?.(category, volume)
  }

  public getVolume(category: AudioCategory): number {
    return this.volumeSettings[category.toLowerCase() as keyof VolumeSettings]
  }

  private calculateFinalVolume(category: AudioCategory, baseVolume: number): number {
    const categoryVolume = this.getVolume(category)
    const masterVolume = this.getVolume('MASTER' as AudioCategory)
    return baseVolume * categoryVolume * masterVolume
  }

  private loadVolumeSettings(): VolumeSettings {
    const settings: VolumeSettings = {
      master: GAME_CONFIG.AUDIO.CATEGORIES.MASTER.default,
      sfx: GAME_CONFIG.AUDIO.CATEGORIES.SFX.default,
      music: GAME_CONFIG.AUDIO.CATEGORIES.MUSIC.default,
      ui: GAME_CONFIG.AUDIO.CATEGORIES.UI.default,
      ambient: GAME_CONFIG.AUDIO.CATEGORIES.AMBIENT.default,
    }

    // Load from localStorage
    Object.entries(GAME_CONFIG.AUDIO.CATEGORIES).forEach(([category, config]) => {
      const saved = localStorage.getItem(config.key)
      if (saved !== null) {
        const volume = parseFloat(saved)
        if (!isNaN(volume)) {
          settings[category.toLowerCase() as keyof VolumeSettings] = Math.max(0, Math.min(1, volume))
        }
      }
    })

    return settings
  }

  private startCleanupInterval(): void {
    this.cleanupInterval = window.setInterval(() => {
      this.cleanupInactiveAudio()
    }, GAME_CONFIG.AUDIO.POOL.CLEANUP_INTERVAL)
  }

  private cleanupInactiveAudio(): void {
    const now = Date.now()
    const maxAge = GAME_CONFIG.AUDIO.POOL.CLEANUP_INTERVAL * 2

    for (const [id, audioSource] of this.activeAudio) {
      if (!audioSource.isPlaying && (now - audioSource.lastPlayTime) > maxAge) {
        this.activeAudio.delete(id)
      }
    }
  }

  // Convenience methods for common sounds
  public playFootstep(position: THREE.Vector3, surfaceType: 'GRASS' | 'STONE' | 'WOOD' | 'WATER'): Promise<string | null> {
    const sounds = GAME_CONFIG.AUDIO.SFX.FOOTSTEPS[surfaceType]
    const randomSound = sounds[Math.floor(Math.random() * sounds.length)]
    
    return this.playSound(randomSound, 'SFX', {
      position,
      volume: 0.8,
      pitch: 0.9 + Math.random() * 0.2, // Slight pitch variation
    })
  }

  public playWeaponSound(weaponType: 'RIFLE' | 'SHOTGUN' | 'PISTOL', action: 'FIRE' | 'RELOAD' | 'SWITCH' | 'EMPTY_CLICK', position?: THREE.Vector3): Promise<string | null> {
    let soundPath: string
    
    if (action === 'FIRE') {
      soundPath = GAME_CONFIG.AUDIO.SFX.WEAPONS[`${weaponType}_FIRE`]
    } else {
      soundPath = GAME_CONFIG.AUDIO.SFX.WEAPONS[action]
    }

    return this.playSound(soundPath, 'SFX', {
      position,
      volume: action === 'FIRE' ? 1.0 : 0.7,
    })
  }

  public playToolSound(toolType: 'HATCHET' | 'PICKAXE' | 'SHOVEL', position: THREE.Vector3): Promise<string | null> {
    let soundPath: string
    
    if (toolType === 'SHOVEL') {
      soundPath = GAME_CONFIG.AUDIO.SFX.TOOLS.SHOVEL_DIG
    } else {
      soundPath = GAME_CONFIG.AUDIO.SFX.TOOLS[`${toolType}_HIT`]
    }
    
    return this.playSound(soundPath, 'SFX', {
      position,
      volume: 0.8,
      pitch: 0.8 + Math.random() * 0.4, // More pitch variation for tools
    })
  }

  public playUISound(type: 'CLICK' | 'HOVER' | 'EQUIP' | 'ALERT' | 'INVENTORY_MOVE' | 'NOTIFICATION'): Promise<string | null> {
    const soundPath = GAME_CONFIG.AUDIO.SFX.UI[type]
    
    return this.playSound(soundPath, 'UI', {
      volume: type === 'HOVER' ? 0.3 : 0.6,
    })
  }

  public playBuildingSound(action: 'PLACE' | 'REMOVE' | 'INVALID', position?: THREE.Vector3): Promise<string | null> {
    const soundPath = GAME_CONFIG.AUDIO.SFX.BUILDING[action]
    
    return this.playSound(soundPath, 'SFX', {
      position,
      volume: 0.7,
    })
  }

  // Event listeners
  public onVolumeChangeEvent(callback: (category: AudioCategory, volume: number) => void): void {
    this.onVolumeChange = callback
  }

  public onAudioLoadEvent(callback: (soundId: string, success: boolean) => void): void {
    this.onAudioLoad = callback
  }

  public onAudioErrorEvent(callback: (error: string) => void): void {
    this.onAudioError = callback
  }

  public dispose(): void {
    // Stop all audio
    this.stopAllSounds()
    
    // Clear pools
    for (const pool of Object.values(this.audioPool)) {
      pool.instances.forEach(instance => {
        if (instance.audio.source) {
          instance.audio.disconnect()
        }
      })
    }
    
    // Clear intervals
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval)
      this.cleanupInterval = null
    }
    
    // Close audio context
    if (this.audioContext && this.audioContext.state !== 'closed') {
      this.audioContext.close()
    }
    
    this.audioPool = {}
    this.activeAudio.clear()
    this.isInitialized = false
  }
} 