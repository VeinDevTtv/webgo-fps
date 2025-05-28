import * as THREE from 'three'
import { GAME_CONFIG } from '@/lib/config/game-config'

export interface CollisionObject {
  id: string
  type: 'tree' | 'stone' | 'building' | 'enemy' | 'loot'
  position: THREE.Vector3
  boundingBox?: THREE.Box3
  boundingSphere?: THREE.Sphere
  isStatic: boolean
  canStandOn?: boolean
  height?: number
}

export interface CollisionResult {
  hasCollision: boolean
  normal: THREE.Vector3
  penetration: number
  contactPoint: THREE.Vector3
  object?: CollisionObject
}

export interface SlopeInfo {
  isOnSlope: boolean
  slopeAngle: number
  slopeNormal: THREE.Vector3
  shouldSlide: boolean
}

export class EnhancedCollisionSystem {
  private collisionObjects: Map<string, CollisionObject> = new Map()
  private spatialGrid: Map<string, Set<string>> = new Map()
  private gridSize = GAME_CONFIG.PERFORMANCE.CHUNK_SIZE

  constructor() {
    console.log('Enhanced Collision System initialized')
  }

  // Add collision object to the system
  public addCollisionObject(object: CollisionObject): void {
    this.collisionObjects.set(object.id, object)
    this.updateSpatialGrid(object)
  }

  // Remove collision object from the system
  public removeCollisionObject(id: string): void {
    const object = this.collisionObjects.get(id)
    if (object) {
      this.removeFromSpatialGrid(object)
      this.collisionObjects.delete(id)
    }
  }

  // Update collision object position
  public updateCollisionObject(id: string, position: THREE.Vector3): void {
    const object = this.collisionObjects.get(id)
    if (object) {
      this.removeFromSpatialGrid(object)
      object.position.copy(position)
      this.updateBounds(object)
      this.updateSpatialGrid(object)
    }
  }

  // Check collision for a sphere (player)
  public checkSphereCollision(
    position: THREE.Vector3,
    radius: number,
    excludeIds: string[] = []
  ): CollisionResult {
    const playerSphere = new THREE.Sphere(position, radius)
    const nearbyObjects = this.getNearbyObjects(position)

    for (const objectId of nearbyObjects) {
      if (excludeIds.includes(objectId)) continue

      const object = this.collisionObjects.get(objectId)
      if (!object) continue

      const collision = this.checkSphereObjectCollision(playerSphere, object)
      if (collision.hasCollision) {
        return collision
      }
    }

    return {
      hasCollision: false,
      normal: new THREE.Vector3(),
      penetration: 0,
      contactPoint: new THREE.Vector3(),
    }
  }

  // Check if player can stand on surface at position
  public checkGroundCollision(
    position: THREE.Vector3,
    radius: number,
    terrainHeightData: number[][]
  ): { isGrounded: boolean; height: number; slopeInfo: SlopeInfo } {
    const terrainHeight = this.getTerrainHeight(position.x, position.z, terrainHeightData)
    const terrainNormal = this.getTerrainNormal(position.x, position.z, terrainHeightData)
    
    // Check terrain slope
    const slopeInfo = this.calculateSlopeInfo(terrainNormal)
    
    // Check for objects player can stand on
    const nearbyObjects = this.getNearbyObjects(position)
    let maxHeight = terrainHeight
    let standingOnObject = false

    for (const objectId of nearbyObjects) {
      const object = this.collisionObjects.get(objectId)
      if (!object || !object.canStandOn) continue

      const objectTop = this.getObjectTopHeight(object, position)
      if (objectTop > maxHeight && this.canStandOnObject(position, radius, object)) {
        maxHeight = objectTop
        standingOnObject = true
      }
    }

    const playerBottom = position.y - GAME_CONFIG.PLAYER.HEIGHT
    const groundTolerance = GAME_CONFIG.COLLISION.GROUND_TOLERANCE
    const isGrounded = playerBottom <= maxHeight + groundTolerance

    return {
      isGrounded,
      height: maxHeight,
      slopeInfo: standingOnObject ? { isOnSlope: false, slopeAngle: 0, slopeNormal: new THREE.Vector3(0, 1, 0), shouldSlide: false } : slopeInfo,
    }
  }

