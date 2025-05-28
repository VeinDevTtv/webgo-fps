import * as THREE from 'three'

export enum TimeOfDay {
  DAWN = 'dawn',
  MORNING = 'morning',
  NOON = 'noon',
  AFTERNOON = 'afternoon',
  DUSK = 'dusk',
  NIGHT = 'night',
  MIDNIGHT = 'midnight'
}

export interface DayNightState {
  timeOfDay: TimeOfDay
  dayProgress: number // 0-1, where 0 is midnight and 0.5 is noon
  sunPosition: THREE.Vector3
  moonPosition: THREE.Vector3
  sunIntensity: number
  moonIntensity: number
  skyColor: THREE.Color
  ambientColor: THREE.Color
  fogColor: THREE.Color
}

export interface DayNightEffects {
  lightDirection: THREE.Vector3
  lightIntensity: number
  lightColor: THREE.Color
  ambientIntensity: number
  ambientColor: THREE.Color
  skyColor: THREE.Color
  fogColor: THREE.Color
  fogDensity: number
  enemyAggroMultiplier: number // Enemies more aggressive at night
  visibilityMultiplier: number
}

export class DayNightSystem {
  private dayProgress: number = 0.25 // Start at dawn
  private cycleDuration: number = 600 // 10 minutes for full day/night cycle
  private onTimeChange?: (state: DayNightState, effects: DayNightEffects) => void
  private onAmbientChange?: (soundId: string | null) => void

  // Time of day configurations
  private timeConfigs: Record<TimeOfDay, {
    progressRange: [number, number]
    skyColor: THREE.Color
    ambientColor: THREE.Color
    fogColor: THREE.Color
    lightIntensity: number
    lightColor: THREE.Color
    ambientIntensity: number
    fogDensity: number
    enemyAggroMultiplier: number
    visibilityMultiplier: number
    ambientSound?: string
  }> = {
    [TimeOfDay.MIDNIGHT]: {
      progressRange: [0, 0.1],
      skyColor: new THREE.Color(0x000011),
      ambientColor: new THREE.Color(0x111133),
      fogColor: new THREE.Color(0x000022),
      lightIntensity: 0.1,
      lightColor: new THREE.Color(0x9999FF),
      ambientIntensity: 0.2,
      fogDensity: 0.003,
      enemyAggroMultiplier: 1.5,
      visibilityMultiplier: 0.3,
      ambientSound: 'night_crickets'
    },
    [TimeOfDay.DAWN]: {
      progressRange: [0.1, 0.25],
      skyColor: new THREE.Color(0xFF6B35),
      ambientColor: new THREE.Color(0xFFB366),
      fogColor: new THREE.Color(0xFFCC99),
      lightIntensity: 0.4,
      lightColor: new THREE.Color(0xFFCC66),
      ambientIntensity: 0.4,
      fogDensity: 0.002,
      enemyAggroMultiplier: 1.2,
      visibilityMultiplier: 0.6,
      ambientSound: 'dawn_birds'
    },
    [TimeOfDay.MORNING]: {
      progressRange: [0.25, 0.4],
      skyColor: new THREE.Color(0x87CEEB),
      ambientColor: new THREE.Color(0xFFFFCC),
      fogColor: new THREE.Color(0xE6E6FA),
      lightIntensity: 0.8,
      lightColor: new THREE.Color(0xFFFFDD),
      ambientIntensity: 0.6,
      fogDensity: 0.001,
      enemyAggroMultiplier: 1.0,
      visibilityMultiplier: 0.9,
      ambientSound: 'morning_birds'
    },
    [TimeOfDay.NOON]: {
      progressRange: [0.4, 0.6],
      skyColor: new THREE.Color(0x87CEEB),
      ambientColor: new THREE.Color(0xFFFFFF),
      fogColor: new THREE.Color(0xF0F8FF),
      lightIntensity: 1.0,
      lightColor: new THREE.Color(0xFFFFFF),
      ambientIntensity: 0.8,
      fogDensity: 0.0005,
      enemyAggroMultiplier: 0.8,
      visibilityMultiplier: 1.0,
      ambientSound: 'day_ambient'
    },
    [TimeOfDay.AFTERNOON]: {
      progressRange: [0.6, 0.75],
      skyColor: new THREE.Color(0xFFB347),
      ambientColor: new THREE.Color(0xFFE4B5),
      fogColor: new THREE.Color(0xFFE4CC),
      lightIntensity: 0.8,
      lightColor: new THREE.Color(0xFFE4B5),
      ambientIntensity: 0.6,
      fogDensity: 0.001,
      enemyAggroMultiplier: 1.0,
      visibilityMultiplier: 0.9,
      ambientSound: 'afternoon_wind'
    },
    [TimeOfDay.DUSK]: {
      progressRange: [0.75, 0.9],
      skyColor: new THREE.Color(0xFF4500),
      ambientColor: new THREE.Color(0xFF6347),
      fogColor: new THREE.Color(0xFF7F50),
      lightIntensity: 0.3,
      lightColor: new THREE.Color(0xFF6347),
      ambientIntensity: 0.4,
      fogDensity: 0.002,
      enemyAggroMultiplier: 1.3,
      visibilityMultiplier: 0.5,
      ambientSound: 'dusk_wind'
    },
    [TimeOfDay.NIGHT]: {
      progressRange: [0.9, 1.0],
      skyColor: new THREE.Color(0x191970),
      ambientColor: new THREE.Color(0x2F2F4F),
      fogColor: new THREE.Color(0x1C1C3A),
      lightIntensity: 0.15,
      lightColor: new THREE.Color(0xCCCCFF),
      ambientIntensity: 0.3,
      fogDensity: 0.003,
      enemyAggroMultiplier: 1.4,
      visibilityMultiplier: 0.4,
      ambientSound: 'night_wind'
    }
  }

