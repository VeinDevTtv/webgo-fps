import * as THREE from 'three'
import { GAME_CONFIG } from '@/lib/config/game-config'

export interface BuildingData {
  id: string
  type: 'storage_box' | 'wall' | 'door' | 'foundation'
  position: THREE.Vector3
  rotation: THREE.Euler
  dimensions: { width: number; height: number; depth: number }
  cost: Record<string, number>
  placedAt: number
  ownerId?: string
}

export interface BuildingTemplate {
  type: string
  name: string
  dimensions: { width: number; height: number; depth: number }
  cost: Record<string, number>
  snapToGrid: boolean
  icon: string
  description: string
}

export interface PlacementValidation {
  isValid: boolean
  reason?: string
  snappedPosition: THREE.Vector3
  snappedRotation: THREE.Euler
}

export interface GhostPreview {
  mesh: THREE.Mesh | null
  isVisible: boolean
  isValid: boolean
}

export class BuildingSystem {
  private buildings: Map<string, BuildingData> = new Map()
  private buildingTemplates: Map<string, BuildingTemplate> = new Map()
  private ghostPreview: GhostPreview = { mesh: null, isVisible: false, isValid: false }
  private scene: THREE.Scene
  private camera: THREE.Camera
  
  private onBuildingPlace?: (building: BuildingData) => void
  private onBuildingRemove?: (buildingId: string) => void
  private onValidationChange?: (isValid: boolean, reason?: string) => void

  constructor(scene: THREE.Scene, camera: THREE.Camera) {
    this.scene = scene
    this.camera = camera
    this.initializeBuildingTemplates()
  }

  private initializeBuildingTemplates(): void {
    // Storage Box
    this.buildingTemplates.set('storage_box', {
      type: 'storage_box',
      name: 'Storage Box',
      dimensions: {
        width: GAME_CONFIG.BUILDING.STORAGE_BOX.WIDTH,
        height: GAME_CONFIG.BUILDING.STORAGE_BOX.HEIGHT,
        depth: GAME_CONFIG.BUILDING.STORAGE_BOX.DEPTH,
      },
      cost: GAME_CONFIG.BUILDING.STORAGE_BOX.COST,
      snapToGrid: GAME_CONFIG.BUILDING.STORAGE_BOX.SNAP_TO_GRID,
      icon: '📦',
      description: 'Store items safely',
    })

    // Wall
    this.buildingTemplates.set('wall', {
      type: 'wall',
      name: 'Wall',
      dimensions: {
        width: GAME_CONFIG.BUILDING.WALL.WIDTH,
        height: GAME_CONFIG.BUILDING.WALL.HEIGHT,
        depth: GAME_CONFIG.BUILDING.WALL.DEPTH,
      },
      cost: GAME_CONFIG.BUILDING.WALL.COST,
      snapToGrid: GAME_CONFIG.BUILDING.WALL.SNAP_TO_GRID,
      icon: '🧱',
      description: 'Defensive barrier',
    })

    // Door
    this.buildingTemplates.set('door', {
      type: 'door',
      name: 'Door',
      dimensions: {
        width: GAME_CONFIG.BUILDING.DOOR.WIDTH,
        height: GAME_CONFIG.BUILDING.DOOR.HEIGHT,
        depth: GAME_CONFIG.BUILDING.DOOR.DEPTH,
      },
      cost: GAME_CONFIG.BUILDING.DOOR.COST,
      snapToGrid: GAME_CONFIG.BUILDING.DOOR.SNAP_TO_GRID,
      icon: '🚪',
      description: 'Entrance/exit',
    })

    // Foundation
    this.buildingTemplates.set('foundation', {
      type: 'foundation',
      name: 'Foundation',
      dimensions: {
        width: GAME_CONFIG.BUILDING.FOUNDATION.WIDTH,
        height: GAME_CONFIG.BUILDING.FOUNDATION.HEIGHT,
        depth: GAME_CONFIG.BUILDING.FOUNDATION.DEPTH,
      },
      cost: GAME_CONFIG.BUILDING.FOUNDATION.COST,
      snapToGrid: GAME_CONFIG.BUILDING.FOUNDATION.SNAP_TO_GRID,
      icon: '🏗️',
      description: 'Building foundation',
    })
  }

