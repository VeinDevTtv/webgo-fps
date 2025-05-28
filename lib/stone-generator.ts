import * as THREE from "three"

// Stone parameters
export interface StoneParams {
  count: number
  minSize: number
  maxSize: number
  distribution: number // Higher values = more clustered
  avoidWaterDepth: number // How far from water to avoid placing stones
}

// Stone instance data
export interface StoneNodeInstance {
  id: number // Unique identifier for the stone
  position: THREE.Vector3
  rotation: THREE.Euler
  scale: number
  radius: number
  type: number // Different stone types (0-2)
  health: number // Current health of the stone
  maxHealth: number // Maximum health of the stone
  isMined: boolean // Whether the stone has been mined
  respawnTime: number | null // When the stone will respawn (timestamp)
}

export class StoneGenerator {
  private params: StoneParams
  private terrainSize: { width: number; depth: number }
  private terrainHeightData: number[][]
  private waterLevel: number
  private seed: number
  private static nextStoneId = 1 // Static counter for unique stone IDs

  constructor(
    terrainHeightData: number[][],
    terrainSize: { width: number; depth: number },
    waterLevel: number,
    params?: Partial<StoneParams>,
  ) {
    this.terrainHeightData = terrainHeightData
    this.terrainSize = terrainSize
    this.waterLevel = waterLevel

    // Use a fixed seed for consistent stone generation - different from tree seed
    this.seed = 54321

    // Default parameters
    this.params = {
      count: 200, // Fewer stones than trees
      minSize: 0.8,
      maxSize: 2.0,
      distribution: 0.8, // More clustered than trees
      avoidWaterDepth: 3.0, // Increased from 1.5 to 3.0 to ensure stones are well away from water
      ...params,
    }
  }

  // Seeded random function
  private random(): number {
    this.seed = (this.seed * 9301 + 49297) % 233280
    return this.seed / 233280
  }

  // Get terrain height at a specific position
  private getTerrainHeight(x: number, z: number): number {
    if (!this.terrainHeightData || this.terrainHeightData.length === 0 || !this.terrainHeightData[0]) {
      console.warn("No terrain height data available")
      return 0
    }

    const terrainSize = this.terrainHeightData.length
    const halfSize = terrainSize / 2

    // Map from world space to grid space
    const gridX = Math.floor(x + halfSize)
    const gridZ = Math.floor(z + halfSize)

    // Check bounds
    if (gridX < 0 || gridX >= terrainSize || gridZ < 0 || gridZ >= terrainSize) {
      return 0
    }

    return this.terrainHeightData[gridZ][gridX]
  }

  // Calculate terrain normal at a specific position
  private getTerrainNormal(x: number, z: number): THREE.Vector3 {
    const epsilon = 1.0 // Sample distance

    // Get heights at nearby points
    const h = this.getTerrainHeight(x, z)
    const hL = this.getTerrainHeight(x - epsilon, z)
    const hR = this.getTerrainHeight(x + epsilon, z)
    const hD = this.getTerrainHeight(x, z - epsilon)
    const hU = this.getTerrainHeight(x, z + epsilon)

    // Calculate normal using central differences
    const normal = new THREE.Vector3((hL - hR) / (2 * epsilon), 1.0, (hD - hU) / (2 * epsilon))

    return normal.normalize()
  }

  // Calculate terrain slope at a specific position (0 = flat, 1 = vertical)
  private getTerrainSlope(x: number, z: number): number {
    const normal = this.getTerrainNormal(x, z)
    const up = new THREE.Vector3(0, 1, 0)
    const dot = normal.dot(up)
    return 1.0 - dot // 0 = flat, 1 = vertical
  }

  // Check if a position is near water
  private isNearWater(x: number, z: number): boolean {
    const terrainHeight = this.getTerrainHeight(x, z)

    // Check if this position is too close to water level
    if (terrainHeight < this.waterLevel + this.params.avoidWaterDepth) {
      return true
    }

    // Also check surrounding points to avoid edges of water
    const checkRadius = 3.0 // Check in a 3-unit radius
    for (let dx = -checkRadius; dx <= checkRadius; dx += 1.5) {
      for (let dz = -checkRadius; dz <= checkRadius; dz += 1.5) {
        // Skip the center point (already checked)
        if (dx === 0 && dz === 0) continue

        const nearbyHeight = this.getTerrainHeight(x + dx, z + dz)
        if (nearbyHeight < this.waterLevel + 0.5) {
          // If any nearby point is underwater or very close
          return true
        }
      }
    }

    return false
  }