  // Resolve collision by moving object out of collision
  public resolveCollision(
    position: THREE.Vector3,
    radius: number,
    velocity: THREE.Vector3,
    excludeIds: string[] = []
  ): { newPosition: THREE.Vector3; newVelocity: THREE.Vector3; collisionOccurred: boolean } {
    let currentPosition = position.clone()
    let currentVelocity = velocity.clone()
    let collisionOccurred = false

    for (let i = 0; i < GAME_CONFIG.COLLISION.MAX_COLLISION_ITERATIONS; i++) {
      const collision = this.checkSphereCollision(currentPosition, radius, excludeIds)
      
      if (!collision.hasCollision) break

      collisionOccurred = true

      // Move object out of collision
      const separationDistance = radius + collision.penetration + 0.01
      const separationVector = collision.normal.clone().multiplyScalar(separationDistance)
      currentPosition.add(separationVector)

      // Apply bounce/slide physics
      const velocityDotNormal = currentVelocity.dot(collision.normal)
      if (velocityDotNormal < 0) {
        // Remove velocity component in collision direction
        const normalVelocity = collision.normal.clone().multiplyScalar(velocityDotNormal)
        currentVelocity.sub(normalVelocity)
        
        // Apply damping
        currentVelocity.multiplyScalar(GAME_CONFIG.COLLISION.BOUNCE_DAMPING)
      }
    }

    return {
      newPosition: currentPosition,
      newVelocity: currentVelocity,
      collisionOccurred,
    }
  }

  // Apply slope physics
  public applySlopePhysics(
    position: THREE.Vector3,
    velocity: THREE.Vector3,
    slopeInfo: SlopeInfo,
    deltaTime: number
  ): THREE.Vector3 {
    if (!slopeInfo.isOnSlope || !slopeInfo.shouldSlide) {
      return velocity
    }

    // Calculate slide direction (down the slope)
    const slideDirection = new THREE.Vector3()
    slideDirection.copy(slopeInfo.slopeNormal)
    slideDirection.y = 0
    slideDirection.normalize()

    // Apply gravity along slope
    const slopeGravity = GAME_CONFIG.PLAYER.GRAVITY * Math.sin(slopeInfo.slopeAngle)
    const slideForce = slideDirection.multiplyScalar(slopeGravity * deltaTime)

    // Apply friction
    const friction = GAME_CONFIG.COLLISION.SLIDE_FRICTION
    velocity.multiplyScalar(1 - friction * deltaTime)

    // Add slide force
    velocity.add(slideForce)

    return velocity
  }

  // Get all collision objects in area
  public getObjectsInArea(center: THREE.Vector3, radius: number): CollisionObject[] {
    const nearbyIds = this.getNearbyObjects(center, radius)
    return Array.from(nearbyIds)
      .map(id => this.collisionObjects.get(id))
      .filter(obj => obj !== undefined) as CollisionObject[]
  }

  // Private helper methods
  private updateSpatialGrid(object: CollisionObject): void {
    const gridKeys = this.getGridKeys(object.position)
    for (const key of gridKeys) {
      if (!this.spatialGrid.has(key)) {
        this.spatialGrid.set(key, new Set())
      }
      this.spatialGrid.get(key)!.add(object.id)
    }
  }

  private removeFromSpatialGrid(object: CollisionObject): void {
    const gridKeys = this.getGridKeys(object.position)
    for (const key of gridKeys) {
      const cell = this.spatialGrid.get(key)
      if (cell) {
        cell.delete(object.id)
        if (cell.size === 0) {
          this.spatialGrid.delete(key)
        }
      }
    }
  }

  private getGridKeys(position: THREE.Vector3): string[] {
    const x = Math.floor(position.x / this.gridSize)
    const z = Math.floor(position.z / this.gridSize)
    
    // Return keys for current cell and adjacent cells
    const keys: string[] = []
    for (let dx = -1; dx <= 1; dx++) {
      for (let dz = -1; dz <= 1; dz++) {
        keys.push(`${x + dx},${z + dz}`)
      }
    }
    return keys
  }

