import * as THREE from "three"

// Tree parameters
export interface TreeParams {
  count: number
  minHeight: number
  maxHeight: number
  minRadius: number
  maxRadius: number
  minScale: number
  maxScale: number
  distribution: number // Higher values = more clustered
  avoidWaterDepth: number // How far from water to avoid placing trees
}

// Tree instance data
export interface TreeInstance {
  id: number // Unique identifier for the tree
  position: THREE.Vector3
  rotation: THREE.Euler
  scale: number
  height: number
  type: number // Different tree types (0-2)
  health: number // Current health of the tree
  maxHealth: number // Maximum health of the tree
  isChopped: boolean // Whether the tree has been chopped
  respawnTime: number | null // When the tree will respawn (timestamp)
  // Collision data
  trunkRadius?: number
  trunkHeight?: number
  foliageRadius?: number
  foliageBottom?: number
  foliageTop?: number
}

export class TreeGenerator {
  private params: TreeParams
  private terrainSize: { width: number; depth: number }
  private terrainHeightData: number[][]
  private waterLevel: number
  private seed: number
  private static nextTreeId = 1 // Static counter for unique tree IDs

  constructor(
    terrainHeightData: number[][],
    terrainSize: { width: number; depth: number },
    waterLevel: number,
    params?: Partial<TreeParams>,
  ) {
    this.terrainHeightData = terrainHeightData
    this.terrainSize = terrainSize
    this.waterLevel = waterLevel

    // Use a fixed seed for consistent tree generation
    this.seed = 12345

    // Default parameters
    this.params = {
      count: 500, // Number of trees
      minHeight: 2, // Minimum tree height
      maxHeight: 6, // Maximum tree height
      minRadius: 0.2, // Minimum trunk radius
      maxRadius: 0.6, // Maximum trunk radius
      minScale: 0.7, // Minimum overall scale
      maxScale: 1.3, // Maximum overall scale
      distribution: 0.6, // Distribution factor (0-1)
      avoidWaterDepth: 2, // Avoid placing trees within 2 units of water
      ...params,
    }
  }

  // Seeded random function
  private random(): number {
    this.seed = (this.seed * 9301 + 49297) % 233280
    return this.seed / 233280
  }

