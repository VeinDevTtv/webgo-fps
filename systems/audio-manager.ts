import * as THREE from 'three'
import { SpatialAudioSystem, type AudioCategory } from './spatial-audio-system'
import { DynamicMusicSystem, type MusicState, type GameContext } from './dynamic-music-system'
import { AmbientAudioSystem, type EnvironmentState } from './ambient-audio-system'
import { MultiplayerManager } from './multiplayer-manager'
import { GAME_CONFIG } from '@/lib/config/game-config'

export interface AudioManagerConfig {
  camera: THREE.Camera
  multiplayerManager?: MultiplayerManager
}

export interface PlayerAudioState {
  position: THREE.Vector3
  isMoving: boolean
  currentTool?: string
  currentWeapon?: string
  surfaceType: 'GRASS' | 'STONE' | 'WOOD' | 'WATER'
}

export class AudioManager {
  private spatialAudio: SpatialAudioSystem
  private musicSystem: DynamicMusicSystem
  private ambientSystem: AmbientAudioSystem
  private multiplayerManager?: MultiplayerManager
  
  private lastFootstepTime = 0
  private systemsReady = false
  private playerAudioStates: Map<string, PlayerAudioState> = new Map()
  
  // Event callbacks
  private onSystemReady?: () => void
  private onError?: (error: string) => void

  constructor(config: AudioManagerConfig) {
    this.spatialAudio = new SpatialAudioSystem(config.camera)
    this.musicSystem = new DynamicMusicSystem(this.spatialAudio)
    this.ambientSystem = new AmbientAudioSystem(this.spatialAudio)
    this.multiplayerManager = config.multiplayerManager
    
    this.initializeAudioSystems()
    this.setupMultiplayerIntegration()
  }

  private async initializeAudioSystems(): Promise<void> {
    try {
      // Set up event listeners between systems
      this.spatialAudio.onAudioErrorEvent((error) => {
        console.error('Spatial audio error:', error)
        this.onError?.(error)
      })

      this.spatialAudio.onAudioLoadEvent((soundId, success) => {
        if (!success) {
          console.warn(`Failed to load audio: ${soundId}`)
        }
      })

      this.musicSystem.onStateChangeEvent((oldState, newState) => {
        console.log(`Music state changed: ${oldState} -> ${newState}`)
      })

      this.ambientSystem.onZoneEnterEvent((zoneId) => {
        console.log(`Entered ambient zone: ${zoneId}`)
      })

      this.ambientSystem.onZoneExitEvent((zoneId) => {
        console.log(`Exited ambient zone: ${zoneId}`)
      })

      this.systemsReady = true
      this.onSystemReady?.()
      
    } catch (error) {
      console.error('Failed to initialize audio systems:', error)
      this.onError?.('Failed to initialize audio systems')
    }
  }

  private setupMultiplayerIntegration(): void {
    if (!this.multiplayerManager) return

    // Listen for other players' audio events
    this.multiplayerManager.onPlayerUpdateEvent((player) => {
      this.updatePlayerAudioState(player.id, {
        position: new THREE.Vector3(player.position.x, player.position.y, player.position.z),
        isMoving: false, // Would need velocity data
        surfaceType: 'GRASS', // Would need surface detection
      })
    })

    // Listen for weapon fire events
    this.multiplayerManager.onPlayerShootEvent((playerId, data) => {
      const position = new THREE.Vector3(data.position.x, data.position.y, data.position.z)
      this.playRemoteWeaponSound(data.weaponType as any, 'FIRE', position)
    })

    // Listen for tool use events
    this.multiplayerManager.onPlayerToolUseEvent((playerId, data) => {
      const position = new THREE.Vector3(data.targetPosition.x, data.targetPosition.y, data.targetPosition.z)
      this.playRemoteToolSound(data.toolType as any, position)
    })
  }

