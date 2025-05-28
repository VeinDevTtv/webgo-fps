import * as THREE from 'three'
import { GAME_CONFIG } from '@/lib/config/game-config'
import { SpatialAudioSystem } from './spatial-audio-system'

export interface AmbientZone {
  id: string
  center: THREE.Vector3
  radius: number
  soundId: string
  volume: number
  fadeDistance: number
  timeRestriction?: {
    startHour: number
    endHour: number
  }
}

export interface EnvironmentState {
  playerPosition: THREE.Vector3
  timeOfDay: number // 0-24 hours
  weather: 'clear' | 'rain' | 'storm' | 'fog'
  biome: 'forest' | 'plains' | 'mountains' | 'water'
}

export class AmbientAudioSystem {
  private audioSystem: SpatialAudioSystem
  private ambientZones: Map<string, AmbientZone> = new Map()
  private activeAmbientSounds: Map<string, string> = new Map() // zoneId -> audioId
  private globalAmbientSounds: Map<string, string> = new Map() // soundType -> audioId
  private lastEnvironmentState: EnvironmentState | null = null
  private updateInterval: number | null = null
  
  private onZoneEnter?: (zoneId: string) => void
  private onZoneExit?: (zoneId: string) => void

  constructor(audioSystem: SpatialAudioSystem) {
    this.audioSystem = audioSystem
    this.initializeDefaultZones()
    this.startEnvironmentMonitoring()
  }

  private initializeDefaultZones(): void {
    // Forest ambient zone
    this.addAmbientZone({
      id: 'forest_birds',
      center: new THREE.Vector3(0, 0, 0),
      radius: 30,
      soundId: GAME_CONFIG.AUDIO.AMBIENT.BIRDS,
      volume: 0.4,
      fadeDistance: 10,
      timeRestriction: {
        startHour: 6,
        endHour: 20, // Birds active during day
      },
    })

    // Night crickets
    this.addAmbientZone({
      id: 'night_crickets',
      center: new THREE.Vector3(0, 0, 0),
      radius: 50,
      soundId: GAME_CONFIG.AUDIO.AMBIENT.NIGHT_CRICKETS,
      volume: 0.3,
      fadeDistance: 15,
      timeRestriction: {
        startHour: 20,
        endHour: 6, // Crickets active at night
      },
    })

    // River zone (example)
    this.addAmbientZone({
      id: 'river_sound',
      center: new THREE.Vector3(50, 0, 25),
      radius: 20,
      soundId: GAME_CONFIG.AUDIO.AMBIENT.RIVER,
      volume: 0.6,
      fadeDistance: 8,
    })
  }

  private startEnvironmentMonitoring(): void {
    this.updateInterval = window.setInterval(() => {
      // Environment updates will be triggered externally
    }, 1000) // Check every second
  }

  public updateEnvironment(environmentState: EnvironmentState): void {
    // Check if environment has changed significantly
    if (this.hasEnvironmentChanged(environmentState)) {
      this.updateAmbientSounds(environmentState)
      this.updateGlobalAmbient(environmentState)
      this.lastEnvironmentState = { ...environmentState }
    }
  }

  private hasEnvironmentChanged(newState: EnvironmentState): boolean {
    if (!this.lastEnvironmentState) return true

    const positionChanged = this.lastEnvironmentState.playerPosition.distanceTo(newState.playerPosition) > 5
    const timeChanged = Math.abs(this.lastEnvironmentState.timeOfDay - newState.timeOfDay) > 0.5
    const weatherChanged = this.lastEnvironmentState.weather !== newState.weather
    const biomeChanged = this.lastEnvironmentState.biome !== newState.biome

    return positionChanged || timeChanged || weatherChanged || biomeChanged
  }

