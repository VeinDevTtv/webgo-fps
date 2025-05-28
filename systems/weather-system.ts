import * as THREE from 'three'

export enum WeatherType {
  CLEAR = 'clear',
  OVERCAST = 'overcast',
  RAIN = 'rain',
  FOG = 'fog',
  THUNDERSTORM = 'thunderstorm'
}

export interface WeatherState {
  type: WeatherType
  intensity: number // 0-1
  duration: number // seconds
  timeRemaining: number // seconds
  transition: boolean
  transitionProgress: number // 0-1
}

export interface WeatherEffects {
  skyColor: THREE.Color
  fogColor: THREE.Color
  fogDensity: number
  lightIntensity: number
  lightColor: THREE.Color
  ambientSound?: string
  particleCount: number
  windStrength: number
  visibility: number // 0-1, affects render distance
}

export class WeatherSystem {
  private currentWeather: WeatherState
  private nextWeather: WeatherType | null = null
  private transitionDuration: number = 30 // seconds
  private weatherDuration: { min: number; max: number } = { min: 180, max: 300 } // 3-5 minutes
  private onWeatherChange?: (weather: WeatherState, effects: WeatherEffects) => void
  private onAmbientSoundChange?: (soundId: string | null) => void

  // Weather configuration
  private weatherConfigs: Record<WeatherType, WeatherEffects> = {
    [WeatherType.CLEAR]: {
      skyColor: new THREE.Color(0x87CEEB), // Sky blue
      fogColor: new THREE.Color(0xCCCCCC),
      fogDensity: 0.0001,
      lightIntensity: 1.0,
      lightColor: new THREE.Color(0xFFFFFF),
      ambientSound: 'birds',
      particleCount: 0,
      windStrength: 0.2,
      visibility: 1.0
    },
    [WeatherType.OVERCAST]: {
      skyColor: new THREE.Color(0x708090), // Slate gray
      fogColor: new THREE.Color(0x999999),
      fogDensity: 0.0005,
      lightIntensity: 0.6,
      lightColor: new THREE.Color(0xE6E6FA),
      ambientSound: 'wind_light',
      particleCount: 0,
      windStrength: 0.4,
      visibility: 0.8
    },
    [WeatherType.RAIN]: {
      skyColor: new THREE.Color(0x2F4F4F), // Dark slate gray
      fogColor: new THREE.Color(0x696969),
      fogDensity: 0.002,
      lightIntensity: 0.4,
      lightColor: new THREE.Color(0xB0C4DE),
      ambientSound: 'rain',
      particleCount: 1000,
      windStrength: 0.6,
      visibility: 0.6
    },
    [WeatherType.FOG]: {
      skyColor: new THREE.Color(0xDCDCDC), // Gainsboro
      fogColor: new THREE.Color(0xF5F5F5),
      fogDensity: 0.01,
      lightIntensity: 0.3,
      lightColor: new THREE.Color(0xF0F8FF),
      ambientSound: 'wind_heavy',
      particleCount: 0,
      windStrength: 0.1,
      visibility: 0.3
    },
    [WeatherType.THUNDERSTORM]: {
      skyColor: new THREE.Color(0x191970), // Midnight blue
      fogColor: new THREE.Color(0x2F2F2F),
      fogDensity: 0.003,
      lightIntensity: 0.2,
      lightColor: new THREE.Color(0x9370DB),
      ambientSound: 'thunderstorm',
      particleCount: 1500,
      windStrength: 0.8,
      visibility: 0.4
    }
  }

  constructor() {
    this.currentWeather = {
      type: WeatherType.CLEAR,
      intensity: 1.0,
      duration: this.getRandomDuration(),
      timeRemaining: this.getRandomDuration(),
      transition: false,
      transitionProgress: 0
    }
  }

  public setWeatherChangeCallback(callback: (weather: WeatherState, effects: WeatherEffects) => void): void {
    this.onWeatherChange = callback
  }

  public setAmbientSoundCallback(callback: (soundId: string | null) => void): void {
    this.onAmbientSoundChange = callback
  }