  public getBuildingTemplates(): BuildingTemplate[] {
    return Array.from(this.buildingTemplates.values())
  }

  public getBuildingTemplate(type: string): BuildingTemplate | null {
    return this.buildingTemplates.get(type) || null
  }

  public snapToGrid(position: THREE.Vector3): THREE.Vector3 {
    const gridSize = GAME_CONFIG.BUILDING.GRID_SIZE
    return new THREE.Vector3(
      Math.round(position.x / gridSize) * gridSize,
      position.y, // Don't snap Y to allow for terrain following
      Math.round(position.z / gridSize) * gridSize
    )
  }

  public validatePlacement(
    buildingType: string,
    position: THREE.Vector3,
    rotation: THREE.Euler,
    playerPosition: THREE.Vector3,
    terrainHeight: number
  ): PlacementValidation {
    const template = this.getBuildingTemplate(buildingType)
    if (!template) {
      return {
        isValid: false,
        reason: 'Invalid building type',
        snappedPosition: position.clone(),
        snappedRotation: rotation.clone(),
      }
    }

    // Snap to grid if required
    let snappedPosition = template.snapToGrid ? this.snapToGrid(position) : position.clone()
    
    // Adjust for terrain height
    snappedPosition.y = terrainHeight

    const snappedRotation = rotation.clone()

    // Check distance from player
    const distance = playerPosition.distanceTo(snappedPosition)
    if (distance > GAME_CONFIG.BUILDING.MAX_PLACEMENT_DISTANCE) {
      return {
        isValid: false,
        reason: 'Too far from player',
        snappedPosition,
        snappedRotation,
      }
    }

    // Check for collisions with existing buildings
    const boundingBox = this.createBoundingBox(snappedPosition, template.dimensions, snappedRotation)
    
    for (const [id, building] of this.buildings) {
      const existingBoundingBox = this.createBoundingBox(
        building.position,
        building.dimensions,
        building.rotation
      )
      
      if (boundingBox.intersectsBox(existingBoundingBox)) {
        return {
          isValid: false,
          reason: 'Overlaps with existing building',
          snappedPosition,
          snappedRotation,
        }
      }
    }

    // Check terrain constraints (e.g., not too steep)
    // This could be expanded with more sophisticated terrain analysis

    return {
      isValid: true,
      snappedPosition,
      snappedRotation,
    }
  }

  private createBoundingBox(
    position: THREE.Vector3,
    dimensions: { width: number; height: number; depth: number },
    rotation: THREE.Euler
  ): THREE.Box3 {
    const halfWidth = dimensions.width / 2
    const halfHeight = dimensions.height / 2
    const halfDepth = dimensions.depth / 2

    const min = new THREE.Vector3(
      position.x - halfWidth,
      position.y,
      position.z - halfDepth
    )
    const max = new THREE.Vector3(
      position.x + halfWidth,
      position.y + dimensions.height,
      position.z + halfDepth
    )

    // For simplicity, we're not rotating the bounding box
    // In a more sophisticated system, you'd apply the rotation
    return new THREE.Box3(min, max)
  }

  public showGhostPreview(
    buildingType: string,
    position: THREE.Vector3,
    rotation: THREE.Euler,
    isValid: boolean
  ): void {
    const template = this.getBuildingTemplate(buildingType)
    if (!template) return

    // Remove existing ghost
    this.hideGhostPreview()

    // Create ghost mesh
    const geometry = new THREE.BoxGeometry(
      template.dimensions.width,
      template.dimensions.height,
      template.dimensions.depth
    )

    const material = new THREE.MeshBasicMaterial({
      color: isValid ? GAME_CONFIG.BUILDING.VALID_COLOR : GAME_CONFIG.BUILDING.INVALID_COLOR,
      transparent: true,
      opacity: GAME_CONFIG.BUILDING.GHOST_OPACITY,
      wireframe: true,
    })

    const mesh = new THREE.Mesh(geometry, material)
    mesh.position.copy(position)
    mesh.rotation.copy(rotation)

    // Adjust position for proper ground placement
    mesh.position.y += template.dimensions.height / 2

    this.scene.add(mesh)
    this.ghostPreview = { mesh, isVisible: true, isValid }
  }

