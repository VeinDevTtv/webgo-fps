import * as THREE from 'three'
import { PhysicsSystem } from './physics-system'
import { WeatherSystem, WeatherType, WeatherState, WeatherEffects } from './weather-system'
import { DayNightSystem, TimeOfDay, DayNightState, DayNightEffects } from './day-night-system'
import { BiomeSystem, BiomeType } from './biome-system'

export interface EnvironmentalState {
  weather: WeatherState
  dayNight: DayNightState
  currentBiome: BiomeType
  combinedEffects: CombinedEnvironmentalEffects
}

export interface CombinedEnvironmentalEffects {
  // Lighting
  lightDirection: THREE.Vector3
  lightIntensity: number
  lightColor: THREE.Color
  ambientIntensity: number
  ambientColor: THREE.Color
  
  // Atmosphere
  skyColor: THREE.Color
  fogColor: THREE.Color
  fogDensity: number
  
  // Visibility and gameplay
  visibility: number
  enemyAggroMultiplier: number
  windStrength: number
  
  // Audio
  ambientSound: string | null
  
  // Particles
  particleCount: number
}

export class EnvironmentalManager {
  private physicsSystem: PhysicsSystem
  private weatherSystem: WeatherSystem
  private dayNightSystem: DayNightSystem
  private biomeSystem: BiomeSystem
  
  private currentPlayerPosition: THREE.Vector3 = new THREE.Vector3()
  private currentBiome: BiomeType = BiomeType.FOREST
  
  // Callbacks
  private onEnvironmentChange?: (state: EnvironmentalState) => void
  private onLightingChange?: (effects: DayNightEffects) => void
  private onWeatherChange?: (effects: WeatherEffects) => void
  private onAmbientSoundChange?: (soundId: string | null) => void

  constructor() {
    this.physicsSystem = new PhysicsSystem()
    this.weatherSystem = new WeatherSystem()
    this.dayNightSystem = new DayNightSystem()
    this.biomeSystem = new BiomeSystem()
    
    this.setupSystemCallbacks()
  }

  private setupSystemCallbacks(): void {
    // Weather system callbacks
    this.weatherSystem.setWeatherChangeCallback((weather, effects) => {
      this.onWeatherChange?.(effects)
      this.updateCombinedEffects()
    })

    this.weatherSystem.setAmbientSoundCallback((soundId) => {
      // Weather sounds take priority over biome sounds
      this.onAmbientSoundChange?.(soundId)
    })

    // Day/night system callbacks
    this.dayNightSystem.setTimeChangeCallback((dayNight, effects) => {
      this.onLightingChange?.(effects)
      this.updateCombinedEffects()
    })

    this.dayNightSystem.setAmbientChangeCallback((soundId) => {
      // Only play time-based sounds if no weather sound is active
      const currentWeather = this.weatherSystem.getCurrentWeather()
      if (!currentWeather.transition) {
        this.onAmbientSoundChange?.(soundId)
      }
    })
  }

  public setEnvironmentChangeCallback(callback: (state: EnvironmentalState) => void): void {
    this.onEnvironmentChange = callback
  }

  public setLightingChangeCallback(callback: (effects: DayNightEffects) => void): void {
    this.onLightingChange = callback
  }

  public setWeatherChangeCallback(callback: (effects: WeatherEffects) => void): void {
    this.onWeatherChange = callback
  }

  public setAmbientSoundCallback(callback: (soundId: string | null) => void): void {
    this.onAmbientSoundChange = callback
  }

  public update(deltaTime: number, playerPosition: THREE.Vector3): void {
    // Update player position
    this.currentPlayerPosition.copy(playerPosition)
    
    // Update current biome
    const biomeData = this.biomeSystem.getBiomeAt(playerPosition.x, playerPosition.z)
    this.currentBiome = biomeData.biome

    // Update all systems
    this.physicsSystem.step(deltaTime)
    this.weatherSystem.update(deltaTime)
    this.dayNightSystem.update(deltaTime)

    // Update combined effects
    this.updateCombinedEffects()
  }