  public update(deltaTime: number): void {
    if (this.currentWeather.transition) {
      // Handle transition
      this.currentWeather.transitionProgress += deltaTime / this.transitionDuration
      
      if (this.currentWeather.transitionProgress >= 1.0) {
        // Transition complete
        this.currentWeather.transition = false
        this.currentWeather.transitionProgress = 0
        this.currentWeather.type = this.nextWeather!
        this.currentWeather.duration = this.getRandomDuration()
        this.currentWeather.timeRemaining = this.currentWeather.duration
        this.nextWeather = null

        // Update ambient sound
        const effects = this.getCurrentEffects()
        this.onAmbientSoundChange?.(effects.ambientSound || null)
      }
    } else {
      // Normal weather duration
      this.currentWeather.timeRemaining -= deltaTime
      
      if (this.currentWeather.timeRemaining <= 0) {
        this.startWeatherTransition()
      }
    }

    // Notify listeners of current weather state
    const effects = this.getCurrentEffects()
    this.onWeatherChange?.(this.currentWeather, effects)
  }

  private startWeatherTransition(): void {
    // Choose next weather type (avoid repeating current weather)
    const availableWeathers = Object.values(WeatherType).filter(w => w !== this.currentWeather.type)
    this.nextWeather = availableWeathers[Math.floor(Math.random() * availableWeathers.length)]
    
    this.currentWeather.transition = true
    this.currentWeather.transitionProgress = 0
  }

  private getRandomDuration(): number {
    return this.weatherDuration.min + Math.random() * (this.weatherDuration.max - this.weatherDuration.min)
  }

  public getCurrentEffects(): WeatherEffects {
    const currentConfig = this.weatherConfigs[this.currentWeather.type]
    
    if (!this.currentWeather.transition || !this.nextWeather) {
      return { ...currentConfig }
    }

    // Interpolate between current and next weather during transition
    const nextConfig = this.weatherConfigs[this.nextWeather]
    const progress = this.currentWeather.transitionProgress

    return {
      skyColor: new THREE.Color().lerpColors(currentConfig.skyColor, nextConfig.skyColor, progress),
      fogColor: new THREE.Color().lerpColors(currentConfig.fogColor, nextConfig.fogColor, progress),
      fogDensity: THREE.MathUtils.lerp(currentConfig.fogDensity, nextConfig.fogDensity, progress),
      lightIntensity: THREE.MathUtils.lerp(currentConfig.lightIntensity, nextConfig.lightIntensity, progress),
      lightColor: new THREE.Color().lerpColors(currentConfig.lightColor, nextConfig.lightColor, progress),
      ambientSound: progress < 0.5 ? currentConfig.ambientSound : nextConfig.ambientSound,
      particleCount: Math.round(THREE.MathUtils.lerp(currentConfig.particleCount, nextConfig.particleCount, progress)),
      windStrength: THREE.MathUtils.lerp(currentConfig.windStrength, nextConfig.windStrength, progress),
      visibility: THREE.MathUtils.lerp(currentConfig.visibility, nextConfig.visibility, progress)
    }
  }

  public getCurrentWeather(): WeatherState {
    return { ...this.currentWeather }
  }

  public forceWeather(type: WeatherType): void {
    this.currentWeather.type = type
    this.currentWeather.transition = false
    this.currentWeather.transitionProgress = 0
    this.currentWeather.duration = this.getRandomDuration()
    this.currentWeather.timeRemaining = this.currentWeather.duration
    this.nextWeather = null

    const effects = this.getCurrentEffects()
    this.onAmbientSoundChange?.(effects.ambientSound || null)
    this.onWeatherChange?.(this.currentWeather, effects)
  }

  public triggerLightning(): void {
    // Trigger lightning flash effect (to be handled by the renderer)
    if (this.currentWeather.type === WeatherType.THUNDERSTORM) {
      // Lightning flash will be handled by the lighting system
      console.log('Lightning flash triggered!')
    }
  }

  public getVisibilityMultiplier(): number {
    return this.getCurrentEffects().visibility
  }

  public getWindStrength(): number {
    return this.getCurrentEffects().windStrength
  }
} 