  constructor(startTime: number = 0.25) {
    this.dayProgress = startTime
  }

  public setTimeChangeCallback(callback: (state: DayNightState, effects: DayNightEffects) => void): void {
    this.onTimeChange = callback
  }

  public setAmbientChangeCallback(callback: (soundId: string | null) => void): void {
    this.onAmbientChange = callback
  }

  public update(deltaTime: number): void {
    const previousTimeOfDay = this.getCurrentTimeOfDay()
    
    // Update day progress
    this.dayProgress += deltaTime / this.cycleDuration
    if (this.dayProgress >= 1.0) {
      this.dayProgress -= 1.0
    }

    const currentTimeOfDay = this.getCurrentTimeOfDay()
    
    // Check if time of day changed
    if (currentTimeOfDay !== previousTimeOfDay) {
      const config = this.timeConfigs[currentTimeOfDay]
      this.onAmbientChange?.(config.ambientSound || null)
    }

    // Notify listeners
    const state = this.getCurrentState()
    const effects = this.getCurrentEffects()
    this.onTimeChange?.(state, effects)
  }

  private getCurrentTimeOfDay(): TimeOfDay {
    for (const [timeOfDay, config] of Object.entries(this.timeConfigs)) {
      const [start, end] = config.progressRange
      if (this.dayProgress >= start && this.dayProgress < end) {
        return timeOfDay as TimeOfDay
      }
    }
    return TimeOfDay.MIDNIGHT // Fallback
  }

  public getCurrentState(): DayNightState {
    const timeOfDay = this.getCurrentTimeOfDay()
    const config = this.timeConfigs[timeOfDay]
    
    // Calculate sun and moon positions
    const sunAngle = (this.dayProgress - 0.25) * Math.PI * 2 // Sun rises at dawn (0.25)
    const moonAngle = (this.dayProgress + 0.25) * Math.PI * 2 // Moon opposite to sun
    
    const sunPosition = new THREE.Vector3(
      Math.cos(sunAngle) * 100,
      Math.sin(sunAngle) * 100,
      0
    )
    
    const moonPosition = new THREE.Vector3(
      Math.cos(moonAngle) * 100,
      Math.sin(moonAngle) * 100,
      0
    )

    // Calculate intensities based on position
    const sunIntensity = Math.max(0, Math.sin(sunAngle)) * config.lightIntensity
    const moonIntensity = Math.max(0, Math.sin(moonAngle)) * 0.2

    return {
      timeOfDay,
      dayProgress: this.dayProgress,
      sunPosition,
      moonPosition,
      sunIntensity,
      moonIntensity,
      skyColor: config.skyColor.clone(),
      ambientColor: config.ambientColor.clone(),
      fogColor: config.fogColor.clone()
    }
  }

  public getCurrentEffects(): DayNightEffects {
    const state = this.getCurrentState()
    const config = this.timeConfigs[state.timeOfDay]
    
    // Determine primary light source (sun or moon)
    const useSun = state.sunIntensity > state.moonIntensity
    const lightDirection = useSun ? 
      state.sunPosition.clone().normalize().negate() : 
      state.moonPosition.clone().normalize().negate()
    
    const lightIntensity = useSun ? state.sunIntensity : state.moonIntensity
    const lightColor = useSun ? config.lightColor.clone() : new THREE.Color(0xCCCCFF)

    return {
      lightDirection,
      lightIntensity,
      lightColor,
      ambientIntensity: config.ambientIntensity,
      ambientColor: config.ambientColor.clone(),
      skyColor: config.skyColor.clone(),
      fogColor: config.fogColor.clone(),
      fogDensity: config.fogDensity,
      enemyAggroMultiplier: config.enemyAggroMultiplier,
      visibilityMultiplier: config.visibilityMultiplier
    }
  }

  public setTime(progress: number): void {
    this.dayProgress = Math.max(0, Math.min(1, progress))
  }

  public setTimeOfDay(timeOfDay: TimeOfDay): void {
    const config = this.timeConfigs[timeOfDay]
    const [start, end] = config.progressRange
    this.dayProgress = (start + end) / 2 // Set to middle of time period
  }

  public getTimeString(): string {
    const hours = Math.floor(this.dayProgress * 24)
    const minutes = Math.floor((this.dayProgress * 24 * 60) % 60)
    return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`
  }

  public isNight(): boolean {
    const timeOfDay = this.getCurrentTimeOfDay()
    return timeOfDay === TimeOfDay.NIGHT || timeOfDay === TimeOfDay.MIDNIGHT
  }

  public isDawn(): boolean {
    return this.getCurrentTimeOfDay() === TimeOfDay.DAWN
  }

  public isDusk(): boolean {
    return this.getCurrentTimeOfDay() === TimeOfDay.DUSK
  }

  public getEnemyAggroMultiplier(): number {
    return this.getCurrentEffects().enemyAggroMultiplier
  }

  public getVisibilityMultiplier(): number {
    return this.getCurrentEffects().visibilityMultiplier
  }
} 