  // Player audio methods
  public updatePlayerState(playerState: PlayerAudioState): void {
    if (!this.systemsReady) return

    // Update footsteps
    if (playerState.isMoving) {
      this.handleFootsteps(playerState.position, playerState.surfaceType)
    }

    // Store state for multiplayer sync
    this.playerAudioStates.set('local', playerState)
  }

  public updateGameContext(context: GameContext): void {
    if (!this.systemsReady) return

    // Update music system
    this.musicSystem.updateGameContext(context)

    // Update ambient system
    const environmentState: EnvironmentState = {
      playerPosition: context.playerPosition,
      timeOfDay: context.timeOfDay,
      weather: 'clear', // Would need weather system
      biome: 'forest', // Would need biome detection
    }
    this.ambientSystem.updateEnvironment(environmentState)
  }

  private handleFootsteps(position: THREE.Vector3, surfaceType: 'GRASS' | 'STONE' | 'WOOD' | 'WATER'): void {
    const now = Date.now()
    if (now - this.lastFootstepTime >= GAME_CONFIG.AUDIO.FOOTSTEP_INTERVAL) {
      this.spatialAudio.playFootstep(position, surfaceType)
      this.lastFootstepTime = now
    }
  }

  // Weapon audio methods
  public playWeaponSound(
    weaponType: 'RIFLE' | 'SHOTGUN' | 'PISTOL',
    action: 'FIRE' | 'RELOAD' | 'SWITCH' | 'EMPTY_CLICK',
    position?: THREE.Vector3
  ): Promise<string | null> {
    if (!this.systemsReady) return Promise.resolve(null)

    // Send to multiplayer if it's a fire event
    if (action === 'FIRE' && position && this.multiplayerManager) {
      this.multiplayerManager.sendShoot({
        position: { x: position.x, y: position.y, z: position.z },
        direction: { x: 0, y: 0, z: 1 }, // Would need actual direction
        weaponType: weaponType.toLowerCase(),
      })
    }

    return this.spatialAudio.playWeaponSound(weaponType, action, position)
  }

  private playRemoteWeaponSound(
    weaponType: 'rifle' | 'shotgun' | 'pistol',
    action: 'FIRE',
    position: THREE.Vector3
  ): Promise<string | null> {
    const type = weaponType.toUpperCase() as 'RIFLE' | 'SHOTGUN' | 'PISTOL'
    return this.spatialAudio.playWeaponSound(type, action, position)
  }

  // Tool audio methods
  public playToolSound(
    toolType: 'HATCHET' | 'PICKAXE' | 'SHOVEL',
    position: THREE.Vector3
  ): Promise<string | null> {
    if (!this.systemsReady) return Promise.resolve(null)

    // Send to multiplayer
    if (this.multiplayerManager) {
      this.multiplayerManager.sendToolUse({
        toolType: toolType.toLowerCase(),
        targetPosition: { x: position.x, y: position.y, z: position.z },
      })
    }

    return this.spatialAudio.playToolSound(toolType, position)
  }

  private playRemoteToolSound(
    toolType: 'hatchet' | 'pickaxe' | 'shovel',
    position: THREE.Vector3
  ): Promise<string | null> {
    const type = toolType.toUpperCase() as 'HATCHET' | 'PICKAXE' | 'SHOVEL'
    return this.spatialAudio.playToolSound(type, position)
  }

  // UI audio methods
  public playUISound(type: 'CLICK' | 'HOVER' | 'EQUIP' | 'ALERT' | 'INVENTORY_MOVE' | 'NOTIFICATION'): Promise<string | null> {
    if (!this.systemsReady) return Promise.resolve(null)
    return this.spatialAudio.playUISound(type)
  }

  // Building audio methods
  public playBuildingSound(
    action: 'PLACE' | 'REMOVE' | 'INVALID',
    position?: THREE.Vector3
  ): Promise<string | null> {
    if (!this.systemsReady) return Promise.resolve(null)
    return this.spatialAudio.playBuildingSound(action, position)
  }

  // Volume control methods
  public setVolume(category: AudioCategory, volume: number): void {
    this.spatialAudio.setVolume(category, volume)
  }

