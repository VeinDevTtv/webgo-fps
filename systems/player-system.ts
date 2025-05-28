import * as THREE from 'three'
import { GAME_CONFIG } from '@/lib/config/game-config'

export interface PlayerMovementState {
  position: THREE.Vector3
  velocity: THREE.Vector3
  rotation: THREE.Euler
  isGrounded: boolean
  isCrouching: boolean
  isSprinting: boolean
  isJumping: boolean
}

export interface KeyState {
  KeyW: boolean
  KeyS: boolean
  KeyA: boolean
  KeyD: boolean
  Space: boolean
  ShiftLeft: boolean
  KeyC: boolean
}

export class PlayerSystem {
  private movementState: PlayerMovementState
  private lastFootstepTime = 0
  private jumpCooldown = false

  constructor(spawnPoint: THREE.Vector3) {
    this.movementState = {
      position: spawnPoint.clone(),
      velocity: new THREE.Vector3(0, -0.1, 0),
      rotation: new THREE.Euler(0, 0, 0),
      isGrounded: false,
      isCrouching: false,
      isSprinting: false,
      isJumping: false,
    }
  }

  public getPosition(): THREE.Vector3 {
    return this.movementState.position.clone()
  }

  public getVelocity(): THREE.Vector3 {
    return this.movementState.velocity.clone()
  }

  public isGrounded(): boolean {
    return this.movementState.isGrounded
  }

  public isCrouching(): boolean {
    return this.movementState.isCrouching
  }

  public isSprinting(): boolean {
    return this.movementState.isSprinting
  }

  public setGrounded(grounded: boolean): void {
    this.movementState.isGrounded = grounded
  }

  public setCrouching(crouching: boolean): void {
    this.movementState.isCrouching = crouching
  }

  public setSprinting(sprinting: boolean): void {
    this.movementState.isSprinting = sprinting
  }

  public updateMovement(
    keys: KeyState,
    camera: THREE.Camera,
    deltaTime: number,
    terrainHeightData: number[][],
    obstacles: any[] = []
  ): void {
    // Calculate movement direction
    const direction = new THREE.Vector3()
    const forward = new THREE.Vector3(0, 0, -1)
    const right = new THREE.Vector3(1, 0, 0)

    forward.applyQuaternion(camera.quaternion)
    right.applyQuaternion(camera.quaternion)

    forward.y = 0
    right.y = 0
    forward.normalize()
    right.normalize()

    // Handle input
    if (keys.KeyW) direction.add(forward)
    if (keys.KeyS) direction.sub(forward)
    if (keys.KeyD) direction.add(right)
    if (keys.KeyA) direction.sub(right)

    // Determine movement speed
    let speed: number = GAME_CONFIG.PLAYER.WALK_SPEED
    if (keys.ShiftLeft && !this.movementState.isCrouching) {
      speed = GAME_CONFIG.PLAYER.SPRINT_SPEED
      this.movementState.isSprinting = true
    } else {
      this.movementState.isSprinting = false
    }

    if (keys.KeyC) {
      speed = GAME_CONFIG.PLAYER.CROUCH_SPEED
      this.movementState.isCrouching = true
    } else {
      this.movementState.isCrouching = false
    }

    // Apply horizontal movement
    if (direction.length() > 0) {
      direction.normalize()
      direction.multiplyScalar(speed * deltaTime)
      
      // Test new position for collisions
      const newPosition = this.movementState.position.clone().add(direction)
      if (!this.checkCollisions(newPosition, obstacles)) {
        this.movementState.position.add(direction)
      }
    }

    // Handle jumping
    if (keys.Space && this.movementState.isGrounded && !this.jumpCooldown) {
      this.movementState.velocity.y = GAME_CONFIG.PLAYER.JUMP_FORCE
      this.movementState.isGrounded = false
      this.movementState.isJumping = true
      this.jumpCooldown = true
      
      setTimeout(() => {
        this.jumpCooldown = false
      }, 500)
    }

    // Apply gravity
    if (!this.movementState.isGrounded) {
      this.movementState.velocity.y -= GAME_CONFIG.PLAYER.GRAVITY * deltaTime
      this.movementState.velocity.y = Math.max(
        this.movementState.velocity.y,
        -GAME_CONFIG.PLAYER.MAX_FALL_SPEED
      )
    }

    // Apply vertical movement
    this.movementState.position.y += this.movementState.velocity.y * deltaTime

    // Check ground collision
    const groundHeight = this.getTerrainHeight(
      this.movementState.position.x,
      this.movementState.position.z,
      terrainHeightData
    )

    const playerHeight = this.movementState.isCrouching 
      ? GAME_CONFIG.PLAYER.CROUCH_HEIGHT 
      : GAME_CONFIG.PLAYER.HEIGHT

    if (this.movementState.position.y <= groundHeight + playerHeight) {
      this.movementState.position.y = groundHeight + playerHeight
      this.movementState.velocity.y = 0
      this.movementState.isGrounded = true
      this.movementState.isJumping = false
    }
  }

  private checkCollisions(position: THREE.Vector3, obstacles: any[]): boolean {
    // Simple sphere collision detection
    const playerSphere = new THREE.Sphere(position, GAME_CONFIG.PLAYER.RADIUS)
    
    for (const obstacle of obstacles) {
      if (obstacle.intersectsSphere && obstacle.intersectsSphere(playerSphere)) {
        return true
      }
    }
    
    return false
  }

  private getTerrainHeight(x: number, z: number, terrainHeightData: number[][]): number {
    if (!terrainHeightData || terrainHeightData.length === 0) {
      return 0
    }

    // Convert world coordinates to terrain grid coordinates
    const gridX = Math.floor(x + terrainHeightData.length / 2)
    const gridZ = Math.floor(z + terrainHeightData[0].length / 2)

    // Clamp to terrain bounds
    const clampedX = Math.max(0, Math.min(terrainHeightData.length - 1, gridX))
    const clampedZ = Math.max(0, Math.min(terrainHeightData[0].length - 1, gridZ))

    return terrainHeightData[clampedX][clampedZ] * GAME_CONFIG.TERRAIN.DEFAULT_PARAMS.HEIGHT
  }

  public shouldPlayFootstep(isMoving: boolean): boolean {
    if (!isMoving || !this.movementState.isGrounded) {
      return false
    }

    const now = Date.now()
    const interval = this.movementState.isSprinting 
      ? GAME_CONFIG.AUDIO.FOOTSTEP_INTERVAL * 0.7 
      : GAME_CONFIG.AUDIO.FOOTSTEP_INTERVAL

    if (now - this.lastFootstepTime > interval) {
      this.lastFootstepTime = now
      return true
    }

    return false
  }
} 