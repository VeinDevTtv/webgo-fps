import * as THREE from 'three'
import { GAME_CONFIG } from '@/lib/config/game-config'
import type { TerrainParams, TerrainWorkerMessage, TerrainWorkerResponse } from '../workers/terrain-worker'

export interface TerrainChunk {
  id: string
  position: { x: number, z: number }
  geometry: THREE.BufferGeometry | null
  mesh: THREE.Mesh | null
  heightMap: number[][] | null
  isLoading: boolean
  isGenerated: boolean
}

export class TerrainManager {
  private worker: Worker | null = null
  private chunks: Map<string, TerrainChunk> = new Map()
  private pendingRequests: Map<string, (chunk: TerrainChunk) => void> = new Map()
  private scene: THREE.Scene
  private material: THREE.Material

  constructor(scene: THREE.Scene) {
    this.scene = scene
    this.material = new THREE.MeshLambertMaterial({ 
      color: 0x4a5d23,
      wireframe: false 
    })
    
    this.initializeWorker()
  }

  private initializeWorker(): void {
    try {
      // Create worker from the terrain worker file
      this.worker = new Worker(new URL('../workers/terrain-worker.ts', import.meta.url))
      
      this.worker.onmessage = (event: MessageEvent<TerrainWorkerResponse>) => {
        this.handleWorkerMessage(event.data)
      }

      this.worker.onerror = (error) => {
        console.error('Terrain worker error:', error)
        // Fallback to main thread generation if worker fails
        this.worker = null
      }
    } catch (error) {
      console.warn('Failed to create terrain worker, falling back to main thread:', error)
      this.worker = null
    }
  }

  private handleWorkerMessage(response: TerrainWorkerResponse): void {
    if (response.type === 'TERRAIN_GENERATED') {
      const chunk = this.chunks.get(response.id)
      if (chunk) {
        this.createChunkGeometry(chunk, response)
        
        // Resolve any pending promises
        const resolver = this.pendingRequests.get(response.id)
        if (resolver) {
          resolver(chunk)
          this.pendingRequests.delete(response.id)
        }
      }
    }
  }

  private createChunkGeometry(chunk: TerrainChunk, data: TerrainWorkerResponse): void {
    // Create Three.js geometry from worker data
    const geometry = new THREE.BufferGeometry()
    
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(data.vertices, 3))
    geometry.setAttribute('normal', new THREE.Float32BufferAttribute(data.normals, 3))
    geometry.setAttribute('uv', new THREE.Float32BufferAttribute(data.uvs, 2))
    geometry.setIndex(data.indices)

    // Create mesh
    const mesh = new THREE.Mesh(geometry, this.material)
    mesh.position.set(
      chunk.position.x * GAME_CONFIG.PERFORMANCE.CHUNK_SIZE,
      0,
      chunk.position.z * GAME_CONFIG.PERFORMANCE.CHUNK_SIZE
    )

    // Update chunk
    chunk.geometry = geometry
    chunk.mesh = mesh
    chunk.heightMap = data.heightMap
    chunk.isLoading = false
    chunk.isGenerated = true