  public getVolume(category: AudioCategory): number {
    return this.spatialAudio.getVolume(category)
  }

  public setMusicEnabled(enabled: boolean): void {
    this.musicSystem.setEnabled(enabled)
  }

  public isMusicEnabled(): boolean {
    return this.musicSystem.isEnabled()
  }

  // Music control methods
  public getCurrentMusicState(): MusicState {
    return this.musicSystem.getCurrentState()
  }

  public forceMusic(state: MusicState, context: GameContext): void {
    this.musicSystem.forceState(state, context)
  }

  public stopMusic(): void {
    this.musicSystem.stopMusic()
  }

  public pauseMusic(): void {
    this.musicSystem.pauseMusic()
  }

  public resumeMusic(context: GameContext): void {
    this.musicSystem.resumeMusic(context)
  }

  // Ambient control methods
  public addAmbientZone(zone: {
    id: string
    center: THREE.Vector3
    radius: number
    soundId: string
    volume: number
    fadeDistance: number
    timeRestriction?: { startHour: number; endHour: number }
  }): void {
    this.ambientSystem.addAmbientZone(zone)
  }

  public removeAmbientZone(zoneId: string): void {
    this.ambientSystem.removeAmbientZone(zoneId)
  }

  public getActiveAmbientZones(): string[] {
    return this.ambientSystem.getActiveZones()
  }

  public stopAllAmbient(): void {
    this.ambientSystem.stopAllAmbient()
  }

  public pauseAllAmbient(): void {
    this.ambientSystem.pauseAllAmbient()
  }

  public resumeAllAmbient(): void {
    this.ambientSystem.resumeAllAmbient()
  }

  // Player state management for multiplayer
  private updatePlayerAudioState(playerId: string, state: PlayerAudioState): void {
    this.playerAudioStates.set(playerId, state)
  }

  public getPlayerAudioState(playerId: string): PlayerAudioState | undefined {
    return this.playerAudioStates.get(playerId)
  }

  // System control methods
  public stopAllAudio(): void {
    this.spatialAudio.stopAllSounds()
    this.musicSystem.stopMusic()
    this.ambientSystem.stopAllAmbient()
  }

  public pauseAllAudio(): void {
    this.spatialAudio.stopAllSounds('SFX')
    this.musicSystem.pauseMusic()
    this.ambientSystem.pauseAllAmbient()
  }

  public resumeAllAudio(context: GameContext): void {
    this.musicSystem.resumeMusic(context)
    this.ambientSystem.resumeAllAmbient()
  }

  public muteAll(): void {
    this.setVolume('MASTER' as AudioCategory, 0)
  }

  public unmuteAll(): void {
    this.setVolume('MASTER' as AudioCategory, GAME_CONFIG.AUDIO.CATEGORIES.MASTER.default)
  }

  // Utility methods
  public isInitialized(): boolean {
    return this.systemsReady
  }

  public getAudioSystemStats(): {
    activeSounds: number
    musicState: MusicState
    activeAmbientZones: string[]
    volumeSettings: Record<string, number>
  } {
    return {
      activeSounds: 0, // Would need to track this in spatial audio system
      musicState: this.musicSystem.getCurrentState(),
      activeAmbientZones: this.ambientSystem.getActiveZones(),
      volumeSettings: {
        master: this.getVolume('MASTER' as AudioCategory),
        sfx: this.getVolume('SFX'),
        music: this.getVolume('MUSIC'),
        ui: this.getVolume('UI'),
        ambient: this.getVolume('AMBIENT'),
      },
    }
  }

  // Event listeners
  public onSystemReadyEvent(callback: () => void): void {
    this.onSystemReady = callback
  }

  public onErrorEvent(callback: (error: string) => void): void {
    this.onError = callback
  }

  // Cleanup
  public dispose(): void {
    this.spatialAudio.dispose()
    this.musicSystem.dispose()
    this.ambientSystem.dispose()
    this.playerAudioStates.clear()
    this.systemsReady = false
  }
} 