  // Get terrain height at a specific world position
  private getTerrainHeight(x: number, z: number): number {
    // Convert world coordinates to terrain grid coordinates
    const halfWidth = this.terrainSize.width / 2
    const halfDepth = this.terrainSize.depth / 2

    // Map from world space to grid space
    const gridX = Math.floor(x + halfWidth)
    const gridZ = Math.floor(z + halfDepth)

    // Check bounds
    if (gridX < 0 || gridX >= this.terrainHeightData[0].length || gridZ < 0 || gridZ >= this.terrainHeightData.length) {
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

  // Generate tree instances
  generateTrees(): TreeInstance[] {
    console.log("Generating trees...")
    const trees: TreeInstance[] = []
    const halfWidth = this.terrainSize.width / 2
    const halfDepth = this.terrainSize.depth / 2

    // Reset seed for consistent generation
    this.seed = 12345

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
        value += Math.sin(nx * 5 + this.random() * 10) * Math.cos(nz * 5 + this.random() * 10) * 0.5
        value += Math.sin(nx * 15 + this.random() * 10) * Math.cos(nz * 15 + this.random() * 10) * 0.3
        value += Math.sin(nx * 30 + this.random() * 10) * Math.cos(nz * 30 + this.random() * 10) * 0.2

        // Normalize to 0-1
        value = (value + 1) / 2

        // Apply distribution factor
        value = Math.pow(value, 1 + this.params.distribution * 3)

        distributionMap[z][x] = value
      }
    }

    // Try to place the requested number of trees
    let attempts = 0
    const maxAttempts = this.params.count * 10 // Limit attempts to avoid infinite loops

    while (trees.length < this.params.count && attempts < maxAttempts) {
      attempts++

      // Get random position within terrain bounds
      const x = (this.random() * 2 - 1) * halfWidth
      const z = (this.random() * 2 - 1) * halfDepth

      // Sample distribution map to see if we should place a tree here
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

      // Skip if underwater or too close to water
      if (y < this.waterLevel + this.params.avoidWaterDepth) {
        continue
      }

      // Get terrain slope
      const slope = this.getTerrainSlope(x, z)

      // Skip if slope is too steep (trees don't grow well on steep slopes)
      if (slope > 0.3) {
        continue
      }

      // Check if too close to other trees (avoid overlapping)
      let tooClose = false
      for (const existingTree of trees) {
        const dx = existingTree.position.x - x
        const dz = existingTree.position.z - z
        const distSq = dx * dx + dz * dz

        // Minimum distance between trees based on their scale
        const minDist = 2.0 * (existingTree.scale + this.params.minScale)

        if (distSq < minDist * minDist) {
          tooClose = true
          break
        }
      }

      if (tooClose) {
        continue
      }

      // Get terrain normal for tree orientation
      const normal = this.getTerrainNormal(x, z)

      // Create rotation from normal
      const rotation = new THREE.Euler()
      const upVector = new THREE.Vector3(0, 1, 0)

      // Only apply slight rotation based on terrain normal
      // This keeps trees mostly upright but with slight variation
      const maxTilt = 0.2 // Maximum tilt in radians (about 11 degrees)
      rotation.x = normal.z * maxTilt
      rotation.z = -normal.x * maxTilt

      // Add some random rotation around Y axis
      rotation.y = this.random() * Math.PI * 2

      // Randomize tree properties
      const scale = this.params.minScale + this.random() * (this.params.maxScale - this.params.minScale)
      const height = this.params.minHeight + this.random() * (this.params.maxHeight - this.params.minHeight)

      // Determine tree type (0-2)
      const type = Math.floor(this.random() * 3)

      // Calculate collision data based on tree type
      let trunkRadius, trunkHeight, foliageRadius, foliageBottom, foliageTop

      switch (type) {
        case 0: // Pine tree
          trunkRadius = 0.2 * scale
          trunkHeight = height * 0.6 * scale
          foliageRadius = 1.2 * scale
          foliageBottom = trunkHeight * 0.5
          foliageTop = trunkHeight + height * 0.9 * scale
          break
        case 1: // Oak tree
          trunkRadius = 0.3 * scale
          trunkHeight = height * 0.8 * scale
          foliageRadius = 1.5 * scale
          foliageBottom = trunkHeight * 0.5
          foliageTop = trunkHeight + height * 0.7 * scale
          break
        case 2: // Bush
          trunkRadius = 0.15 * scale
          trunkHeight = height * 0.5 * scale
          foliageRadius = 1.3 * scale
          foliageBottom = trunkHeight * 0.3
          foliageTop = trunkHeight + height * 0.6 * scale
          break
        default:
          trunkRadius = 0.2 * scale
          trunkHeight = height * scale
          foliageRadius = 1.2 * scale
          foliageBottom = trunkHeight * 0.5
          foliageTop = trunkHeight + height * 0.7 * scale
      }

      // Determine tree health based on type and size (4-6 hits)
      const minHealth = 4
      const maxHealth = 6
      const healthVariation = this.random() // 0-1 random value
      const treeHealth = Math.floor(minHealth + healthVariation * (maxHealth - minHealth + 1))

      // Create tree instance with collision data and health
      trees.push({
        id: TreeGenerator.nextTreeId++,
        position: new THREE.Vector3(x, y, z),
        rotation,
        scale,
        height,
        type,
        health: treeHealth,
        maxHealth,
        isChopped: false,
        respawnTime: null,
        trunkRadius,
        trunkHeight,
        foliageRadius,
        foliageBottom,
        foliageTop,
      })
    }

    console.log(`Generated ${trees.length} trees after ${attempts} attempts`)
    return trees
  }
}