  private updateAmbientSounds(environmentState: EnvironmentState): void {
    for (const [zoneId, zone] of this.ambientZones) {
      const distance = environmentState.playerPosition.distanceTo(zone.center)
      const isInRange = distance <= zone.radius
      const isTimeAppropriate = this.isTimeAppropriate(zone, environmentState.timeOfDay)
      const shouldPlay = isInRange && isTimeAppropriate

      const currentAudioId = this.activeAmbientSounds.get(zoneId)

      if (shouldPlay && !currentAudioId) {
        // Start playing ambient sound
        this.startAmbientSound(zone, environmentState)
      } else if (!shouldPlay && currentAudioId) {
        // Stop playing ambient sound
        this.stopAmbientSound(zoneId)
      } else if (shouldPlay && currentAudioId) {
        // Update volume based on distance
        this.updateAmbientVolume(zone, distance)
      }
    }
  }

  private async startAmbientSound(zone: AmbientZone, environmentState: EnvironmentState): Promise<void> {
    try {
      const audioId = await this.audioSystem.playSound(zone.soundId, 'AMBIENT', {
        position: zone.center,
        volume: this.calculateZoneVolume(zone, environmentState.playerPosition.distanceTo(zone.center)),
        loop: true,
      })

      if (audioId) {
        this.activeAmbientSounds.set(zone.id, audioId)
        this.onZoneEnter?.(zone.id)
      }
    } catch (error) {
      console.error(`Failed to start ambient sound for zone ${zone.id}:`, error)
    }
  }

  private stopAmbientSound(zoneId: string): void {
    const audioId = this.activeAmbientSounds.get(zoneId)
    if (audioId) {
      this.audioSystem.stopSound(audioId)
      this.activeAmbientSounds.delete(zoneId)
      this.onZoneExit?.(zoneId)
    }
  }

  private updateAmbientVolume(zone: AmbientZone, distance: number): void {
    const audioId = this.activeAmbientSounds.get(zone.id)
    if (audioId) {
      const volume = this.calculateZoneVolume(zone, distance)
      // Would need volume update method in audio system
      // this.audioSystem.updateVolume(audioId, volume)
    }
  }

  private calculateZoneVolume(zone: AmbientZone, distance: number): number {
    if (distance >= zone.radius) return 0

    const fadeStart = Math.max(0, zone.radius - zone.fadeDistance)
    
    if (distance <= fadeStart) {
      return zone.volume
    } else {
      // Linear fade from fadeStart to radius
      const fadeProgress = (distance - fadeStart) / zone.fadeDistance
      return zone.volume * (1 - fadeProgress)
    }
  }

  private isTimeAppropriate(zone: AmbientZone, timeOfDay: number): boolean {
    if (!zone.timeRestriction) return true

    const { startHour, endHour } = zone.timeRestriction

    if (startHour <= endHour) {
      // Normal time range (e.g., 6 to 20)
      return timeOfDay >= startHour && timeOfDay <= endHour
    } else {
      // Time range spans midnight (e.g., 20 to 6)
      return timeOfDay >= startHour || timeOfDay <= endHour
    }
  }

  private updateGlobalAmbient(environmentState: EnvironmentState): void {
    // Update global ambient sounds based on weather and biome
    this.updateWindAmbient(environmentState)
    this.updateWeatherAmbient(environmentState)
  }

  private async updateWindAmbient(environmentState: EnvironmentState): Promise<void> {
    const windSoundId = 'global_wind'
    const currentWindAudio = this.globalAmbientSounds.get(windSoundId)

    // Determine if wind should be playing
    const shouldPlayWind = environmentState.biome !== 'water' && environmentState.weather !== 'storm'
    
    if (shouldPlayWind && !currentWindAudio) {
      try {
        const audioId = await this.audioSystem.playSound(GAME_CONFIG.AUDIO.AMBIENT.WIND, 'AMBIENT', {
          volume: this.getWindVolume(environmentState),
          loop: true,
        })

        if (audioId) {
          this.globalAmbientSounds.set(windSoundId, audioId)
        }
      } catch (error) {
        console.error('Failed to start wind ambient:', error)
      }
    } else if (!shouldPlayWind && currentWindAudio) {
      this.audioSystem.stopSound(currentWindAudio)
      this.globalAmbientSounds.delete(windSoundId)
    }
  }