  public hideGhostPreview(): void {
    if (this.ghostPreview.mesh) {
      this.scene.remove(this.ghostPreview.mesh)
      this.ghostPreview.mesh.geometry.dispose()
      if (Array.isArray(this.ghostPreview.mesh.material)) {
        this.ghostPreview.mesh.material.forEach(mat => mat.dispose())
      } else {
        this.ghostPreview.mesh.material.dispose()
      }
      this.ghostPreview = { mesh: null, isVisible: false, isValid: false }
    }
  }

  public placeBuilding(
    buildingType: string,
    position: THREE.Vector3,
    rotation: THREE.Euler,
    ownerId?: string
  ): string | null {
    const template = this.getBuildingTemplate(buildingType)
    if (!template) return null

    const buildingId = `building_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
    
    const building: BuildingData = {
      id: buildingId,
      type: buildingType as any,
      position: position.clone(),
      rotation: rotation.clone(),
      dimensions: { ...template.dimensions },
      cost: { ...template.cost },
      placedAt: Date.now(),
      ownerId,
    }

    this.buildings.set(buildingId, building)
    this.onBuildingPlace?.(building)

    return buildingId
  }

  public removeBuilding(buildingId: string): boolean {
    const building = this.buildings.get(buildingId)
    if (!building) return false

    this.buildings.delete(buildingId)
    this.onBuildingRemove?.(buildingId)

    return true
  }

  public getBuilding(buildingId: string): BuildingData | null {
    return this.buildings.get(buildingId) || null
  }

  public getAllBuildings(): BuildingData[] {
    return Array.from(this.buildings.values())
  }

  public getBuildingsInRadius(center: THREE.Vector3, radius: number): BuildingData[] {
    return this.getAllBuildings().filter(building => 
      building.position.distanceTo(center) <= radius
    )
  }

  public canAffordBuilding(buildingType: string, resources: Record<string, number>): boolean {
    const template = this.getBuildingTemplate(buildingType)
    if (!template) return false

    for (const [resource, cost] of Object.entries(template.cost)) {
      if ((resources[resource] || 0) < cost) {
        return false
      }
    }

    return true
  }

  public getResourcesNeeded(buildingType: string, resources: Record<string, number>): Record<string, number> {
    const template = this.getBuildingTemplate(buildingType)
    if (!template) return {}

    const needed: Record<string, number> = {}
    
    for (const [resource, cost] of Object.entries(template.cost)) {
      const available = resources[resource] || 0
      if (available < cost) {
        needed[resource] = cost - available
      }
    }

    return needed
  }

  // Multiplayer synchronization
  public getStateForSync(): any {
    return {
      buildings: Array.from(this.buildings.entries()).map(([id, building]) => ({
        ...building,
        position: { x: building.position.x, y: building.position.y, z: building.position.z },
        rotation: { x: building.rotation.x, y: building.rotation.y, z: building.rotation.z },
      })),
    }
  }

  public applyStateFromSync(syncData: any): void {
    this.buildings.clear()
    
    for (const buildingData of syncData.buildings) {
      const building: BuildingData = {
        ...buildingData,
        position: new THREE.Vector3(
          buildingData.position.x,
          buildingData.position.y,
          buildingData.position.z
        ),
        rotation: new THREE.Euler(
          buildingData.rotation.x,
          buildingData.rotation.y,
          buildingData.rotation.z
        ),
      }
      
      this.buildings.set(building.id, building)
    }
  }

  // Event listeners
  public onBuildingPlaceEvent(callback: (building: BuildingData) => void): void {
    this.onBuildingPlace = callback
  }

  public onBuildingRemoveEvent(callback: (buildingId: string) => void): void {
    this.onBuildingRemove = callback
  }

  public onValidationChangeEvent(callback: (isValid: boolean, reason?: string) => void): void {
    this.onValidationChange = callback
  }

  public dispose(): void {
    this.hideGhostPreview()
    this.buildings.clear()
  }
} 