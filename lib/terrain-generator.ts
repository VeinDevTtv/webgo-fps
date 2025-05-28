import { createNoise2D, type NoiseFunction2D } from "simplex-noise"
import * as THREE from "three"

// Terrain generation parameters
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

export class TerrainGenerator {
  private noise2D: NoiseFunction2D
  private params: TerrainParams

  constructor(params: TerrainParams) {
    this.params = {
      seed: params.seed || Math.random().toString(),
      width: params.width || 100,
      depth: params.depth || 100,
      height: params.height || 20,
      scale: params.scale || 50,
      octaves: params.octaves || 6,
      persistence: params.persistence || 0.5,
      lacunarity: params.lacunarity || 2.0,
      heightOffset: params.heightOffset || 0,
      waterLevel: params.waterLevel || 0.3,
    }

    // Initialize noise with seed
    this.noise2D = createNoise2D(() => this.stringToSeed(this.params.seed || "default-seed"))
  }

  // Helper method to convert string seed to number
  private stringToSeed(str: string): number {
    let h = 1779033703 ^ str.length
    for (let i = 0; i < str.length; i++) {
      h = Math.imul(h ^ str.charCodeAt(i), 3432918353)
      h = (h << 13) | (h >>> 19)
    }
    return h
  }

  // Generate a single height map
  generateHeightMap(isVertical = false): number[][] {
    const { width, depth, scale, octaves, persistence, lacunarity } = this.params
    const size = isVertical ? depth : width
    const otherSize = isVertical ? width : depth

    const heightMap: number[][] = []

    for (let i = 0; i < size; i++) {
      heightMap[i] = []
      for (let j = 0; j < otherSize; j++) {
        // Get coordinates based on orientation
        const x = isVertical ? j : i
        const z = isVertical ? i : j

        // Generate noise value
        let amplitude = 1
        let frequency = 1
        let noiseHeight = 0

        for (let o = 0; o < octaves; o++) {
          const sampleX = (x / scale) * frequency
          const sampleZ = (z / scale) * frequency

          // Get noise value
          const noiseValue = this.noise2D(sampleX, sampleZ)
          noiseHeight += noiseValue * amplitude

          // Update amplitude and frequency for next octave
          amplitude *= persistence
          frequency *= lacunarity
        }

        // Normalize to 0-1 range
        noiseHeight = (noiseHeight + 1) / 2
        heightMap[i][j] = noiseHeight
      }
    }

    return heightMap
  }

  // Combine two height maps to create a 3D terrain
  generateTerrain(): THREE.BufferGeometry {
    console.log("Generating terrain geometry...")
    const { width, depth, height, heightOffset } = this.params

    // Generate two perpendicular height maps
    const horizontalMap = this.generateHeightMap(false)
    const verticalMap = this.generateHeightMap(true)

    // Create geometry
    const geometry = new THREE.BufferGeometry()
    const vertices: number[] = []
    const normals: number[] = []
    const uvs: number[] = []
    const indices: number[] = []

    // Generate terrain mesh
    // We'll use a grid of quads (2 triangles each)
    for (let z = 0; z < depth; z++) {
      for (let x = 0; x < width; x++) {
        // Calculate combined height from both maps
        // We average the two height maps to get the final height
        const h1 = horizontalMap[x] ? horizontalMap[x][z] || 0 : 0
        const h2 = verticalMap[z] ? verticalMap[z][x] || 0 : 0

        // Average the heights with a bias toward the higher value
        // This creates more interesting terrain than a simple average
        const combinedHeight = Math.max((h1 + h2) / 2, Math.max(h1, h2) * 0.8)

        // Apply height scale and offset
        const y = combinedHeight * height + heightOffset

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

          // First triangle - FIXED winding order for upward-facing normals
          indices.push(a, c, b)
          // Second triangle - FIXED winding order for upward-facing normals
          indices.push(b, c, d)
        }
      }
    }

    // Set attributes
    geometry.setAttribute("position", new THREE.Float32BufferAttribute(vertices, 3))
    geometry.setAttribute("normal", new THREE.Float32BufferAttribute(normals, 3))
    geometry.setAttribute("uv", new THREE.Float32BufferAttribute(uvs, 2))
    geometry.setIndex(indices)

