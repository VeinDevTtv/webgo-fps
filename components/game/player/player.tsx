"use client"

import { useRef, useEffect, useState, useMemo } from "react"
import { useFrame, useThree } from "@react-three/fiber"
import { useGameState } from "@/lib/game-context"
import * as THREE from "three"
import type { TreeInstance } from "@/lib/tree-generator"
import { useSoundManager } from "@/lib/sound-manager"
import { useInventory } from "@/lib/inventory-context"
import type { StoneNodeInstance } from "@/lib/stone-generator"

// Define Wall interface inline since wall-generator doesn't exist
interface Wall {
  position: [number, number, number]
  geometry: THREE.BufferGeometry
  material: THREE.Material
  rotation?: [number, number, number]
}

// Define a type for storage boxes
interface StorageBoxInstance {
  id: string
  position: [number, number, number]
  normal?: [number, number, number]
}

// Update the PlayerProps interface to include storage boxes
interface PlayerProps {
  keys: {
    KeyW: boolean
    KeyS: boolean
    KeyA: boolean
    KeyD: boolean
    Space: boolean
    ShiftLeft: boolean
    KeyC: boolean // Change ControlLeft to KeyC for crouching
  }
  isLocked: boolean
  walls: Wall[]
  terrainHeightData: number[][]
  spawnPoint: THREE.Vector3
  trees?: TreeInstance[]
  stones?: StoneNodeInstance[]
  storageBoxes?: StorageBoxInstance[] // Add storage boxes
  mouseSensitivity?: number
  invertY?: boolean
  disabled?: boolean
}

// Add crouching constants after the movement speed constants
const SPRINT_SPEED = 5.0 // Units per second
const WALK_SPEED = 2.5 // Units per second
const CROUCH_SPEED = 1.2 // Units per second for crouching
const PLAYER_HEIGHT = 1.7
const CROUCH_HEIGHT = 1.0 // Height when crouching
const CROUCH_TRANSITION_SPEED = 5.0 // Speed of transition between standing and crouching
const PLAYER_RADIUS = 0.5
const JUMP_FORCE = 5.0 // Units per second
const GRAVITY = 9.8 // Units per second squared
const MAX_FALL_SPEED = 20.0 // Units per second
const TERRAIN_CHECK_OFFSET = 0.1
const COLLISION_ITERATIONS = 3

// Define storage box dimensions
const STORAGE_BOX_WIDTH = 1.2
const STORAGE_BOX_DEPTH = 0.8
const STORAGE_BOX_HEIGHT = 0.5