  private updateCombinedEffects(): void {
    const weatherEffects = this.weatherSystem.getCurrentEffects()
    const dayNightEffects = this.dayNightSystem.getCurrentEffects()
    const biomeConfig = this.biomeSystem.getBiomeConfig(this.currentBiome)

    if (!biomeConfig) return

    // Combine effects from all systems
    const combinedEffects: CombinedEnvironmentalEffects = {
      // Lighting - day/night takes priority, weather modifies
      lightDirection: dayNightEffects.lightDirection,
      lightIntensity: dayNightEffects.lightIntensity * weatherEffects.lightIntensity,
      lightColor: new THREE.Color().lerpColors(
        dayNightEffects.lightColor,
        weatherEffects.lightColor,
        0.3
      ),
      ambientIntensity: dayNightEffects.ambientIntensity * 0.7 + weatherEffects.lightIntensity * 0.3,
      ambientColor: new THREE.Color().lerpColors(
        dayNightEffects.ambientColor,
        weatherEffects.skyColor,
        0.2
      ),

      // Atmosphere - blend weather and day/night
      skyColor: new THREE.Color().lerpColors(
        dayNightEffects.skyColor,
        weatherEffects.skyColor,
        0.6
      ),
      fogColor: new THREE.Color().lerpColors(
        dayNightEffects.fogColor,
        weatherEffects.fogColor,
        0.7
      ),
      fogDensity: Math.max(dayNightEffects.fogDensity, weatherEffects.fogDensity) + biomeConfig.fogDensity,

      // Visibility and gameplay - most restrictive wins
      visibility: Math.min(
        dayNightEffects.visibilityMultiplier,
        weatherEffects.visibility
      ),
      enemyAggroMultiplier: dayNightEffects.enemyAggroMultiplier,
      windStrength: weatherEffects.windStrength,

      // Audio - weather takes priority, then time of day, then biome
      ambientSound: this.determineAmbientSound(),

      // Particles - from weather system
      particleCount: weatherEffects.particleCount
    }

    // Notify listeners
    const environmentalState: EnvironmentalState = {
      weather: this.weatherSystem.getCurrentWeather(),
      dayNight: this.dayNightSystem.getCurrentState(),
      currentBiome: this.currentBiome,
      combinedEffects
    }

    this.onEnvironmentChange?.(environmentalState)
  }

  private determineAmbientSound(): string | null {
    const weatherEffects = this.weatherSystem.getCurrentEffects()
    const dayNightEffects = this.dayNightSystem.getCurrentEffects()
    const biomeConfig = this.biomeSystem.getBiomeConfig(this.currentBiome)

    // Priority: Weather > Time of Day > Biome
    if (weatherEffects.ambientSound) {
      return weatherEffects.ambientSound
    }

    // Check if it's a special time of day
    const timeOfDay = this.dayNightSystem.getCurrentState().timeOfDay
    if (timeOfDay === TimeOfDay.DAWN) return 'dawn_birds'
    if (timeOfDay === TimeOfDay.NIGHT || timeOfDay === TimeOfDay.MIDNIGHT) return 'night_crickets'

    // Default to biome sound
    return biomeConfig?.ambientSound || null
  }

  // Physics system methods
  public createRagdoll(position: THREE.Vector3, impulse?: THREE.Vector3): string {
    return this.physicsSystem.createRagdoll(position, impulse)
  }

  public cleanupRagdoll(ragdollId: string): void {
    this.physicsSystem.cleanupRagdoll(ragdollId)
  }

  public getRagdollBodies(ragdollId: string) {
    return this.physicsSystem.getRagdollBodies(ragdollId)
  }

  // Weather system methods
  public getCurrentWeather(): WeatherState {
    return this.weatherSystem.getCurrentWeather()
  }

  public forceWeather(type: WeatherType): void {
    this.weatherSystem.forceWeather(type)
  }

  public triggerLightning(): void {
    this.weatherSystem.triggerLightning()
  }