    // Compute vertex normals for proper lighting
    geometry.computeVertexNormals()

    // Add bottom faces to close the terrain mesh
    this.addBottomFaces(geometry, width, depth, heightOffset - 5)

    // Add side faces to close the terrain mesh
    this.addSideFaces(geometry, width, depth, heightOffset - 5)

    this.flipNormals(geometry)
    console.log("Terrain geometry generated successfully")
    return geometry
  }

  // Flip normals if they're pointing in the wrong direction
  private flipNormals(geometry: THREE.BufferGeometry): void {
    // Get the normal attribute
    const normalAttribute = geometry.getAttribute("normal") as THREE.BufferAttribute

    // Flip all normals
    for (let i = 0; i < normalAttribute.count; i++) {
      normalAttribute.setXYZ(i, -normalAttribute.getX(i), -normalAttribute.getY(i), -normalAttribute.getZ(i))
    }

    // Mark the attribute as needing an update
    normalAttribute.needsUpdate = true

    // Flip the winding order of the triangles
    const index = geometry.getIndex()
    if (index) {
      const indices = index.array
      for (let i = 0; i < indices.length; i += 3) {
        const temp = indices[i + 1]
        indices[i + 1] = indices[i + 2]
        indices[i + 2] = temp
      }
      index.needsUpdate = true
    }
  }

  // Add bottom faces to close the terrain mesh
  private addBottomFaces(geometry: THREE.BufferGeometry, width: number, depth: number, bottomY: number) {
    const positions = geometry.getAttribute("position") as THREE.BufferAttribute
    const normals = geometry.getAttribute("normal") as THREE.BufferAttribute
    const uvs = geometry.getAttribute("uv") as THREE.BufferAttribute
    const indices = geometry.getIndex() as THREE.BufferAttribute

    // Create new arrays to hold the expanded data
    const newPositions = new Float32Array(positions.array.length + width * depth * 3)
    const newNormals = new Float32Array(normals.array.length + width * depth * 3)
    const newUvs = new Float32Array(uvs.array.length + width * depth * 2)

    // Copy existing data
    newPositions.set(positions.array)
    newNormals.set(normals.array)
    newUvs.set(uvs.array)

    // Get the current number of vertices
    const vertexCount = positions.count

    // Add bottom vertices
    for (let z = 0; z < depth; z++) {
      for (let x = 0; x < width; x++) {
        const i = vertexCount + z * width + x
        const idx = i * 3
        const uvIdx = i * 2

        // Get the x and z from the top vertex
        const topIdx = (z * width + x) * 3
        const topX = positions.array[topIdx]
        const topZ = positions.array[topIdx + 2]

        // Add bottom vertex
        newPositions[idx] = topX
        newPositions[idx + 1] = bottomY
        newPositions[idx + 2] = topZ

        // Bottom-facing normal
        newNormals[idx] = 0
        newNormals[idx + 1] = -1
        newNormals[idx + 2] = 0

        // UV coordinates
        newUvs[uvIdx] = x / width
        newUvs[uvIdx + 1] = z / depth
      }
    }

    // Create new indices array including bottom faces
    const newIndicesCount = indices.count + (width - 1) * (depth - 1) * 6
    const newIndices = new Uint32Array(newIndicesCount)
    newIndices.set(indices.array)

    // Add indices for bottom faces
    let indexOffset = indices.count

    for (let z = 0; z < depth - 1; z++) {
      for (let x = 0; x < width - 1; x++) {
        const a = vertexCount + z * width + x
        const b = vertexCount + z * width + x + 1
        const c = vertexCount + (z + 1) * width + x
        const d = vertexCount + (z + 1) * width + x + 1

        // Bottom faces (opposite winding order from top)
        newIndices[indexOffset++] = a
        newIndices[indexOffset++] = c
        newIndices[indexOffset++] = b

        newIndices[indexOffset++] = b
        newIndices[indexOffset++] = c
        newIndices[indexOffset++] = d
      }
    }

    // Update geometry with new data
    geometry.setAttribute("position", new THREE.BufferAttribute(newPositions, 3))
    geometry.setAttribute("normal", new THREE.BufferAttribute(newNormals, 3))
    geometry.setAttribute("uv", new THREE.BufferAttribute(newUvs, 2))
    geometry.setIndex(new THREE.BufferAttribute(newIndices, 1))
  }

  // Add side faces to close the terrain mesh
  private addSideFaces(geometry: THREE.BufferGeometry, width: number, depth: number, bottomY: number) {
    const positions = geometry.getAttribute("position") as THREE.BufferAttribute
    const normals = geometry.getAttribute("normal") as THREE.BufferAttribute
    const uvs = geometry.getAttribute("uv") as THREE.BufferAttribute
    const indices = geometry.getIndex() as THREE.BufferAttribute

    // Calculate how many new vertices we need for the sides
    // We need 4 sides with vertices at top and bottom
    const sideVertexCount = 2 * (width * 2 + depth * 2)

    // Create new arrays to hold the expanded data
    const newPositions = new Float32Array(positions.array.length + sideVertexCount * 3)
    const newNormals = new Float32Array(normals.array.length + sideVertexCount * 3)
    const newUvs = new Float32Array(uvs.array.length + sideVertexCount * 2)

    // Copy existing data
    newPositions.set(positions.array)
    newNormals.set(normals.array)
    newUvs.set(uvs.array)

    // Get the current number of vertices
    const vertexCount = positions.count
    let newVertexIndex = vertexCount

    // Calculate how many new triangles we need
    // Each side has (width or depth) - 1 quads, each with 2 triangles
    const northSideTriangles = (width - 1) * 2
    const southSideTriangles = (width - 1) * 2
    const eastSideTriangles = (depth - 1) * 2
    const westSideTriangles = (depth - 1) * 2
    const totalNewTriangles = northSideTriangles + southSideTriangles + eastSideTriangles + westSideTriangles

    // Create new indices array
    const newIndicesCount = indices.count + totalNewTriangles * 3
    const newIndices = new Uint32Array(newIndicesCount)
    newIndices.set(indices.array)
    let indexOffset = indices.count

    // Add north side (z = 0)
    for (let x = 0; x < width; x++) {
      // Top vertex
      const topIdx = (0 * width + x) * 3
      const topX = positions.array[topIdx]
      const topY = positions.array[topIdx + 1]
      const topZ = positions.array[topIdx + 2]

      // Add top vertex
      const topVertexIdx = newVertexIndex * 3
      newPositions[topVertexIdx] = topX
      newPositions[topVertexIdx + 1] = topY
      newPositions[topVertexIdx + 2] = topZ

      // North-facing normal
      newNormals[topVertexIdx] = 0
      newNormals[topVertexIdx + 1] = 0
      newNormals[topVertexIdx + 2] = -1

      // UV coordinates
      const topUvIdx = newVertexIndex * 2
      newUvs[topUvIdx] = x / width
      newUvs[topUvIdx + 1] = 1

      newVertexIndex++

      // Add bottom vertex
      const bottomVertexIdx = newVertexIndex * 3
      newPositions[bottomVertexIdx] = topX
      newPositions[bottomVertexIdx + 1] = bottomY
      newPositions[bottomVertexIdx + 2] = topZ

      // North-facing normal
      newNormals[bottomVertexIdx] = 0
      newNormals[bottomVertexIdx + 1] = 0
      newNormals[bottomVertexIdx + 2] = -1

      // UV coordinates
      const bottomUvIdx = newVertexIndex * 2
      newUvs[bottomUvIdx] = x / width
      newUvs[bottomUvIdx + 1] = 0

      newVertexIndex++

      // Add triangles
      if (x < width - 1) {
        const a = vertexCount + x * 2
        const b = vertexCount + (x + 1) * 2
        const c = vertexCount + x * 2 + 1
        const d = vertexCount + (x + 1) * 2 + 1

        // First triangle
        newIndices[indexOffset++] = a
        newIndices[indexOffset++] = b
        newIndices[indexOffset++] = c

        // Second triangle
        newIndices[indexOffset++] = c
        newIndices[indexOffset++] = b
        newIndices[indexOffset++] = d
      }
    }

    // Add south side (z = depth - 1)
    const southVertexStart = newVertexIndex
    for (let x = 0; x < width; x++) {
      // Top vertex
      const topIdx = ((depth - 1) * width + x) * 3
      const topX = positions.array[topIdx]
      const topY = positions.array[topIdx + 1]
      const topZ = positions.array[topIdx + 2]

      // Add top vertex
      const topVertexIdx = newVertexIndex * 3
      newPositions[topVertexIdx] = topX
      newPositions[topVertexIdx + 1] = topY
      newPositions[topVertexIdx + 2] = topZ

      // South-facing normal
      newNormals[topVertexIdx] = 0
      newNormals[topVertexIdx + 1] = 0
      newNormals[topVertexIdx + 2] = 1

      // UV coordinates
      const topUvIdx = newVertexIndex * 2
      newUvs[topUvIdx] = x / width
      newUvs[topUvIdx + 1] = 1

      newVertexIndex++

      // Add bottom vertex
      const bottomVertexIdx = newVertexIndex * 3
      newPositions[bottomVertexIdx] = topX
      newPositions[bottomVertexIdx + 1] = bottomY
      newPositions[bottomVertexIdx + 2] = topZ

      // South-facing normal
      newNormals[bottomVertexIdx] = 0
      newNormals[bottomVertexIdx + 1] = 0
      newNormals[bottomVertexIdx + 2] = 1

      // UV coordinates
      const bottomUvIdx = newVertexIndex * 2
      newUvs[bottomUvIdx] = x / width
      newUvs[bottomUvIdx + 1] = 0

      newVertexIndex++

      // Add triangles
      if (x < width - 1) {
        const a = southVertexStart + x * 2
        const b = southVertexStart + (x + 1) * 2
        const c = southVertexStart + x * 2 + 1
        const d = southVertexStart + (x + 1) * 2 + 1

        // First triangle (opposite winding order from north side)
        newIndices[indexOffset++] = b
        newIndices[indexOffset++] = a
        newIndices[indexOffset++] = d

        // Second triangle
        newIndices[indexOffset++] = a
        newIndices[indexOffset++] = c
        newIndices[indexOffset++] = d
      }
    }

    // Add east side (x = width - 1)
    const eastVertexStart = newVertexIndex
    for (let z = 0; z < depth; z++) {
      // Top vertex
      const topIdx = (z * width + (width - 1)) * 3
      const topX = positions.array[topIdx]
      const topY = positions.array[topIdx + 1]
      const topZ = positions.array[topIdx + 2]

      // Add top vertex
      const topVertexIdx = newVertexIndex * 3
      newPositions[topVertexIdx] = topX
      newPositions[topVertexIdx + 1] = topY
      newPositions[topVertexIdx + 2] = topZ

      // East-facing normal
      newNormals[topVertexIdx] = 1
      newNormals[topVertexIdx + 1] = 0
      newNormals[topVertexIdx + 2] = 0

      // UV coordinates
      const topUvIdx = newVertexIndex * 2
      newUvs[topUvIdx] = z / depth
      newUvs[topUvIdx + 1] = 1

      newVertexIndex++

      // Add bottom vertex
      const bottomVertexIdx = newVertexIndex * 3
      newPositions[bottomVertexIdx] = topX
      newPositions[bottomVertexIdx + 1] = bottomY
      newPositions[bottomVertexIdx + 2] = topZ

      // East-facing normal
      newNormals[bottomVertexIdx] = 1
      newNormals[bottomVertexIdx + 1] = 0
      newNormals[bottomVertexIdx + 2] = 0

      // UV coordinates
      const bottomUvIdx = newVertexIndex * 2
      newUvs[bottomUvIdx] = z / depth
      newUvs[bottomUvIdx + 1] = 0

      newVertexIndex++

      // Add triangles
      if (z < depth - 1) {
        const a = eastVertexStart + z * 2
        const b = eastVertexStart + (z + 1) * 2
        const c = eastVertexStart + z * 2 + 1
        const d = eastVertexStart + (z + 1) * 2 + 1

        // First triangle (opposite winding order from west side)
        newIndices[indexOffset++] = b
        newIndices[indexOffset++] = a
        newIndices[indexOffset++] = d

        // Second triangle
        newIndices[indexOffset++] = a
        newIndices[indexOffset++] = c
        newIndices[indexOffset++] = d
      }
    }

    // Add west side (x = 0)
    const westVertexStart = newVertexIndex
    for (let z = 0; z < depth; z++) {
      // Top vertex
      const topIdx = (z * width + 0) * 3
      const topX = positions.array[topIdx]
      const topY = positions.array[topIdx + 1]
      const topZ = positions.array[topIdx + 2]

      // Add top vertex
      const topVertexIdx = newVertexIndex * 3
      newPositions[topVertexIdx] = topX
      newPositions[topVertexIdx + 1] = topY
      newPositions[topVertexIdx + 2] = topZ

      // West-facing normal
      newNormals[topVertexIdx] = -1
      newNormals[topVertexIdx + 1] = 0
      newNormals[topVertexIdx + 2] = 0

      // UV coordinates
      const topUvIdx = newVertexIndex * 2
      newUvs[topUvIdx] = z / depth
      newUvs[topUvIdx + 1] = 1

      newVertexIndex++

      // Add bottom vertex
      const bottomVertexIdx = newVertexIndex * 3
      newPositions[bottomVertexIdx] = topX
      newPositions[bottomVertexIdx + 1] = bottomY
      newPositions[bottomVertexIdx + 2] = topZ

      // West-facing normal
      newNormals[bottomVertexIdx] = -1
      newNormals[bottomVertexIdx + 1] = 0
      newNormals[bottomVertexIdx + 2] = 0

      // UV coordinates
      const bottomUvIdx = newVertexIndex * 2
      newUvs[bottomUvIdx] = z / depth
      newUvs[bottomUvIdx + 1] = 0

      newVertexIndex++

      // Add triangles
      if (z < depth - 1) {
        const a = westVertexStart + z * 2
        const b = westVertexStart + (z + 1) * 2
        const c = westVertexStart + z * 2 + 1
        const d = westVertexStart + (z + 1) * 2 + 1

        // First triangle
        newIndices[indexOffset++] = a
        newIndices[indexOffset++] = b
        newIndices[indexOffset++] = c

        // Second triangle
        newIndices[indexOffset++] = c
        newIndices[indexOffset++] = b
        newIndices[indexOffset++] = d
      }
    }

    // Update geometry with new data
    geometry.setAttribute("position", new THREE.BufferAttribute(newPositions, 3))
    geometry.setAttribute("normal", new THREE.BufferAttribute(newNormals, 3))
    geometry.setAttribute("uv", new THREE.BufferAttribute(newUvs, 2))
    geometry.setIndex(new THREE.BufferAttribute(newIndices, 1))
  }

  // Generate a water plane
  generateWater(): THREE.PlaneGeometry {
    const { width, depth } = this.params
    return new THREE.PlaneGeometry(width, depth)
  }

  // Get terrain data for collision detection
  getTerrainHeightData(): number[][] {
    console.log("Generating terrain height data...")
    const { width, depth, height, heightOffset } = this.params

    // Generate two perpendicular height maps
    const horizontalMap = this.generateHeightMap(false)
    const verticalMap = this.generateHeightMap(true)

    // Combine maps to get height data
    const heightData: number[][] = []

    for (let z = 0; z < depth; z++) {
      heightData[z] = []
      for (let x = 0; x < width; x++) {
        const h1 = horizontalMap[x] ? horizontalMap[x][z] || 0 : 0
        const h2 = verticalMap[z] ? verticalMap[z][x] || 0 : 0

        // Use the same combination method as in generateTerrain
        const combinedHeight = Math.max((h1 + h2) / 2, Math.max(h1, h2) * 0.8)

        heightData[z][x] = combinedHeight * height + heightOffset
      }
    }

    console.log("Terrain height data generated successfully")
    return heightData
  }
}
