import * as THREE from 'three'
import { GAME_CONFIG } from '@/lib/config/game-config'
import { SpatialAudioSystem } from './spatial-audio-system'

export type MusicState = 'exploration' | 'combat' | 'night' | 'menu' | 'none'

export interface MusicTrack {
  id: string
  path: string
  state: MusicState
  volume: number
  fadeInDuration: number
  fadeOutDuration: number
  loop: boolean
}

export interface GameContext {
  playerPosition: THREE.Vector3
  isInCombat: boolean
  nearbyEnemies: THREE.Vector3[]
  timeOfDay: number // 0-24 hours
  isInMenu: boolean
  playerHealth: number
}

export class DynamicMusicSystem {
  private audioSystem: SpatialAudioSystem
  private currentTrack: string | null = null
  private currentState: MusicState = 'none'
  private tracks: Map<string, MusicTrack> = new Map()
  private musicEnabled = true
  private fadeTimeout: number | null = null
  private stateCheckInterval: number | null = null
  private lastStateChange = 0
  
  // State transition settings
  private readonly STATE_CHANGE_COOLDOWN = 5000 // 5 seconds minimum between state changes
  private readonly COMBAT_FADE_DELAY = 2000 // 2 seconds delay before fading out of combat music
  
  private onStateChange?: (oldState: MusicState, newState: MusicState) => void
  private onTrackChange?: (oldTrack: string | null, newTrack: string | null) => void

  constructor(audioSystem: SpatialAudioSystem) {
    this.audioSystem = audioSystem
    this.initializeTracks()
    this.loadSettings()
    this.startStateMonitoring()
  }

  private initializeTracks(): void {
    // Exploration tracks
    GAME_CONFIG.AUDIO.MUSIC.EXPLORATION_TRACKS.forEach((path, index) => {
      this.tracks.set(`exploration_${index}`, {
        id: `exploration_${index}`,
        path,
        state: 'exploration',
        volume: 0.7,
        fadeInDuration: GAME_CONFIG.AUDIO.MUSIC.FADE_DURATION,
        fadeOutDuration: GAME_CONFIG.AUDIO.MUSIC.FADE_DURATION,
        loop: true,
      })
    })

    // Combat tracks
    GAME_CONFIG.AUDIO.MUSIC.COMBAT_TRACKS.forEach((path, index) => {
      this.tracks.set(`combat_${index}`, {
        id: `combat_${index}`,
        path,
        state: 'combat',
        volume: 0.8,
        fadeInDuration: 1000, // Faster fade in for combat
        fadeOutDuration: GAME_CONFIG.AUDIO.MUSIC.FADE_DURATION,
        loop: true,
      })
    })

    // Night tracks
    GAME_CONFIG.AUDIO.MUSIC.NIGHT_TRACKS.forEach((path, index) => {
      this.tracks.set(`night_${index}`, {
        id: `night_${index}`,
        path,
        state: 'night',
        volume: 0.5,
        fadeInDuration: GAME_CONFIG.AUDIO.MUSIC.FADE_DURATION * 1.5, // Slower fade for night
        fadeOutDuration: GAME_CONFIG.AUDIO.MUSIC.FADE_DURATION,
        loop: true,
      })
    })
  }

  private loadSettings(): void {
    const enabled = localStorage.getItem('music_enabled')
    this.musicEnabled = enabled !== 'false' // Default to true
  }

  private saveSettings(): void {
    localStorage.setItem('music_enabled', this.musicEnabled.toString())
  }

  private startStateMonitoring(): void {
    // Check state every 2 seconds
    this.stateCheckInterval = window.setInterval(() => {
      // State checking will be triggered externally via updateGameContext
    }, 2000)
  }

  public updateGameContext(context: GameContext): void {
    if (!this.musicEnabled) return

    const newState = this.determineOptimalState(context)
    
    if (newState !== this.currentState) {
      const now = Date.now()
      
      // Prevent rapid state changes
      if (now - this.lastStateChange > this.STATE_CHANGE_COOLDOWN) {
        this.transitionToState(newState, context)
        this.lastStateChange = now
      }
    }
  }

  private determineOptimalState(context: GameContext): MusicState {
    // Priority order: menu > combat > night > exploration

    if (context.isInMenu) {
      return 'menu'
    }

    // Check for combat
    if (context.isInCombat || this.hasNearbyEnemies(context)) {
      return 'combat'
    }

    // Check for night time
    if (this.isNightTime(context.timeOfDay)) {
      return 'night'
    }

    // Default to exploration
    return 'exploration'
  }

  private hasNearbyEnemies(context: GameContext): boolean {
    const detectionRadius = GAME_CONFIG.AUDIO.MUSIC.COMBAT_DETECTION_RADIUS
    
    return context.nearbyEnemies.some(enemyPos => 
      context.playerPosition.distanceTo(enemyPos) <= detectionRadius
    )
  }

  private isNightTime(timeOfDay: number): boolean {
    const nightStart = GAME_CONFIG.AUDIO.MUSIC.NIGHT_START_HOUR
    const nightEnd = GAME_CONFIG.AUDIO.MUSIC.NIGHT_END_HOUR
    
    if (nightStart > nightEnd) {
      // Night spans midnight (e.g., 20:00 to 6:00)
      return timeOfDay >= nightStart || timeOfDay <= nightEnd
    } else {
      // Night doesn't span midnight
      return timeOfDay >= nightStart && timeOfDay <= nightEnd
    }
  }

