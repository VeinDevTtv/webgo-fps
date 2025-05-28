import * as THREE from 'three'
import { WeatherType } from './weather-system'

export enum BiomeType {
  FOREST = 'forest',
  DESERT = 'desert',
  HILLS = 'hills',
  ROCKY = 'rocky'
}

export interface BiomeConfig {
  name: string
  groundColor: THREE.Color
  groundTexture: string
  vegetationDensity: number
  rockDensity: number
  heightVariation: number
  preferredWeather: WeatherType[]
  weatherFrequency: Record<WeatherType, number>
  ambientSound: string
  fogDensity: number
  treeTypes: string[]
  rockTypes: string[]
  grassTypes: string[]
}

export interface BiomeData {
  type: BiomeType
  center: THREE.Vector2
  radius: number
  influence: number // 0-1, how much this biome affects a given point
}

export interface TerrainPoint {
  position: THREE.Vector3
  biome: BiomeType
  biomeInfluence: number
  height: number
  moisture: number
  temperature: number
  vegetation: boolean
  rockFormation: boolean
}

export class BiomeSystem {
  private biomes: Map<BiomeType, BiomeConfig> = new Map()
  private activeBiomes: BiomeData[] = []
  private terrainSize: number = 256
  private biomeScale: number = 0.01

  constructor() {
    this.initializeBiomes()
    this.generateBiomeLayout()
  }

  private initializeBiomes(): void {
    this.biomes.set(BiomeType.FOREST, {
      name: 'Forest',
      groundColor: new THREE.Color(0x2D5016),
      groundTexture: 'grass',
      vegetationDensity: 0.8,
      rockDensity: 0.2,
      heightVariation: 0.3,
      preferredWeather: [WeatherType.RAIN, WeatherType.OVERCAST, WeatherType.FOG],
      weatherFrequency: {
        [WeatherType.CLEAR]: 0.2,
        [WeatherType.OVERCAST]: 0.3,
        [WeatherType.RAIN]: 0.3,
        [WeatherType.FOG]: 0.15,
        [WeatherType.THUNDERSTORM]: 0.05
      },
      ambientSound: 'forest_ambient',
      fogDensity: 0.002,
      treeTypes: ['oak', 'pine', 'birch'],
      rockTypes: ['moss_rock', 'boulder'],
      grassTypes: ['fern', 'bush', 'flowers']
    })

    this.biomes.set(BiomeType.DESERT, {
      name: 'Desert',
      groundColor: new THREE.Color(0xC2B280),
      groundTexture: 'sand',
      vegetationDensity: 0.1,
      rockDensity: 0.4,
      heightVariation: 0.2,
      preferredWeather: [WeatherType.CLEAR],
      weatherFrequency: {
        [WeatherType.CLEAR]: 0.6,
        [WeatherType.OVERCAST]: 0.2,
        [WeatherType.RAIN]: 0.05,
        [WeatherType.FOG]: 0.1,
        [WeatherType.THUNDERSTORM]: 0.05
      },
      ambientSound: 'desert_wind',
      fogDensity: 0.001,
      treeTypes: ['cactus', 'dead_tree'],
      rockTypes: ['sandstone', 'red_rock'],
      grassTypes: ['desert_grass', 'tumbleweed']
    })

    this.biomes.set(BiomeType.HILLS, {
      name: 'Hills',
      groundColor: new THREE.Color(0x6B8E23),
      groundTexture: 'grass_hill',
      vegetationDensity: 0.5,
      rockDensity: 0.3,
      heightVariation: 0.6,
      preferredWeather: [WeatherType.CLEAR, WeatherType.OVERCAST],
      weatherFrequency: {
        [WeatherType.CLEAR]: 0.4,
        [WeatherType.OVERCAST]: 0.3,
        [WeatherType.RAIN]: 0.2,
        [WeatherType.FOG]: 0.05,
        [WeatherType.THUNDERSTORM]: 0.05
      },
      ambientSound: 'hill_wind',
      fogDensity: 0.0015,
      treeTypes: ['oak', 'pine'],
      rockTypes: ['granite', 'limestone'],
      grassTypes: ['hill_grass', 'wildflowers']
    })

    this.biomes.set(BiomeType.ROCKY, {
      name: 'Rocky',
      groundColor: new THREE.Color(0x696969),
      groundTexture: 'stone',
      vegetationDensity: 0.2,
      rockDensity: 0.8,
      heightVariation: 0.8,
      preferredWeather: [WeatherType.FOG, WeatherType.OVERCAST],
      weatherFrequency: {
        [WeatherType.CLEAR]: 0.2,
        [WeatherType.OVERCAST]: 0.3,
        [WeatherType.RAIN]: 0.2,
        [WeatherType.FOG]: 0.2,
        [WeatherType.THUNDERSTORM]: 0.1
      },
      ambientSound: 'mountain_wind',
      fogDensity: 0.003,
      treeTypes: ['pine', 'dead_tree'],
      rockTypes: ['granite', 'slate', 'boulder'],
      grassTypes: ['mountain_grass', 'lichen']
    })
  }

  private generateBiomeLayout(): void {
    // Generate 4-6 biome regions across the terrain
    const biomeCount = 4 + Math.floor(Math.random() * 3)
    const biomeTypes = Object.values(BiomeType)
    
    for (let i = 0; i < biomeCount; i++) {
      const angle = (i / biomeCount) * Math.PI * 2 + (Math.random() - 0.5) * 0.5
      const distance = 50 + Math.random() * 100
      
      const center = new THREE.Vector2(
        Math.cos(angle) * distance,
        Math.sin(angle) * distance
      )
      
      const biomeType = biomeTypes[Math.floor(Math.random() * biomeTypes.length)]
      const radius = 40 + Math.random() * 60
      
      this.activeBiomes.push({
        type: biomeType,
        center,
        radius,
        influence: 0.8 + Math.random() * 0.2
      })
    }
  }