  private getNearbyObjects(position: THREE.Vector3, radius: number = this.gridSize): Set<string> {
    const gridKeys = this.getGridKeys(position)
    const nearbyObjects = new Set<string>()

    for (const key of gridKeys) {
      const cell = this.spatialGrid.get(key)
      if (cell) {
        for (const objectId of cell) {
          nearbyObjects.add(objectId)
        }
      }
    }

    return nearbyObjects
  }

  private checkSphereObjectCollision(sphere: THREE.Sphere, object: CollisionObject): CollisionResult {
    if (object.boundingSphere) {
      return this.checkSphereSphereCollision(sphere, object.boundingSphere, object)
    } else if (object.boundingBox) {
      return this.checkSphereBoxCollision(sphere, object.boundingBox, object)
    }

    // Fallback to simple distance check
    const distance = sphere.center.distanceTo(object.position)
    const minDistance = sphere.radius + 1.0 // Default object radius

    if (distance < minDistance) {
      const normal = sphere.center.clone().sub(object.position).normalize()
      return {
        hasCollision: true,
        normal,
        penetration: minDistance - distance,
        contactPoint: object.position.clone().add(normal.clone().multiplyScalar(1.0)),
        object,
      }
    }

    return {
      hasCollision: false,
      normal: new THREE.Vector3(),
      penetration: 0,
      contactPoint: new THREE.Vector3(),
    }
  }

  private checkSphereSphereCollision(sphere1: THREE.Sphere, sphere2: THREE.Sphere, object: CollisionObject): CollisionResult {
    const distance = sphere1.center.distanceTo(sphere2.center)
    const minDistance = sphere1.radius + sphere2.radius

    if (distance < minDistance) {
      const normal = sphere1.center.clone().sub(sphere2.center).normalize()
      return {
        hasCollision: true,
        normal,
        penetration: minDistance - distance,
        contactPoint: sphere2.center.clone().add(normal.clone().multiplyScalar(sphere2.radius)),
        object,
      }
    }

    return {
      hasCollision: false,
      normal: new THREE.Vector3(),
      penetration: 0,
      contactPoint: new THREE.Vector3(),
    }
  }

  private checkSphereBoxCollision(sphere: THREE.Sphere, box: THREE.Box3, object: CollisionObject): CollisionResult {
    const closestPoint = box.clampPoint(sphere.center, new THREE.Vector3())
    const distance = sphere.center.distanceTo(closestPoint)

    if (distance < sphere.radius) {
      const normal = sphere.center.clone().sub(closestPoint).normalize()
      return {
        hasCollision: true,
        normal,
        penetration: sphere.radius - distance,
        contactPoint: closestPoint,
        object,
      }
    }

    return {
      hasCollision: false,
      normal: new THREE.Vector3(),
      penetration: 0,
      contactPoint: new THREE.Vector3(),
    }
  }

  private updateBounds(object: CollisionObject): void {
    // Update bounding volumes based on object type
    switch (object.type) {
      case 'tree':
        const treeRadius = 0.5 * GAME_CONFIG.COLLISION.TREE_COLLISION_MULTIPLIER
        object.boundingSphere = new THREE.Sphere(object.position, treeRadius)
        object.canStandOn = true
        object.height = 8.0 // Approximate tree height
        break

      case 'stone':
        const stoneRadius = 0.8 * GAME_CONFIG.COLLISION.STONE_COLLISION_MULTIPLIER
        object.boundingSphere = new THREE.Sphere(object.position, stoneRadius)
        object.canStandOn = true
        object.height = 1.5 // Approximate stone height
        break

      case 'building':
        // Buildings use box collision
        const size = new THREE.Vector3(2, 3, 0.2) // Default wall size
        const halfSize = size.clone().multiplyScalar(0.5)
        object.boundingBox = new THREE.Box3(
          object.position.clone().sub(halfSize),
          object.position.clone().add(halfSize)
        )
        object.canStandOn = false
        break

      case 'enemy':
        object.boundingSphere = new THREE.Sphere(object.position, GAME_CONFIG.COLLISION.PLAYER_RADIUS)
        object.canStandOn = false
        break

      case 'loot':
        object.boundingSphere = new THREE.Sphere(object.position, 0.3)
        object.canStandOn = false
        break
    }
  }