  private async transitionToState(newState: MusicState, context: GameContext): Promise<void> {
    const oldState = this.currentState
    this.currentState = newState

    // Notify listeners
    this.onStateChange?.(oldState, newState)

    if (newState === 'none' || newState === 'menu') {
      await this.fadeOutCurrentTrack()
      return
    }

    // Select appropriate track for the new state
    const newTrack = this.selectTrackForState(newState, context)
    
    if (newTrack && newTrack.id !== this.currentTrack) {
      await this.crossfadeToTrack(newTrack)
    }
  }

  private selectTrackForState(state: MusicState, context: GameContext): MusicTrack | null {
    const stateTracks = Array.from(this.tracks.values()).filter(track => track.state === state)
    
    if (stateTracks.length === 0) return null

    // For now, select randomly. Could be enhanced with more sophisticated selection logic
    const randomIndex = Math.floor(Math.random() * stateTracks.length)
    return stateTracks[randomIndex]
  }

  private async crossfadeToTrack(newTrack: MusicTrack): Promise<void> {
    const oldTrackId = this.currentTrack

    // Start fading out current track
    if (oldTrackId) {
      this.fadeOutTrack(oldTrackId, newTrack.fadeOutDuration)
    }

    // Start new track
    try {
      const audioId = await this.audioSystem.playSound(newTrack.path, 'MUSIC', {
        volume: 0, // Start at 0 for fade in
        loop: newTrack.loop,
      })

      if (audioId) {
        this.currentTrack = audioId
        this.fadeInTrack(audioId, newTrack.volume, newTrack.fadeInDuration)
        this.onTrackChange?.(oldTrackId, audioId)
      }

    } catch (error) {
      console.error('Failed to start new music track:', error)
    }
  }

  private fadeInTrack(audioId: string, targetVolume: number, duration: number): void {
    const steps = 20
    const stepDuration = duration / steps
    const volumeStep = targetVolume / steps
    let currentStep = 0

    const fadeInterval = setInterval(() => {
      currentStep++
      const volume = volumeStep * currentStep

      // Update volume through audio system
      this.updateTrackVolume(audioId, volume)

      if (currentStep >= steps) {
        clearInterval(fadeInterval)
      }
    }, stepDuration)
  }

  private fadeOutTrack(audioId: string, duration: number): void {
    const steps = 20
    const stepDuration = duration / steps
    let currentStep = 0

    const fadeInterval = setInterval(() => {
      currentStep++
      const volume = 1 - (currentStep / steps)

      this.updateTrackVolume(audioId, Math.max(0, volume))

      if (currentStep >= steps) {
        clearInterval(fadeInterval)
        this.audioSystem.stopSound(audioId)
        
        if (this.currentTrack === audioId) {
          this.currentTrack = null
        }
      }
    }, stepDuration)
  }

  private async fadeOutCurrentTrack(): Promise<void> {
    if (this.currentTrack) {
      this.fadeOutTrack(this.currentTrack, GAME_CONFIG.AUDIO.MUSIC.FADE_DURATION)
    }
  }

  private updateTrackVolume(audioId: string, volume: number): void {
    // This would need to be implemented in the audio system
    // For now, we'll use a simplified approach
    try {
      const finalVolume = volume * this.audioSystem.getVolume('MUSIC')
      // The audio system would need a method to update individual track volumes
    } catch (error) {
      console.warn('Failed to update track volume:', error)
    }
  }

  // Public API methods
  public setEnabled(enabled: boolean): void {
    this.musicEnabled = enabled
    this.saveSettings()

    if (!enabled) {
      this.fadeOutCurrentTrack()
      this.currentState = 'none'
    }
  }

  public isEnabled(): boolean {
    return this.musicEnabled
  }

  public getCurrentState(): MusicState {
    return this.currentState
  }

  public getCurrentTrack(): string | null {
    return this.currentTrack
  }

  public forceState(state: MusicState, context: GameContext): void {
    this.transitionToState(state, context)
  }

  public stopMusic(): void {
    this.fadeOutCurrentTrack()
    this.currentState = 'none'
  }

  public pauseMusic(): void {
    if (this.currentTrack) {
      // Would need pause functionality in audio system
      this.audioSystem.stopSound(this.currentTrack)
    }
  }

  public resumeMusic(context: GameContext): void {
    if (this.musicEnabled) {
      const state = this.determineOptimalState(context)
      this.transitionToState(state, context)
    }
  }

  // Event listeners
  public onStateChangeEvent(callback: (oldState: MusicState, newState: MusicState) => void): void {
    this.onStateChange = callback
  }

  public onTrackChangeEvent(callback: (oldTrack: string | null, newTrack: string | null) => void): void {
    this.onTrackChange = callback
  }

  public dispose(): void {
    // Stop current music
    this.stopMusic()

    // Clear intervals
    if (this.stateCheckInterval) {
      clearInterval(this.stateCheckInterval)
      this.stateCheckInterval = null
    }

    if (this.fadeTimeout) {
      clearTimeout(this.fadeTimeout)
      this.fadeTimeout = null
    }

    // Clear tracks
    this.tracks.clear()
    this.currentTrack = null
    this.currentState = 'none'
  }
} 