  // Day/night system methods
  public getCurrentTimeOfDay(): TimeOfDay {
    return this.dayNightSystem.getCurrentState().timeOfDay
  }

  public setTimeOfDay(timeOfDay: TimeOfDay): void {
    this.dayNightSystem.setTimeOfDay(timeOfDay)
  }

  public getTimeString(): string {
    return this.dayNightSystem.getTimeString()
  }

  public isNight(): boolean {
    return this.dayNightSystem.isNight()
  }

  // Biome system methods
  public getCurrentBiome(): BiomeType {
    return this.currentBiome
  }

  public getBiomeAt(x: number, z: number) {
    return this.biomeSystem.getBiomeAt(x, z)
  }

  public getGroundColorAt(x: number, z: number, baseColor: THREE.Color): THREE.Color {
    return this.biomeSystem.getGroundColorAt(x, z, baseColor)
  }

  public getVegetationTypeAt(x: number, z: number): string | null {
    return this.biomeSystem.getVegetationTypeAt(x, z)
  }

  public getRockTypeAt(x: number, z: number): string | null {
    return this.biomeSystem.getRockTypeAt(x, z)
  }

  // Combined getters
  public getVisibilityMultiplier(): number {
    const weather = this.weatherSystem.getVisibilityMultiplier()
    const dayNight = this.dayNightSystem.getVisibilityMultiplier()
    return Math.min(weather, dayNight)
  }

  public getEnemyAggroMultiplier(): number {
    return this.dayNightSystem.getEnemyAggroMultiplier()
  }

  public getWindStrength(): number {
    return this.weatherSystem.getWindStrength()
  }

  public getCurrentEffects(): CombinedEnvironmentalEffects {
    const weatherEffects = this.weatherSystem.getCurrentEffects()
    const dayNightEffects = this.dayNightSystem.getCurrentEffects()
    const biomeConfig = this.biomeSystem.getBiomeConfig(this.currentBiome)

    if (!biomeConfig) {
      // Fallback effects
      return {
        lightDirection: dayNightEffects.lightDirection,
        lightIntensity: dayNightEffects.lightIntensity,
        lightColor: dayNightEffects.lightColor,
        ambientIntensity: dayNightEffects.ambientIntensity,
        ambientColor: dayNightEffects.ambientColor,
        skyColor: dayNightEffects.skyColor,
        fogColor: dayNightEffects.fogColor,
        fogDensity: dayNightEffects.fogDensity,
        visibility: Math.min(dayNightEffects.visibilityMultiplier, weatherEffects.visibility),
        enemyAggroMultiplier: dayNightEffects.enemyAggroMultiplier,
        windStrength: weatherEffects.windStrength,
        ambientSound: this.determineAmbientSound(),
        particleCount: weatherEffects.particleCount
      }
    }

    return {
      lightDirection: dayNightEffects.lightDirection,
      lightIntensity: dayNightEffects.lightIntensity * weatherEffects.lightIntensity,
      lightColor: new THREE.Color().lerpColors(dayNightEffects.lightColor, weatherEffects.lightColor, 0.3),
      ambientIntensity: dayNightEffects.ambientIntensity * 0.7 + weatherEffects.lightIntensity * 0.3,
      ambientColor: new THREE.Color().lerpColors(dayNightEffects.ambientColor, weatherEffects.skyColor, 0.2),
      skyColor: new THREE.Color().lerpColors(dayNightEffects.skyColor, weatherEffects.skyColor, 0.6),
      fogColor: new THREE.Color().lerpColors(dayNightEffects.fogColor, weatherEffects.fogColor, 0.7),
      fogDensity: Math.max(dayNightEffects.fogDensity, weatherEffects.fogDensity) + biomeConfig.fogDensity,
      visibility: Math.min(dayNightEffects.visibilityMultiplier, weatherEffects.visibility),
      enemyAggroMultiplier: dayNightEffects.enemyAggroMultiplier,
      windStrength: weatherEffects.windStrength,
      ambientSound: this.determineAmbientSound(),
      particleCount: weatherEffects.particleCount
    }
  }
} 