    // Add to scene
    this.scene.add(mesh)
  }

  public async generateChunk(chunkX: number, chunkZ: number): Promise<TerrainChunk> {
    const chunkId = `${chunkX}_${chunkZ}`
    
    // Check if chunk already exists
    let chunk = this.chunks.get(chunkId)
    if (chunk) {
      if (chunk.isGenerated) {
        return chunk
      }
      if (chunk.isLoading) {
        // Return existing promise
        return new Promise((resolve) => {
          this.pendingRequests.set(chunkId, resolve)
        })
      }
    }

    // Create new chunk
    chunk = {
      id: chunkId,
      position: { x: chunkX, z: chunkZ },
      geometry: null,
      mesh: null,
      heightMap: null,
      isLoading: true,
      isGenerated: false,
    }

    this.chunks.set(chunkId, chunk)

    // Generate terrain
    if (this.worker) {
      // Use worker for generation
      const params: TerrainParams = {
        seed: `chunk_${chunkX}_${chunkZ}`,
        width: GAME_CONFIG.PERFORMANCE.CHUNK_SIZE,
        depth: GAME_CONFIG.PERFORMANCE.CHUNK_SIZE,
        height: GAME_CONFIG.TERRAIN.DEFAULT_PARAMS.HEIGHT,
        scale: GAME_CONFIG.TERRAIN.DEFAULT_PARAMS.SCALE,
        octaves: GAME_CONFIG.TERRAIN.DEFAULT_PARAMS.OCTAVES,
        persistence: GAME_CONFIG.TERRAIN.DEFAULT_PARAMS.PERSISTENCE,
        lacunarity: GAME_CONFIG.TERRAIN.DEFAULT_PARAMS.LACUNARITY,
        heightOffset: GAME_CONFIG.TERRAIN.DEFAULT_PARAMS.HEIGHT_OFFSET,
        waterLevel: GAME_CONFIG.TERRAIN.DEFAULT_PARAMS.WATER_LEVEL,
      }

      const message: TerrainWorkerMessage = {
        type: 'GENERATE_TERRAIN',
        params,
        id: chunkId,
      }

      this.worker.postMessage(message)

      // Return promise that resolves when worker completes
      return new Promise((resolve) => {
        this.pendingRequests.set(chunkId, resolve)
      })
    } else {
      // Fallback to main thread generation
      return this.generateChunkMainThread(chunk)
    }
  }

  private async generateChunkMainThread(chunk: TerrainChunk): Promise<TerrainChunk> {
    // Simple fallback terrain generation on main thread
    const size = GAME_CONFIG.PERFORMANCE.CHUNK_SIZE
    const geometry = new THREE.PlaneGeometry(size, size, size - 1, size - 1)
    
    // Add some basic height variation
    const positions = geometry.attributes.position.array as Float32Array
    for (let i = 1; i < positions.length; i += 3) {
      positions[i] = Math.random() * 2 - 1 // Random height between -1 and 1
    }
    
    geometry.computeVertexNormals()

    const mesh = new THREE.Mesh(geometry, this.material)
    mesh.rotation.x = -Math.PI / 2 // Rotate to be horizontal
    mesh.position.set(
      chunk.position.x * size,
      0,
      chunk.position.z * size
    )

    chunk.geometry = geometry
    chunk.mesh = mesh
    chunk.heightMap = [] // Empty height map for fallback
    chunk.isLoading = false
    chunk.isGenerated = true

    this.scene.add(mesh)
    return chunk
  }

  public getHeightAtPosition(x: number, z: number): number {
    // Determine which chunk contains this position
    const chunkX = Math.floor(x / GAME_CONFIG.PERFORMANCE.CHUNK_SIZE)
    const chunkZ = Math.floor(z / GAME_CONFIG.PERFORMANCE.CHUNK_SIZE)
    const chunkId = `${chunkX}_${chunkZ}`
    
    const chunk = this.chunks.get(chunkId)
    if (!chunk || !chunk.heightMap) {
      return 0 // Default ground level
    }

    // Convert world position to local chunk position
    const localX = x - (chunkX * GAME_CONFIG.PERFORMANCE.CHUNK_SIZE)
    const localZ = z - (chunkZ * GAME_CONFIG.PERFORMANCE.CHUNK_SIZE)

    // Sample height map
    const gridX = Math.floor(localX + GAME_CONFIG.PERFORMANCE.CHUNK_SIZE / 2)
    const gridZ = Math.floor(localZ + GAME_CONFIG.PERFORMANCE.CHUNK_SIZE / 2)

    if (gridX >= 0 && gridX < chunk.heightMap.length && 
        gridZ >= 0 && gridZ < chunk.heightMap[0].length) {
      return chunk.heightMap[gridX][gridZ] * GAME_CONFIG.TERRAIN.DEFAULT_PARAMS.HEIGHT
    }

    return 0
  }

  public updateChunksAroundPlayer(playerX: number, playerZ: number, renderDistance: number): void {
    const chunkSize = GAME_CONFIG.PERFORMANCE.CHUNK_SIZE
    const chunksToLoad = Math.ceil(renderDistance / chunkSize)
    
    const playerChunkX = Math.floor(playerX / chunkSize)
    const playerChunkZ = Math.floor(playerZ / chunkSize)

    // Generate chunks around player
    for (let x = playerChunkX - chunksToLoad; x <= playerChunkX + chunksToLoad; x++) {
      for (let z = playerChunkZ - chunksToLoad; z <= playerChunkZ + chunksToLoad; z++) {
        const distance = Math.sqrt((x - playerChunkX) ** 2 + (z - playerChunkZ) ** 2)
        if (distance <= chunksToLoad) {
          this.generateChunk(x, z).catch(console.error)
        }
      }
    }

    // Unload distant chunks
    for (const [chunkId, chunk] of this.chunks) {
      const [chunkX, chunkZ] = chunkId.split('_').map(Number)
      const distance = Math.sqrt((chunkX - playerChunkX) ** 2 + (chunkZ - playerChunkZ) ** 2)
      
      if (distance > chunksToLoad + 1) {
        this.unloadChunk(chunkId)
      }
    }
  }

  private unloadChunk(chunkId: string): void {
    const chunk = this.chunks.get(chunkId)
    if (chunk) {
      // Remove mesh from scene
      if (chunk.mesh) {
        this.scene.remove(chunk.mesh)
      }
      
      // Dispose geometry
      if (chunk.geometry) {
        chunk.geometry.dispose()
      }
      
      // Remove from chunks map
      this.chunks.delete(chunkId)
    }
  }

  public dispose(): void {
    // Clean up worker
    if (this.worker) {
      this.worker.terminate()
      this.worker = null
    }

    // Clean up all chunks
    for (const chunkId of this.chunks.keys()) {
      this.unloadChunk(chunkId)
    }

    // Dispose material
    this.material.dispose()
  }
} 