export default function Player({
  keys,
  isLocked,
  walls,
  terrainHeightData,
  spawnPoint,
  trees = [],
  stones = [],
  storageBoxes = [], // Add storage boxes with default empty array
  mouseSensitivity = 1.0,
  invertY = false,
  disabled = false,
}: PlayerProps) {
  const { camera } = useThree()
  const { setPlayerPosition } = useGameState()
  const { isOpen: isInventoryOpen, isTogglingInventory } = useInventory()
  const playerRef = useRef<THREE.Mesh>(null)
  const soundManager = useSoundManager()
  const [debugStoneCollision, setDebugStoneCollision] = useState(false)
  const debugSphereRef = useRef<THREE.Mesh>(null)
  const playerBodyRef = useRef<THREE.Group>(null)
  const leftArmRef = useRef<THREE.Group>(null)
  const rightArmRef = useRef<THREE.Group>(null)
  const legsRef = useRef<THREE.Group>(null)
  const [showPlayerBody, setShowPlayerBody] = useState(true)
  const [debugMode, setDebugMode] = useState(false)

  // Create materials for player body parts
  const skinMaterial = useMemo(() => 
    new THREE.MeshStandardMaterial({ 
      color: "#d4a574", 
      roughness: 0.8, 
      metalness: 0.1,
      wireframe: debugMode 
    }), [debugMode])
    
  const shirtMaterial = useMemo(() => 
    new THREE.MeshStandardMaterial({ 
      color: "#4a5568", 
      roughness: 0.9, 
      metalness: 0.1,
      wireframe: debugMode 
    }), [debugMode])
    
  const pantsMaterial = useMemo(() => 
    new THREE.MeshStandardMaterial({ 
      color: "#2d3748", 
      roughness: 0.9, 
      metalness: 0.1,
      wireframe: debugMode 
    }), [debugMode])
    
  const shoesMaterial = useMemo(() => 
    new THREE.MeshStandardMaterial({ 
      color: "#1a202c", 
      roughness: 0.9, 
      metalness: 0.1,
      wireframe: debugMode 
    }), [debugMode])

  // Initialize player position and physics state
  const playerPosition = useRef(new THREE.Vector3(0, PLAYER_HEIGHT, 0))
  const velocity = useRef(new THREE.Vector3(0, -0.1, 0))

  // Change isGrounded from state to ref to prevent infinite update loops
  const isGrounded = useRef(false)
  const jumpCooldown = useRef(false)
  const wasSpacePressed = useRef(false)
  const initialized = useRef(false)
  const isCrouching = useRef(false) // Track if player is crouching
  const crouchTransition = useRef(0) // 0 = standing, 1 = fully crouched
  const debugInfo = useRef({
    terrainHeight: 0,
    playerHeight: 0,
    isColliding: false,
    standingOnTree: false,
    treeHeight: 0,
  })

  // Sound effect timers and state
  const lastFootstepTime = useRef(0)
  const footstepInterval = useRef(400) // ms between footsteps
  const wasGrounded = useRef(false)
  const wasMoving = useRef(false)

  // Throttle position updates to game state
  const lastPositionUpdate = useRef(0)
  const POSITION_UPDATE_INTERVAL = 100 // ms between position updates

  // Apply mouse sensitivity to camera controls
  useEffect(() => {
    if (isLocked && camera && !isInventoryOpen && !isTogglingInventory) {
      const originalOnMouseMove = document.onmousemove

      document.onmousemove = (event) => {
        if (originalOnMouseMove) {
          const scaledEvent = new MouseEvent("mousemove", {
            movementX: event.movementX * mouseSensitivity,
            movementY: event.movementY * mouseSensitivity * (invertY ? -1 : 1),
          } as MouseEventInit)

          originalOnMouseMove.call(document, scaledEvent)
        }
      }

      return () => {
        document.onmousemove = originalOnMouseMove
      }
    }
  }, [isLocked, camera, mouseSensitivity, invertY, isInventoryOpen, isTogglingInventory])

  // Set initial player position to spawn point - ONLY ONCE
  useEffect(() => {
    if (!initialized.current && spawnPoint) {
      console.log("Initializing player at spawn point:", spawnPoint)
      playerPosition.current.copy(spawnPoint)
      camera.position.copy(spawnPoint)
      initialized.current = true

      // Ensure we're not grounded initially so gravity will be applied
      isGrounded.current = false

      // Start with a small downward velocity to ensure falling
      velocity.current.set(0, -0.1, 0)
    }
  }, [camera, spawnPoint])

  // Handle player body visibility toggle
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.code === 'KeyV') {
        setShowPlayerBody(prev => {
          const newValue = !prev
          console.log('Player body visibility toggled:', newValue)
          return newValue
        })
      }
      if (event.code === 'KeyB') {
        setDebugMode(prev => {
          const newValue = !prev
          console.log('Player body debug mode toggled:', newValue)
          return newValue
        })
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [])

  // Create wall collision boxes
  const wallBoxes = useRef<THREE.Box3[]>([])

  // Initialize wall collision boxes
  useEffect(() => {
    if (!walls || walls.length === 0) return

    wallBoxes.current = walls.map((wall) => {
      if (!wall || !wall.geometry || !wall.position) {
        return new THREE.Box3(new THREE.Vector3(-1000, -1000, -1000), new THREE.Vector3(-999, -999, -999))
      }

      const size = new THREE.Vector3()
      wall.geometry.computeBoundingBox()
      if (!wall.geometry.boundingBox) {
        return new THREE.Box3(new THREE.Vector3(-1000, -1000, -1000), new THREE.Vector3(-999, -999, -999))
      }

      wall.geometry.boundingBox.getSize(size)

      if (wall.rotation && wall.rotation[1] !== 0) {
        const temp = size.x
        size.x = size.z
        size.z = temp
      }

      const halfSize = size.clone().multiplyScalar(0.5)
      const position = new THREE.Vector3(...wall.position)

      const min = position.clone().sub(halfSize)
      const max = position.clone().add(halfSize)

      return new THREE.Box3(min, max)
    })
  }, [walls])

  // Simple collision detection with walls
  const checkWallCollision = (position: THREE.Vector3): boolean => {
    if (!wallBoxes.current || wallBoxes.current.length === 0) return false

    const playerSphere = new THREE.Sphere(position, PLAYER_RADIUS)

    for (const box of wallBoxes.current) {
      if (box && box.intersectsSphere(playerSphere)) {
        return true
      }
    }

    return false
  }

  // Check collision with storage boxes
  const checkStorageBoxCollision = (
    position: THREE.Vector3,
  ): { collision: boolean; standingOn: boolean; height: number } => {
    if (!storageBoxes || storageBoxes.length === 0) {
      return { collision: false, standingOn: false, height: 0 }
    }

    const playerSphere = new THREE.Sphere(position, PLAYER_RADIUS)
    let collisionDetected = false
    let standingOn = false
    let boxHeight = 0

    for (const box of storageBoxes) {
      // Create a box for the storage box
      const boxPos = new THREE.Vector3(...box.position)

      // Calculate the box dimensions
      const halfWidth = STORAGE_BOX_WIDTH / 2
      const halfDepth = STORAGE_BOX_DEPTH / 2
      const halfHeight = STORAGE_BOX_HEIGHT / 2

      // Calculate horizontal distance (ignoring Y)
      const dx = position.x - boxPos.x
      const dz = position.z - boxPos.z
      const horizontalDistSq = dx * dx + dz * dz

      // If we're within the horizontal bounds of the box
      if (Math.abs(dx) < halfWidth + PLAYER_RADIUS && Math.abs(dz) < halfDepth + PLAYER_RADIUS) {
        // Calculate vertical position relative to box
        const boxTop = boxPos.y + STORAGE_BOX_HEIGHT
        const boxBottom = boxPos.y
        const playerBottom = position.y - PLAYER_HEIGHT
        const playerTop = position.y

        // Check if player is above the box and close to the top surface
        if (playerBottom <= boxTop + TERRAIN_CHECK_OFFSET * 2 && playerBottom >= boxTop - TERRAIN_CHECK_OFFSET * 2) {
          // Player is standing on top of the box
          standingOn = true
          boxHeight = boxTop
        }
        // Check if player is inside or colliding with the box
        else if (
          (playerBottom < boxTop && playerBottom > boxBottom) ||
          (playerTop > boxBottom && playerTop < boxTop) ||
          (playerBottom <= boxBottom && playerTop >= boxTop)
        ) {
          // Player is colliding with the box
          collisionDetected = true
        }

        if (standingOn || collisionDetected) {
          break
        }
      }
    }

    return { collision: collisionDetected, standingOn, height: boxHeight }
  }

  // Let's completely rewrite the checkStoneCollision function to better handle top collisions

  // Check collision with stone nodes
  const checkStoneCollision = (
    position: THREE.Vector3,
  ): { collision: boolean; standingOn: boolean; height: number } => {
    if (!stones || stones.length === 0) {
      return { collision: false, standingOn: false, height: 0 }
    }

    const playerSphere = new THREE.Sphere(position, PLAYER_RADIUS)
    let collisionDetected = false
    let standingOn = false
    let stoneHeight = 0

    for (const stone of stones) {
      // Skip if stone is mined
      if (stone.isMined) continue

      // Create a sphere for the stone
      const stonePos = stone.position.clone()
      stonePos.y += stone.scale * 0.5 // Adjust for stone height
      const stoneRadius = stone.scale * 0.8 // Use 80% of scale as collision radius

      // Calculate horizontal distance (ignoring Y)
      const dx = position.x - stonePos.x
      const dz = position.z - stonePos.z
      const horizontalDistSq = dx * dx + dz * dz

      // If we're within the horizontal bounds of the stone
      if (horizontalDistSq < stoneRadius * stoneRadius) {
        // Calculate vertical position relative to stone
        const stoneTop = stonePos.y + stoneRadius
        const stoneBottom = stonePos.y - stoneRadius
        const playerBottom = position.y - PLAYER_HEIGHT
        const playerTop = position.y

        // Check if player is above the stone and close to the top surface
        if (
          playerBottom <= stoneTop + TERRAIN_CHECK_OFFSET * 2 &&
          playerBottom >= stoneTop - TERRAIN_CHECK_OFFSET * 2
        ) {
          // Player is standing on top of the stone
          standingOn = true
          stoneHeight = stoneTop
        }
        // Check if player is inside or colliding with the stone
        else if (
          (playerBottom < stoneTop && playerBottom > stoneBottom) ||
          (playerTop > stoneBottom && playerTop < stoneTop) ||
          (playerBottom <= stoneBottom && playerTop >= stoneTop)
        ) {
          // Player is colliding with the stone
          collisionDetected = true
        }

        // Update debug sphere position for visualization
        if (debugSphereRef.current) {
          debugSphereRef.current.position.copy(stonePos)
          debugSphereRef.current.scale.set(stoneRadius * 2, stoneRadius * 2, stoneRadius * 2)
          setDebugStoneCollision(true)
        }

        if (standingOn || collisionDetected) {
          break
        }
      }
    }

    // If no collision, hide debug sphere
    if (!collisionDetected && !standingOn && debugStoneCollision) {
      setDebugStoneCollision(false)
    }

    return { collision: collisionDetected, standingOn, height: stoneHeight }
  }

  // Check collision with trees - IMPROVED to ensure trunk collision works properly
  const checkTreeCollision = (position: THREE.Vector3): { collision: boolean; standingOn: boolean; height: number } => {
    if (!trees || trees.length === 0) {
      return { collision: false, standingOn: false, height: 0 }
    }

    const playerSphere = new THREE.Sphere(position, PLAYER_RADIUS)
    let collision = false
    let standingOn = false
    let treeHeight = 0

    for (const tree of trees) {
      // Skip trees that are chopped down
      if (tree.isChopped) continue

      // Skip trees without collision data
      if (!tree.trunkRadius || !tree.trunkHeight || !tree.foliageRadius || !tree.foliageBottom || !tree.foliageTop) {
        continue
      }

      const treePos = tree.position.clone()

      // Check horizontal distance to tree trunk
      const dx = position.x - treePos.x
      const dz = position.z - treePos.z
      const horizontalDistSq = dx * dx + dz * dz

      // IMPROVED: Create a proper cylinder collision for the trunk
      // Check if player is within trunk radius horizontally
      if (horizontalDistSq < tree.trunkRadius * 1.2 * (tree.trunkRadius * 1.2)) {
        // Check if player is within trunk height vertically
        // The trunk goes from ground level (treePos.y) to trunk height (treePos.y + trunkHeight)
        if (position.y >= treePos.y && position.y <= treePos.y + tree.trunkHeight) {
          collision = true
          break
        }
      }

      // Check if player is standing on top of the tree
      const treeTopHeight = treePos.y + tree.foliageTop
      const playerBottomHeight = position.y - PLAYER_HEIGHT
      const verticalDist = playerBottomHeight - treeTopHeight

      if (
        horizontalDistSq < tree.foliageRadius * tree.foliageRadius &&
        verticalDist > -TERRAIN_CHECK_OFFSET * 2 &&
        verticalDist < TERRAIN_CHECK_OFFSET * 2
      ) {
        standingOn = true
        treeHeight = treeTopHeight
      }
    }

    return { collision, standingOn, height: treeHeight }
  }

  // Get terrain height at position with interpolation for smoother movement
  const getTerrainHeight = (x: number, z: number): number => {
    if (!terrainHeightData || terrainHeightData.length === 0 || !terrainHeightData[0]) {
      console.warn("No terrain height data available")
      return 0
    }

    const terrainSize = terrainHeightData.length
    const halfSize = terrainSize / 2

    const gridX = x + halfSize
    const gridZ = z + halfSize

    const x0 = Math.floor(gridX)
    const z0 = Math.floor(gridZ)
    const x1 = Math.min(x0 + 1, terrainSize - 1)
    const z1 = Math.min(z0 + 1, terrainSize - 1)

    if (x0 < 0 || x0 >= terrainSize || z0 < 0 || z0 >= terrainSize) {
      return 0
    }

    if (!terrainHeightData[z0] || !terrainHeightData[z1]) {
      return 0
    }

    const fx = gridX - x0
    const fz = gridZ - z0

    const h00 = terrainHeightData[z0][x0] || 0
    const h10 = terrainHeightData[z0][x1] || 0
    const h01 = terrainHeightData[z1][x0] || 0
    const h11 = terrainHeightData[z1][x1] || 0

    const h0 = h00 * (1 - fx) + h10 * fx
    const h1 = h01 * (1 - fx) + h11 * fx

    const height = h0 * (1 - fz) + h1 * fz

    return height
  }

  // Check if player is on the ground or standing on a tree
  const checkGrounded = (position: THREE.Vector3): { grounded: boolean; height: number } => {
    const terrainHeight = getTerrainHeight(position.x, position.z)
    debugInfo.current.terrainHeight = terrainHeight
    debugInfo.current.playerHeight = position.y

    const treeCheck = checkTreeCollision(position)
    const stoneCheck = checkStoneCollision(position)
    const boxCheck = checkStorageBoxCollision(position)

    debugInfo.current.standingOnTree = treeCheck.standingOn
    debugInfo.current.treeHeight = treeCheck.height

    // Add a slightly larger tolerance for ground detection to prevent bouncing on small terrain variations
    const GROUND_TOLERANCE = TERRAIN_CHECK_OFFSET * 1.5

    // Calculate current player height based on crouch transition
    const currentPlayerHeight = PLAYER_HEIGHT - (PLAYER_HEIGHT - CROUCH_HEIGHT) * crouchTransition.current

    const isGroundedOnTerrain = position.y <= terrainHeight + currentPlayerHeight + GROUND_TOLERANCE
    const isGroundedOnTree =
      treeCheck.standingOn && Math.abs(position.y - (treeCheck.height + currentPlayerHeight)) < GROUND_TOLERANCE * 2
    const isGroundedOnStone =
      stoneCheck.standingOn && Math.abs(position.y - (stoneCheck.height + currentPlayerHeight)) < GROUND_TOLERANCE * 2
    const isGroundedOnBox =
      boxCheck.standingOn && Math.abs(position.y - (boxCheck.height + currentPlayerHeight)) < GROUND_TOLERANCE * 2

    debugInfo.current.isColliding = isGroundedOnTerrain || isGroundedOnTree || isGroundedOnStone || isGroundedOnBox

    // Return the highest surface the player is standing on
    let effectiveHeight = terrainHeight
    if (treeCheck.standingOn && treeCheck.height > effectiveHeight) {
      effectiveHeight = treeCheck.height
    }
    if (stoneCheck.standingOn && stoneCheck.height > effectiveHeight) {
      effectiveHeight = stoneCheck.height
    }
    if (boxCheck.standingOn && boxCheck.height > effectiveHeight) {
      effectiveHeight = boxCheck.height
    }

    return {
      grounded: isGroundedOnTerrain || isGroundedOnTree || isGroundedOnStone || isGroundedOnBox,
      height: effectiveHeight,
    }
  }

  // Handle movement with terrain collision - now using delta time
  useFrame((state, delta) => {
    // Cap delta time to prevent huge jumps if the game freezes temporarily
    const cappedDelta = Math.min(delta, 0.1)

    if (!isLocked || !initialized.current) return

    // CRITICAL FIX: When disabled or toggling inventory, ONLY update position
    // DO NOT touch camera rotation at all
    if (disabled || isTogglingInventory) {
      camera.position.copy(playerPosition.current)
      // DO NOT TOUCH camera.rotation here!
      return
    }

    // Get movement input
    const forward = keys.KeyW
    const backward = keys.KeyS
    const left = keys.KeyA
    const right = keys.KeyD
    const sprint = keys.ShiftLeft
    const jump = keys.Space
    const crouch = keys.KeyC // Change from ControlLeft to KeyC

    const isMoving = forward || backward || left || right

    // Handle crouching transition
    if (crouch && !isCrouching.current) {
      isCrouching.current = true
    } else if (!crouch && isCrouching.current) {
      isCrouching.current = false
    }

    // Smoothly transition between standing and crouching
    if (isCrouching.current && crouchTransition.current < 1) {
      crouchTransition.current = Math.min(crouchTransition.current + CROUCH_TRANSITION_SPEED * cappedDelta, 1)
    } else if (!isCrouching.current && crouchTransition.current > 0) {
      crouchTransition.current = Math.max(crouchTransition.current - CROUCH_TRANSITION_SPEED * cappedDelta, 0)
    }

    // Calculate current player height based on crouch transition
    const currentPlayerHeight = PLAYER_HEIGHT - (PLAYER_HEIGHT - CROUCH_HEIGHT) * crouchTransition.current

    // Handle jumping - detect when space is first pressed
    if (jump && !wasSpacePressed.current && isGrounded.current && !isCrouching.current) {
      // Only allow jumping when not crouching
      // Add a cooldown check to prevent rapid jumps
      const now = performance.now()
      const JUMP_COOLDOWN = 300 // ms

      if (!jumpCooldown.current) {
        velocity.current.y = JUMP_FORCE
        isGrounded.current = false
        jumpCooldown.current = true

        // Reset jump cooldown after a delay
        setTimeout(() => {
          jumpCooldown.current = false
        }, JUMP_COOLDOWN)

        try {
          soundManager.play("jump")
        } catch (error) {
          console.warn("Error playing jump sound:", error)
        }
      }
    }
    wasSpacePressed.current = jump

    // Calculate movement direction based on camera
    const direction = new THREE.Vector3()

    // Forward/backward movement
    if (forward || backward) {
      const forwardDir = new THREE.Vector3()
      camera.getWorldDirection(forwardDir)
      forwardDir.y = 0
      forwardDir.normalize()

      if (forward) direction.add(forwardDir)
      if (backward) direction.sub(forwardDir)
    }

    // Left/right movement
    if (left || right) {
      const forwardDir = new THREE.Vector3()
      camera.getWorldDirection(forwardDir)
      forwardDir.y = 0
      forwardDir.normalize()

      const rightDir = new THREE.Vector3()
      rightDir.crossVectors(forwardDir, new THREE.Vector3(0, 1, 0))
      rightDir.normalize()

      if (right) direction.add(rightDir)
      if (left) direction.sub(rightDir)
    }

    // Normalize direction vector if it has length
    if (direction.length() > 0) {
      // Apply appropriate speed based on sprint state and crouch state, scaled by delta time
      let currentSpeed = WALK_SPEED
      if (isCrouching.current) {
        currentSpeed = CROUCH_SPEED
      } else if (sprint) {
        currentSpeed = SPRINT_SPEED
      }
      direction.normalize().multiplyScalar(currentSpeed * cappedDelta)
    }

    // Apply horizontal movement
    const horizontalMovement = new THREE.Vector3(direction.x, 0, direction.z)

    // Apply gravity and vertical movement with delta time
    if (!isGrounded.current) {
      // Apply gravity to velocity, scaled by delta time
      velocity.current.y -= GRAVITY * cappedDelta

      // Cap fall speed
      if (velocity.current.y < -MAX_FALL_SPEED) {
        velocity.current.y = -MAX_FALL_SPEED
      }
    } else if (velocity.current.y < 0) {
      // Reset vertical velocity when grounded
      velocity.current.y = 0
    }

    // Calculate new position with horizontal movement
    const newHorizontalPosition = playerPosition.current.clone().add(horizontalMovement)

    // Check for horizontal collisions with walls, trees, stones, and storage boxes
    const wallCollision = checkWallCollision(
      new THREE.Vector3(newHorizontalPosition.x, playerPosition.current.y, newHorizontalPosition.z),
    )

    const treeCollision = checkTreeCollision(
      new THREE.Vector3(newHorizontalPosition.x, playerPosition.current.y, newHorizontalPosition.z),
    )

    const stoneCollision = checkStoneCollision(
      new THREE.Vector3(newHorizontalPosition.x, playerPosition.current.y, newHorizontalPosition.z),
    )

    const boxCollision = checkStorageBoxCollision(
      new THREE.Vector3(newHorizontalPosition.x, playerPosition.current.y, newHorizontalPosition.z),
    )

    if (!wallCollision && !treeCollision.collision && !stoneCollision.collision && !boxCollision.collision) {
      // Update horizontal position if no collision
      playerPosition.current.x = newHorizontalPosition.x
      playerPosition.current.z = newHorizontalPosition.z
    } else {
      // Try to slide along obstacles
      // First try moving only in X direction
      const newXPosition = new THREE.Vector3(
        newHorizontalPosition.x,
        playerPosition.current.y,
        playerPosition.current.z,
      )

      const xWallCollision = checkWallCollision(newXPosition)
      const xTreeCollision = checkTreeCollision(newXPosition)
      const xStoneCollision = checkStoneCollision(newXPosition)
      const xBoxCollision = checkStorageBoxCollision(newXPosition)

      if (!xWallCollision && !xTreeCollision.collision && !xStoneCollision.collision && !xBoxCollision.collision) {
        playerPosition.current.x = newHorizontalPosition.x
      }

      // Then try moving only in Z direction
      const newZPosition = new THREE.Vector3(
        playerPosition.current.x,
        playerPosition.current.y,
        newHorizontalPosition.z,
      )

      const zWallCollision = checkWallCollision(newZPosition)
      const zTreeCollision = checkTreeCollision(newZPosition)
      const zStoneCollision = checkStoneCollision(newZPosition)
      const zBoxCollision = checkStorageBoxCollision(newZPosition)

      if (!zWallCollision && !zTreeCollision.collision && !zStoneCollision.collision && !zBoxCollision.collision) {
        playerPosition.current.z = newHorizontalPosition.z
      }
    }

    // Get terrain height at current position
    const terrainHeight = getTerrainHeight(playerPosition.current.x, playerPosition.current.z)

    // Check if standing on a tree
    const treeCheck = checkTreeCollision(playerPosition.current)
    const groundCheck = checkGrounded(playerPosition.current)
    const effectiveGroundHeight = groundCheck.height

    // Calculate new position with vertical movement, scaled by delta time
    const newVerticalPosition = playerPosition.current.clone()
    newVerticalPosition.y += velocity.current.y * cappedDelta

    // Enhanced collision detection with terrain and trees
    // Ensure player doesn't fall through the terrain or trees
    if (newVerticalPosition.y < effectiveGroundHeight + PLAYER_HEIGHT) {
      // Player is below ground/tree surface + player height, resolve collision
      newVerticalPosition.y = effectiveGroundHeight + PLAYER_HEIGHT
      velocity.current.y = 0
      isGrounded.current = true
    } else {
      // Update vertical position
      playerPosition.current.y = newVerticalPosition.y

      // Special check for stone collision to prevent falling through stones
      const stoneCheck = checkStoneCollision(playerPosition.current)
      if (stoneCheck.standingOn) {
        // If we're standing on a stone, make sure we're at the correct height
        playerPosition.current.y = stoneCheck.height + PLAYER_HEIGHT
        velocity.current.y = 0
        isGrounded.current = true
      } else if (stoneCheck.collision) {
        // If we're colliding with a stone but not standing on it,
        // push the player out of the stone
        const prevPos = playerPosition.current.clone()
        prevPos.y -= velocity.current.y * cappedDelta // Go back to previous position

        // Try to find a safe position
        const upPos = prevPos.clone()
        upPos.y = stoneCheck.height + PLAYER_HEIGHT

        // Check if moving up resolves the collision
        const upCheck = checkStoneCollision(upPos)
        if (!upCheck.collision) {
          // Moving up resolves the collision
          playerPosition.current.copy(upPos)
          velocity.current.y = 0
          isGrounded.current = true
        } else {
          // Try moving horizontally to resolve collision
          const escapeDir = new THREE.Vector3(
            playerPosition.current.x - prevPos.x,
            0,
            playerPosition.current.z - prevPos.z,
          )

          if (escapeDir.length() < 0.001) {
            // If no horizontal movement, create a random direction
            escapeDir.set(Math.random() - 0.5, 0, Math.random() - 0.5)
          }

          escapeDir.normalize().multiplyScalar(PLAYER_RADIUS * 1.1)

          const escapePos = prevPos.clone().add(escapeDir)
          escapePos.y = Math.max(prevPos.y, stoneCheck.height + PLAYER_HEIGHT)

          playerPosition.current.copy(escapePos)
          velocity.current.y = 0
        }
      }

      // Similar check for storage box collision
      const boxCheck = checkStorageBoxCollision(playerPosition.current)
      if (boxCheck.standingOn) {
        // If we're standing on a box, make sure we're at the correct height
        playerPosition.current.y = boxCheck.height + PLAYER_HEIGHT
        velocity.current.y = 0
        isGrounded.current = true
      } else if (boxCheck.collision) {
        // If we're colliding with a box but not standing on it,
        // push the player out of the box
        const prevPos = playerPosition.current.clone()
        prevPos.y -= velocity.current.y * cappedDelta // Go back to previous position

        // Try to find a safe position
        const upPos = prevPos.clone()
        upPos.y = boxCheck.height + PLAYER_HEIGHT

        // Check if moving up resolves the collision
        const upCheck = checkStorageBoxCollision(upPos)
        if (!upCheck.collision) {
          // Moving up resolves the collision
          playerPosition.current.copy(upPos)
          velocity.current.y = 0
          isGrounded.current = true
        } else {
          // Try moving horizontally to resolve collision
          const escapeDir = new THREE.Vector3(
            playerPosition.current.x - prevPos.x,
            0,
            playerPosition.current.z - prevPos.z,
          )

          if (escapeDir.length() < 0.001) {
            // If no horizontal movement, create a random direction
            escapeDir.set(Math.random() - 0.5, 0, Math.random() - 0.5)
          }

          escapeDir.normalize().multiplyScalar(PLAYER_RADIUS * 1.1)

          const escapePos = prevPos.clone().add(escapeDir)
          escapePos.y = Math.max(prevPos.y, boxCheck.height + PLAYER_HEIGHT)

          playerPosition.current.copy(escapePos)
          velocity.current.y = 0
        }
      }

      // Check if player is grounded after movement
      const nowGrounded = checkGrounded(playerPosition.current).grounded
      isGrounded.current = nowGrounded
    }

    // Iterative collision resolution for more accurate terrain collision
    for (let i = 0; i < COLLISION_ITERATIONS; i++) {
      const currentGroundCheck = checkGrounded(playerPosition.current)

      if (playerPosition.current.y < currentGroundCheck.height + PLAYER_HEIGHT) {
        playerPosition.current.y = currentGroundCheck.height + PLAYER_HEIGHT
        velocity.current.y = 0
        isGrounded.current = true
      }
    }

    // Play landing sound when player hits the ground - ONLY if falling with significant velocity
    if (isGrounded.current && !wasGrounded.current && velocity.current.y <= 0) {
      // Add a velocity threshold to prevent landing sound on small terrain variations
      const LANDING_VELOCITY_THRESHOLD = -2.0 // Only play sound when falling faster than this

      if (velocity.current.y < LANDING_VELOCITY_THRESHOLD) {
        if (typeof window !== "undefined") {
          try {
            soundManager.play("land")
          } catch (error) {
            console.warn("Error playing land sound:", error)
          }
        }
      }
    }
    wasGrounded.current = isGrounded.current

    // Play footstep sounds when moving on the ground
    if (isGrounded.current && isMoving) {
      const now = performance.now()
      // Adjust footstep interval based on sprint and crouch
      if (isCrouching.current) {
        footstepInterval.current = 600 // Slower footsteps when crouching
      } else if (sprint) {
        footstepInterval.current = 300 // Faster footsteps when sprinting
      } else {
        footstepInterval.current = 400 // Normal walking footsteps
      }

      if (now - lastFootstepTime.current > footstepInterval.current) {
        if (typeof window !== "undefined") {
          try {
            // Alternate between grass and dirt sounds
            const footstepSound = Math.random() > 0.5 ? "footstep_grass" : "footstep_dirt"
            soundManager.play(footstepSound)
          } catch (error) {
            console.warn("Error playing footstep sound:", error)
          }
        }
        lastFootstepTime.current = now
      }
    }

    // Track if player was moving
    wasMoving.current = isMoving

    // Update camera position with crouch offset
    const crouchOffset = (PLAYER_HEIGHT - currentPlayerHeight) * 0.5
    camera.position.copy(playerPosition.current).sub(new THREE.Vector3(0, crouchOffset, 0))

    // Update game state (throttled to reduce overhead)
    const now = performance.now()
    if (now - lastPositionUpdate.current > POSITION_UPDATE_INTERVAL) {
      setPlayerPosition({
        x: playerPosition.current.x,
        y: playerPosition.current.y - crouchOffset, // Apply crouch offset to reported position
        z: playerPosition.current.z,
      })
      lastPositionUpdate.current = now
    }

    // Update debug sphere
    if (playerRef.current) {
      playerRef.current.position.copy(playerPosition.current).sub(new THREE.Vector3(0, crouchOffset, 0))
    }

    // Update player body position and rotation relative to camera
    if (playerBodyRef.current && isLocked && !disabled) {
      // Position the player body group at camera position
      playerBodyRef.current.position.copy(camera.position)
      playerBodyRef.current.rotation.copy(camera.rotation)
      
      // Offset the body slightly down and back so it's visible when looking down
      const bodyOffset = new THREE.Vector3(0, -0.2, 0.1)
      bodyOffset.applyQuaternion(camera.quaternion)
      playerBodyRef.current.position.add(bodyOffset)
      
      // Add walking animation
      if (isMoving && isGrounded.current) {
        const time = state.clock.elapsedTime
        const walkCycle = Math.sin(time * 8) * 0.01
        const sway = Math.sin(time * 4) * 0.005
        
        playerBodyRef.current.position.y += walkCycle
        playerBodyRef.current.rotation.z += sway
        
        // Animate arms
        if (leftArmRef.current && rightArmRef.current) {
          const armSwing = Math.sin(time * 8) * 0.1
          leftArmRef.current.rotation.x = armSwing
          rightArmRef.current.rotation.x = -armSwing
        }
        
        // Animate legs
        if (legsRef.current) {
          const legCycle = Math.sin(time * 8) * 0.05
          legsRef.current.rotation.x = legCycle
        }
      } else {
        // Reset animations when not moving
        if (leftArmRef.current && rightArmRef.current) {
          leftArmRef.current.rotation.x = 0
          rightArmRef.current.rotation.x = 0
        }
        if (legsRef.current) {
          legsRef.current.rotation.x = 0
        }
      }
      
      // Apply crouch animation
      if (isCrouching.current) {
        const crouchBodyOffset = new THREE.Vector3(0, -crouchOffset * 0.3, 0)
        crouchBodyOffset.applyQuaternion(camera.quaternion)
        playerBodyRef.current.position.add(crouchBodyOffset)
      }
    }
  })

  return (
    <>
      {/* First-Person Player Body - visible when looking down */}
      <group ref={playerBodyRef} visible={showPlayerBody}>
        {/* Left Arm */}
        <group ref={leftArmRef} position={[-0.3, -0.2, -0.4]}>
          <mesh position={[0, 0, 0]}>
            <boxGeometry args={[0.08, 0.3, 0.08]} />
            <primitive object={skinMaterial} />
          </mesh>
          {/* Left Hand */}
          <mesh position={[0, -0.2, -0.1]}>
            <sphereGeometry args={[0.06, 8, 8]} />
            <primitive object={skinMaterial} />
          </mesh>
        </group>
        
        {/* Right Arm */}
        <group ref={rightArmRef} position={[0.3, -0.2, -0.4]}>
          <mesh position={[0, 0, 0]}>
            <boxGeometry args={[0.08, 0.3, 0.08]} />
            <primitive object={skinMaterial} />
          </mesh>
          {/* Right Hand */}
          <mesh position={[0, -0.2, -0.1]}>
            <sphereGeometry args={[0.06, 8, 8]} />
            <primitive object={skinMaterial} />
          </mesh>
        </group>

        {/* Player Body - visible when looking down */}
        <mesh position={[0, -0.6, -0.1]}>
          <boxGeometry args={[0.3, 0.4, 0.15]} />
          <primitive object={shirtMaterial} />
        </mesh>

        {/* Player Legs - visible when looking down */}
        <group ref={legsRef} position={[0, -1.0, 0]}>
          {/* Left Leg */}
          <mesh position={[-0.08, 0, 0]}>
            <boxGeometry args={[0.12, 0.6, 0.12]} />
            <primitive object={pantsMaterial} />
          </mesh>
          
          {/* Right Leg */}
          <mesh position={[0.08, 0, 0]}>
            <boxGeometry args={[0.12, 0.6, 0.12]} />
            <primitive object={pantsMaterial} />
          </mesh>
          
          {/* Left Foot */}
          <mesh position={[-0.08, -0.35, 0.08]}>
            <boxGeometry args={[0.12, 0.08, 0.2]} />
            <primitive object={shoesMaterial} />
          </mesh>
          
          {/* Right Foot */}
          <mesh position={[0.08, -0.35, 0.08]}>
            <boxGeometry args={[0.12, 0.08, 0.2]} />
            <primitive object={shoesMaterial} />
          </mesh>
        </group>
      </group>

      {/* Debug sphere to visualize player position - completely hidden now */}
      <mesh
        ref={playerRef}
        position={spawnPoint ? [spawnPoint.x, spawnPoint.y, spawnPoint.z] : [0, PLAYER_HEIGHT, 0]}
        visible={false}
      >
        <sphereGeometry args={[PLAYER_RADIUS, 16, 16]} />
        <meshBasicMaterial color="red" wireframe />
      </mesh>

      {/* Debug visualization for terrain height at player position - hidden as well */}
      <mesh
        position={[playerPosition.current.x, debugInfo.current.terrainHeight, playerPosition.current.z]}
        visible={false}
      >
        <boxGeometry args={[1, 0.1, 1]} />
        <meshBasicMaterial color={debugInfo.current.isColliding ? "green" : "red"} />
      </mesh>

      {/* Debug visualization for tree standing - hidden as well */}
      {debugInfo.current.standingOnTree && (
        <mesh
          position={[playerPosition.current.x, debugInfo.current.treeHeight, playerPosition.current.z]}
          visible={false}
        >
          <boxGeometry args={[1, 0.1, 1]} />
          <meshBasicMaterial color="blue" />
        </mesh>
      )}

      {/* Debug visualization for stone collision */}
      <mesh ref={debugSphereRef} visible={false}>
        <sphereGeometry args={[1, 16, 16]} />
        <meshBasicMaterial color="red" wireframe opacity={0.5} transparent />
      </mesh>
    </>
  )
}