  private getWindVolume(environmentState: EnvironmentState): number {
    switch (environmentState.weather) {
      case 'storm':
        return 0.8
      case 'rain':
        return 0.4
      case 'fog':
        return 0.2
      default:
        return 0.3
    }
  }

  private async updateWeatherAmbient(environmentState: EnvironmentState): Promise<void> {
    // This would handle rain, storm sounds, etc.
    // For now, we'll keep it simple
    const weatherSoundId = 'global_weather'
    const currentWeatherAudio = this.globalAmbientSounds.get(weatherSoundId)

    if (environmentState.weather === 'rain' && !currentWeatherAudio) {
      // Would need rain sound in config
      // const audioId = await this.audioSystem.playSound('rain_sound', 'AMBIENT', { volume: 0.5, loop: true })
    } else if (environmentState.weather !== 'rain' && currentWeatherAudio) {
      this.audioSystem.stopSound(currentWeatherAudio)
      this.globalAmbientSounds.delete(weatherSoundId)
    }
  }

  // Public API methods
  public addAmbientZone(zone: AmbientZone): void {
    this.ambientZones.set(zone.id, zone)
  }

  public removeAmbientZone(zoneId: string): void {
    this.stopAmbientSound(zoneId)
    this.ambientZones.delete(zoneId)
  }

  public updateAmbientZone(zoneId: string, updates: Partial<AmbientZone>): void {
    const zone = this.ambientZones.get(zoneId)
    if (zone) {
      Object.assign(zone, updates)
    }
  }

  public getActiveZones(): string[] {
    return Array.from(this.activeAmbientSounds.keys())
  }

  public isZoneActive(zoneId: string): boolean {
    return this.activeAmbientSounds.has(zoneId)
  }

  public setZoneVolume(zoneId: string, volume: number): void {
    const zone = this.ambientZones.get(zoneId)
    if (zone) {
      zone.volume = Math.max(0, Math.min(1, volume))
      
      // Update current playing sound if active
      const audioId = this.activeAmbientSounds.get(zoneId)
      if (audioId && this.lastEnvironmentState) {
        const distance = this.lastEnvironmentState.playerPosition.distanceTo(zone.center)
        this.updateAmbientVolume(zone, distance)
      }
    }
  }

  public stopAllAmbient(): void {
    // Stop all zone ambient sounds
    for (const [zoneId] of this.activeAmbientSounds) {
      this.stopAmbientSound(zoneId)
    }

    // Stop all global ambient sounds
    for (const [soundType, audioId] of this.globalAmbientSounds) {
      this.audioSystem.stopSound(audioId)
    }
    this.globalAmbientSounds.clear()
  }

  public pauseAllAmbient(): void {
    // Similar to stop, but could be enhanced to remember state for resuming
    this.stopAllAmbient()
  }

  public resumeAllAmbient(): void {
    if (this.lastEnvironmentState) {
      this.updateEnvironment(this.lastEnvironmentState)
    }
  }

  // Event listeners
  public onZoneEnterEvent(callback: (zoneId: string) => void): void {
    this.onZoneEnter = callback
  }

  public onZoneExitEvent(callback: (zoneId: string) => void): void {
    this.onZoneExit = callback
  }

  public dispose(): void {
    // Stop all ambient sounds
    this.stopAllAmbient()

    // Clear intervals
    if (this.updateInterval) {
      clearInterval(this.updateInterval)
      this.updateInterval = null
    }

    // Clear data
    this.ambientZones.clear()
    this.activeAmbientSounds.clear()
    this.globalAmbientSounds.clear()
    this.lastEnvironmentState = null
  }
} 