  // Generate stone instances
  generateStones(): StoneNodeInstance[] {
    console.log("Generating stones...")
    const stones: StoneNodeInstance[] = []
    const halfWidth = this.terrainSize.width / 2
    const halfDepth = this.terrainSize.depth / 2

    // Reset seed for consistent generation
    this.seed = 54321

    // Create noise-based distribution map for more natural clustering
    const distributionMap: number[][] = []
    const mapSize = 50 // Resolution of the distribution map

    // Initialize distribution map with random values
    for (let z = 0; z < mapSize; z++) {
      distributionMap[z] = []
      for (let x = 0; x < mapSize; x++) {
        // Use multiple noise frequencies for more natural distribution
        const nx = x / mapSize
        const nz = z / mapSize

        let value = 0
        value += Math.sin(nx * 8 + this.random() * 10) * Math.cos(nz * 8 + this.random() * 10) * 0.5
        value += Math.sin(nx * 20 + this.random() * 10) * Math.cos(nz * 20 + this.random() * 10) * 0.3
        value += Math.sin(nx * 35 + this.random() * 10) * Math.cos(nz * 35 + this.random() * 10) * 0.2

        // Normalize to 0-1
        value = (value + 1) / 2

        // Apply distribution factor - more clustering
        value = Math.pow(value, 1 + this.params.distribution * 4)

        distributionMap[z][x] = value
      }
    }

    // Try to place the requested number of stones
    let attempts = 0
    const maxAttempts = this.params.count * 20 // Increased from 10 to 20 to allow more attempts

    while (stones.length < this.params.count && attempts < maxAttempts) {
      attempts++

      // Get random position within terrain bounds
      const x = (this.random() * 2 - 1) * halfWidth
      const z = (this.random() * 2 - 1) * halfDepth

      // Sample distribution map to see if we should place a stone here
      const mapX = Math.floor(((x + halfWidth) / this.terrainSize.width) * mapSize)
      const mapZ = Math.floor(((z + halfDepth) / this.terrainSize.depth) * mapSize)

      const mapValue =
        distributionMap[Math.min(mapSize - 1, Math.max(0, mapZ))][Math.min(mapSize - 1, Math.max(0, mapX))]

      // Skip this position if it doesn't meet the distribution threshold
      if (this.random() > mapValue * 0.8 + 0.2) {
        continue
      }

      // Get terrain height at this position
      const y = this.getTerrainHeight(x, z)

      // Skip if underwater or too close to water using our improved check
      if (this.isNearWater(x, z)) {
        continue
      }

      // Get terrain slope
      const slope = this.getTerrainSlope(x, z)

      // Skip if slope is too steep - stones tend to appear on flatter areas
      if (slope > 0.25) {
        continue
      }

      // Check if too close to other stones (avoid overlapping)
      let tooClose = false
      for (const existingStone of stones) {
        const dx = existingStone.position.x - x
        const dz = existingStone.position.z - z
        const distSq = dx * dx + dz * dz

        // Minimum distance between stones based on their scale
        const minDist = 3.0 * (existingStone.scale + this.params.minSize)

        if (distSq < minDist * minDist) {
          tooClose = true
          break
        }
      }

      if (tooClose) {
        continue
      }

      // Get terrain normal for stone orientation
      const normal = this.getTerrainNormal(x, z)

      // Create rotation from normal
      const rotation = new THREE.Euler()
      const upVector = new THREE.Vector3(0, 1, 0)

      // Only apply slight rotation based on terrain normal
      // This keeps stones mostly aligned with terrain but with slight variation
      const maxTilt = 0.3 // Maximum tilt in radians
      rotation.x = normal.z * maxTilt
      rotation.z = -normal.x * maxTilt

      // Add some random rotation around Y axis
      rotation.y = this.random() * Math.PI * 2

      // Randomize stone properties
      const scale = this.params.minSize + this.random() * (this.params.maxSize - this.params.minSize)

      // Radius is proportional to scale but varies by type
      const radius = scale * (0.8 + this.random() * 0.4)

      // Determine stone type (0-2)
      const type = Math.floor(this.random() * 3)

      // Determine stone health based on type and size (3-5 hits)
      const minHealth = 3
      const maxHealth = 5
      const healthVariation = this.random() // 0-1 random value
      const stoneHealth = Math.floor(minHealth + healthVariation * (maxHealth - minHealth + 1))

      // Create stone instance
      stones.push({
        id: StoneGenerator.nextStoneId++,
        position: new THREE.Vector3(x, y, z),
        rotation,
        scale,
        radius,
        type,
        health: stoneHealth,
        maxHealth: stoneHealth,
        isMined: false,
        respawnTime: null,
      })
    }

    console.log(`Generated ${stones.length} stones after ${attempts} attempts`)
    return stones
  }
}