  private getTerrainHeight(x: number, z: number, terrainHeightData: number[][]): number {
    if (!terrainHeightData || terrainHeightData.length === 0) return 0

    const terrainSize = terrainHeightData.length
    const halfSize = terrainSize / 2

    const gridX = x + halfSize
    const gridZ = z + halfSize

    const x0 = Math.floor(gridX)
    const z0 = Math.floor(gridZ)
    const x1 = Math.min(x0 + 1, terrainSize - 1)
    const z1 = Math.min(z0 + 1, terrainSize - 1)

    if (x0 < 0 || x0 >= terrainSize || z0 < 0 || z0 >= terrainSize) return 0

    const fx = gridX - x0
    const fz = gridZ - z0

    const h00 = terrainHeightData[z0]?.[x0] || 0
    const h10 = terrainHeightData[z0]?.[x1] || 0
    const h01 = terrainHeightData[z1]?.[x0] || 0
    const h11 = terrainHeightData[z1]?.[x1] || 0

    const h0 = h00 * (1 - fx) + h10 * fx
    const h1 = h01 * (1 - fx) + h11 * fx

    return h0 * (1 - fz) + h1 * fz
  }

  private getTerrainNormal(x: number, z: number, terrainHeightData: number[][]): THREE.Vector3 {
    const offset = 0.1
    const h1 = this.getTerrainHeight(x - offset, z, terrainHeightData)
    const h2 = this.getTerrainHeight(x + offset, z, terrainHeightData)
    const h3 = this.getTerrainHeight(x, z - offset, terrainHeightData)
    const h4 = this.getTerrainHeight(x, z + offset, terrainHeightData)

    const normal = new THREE.Vector3(
      (h1 - h2) / (2 * offset),
      1,
      (h3 - h4) / (2 * offset)
    )

    return normal.normalize()
  }

  private calculateSlopeInfo(normal: THREE.Vector3): SlopeInfo {
    const upVector = new THREE.Vector3(0, 1, 0)
    const slopeAngle = Math.acos(normal.dot(upVector))
    const isOnSlope = slopeAngle > 0.1 // Small threshold to avoid floating point issues
    const shouldSlide = slopeAngle > GAME_CONFIG.COLLISION.SLOPE_LIMIT

    return {
      isOnSlope,
      slopeAngle,
      slopeNormal: normal,
      shouldSlide,
    }
  }

  private getObjectTopHeight(object: CollisionObject, position: THREE.Vector3): number {
    if (!object.height) return object.position.y

    // For objects with height, return the top surface
    return object.position.y + object.height
  }

  private canStandOnObject(position: THREE.Vector3, radius: number, object: CollisionObject): boolean {
    if (!object.canStandOn || !object.height) return false

    // Check if player is above the object
    const objectTop = this.getObjectTopHeight(object, position)
    const playerBottom = position.y - GAME_CONFIG.PLAYER.HEIGHT
    
    // Check horizontal distance
    const horizontalDistance = new THREE.Vector2(position.x - object.position.x, position.z - object.position.z).length()
    const maxDistance = radius + (object.boundingSphere?.radius || 1.0)

    return horizontalDistance <= maxDistance && 
           Math.abs(playerBottom - objectTop) <= GAME_CONFIG.COLLISION.GROUND_TOLERANCE
  }

  // Debug methods
  public getDebugInfo(): any {
    return {
      totalObjects: this.collisionObjects.size,
      gridCells: this.spatialGrid.size,
      objectsByType: this.getObjectCountByType(),
    }
  }

  private getObjectCountByType(): Record<string, number> {
    const counts: Record<string, number> = {}
    for (const object of this.collisionObjects.values()) {
      counts[object.type] = (counts[object.type] || 0) + 1
    }
    return counts
  }

  public dispose(): void {
    this.collisionObjects.clear()
    this.spatialGrid.clear()
  }
} 