  public getBiomeAt(x: number, z: number): { biome: BiomeType; influence: number; config: BiomeConfig } {
    const position = new THREE.Vector2(x, z)
    let dominantBiome = BiomeType.FOREST
    let maxInfluence = 0
    let totalInfluence = 0

    // Calculate influence from all biomes
    const influences: { biome: BiomeType; influence: number }[] = []
    
    for (const biomeData of this.activeBiomes) {
      const distance = position.distanceTo(biomeData.center)
      const normalizedDistance = distance / biomeData.radius
      
      // Use smooth falloff function
      let influence = 0
      if (normalizedDistance < 1) {
        influence = Math.pow(1 - normalizedDistance, 2) * biomeData.influence
      }
      
      influences.push({ biome: biomeData.type, influence })
      totalInfluence += influence
      
      if (influence > maxInfluence) {
        maxInfluence = influence
        dominantBiome = biomeData.type
      }
    }

    // Normalize influence
    const normalizedInfluence = totalInfluence > 0 ? maxInfluence / totalInfluence : 1

    const config = this.biomes.get(dominantBiome)!
    return { biome: dominantBiome, influence: normalizedInfluence, config }
  }

  public generateTerrainPoint(x: number, z: number, baseHeight: number): TerrainPoint {
    const biomeData = this.getBiomeAt(x, z)
    const config = biomeData.config

    // Apply biome-specific height variation
    const heightModifier = (Math.random() - 0.5) * config.heightVariation * biomeData.influence
    const height = baseHeight + heightModifier

    // Calculate moisture and temperature based on biome
    const moisture = this.calculateMoisture(x, z, biomeData.biome)
    const temperature = this.calculateTemperature(x, z, biomeData.biome)

    // Determine vegetation placement
    const vegetationChance = config.vegetationDensity * biomeData.influence
    const vegetation = Math.random() < vegetationChance

    // Determine rock formation placement
    const rockChance = config.rockDensity * biomeData.influence
    const rockFormation = Math.random() < rockChance

    return {
      position: new THREE.Vector3(x, height, z),
      biome: biomeData.biome,
      biomeInfluence: biomeData.influence,
      height,
      moisture,
      temperature,
      vegetation,
      rockFormation
    }
  }

  private calculateMoisture(x: number, z: number, biome: BiomeType): number {
    // Simple noise-based moisture calculation
    const noise = Math.sin(x * 0.01) * Math.cos(z * 0.01) * 0.5 + 0.5
    
    const biomeModifiers = {
      [BiomeType.FOREST]: 0.8,
      [BiomeType.DESERT]: 0.1,
      [BiomeType.HILLS]: 0.5,
      [BiomeType.ROCKY]: 0.3
    }
    
    return noise * biomeModifiers[biome]
  }

  private calculateTemperature(x: number, z: number, biome: BiomeType): number {
    // Simple noise-based temperature calculation
    const noise = Math.sin(x * 0.005) * Math.cos(z * 0.005) * 0.5 + 0.5
    
    const biomeModifiers = {
      [BiomeType.FOREST]: 0.6,
      [BiomeType.DESERT]: 0.9,
      [BiomeType.HILLS]: 0.5,
      [BiomeType.ROCKY]: 0.3
    }
    
    return noise * biomeModifiers[biome]
  }

  public getGroundColorAt(x: number, z: number, baseColor: THREE.Color): THREE.Color {
    const biomeData = this.getBiomeAt(x, z)
    const config = biomeData.config
    
    // Blend base color with biome color based on influence
    const blendedColor = new THREE.Color()
    blendedColor.lerpColors(baseColor, config.groundColor, biomeData.influence * 0.7)
    
    return blendedColor
  }

  public getVegetationTypeAt(x: number, z: number): string | null {
    const biomeData = this.getBiomeAt(x, z)
    const config = biomeData.config
    
    if (Math.random() > config.vegetationDensity * biomeData.influence) {
      return null
    }
    
    // Choose random vegetation type from biome
    const vegetationTypes = [...config.treeTypes, ...config.grassTypes]
    return vegetationTypes[Math.floor(Math.random() * vegetationTypes.length)]
  }

  public getRockTypeAt(x: number, z: number): string | null {
    const biomeData = this.getBiomeAt(x, z)
    const config = biomeData.config
    
    if (Math.random() > config.rockDensity * biomeData.influence) {
      return null
    }
    
    return config.rockTypes[Math.floor(Math.random() * config.rockTypes.length)]
  }

  public getBiomeConfig(biome: BiomeType): BiomeConfig | undefined {
    return this.biomes.get(biome)
  }

  public getAllBiomes(): BiomeData[] {
    return [...this.activeBiomes]
  }

  public getWeatherPreference(biome: BiomeType): WeatherType[] {
    const config = this.biomes.get(biome)
    return config ? config.preferredWeather : [WeatherType.CLEAR]
  }

  public getWeatherFrequency(biome: BiomeType, weather: WeatherType): number {
    const config = this.biomes.get(biome)
    return config ? config.weatherFrequency[weather] || 0.1 : 0.1
  }

  public getAmbientSound(biome: BiomeType): string {
    const config = this.biomes.get(biome)
    return config ? config.ambientSound : 'default_ambient'
  }
} 