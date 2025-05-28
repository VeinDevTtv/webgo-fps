import { createNoise2D, type NoiseFunction2D } from 'simplex-noise'

export interface TerrainParams {
  seed?: string
  width: number
  depth: number
  height: number
  scale: number
  octaves: number
  persistence: number
  lacunarity: number
  heightOffset: number
  waterLevel: number
}

export interface TerrainWorkerMessage {
  type: 'GENERATE_TERRAIN'
  params: TerrainParams
  id: string
}

export interface TerrainWorkerResponse {
  type: 'TERRAIN_GENERATED'
  id: string
  heightMap: number[][]
  vertices: number[]
  indices: number[]
  normals: number[]
  uvs: number[]
}

class TerrainWorker {
  private noise2D: NoiseFunction2D | null = null

  constructor() {
    self.onmessage = (event: MessageEvent<TerrainWorkerMessage>) => {
      this.handleMessage(event.data)
    }
  }

  private handleMessage(message: TerrainWorkerMessage): void {
    switch (message.type) {
      case 'GENERATE_TERRAIN':
        this.generateTerrain(message.params, message.id)
        break
    }
  }

  private stringToSeed(str: string): number {
    let h = 1779033703 ^ str.length
    for (let i = 0; i < str.length; i++) {
      h = Math.imul(h ^ str.charCodeAt(i), 3432918353)
      h = (h << 13) | (h >>> 19)
    }
    return h
  }

  private generateHeightMap(params: TerrainParams): number[][] {
    // Initialize noise with seed
    this.noise2D = createNoise2D(() => this.stringToSeed(params.seed || 'default-seed'))

    const { width, depth, scale, octaves, persistence, lacunarity } = params
    const heightMap: number[][] = []

    for (let x = 0; x < width; x++) {
      heightMap[x] = []
      for (let z = 0; z < depth; z++) {
        let amplitude = 1
        let frequency = 1
        let noiseHeight = 0

        for (let o = 0; o < octaves; o++) {
          const sampleX = (x / scale) * frequency
          const sampleZ = (z / scale) * frequency

          const noiseValue = this.noise2D!(sampleX, sampleZ)
          noiseHeight += noiseValue * amplitude

          amplitude *= persistence
          frequency *= lacunarity
        }

        // Normalize to 0-1 range
        noiseHeight = (noiseHeight + 1) / 2
        heightMap[x][z] = noiseHeight
      }
    }

    return heightMap
  }

  private generateTerrain(params: TerrainParams, id: string): void {
    const { width, depth, height, heightOffset } = params

    // Generate height map
    const heightMap = this.generateHeightMap(params)

    // Generate mesh data
    const vertices: number[] = []
    const normals: number[] = []
    const uvs: number[] = []
    const indices: number[] = []

    // Generate terrain mesh
    for (let z = 0; z < depth; z++) {
      for (let x = 0; x < width; x++) {
        const heightValue = heightMap[x][z]
        const y = heightValue * height + heightOffset

        // Add vertex
        vertices.push(x - width / 2, y, z - depth / 2)

        // Simple normal (will be recalculated later)
        normals.push(0, 1, 0)

        // UV coordinates
        uvs.push(x / width, z / depth)

        // Add indices for triangles (2 per quad)
        if (x < width - 1 && z < depth - 1) {
          const a = z * width + x
          const b = z * width + x + 1
          const c = (z + 1) * width + x
          const d = (z + 1) * width + x + 1

          // First triangle
          indices.push(a, c, b)
          // Second triangle
          indices.push(b, c, d)
        }
      }
    }

    // Calculate proper normals
    this.calculateNormals(vertices, indices, normals)

    // Send result back to main thread
    const response: TerrainWorkerResponse = {
      type: 'TERRAIN_GENERATED',
      id,
      heightMap,
      vertices,
      indices,
      normals,
      uvs,
    }

    self.postMessage(response)
  }

  private calculateNormals(vertices: number[], indices: number[], normals: number[]): void {
    // Reset normals
    for (let i = 0; i < normals.length; i++) {
      normals[i] = 0
    }

    // Calculate face normals and accumulate
    for (let i = 0; i < indices.length; i += 3) {
      const i1 = indices[i] * 3
      const i2 = indices[i + 1] * 3
      const i3 = indices[i + 2] * 3

      const v1 = [vertices[i1], vertices[i1 + 1], vertices[i1 + 2]]
      const v2 = [vertices[i2], vertices[i2 + 1], vertices[i2 + 2]]
      const v3 = [vertices[i3], vertices[i3 + 1], vertices[i3 + 2]]

      // Calculate face normal
      const edge1 = [v2[0] - v1[0], v2[1] - v1[1], v2[2] - v1[2]]
      const edge2 = [v3[0] - v1[0], v3[1] - v1[1], v3[2] - v1[2]]

      const normal = [
        edge1[1] * edge2[2] - edge1[2] * edge2[1],
        edge1[2] * edge2[0] - edge1[0] * edge2[2],
        edge1[0] * edge2[1] - edge1[1] * edge2[0],
      ]

      // Accumulate normals for each vertex
      normals[i1] += normal[0]
      normals[i1 + 1] += normal[1]
      normals[i1 + 2] += normal[2]

      normals[i2] += normal[0]
      normals[i2 + 1] += normal[1]
      normals[i2 + 2] += normal[2]

      normals[i3] += normal[0]
      normals[i3 + 1] += normal[1]
      normals[i3 + 2] += normal[2]
    }

    // Normalize all normals
    for (let i = 0; i < normals.length; i += 3) {
      const length = Math.sqrt(
        normals[i] * normals[i] + 
        normals[i + 1] * normals[i + 1] + 
        normals[i + 2] * normals[i + 2]
      )

      if (length > 0) {
        normals[i] /= length
        normals[i + 1] /= length
        normals[i + 2] /= length
      }
    }
  }
}

// Initialize the worker
new TerrainWorker() 