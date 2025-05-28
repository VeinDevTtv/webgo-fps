"use client"

import type React from "react"

import { useEffect, useState, useRef, useMemo } from "react"
import { useThree } from "@react-three/fiber"
import { PointerLockControls } from "@react-three/drei"
import * as THREE from "three"

import Player from "./player/player"
import Trees from "./environment/trees"
import StoneNodes from "./environment/stone-nodes"
import { useGameState as useGameContext } from "@/lib/game-context"
import { usePlayerStatus } from "@/lib/player-status-context"
import { useSettings } from "@/lib/settings-context"
import { useGameState } from "@/lib/game-state-context"
import { useToolbar } from "@/lib/toolbar-context"
import { useInventory } from "@/lib/inventory-context"
import { useCampfire } from "@/lib/campfire-context"
import { useStorageBox } from "@/lib/storage-box-context"
import { TerrainGenerator, type TerrainParams } from "@/lib/terrain-generator"

// Import weapons and tools
import Weapon from "./weapons/weapon"
import Hatchet from "./tools/hatchet"
import Pickaxe from "./tools/pickaxe"
import BuildingPlan from "./tools/building-plan"

// Import item manager
import { useItemManager } from "@/lib/item-manager-context"

// Import placers
import CampfirePlacer from "./tools/campfire-placer"
import StorageBoxPlacer from "./tools/storage-box-placer"
import DoorPlacer from "./tools/door-placer"

// Import interactions
import CampfireInteraction from "./items/campfire-interaction"
import StorageBoxInteraction from "./items/storage-box-interaction"
import Door from "./items/door"
import StorageBox from "./items/storage-box"
import Campfire from "./items/campfire"

// Import enemies
import EnemyManager from "./enemies/enemy-manager"
import EnhancedWeapon from "./weapons/enhanced-weapon"

export const MAX_RENDER_DISTANCE = 150

interface GameSceneProps {
  isLocked: boolean
  setIsLocked: (locked: boolean) => void
  onTerrainReady: (ready: boolean) => void
  maxRenderDistance: number
  fogDensity: number
  onAmmoChange: (ammo: { current: number; reserve: number }) => void
  onPointerLockError: (error: any) => void
  onCampfirePromptChange: (showPrompt: boolean) => void
  onCampfireInteraction: (campfireId: string | null) => void
  activeCampfire: string | null
  placedCampfires: Array<{
    id: string
    position: [number, number, number]
    isActive?: boolean
  }>
  setPlacedCampfires: React.Dispatch<
    React.SetStateAction<
      Array<{
        id: string
        position: [number, number, number]
        isActive?: boolean
      }>
    >
  >
  onStorageBoxPromptChange: (showPrompt: boolean) => void
  onStorageBoxInteraction: (storageBoxId: string | null) => void
  activeStorageBox: string | null
  placedStorageBoxes: Array<{
    id: string
    position: [number, number, number]
    normal?: [number, number, number]
  }>
  setPlacedStorageBoxes: React.Dispatch<
    React.SetStateAction<
      Array<{
        id: string
        position: [number, number, number]
        normal?: [number, number, number]
      }>
    >
  >
}

export default function GameScene({
  isLocked,
  setIsLocked,
  onTerrainReady,
  maxRenderDistance = MAX_RENDER_DISTANCE,
  fogDensity = 1.0,
  onAmmoChange,
  onPointerLockError,
  onCampfirePromptChange,
  onCampfireInteraction,
  activeCampfire,
  placedCampfires,
  setPlacedCampfires,
  onStorageBoxPromptChange,
  onStorageBoxInteraction,
  activeStorageBox,
  placedStorageBoxes,
  setPlacedStorageBoxes,
}: GameSceneProps) {
  const { scene, camera } = useThree()
  const { bulletTrails } = useGameContext()
  const { gameStatus } = useGameState()
  const { settings } = useSettings()
  const { selectedSlot, items } = useToolbar()
  const { isOpen: isInventoryOpen } = useInventory()
  const { campfires } = useCampfire()
  const { storageBoxes } = useStorageBox()
  const [terrainHeightData, setTerrainHeightData] = useState<number[][]>([])
  const [spawnPoint, setSpawnPoint] = useState<THREE.Vector3>(new THREE.Vector3(0, 2, 0))
  const [walls, setWalls] = useState<any[]>([])
  const [terrainReady, setTerrainReady] = useState(false)
  const [keys, setKeys] = useState({
    KeyW: false,
    KeyS: false,
    KeyA: false,
    KeyD: false,
    Space: false,
    ShiftLeft: false,
    KeyC: false, // Changed from ControlLeft to KeyC for crouching
  })
  const [playerPosition, setPlayerPosition] = useState<THREE.Vector3>(new THREE.Vector3(0, 2, 0))
  const { health } = usePlayerStatus()
  const controls = useRef<any>()
  const terrainRef = useRef<THREE.Mesh>(null)
  const terrainGenerated = useRef(false)
  const combatSystemRef = useRef<any>(null)

  // Try to use the ItemManager, but provide a fallback if it's not available
  const itemManager = useItemManager()
  const fallbackItemManager = {
    items: {
      campfire: [],
      storage_box: [],
      door: [],
      wall: [],
      foundation: [],
      ceiling: [],
      window: [],
    },
  }

  const effectiveItemManager = itemManager ? itemManager : fallbackItemManager

  // Log placed items for debugging
  useEffect(() => {
    console.log("Current storage boxes in item manager:", effectiveItemManager.items.storage_box)
  }, [effectiveItemManager.items.storage_box])

  // Handle keyboard input
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (isInventoryOpen || gameStatus !== "playing") return // Don't handle movement keys when inventory is open or game is not playing

      setKeys((prevKeys) => ({
        ...prevKeys,
        [e.code]: true,
      }))
    }

    const handleKeyUp = (e: KeyboardEvent) => {
      setKeys((prevKeys) => ({
        ...prevKeys,
        [e.code]: false,
      }))
    }

    window.addEventListener("keydown", handleKeyDown)
    window.addEventListener("keyup", handleKeyUp)

    return () => {
      window.removeEventListener("keydown", handleKeyDown)
      window.removeEventListener("keyup", handleKeyUp)
    }
  }, [isInventoryOpen, gameStatus])

  // Handle pointer lock
  useEffect(() => {
    if (controls.current) {
      const handleLockChange = () => {
        setIsLocked(document.pointerLockElement === controls.current.domElement)
      }

      document.addEventListener("pointerlockchange", handleLockChange)

      return () => {
        document.removeEventListener("pointerlockchange", handleLockChange)
      }
    }
  }, [controls])

  // Generate terrain
  const { terrainGeometry, waterGeometry, terrainParams } = useMemo(() => {
    if (terrainGenerated.current) {
      // Return empty values if terrain has already been generated
      return { terrainGeometry: null, waterGeometry: null, terrainParams: null }
    }

    console.log("Generating terrain...")
    terrainGenerated.current = true

    // Set terrain parameters
    const params: TerrainParams = {
      seed: "webgo-fps-12345", // Fixed seed for consistent generation
      width: 400, // Increased from 100 to 400 (4x wider)
      depth: 400, // Increased from 100 to 400 (4x deeper)
      height: 8, // Reduced from 15 to 8 for flatter terrain
      scale: 120, // Increased from 50 to 120 to spread out features on the larger map
      octaves: 4, // Reduced from 5 to 5 for smoother terrain
      persistence: 0.45, // Slightly reduced from 0.5 for less dramatic height changes
      lacunarity: 2.0,
      heightOffset: -4, // Adjusted from -5 to -4
      waterLevel: 0.25, // Lowered from 0.3 to 0.25
    }

    // Create terrain generator
    const generator = new TerrainGenerator(params)

    // Generate terrain geometry
    const terrainGeometry = generator.generateTerrain()

    // Generate water geometry
    const waterGeometry = generator.generateWater()

    // Get height data for collision detection
    const heightData = generator.getTerrainHeightData()
    setTerrainHeightData(heightData)
    console.log("Terrain generated with height data size:", heightData.length)

    return { terrainGeometry, waterGeometry, terrainParams: params }
  }, [])

  // Create materials with solid colors (no textures)
  const terrainMaterial = useMemo(() => {
    // Create a material with a solid color and proper settings
    return new THREE.MeshStandardMaterial({
      color: 0x556b2f, // Olive green
      roughness: 0.8,
      metalness: 0.1,
      side: THREE.DoubleSide, // Render both sides as a temporary fix
      transparent: false, // Make sure it's not transparent
      opacity: 1.0, // Fully opaque
      flatShading: false, // Smooth shading for better appearance
      depthWrite: true, // Ensure depth is written
      depthTest: true, // Ensure depth testing is enabled
    })
  }, [])

  const waterMaterial = useMemo(() => {
    // Create a material with a solid color
    return new THREE.MeshStandardMaterial({
      color: 0x3366ff, // Blue
      transparent: true,
      opacity: 0.7,
      roughness: 0.2,
      metalness: 0.6,
      side: THREE.DoubleSide, // Render both sides for water
    })
  }, [])

  // Find a suitable spawn point on the terrain
  useEffect(() => {
    if (!terrainHeightData || terrainHeightData.length === 0) {
      console.log("No terrain height data available yet")
      return
    }

    console.log("Finding spawn point on terrain...")

    // Make sure terrainParams is defined
    if (!terrainParams) {
      console.log("Terrain parameters not defined")
      return
    }

    // Try to find a relatively flat area near the center
    const centerX = Math.floor(terrainHeightData[0].length / 2)
    const centerZ = Math.floor(terrainHeightData.length / 2)
    const searchRadius = 20 // Increased from 10 to 20 for the larger map

    let bestSpawnX = centerX
    let bestSpawnZ = centerZ
    let flatnessScore = Number.MAX_VALUE

    // Search in a spiral pattern from the center
    for (let r = 0; r <= searchRadius; r++) {
      for (let dx = -r; dx <= r; dx++) {
        for (let dz = -r; dz <= r; dz++) {
          // Only check points on the current ring
          if (Math.abs(dx) < r && Math.abs(dz) < r) continue

          const x = centerX + dx
          const z = centerZ + dz

          // Check if coordinates are within bounds
          if (x < 0 || x >= terrainHeightData[0].length || z < 0 || z >= terrainHeightData.length) {
            continue
          }

          // Check flatness by sampling nearby points
          let maxDiff = 0
          const centerHeight = terrainHeightData[z][x]

          // Check surrounding points
          for (let nx = -1; nx <= 1; nx++) {
            for (let nz = -1; nz <= 1; nz++) {
              const neighborX = x + nx
              const neighborZ = z + nz

              if (
                neighborX >= 0 &&
                neighborX < terrainHeightData[0].length &&
                neighborZ >= 0 &&
                neighborZ < terrainHeightData.length
              ) {
                const neighborHeight = terrainHeightData[neighborZ][neighborX]
                const diff = Math.abs(neighborHeight - centerHeight)
                maxDiff = Math.max(maxDiff, diff)
              }
            }
          }

          // Check if this area is above water level
          const waterHeight = terrainParams.waterLevel * terrainParams.height + terrainParams.heightOffset
          if (centerHeight <= waterHeight) {
            continue
          }

          // If this area is flatter than our current best, update
          if (maxDiff < flatnessScore) {
            flatnessScore = maxDiff
            bestSpawnX = x
            bestSpawnZ = z
          }
        }
      }
    }

    // Convert grid coordinates to world coordinates
    const worldX = bestSpawnX - terrainHeightData[0].length / 2
    const worldZ = bestSpawnZ - terrainHeightData.length / 2

    // Get terrain height at spawn point
    const terrainHeight = terrainHeightData[bestSpawnZ][bestSpawnX]

    // Set spawn point just above the ground (player height + small offset)
    const PLAYER_HEIGHT = 1.7
    const SPAWN_OFFSET = 0.5 // Small offset to ensure player is above ground
    const worldY = terrainHeight + PLAYER_HEIGHT + SPAWN_OFFSET

    // Set spawn point
    const newSpawnPoint = new THREE.Vector3(worldX, worldY, worldZ)
    setSpawnPoint(newSpawnPoint)
    setTerrainReady(true)

    console.log(`Spawn point set at (${worldX.toFixed(2)}, ${worldY.toFixed(2)}, ${worldZ.toFixed(2)})`)
    console.log(`Terrain height at spawn: ${terrainHeight.toFixed(2)}, spawn height: ${worldY.toFixed(2)}`)
  }, [terrainHeightData, terrainParams])

  // Create walls for collision (boundary walls)
  const boundaryWalls = useMemo(() => {
    const wallGeometry = new THREE.BoxGeometry(1, 10, 1)
    const wallMaterial = new THREE.MeshStandardMaterial({
      color: 0x888888,
      visible: false, // Make walls invisible
    })

    // Create boundary walls
    const walls = []
    const size = 200 // Half the terrain size (increased from 50 to 200)

    // Add boundary walls
    for (let i = -size; i <= size; i += 10) {
      // Increased step from 5 to 10 for efficiency
      // North wall
      walls.push({
        position: [i, 5, -size],
        geometry: wallGeometry,
        material: wallMaterial,
      })

      // South wall
      walls.push({
        position: [i, 5, size],
        geometry: wallGeometry,
        material: wallMaterial,
      })

      // East wall
      walls.push({
        position: [size, 5, i],
        geometry: wallGeometry,
        material: wallMaterial,
      })

      // West wall
      walls.push({
        position: [-size, 5, i],
        geometry: wallGeometry,
        material: wallMaterial,
      })
    }

    setWalls(walls)
    return walls
  }, [])

  // Calculate water position
  const waterPosition = useMemo(() => {
    if (!terrainParams) {
      return [0, 0, 0]
    }
    return [0, terrainParams.waterLevel * terrainParams.height + terrainParams.heightOffset, 0]
  }, [terrainParams])

  // Calculate water level for trees
  const waterLevel = useMemo(() => {
    if (!terrainParams) {
      return 0
    }
    return terrainParams.waterLevel * terrainParams.height + terrainParams.heightOffset
  }, [terrainParams])

  // Render the currently equipped item
  const renderEquippedItem = () => {
    if (isInventoryOpen || gameStatus !== "playing") return null

    const currentItem = items[selectedSlot]
    if (!currentItem) return null

    console.log("Rendering equipped item:", currentItem.id, currentItem.type)

    // Match based on item ID prefix
    if (currentItem.id.startsWith("weapon_")) {
      return (
        <EnhancedWeapon 
          isLocked={isLocked} 
          combatSystem={combatSystemRef.current}
          onAmmoChange={(ammo) => {
            // Update ammo in parent if needed
            console.log("Ammo updated:", ammo)
          }}
        />
      )
    } else if (currentItem.id === "tool_hatchet") {
      return <Hatchet isLocked={isLocked} />
    } else if (currentItem.id === "tool_pickaxe") {
      return <Pickaxe isLocked={isLocked} />
    } else if (currentItem.id.startsWith("tool_building_plan")) {
      return <BuildingPlan isLocked={isLocked} />
    } else if (currentItem.id.startsWith("item_campfire")) {
      return (
        <CampfirePlacer
          isLocked={isLocked}
          terrainHeightData={terrainHeightData}
          placedCampfires={effectiveItemManager.items.campfire.map((item) => ({
            id: item.id,
            position: item.position,
            normal: item.normal || ([0, 1, 0] as [number, number, number]),
          }))}
          setPlacedCampfires={() => {}} // This will be handled by the ItemManager
        />
      )
    } else if (currentItem.id.startsWith("item_storage_box")) {
      return (
        <StorageBoxPlacer
          isLocked={isLocked}
          terrainHeightData={terrainHeightData}
          placedStorageBoxes={effectiveItemManager.items.storage_box.map((item) => ({
            id: item.id,
            position: item.position,
            normal: item.normal || ([0, 1, 0] as [number, number, number]),
          }))}
          setPlacedStorageBoxes={() => {}} // This will be handled by the ItemManager
        />
      )
    } else if (currentItem.id.startsWith("item_door")) {
      return <DoorPlacer isLocked={isLocked} terrainHeightData={terrainHeightData} />
    }

    console.warn(`Unknown item type: ${currentItem.id}`)
    return null
  }

  // Define sky color
  const skyColor = useMemo(() => new THREE.Color("#87CEEB"), []) // Sky blue

  // Create fog - matching the sky color for a natural blend
  const fogColor = useMemo(() => skyColor.clone(), [skyColor])
  const fogParams = useMemo(() => {
    // Fog starts at 50 units away and becomes completely opaque at maxRenderDistance
    // Adjust fog density based on settings
    const near = fogDensity === 0 ? maxRenderDistance : 50 / fogDensity
    const far = maxRenderDistance

    return {
      near,
      far,
      color: fogColor,
    }
  }, [fogColor, maxRenderDistance, fogDensity])

  // Determine if player movement should be disabled
  const isPlayerDisabled = gameStatus !== "playing" || isInventoryOpen

  // Handle campfire interaction
  const handleCampfireInteract = (campfireId: string) => {
    console.log(`GameScene: Campfire interaction triggered for ${campfireId}`)
    onCampfireInteraction(campfireId)
  }

  // Handle storage box interaction
  const handleStorageBoxInteract = (storageBoxId: string) => {
    console.log(`GameScene: Storage box interaction for ${storageBoxId}`)
    onStorageBoxInteraction(storageBoxId)
  }

  // Add player damage handler
  const handlePlayerDamage = (damage: number) => {
    console.log(`Player took ${damage} damage`)
    // TODO: Integrate with player health system
  }

  // Handle weapon fire integration with combat system
  const handleWeaponFireSetup = (combatSystem: any) => {
    combatSystemRef.current = combatSystem
    console.log("Combat system connected to GameScene")
  }

  // Update player position when it changes
  useEffect(() => {
    if (spawnPoint) {
      setPlayerPosition(spawnPoint)
    }
  }, [spawnPoint])

  return (
    <>
      <PointerLockControls ref={controls} />

      {/* Improved lighting for better terrain visibility */}
      <ambientLight intensity={0.6} />
      <directionalLight position={[50, 100, 50]} intensity={1.0} castShadow={settings.graphics?.enableShadows} />
      <directionalLight position={[-50, 50, -50]} intensity={0.5} castShadow={settings.graphics?.enableShadows} />

      {/* Sky color */}
      <color attach="background" args={[skyColor]} />

      {/* Enhanced fog with smooth blending - only if fog density > 0 */}
      {fogDensity > 0 && <fog attach="fog" args={[fogColor, fogParams.near, fogParams.far]} />}

      {/* Terrain */}
      {terrainGeometry && (
        <mesh
          ref={terrainRef}
          receiveShadow={settings.graphics?.enableShadows}
          geometry={terrainGeometry}
          material={terrainMaterial}
          castShadow={settings.graphics?.enableShadows}
        />
      )}

      {/* Water */}
      {waterGeometry && (
        <mesh
          position={waterPosition as [number, number, number]}
          rotation={[-Math.PI / 2, 0, 0]}
          geometry={waterGeometry}
          material={waterMaterial}
        />
      )}

      {/* Trees - only render when terrain is ready */}
      {terrainReady && terrainHeightData.length > 0 && terrainParams && (
        <>
          <Trees
            terrainHeightData={terrainHeightData}
            terrainSize={{ width: terrainParams.width, depth: terrainParams.depth }}
            waterLevel={waterLevel}
            maxRenderDistance={maxRenderDistance}
          />
          <StoneNodes
            terrainHeightData={terrainHeightData}
            terrainSize={{ width: terrainParams.width, depth: terrainParams.depth }}
            waterLevel={waterLevel}
            maxRenderDistance={maxRenderDistance}
          />
        </>
      )}

      {/* Boundary walls (invisible) */}
      {boundaryWalls.map((wall, index) => (
        <mesh
          key={index}
          position={wall.position as [number, number, number]}
          geometry={wall.geometry}
          material={wall.material}
          visible={false}
        />
      ))}

      {/* Player - only render when terrain is ready and spawn point is set */}
      {terrainReady && terrainHeightData.length > 0 && (
        <Player
          keys={keys}
          isLocked={isLocked && gameStatus === "playing"}
          walls={walls}
          terrainHeightData={terrainHeightData}
          spawnPoint={spawnPoint}
          trees={[]} // Trees are handled separately
          stones={[]} // Stones are handled separately
          storageBoxes={effectiveItemManager.items.storage_box.map((item) => ({
            id: item.id,
            position: item.position,
          }))}
          mouseSensitivity={settings.controls?.mouseSensitivity || 1.0}
          invertY={settings.controls?.invertY || false}
          disabled={isPlayerDisabled}
        />
      )}

      {/* Enemy Manager - handles all enemy AI and rendering */}
      {terrainReady && terrainHeightData.length > 0 && gameStatus === "playing" && (
        <EnemyManager
          terrainHeightData={terrainHeightData}
          playerPosition={playerPosition}
          isGameActive={gameStatus === "playing" && !isInventoryOpen}
          onPlayerDamage={handlePlayerDamage}
          onWeaponFire={handleWeaponFireSetup}
        />
      )}

      {/* Equipped item */}
      {renderEquippedItem()}

      {/* Placed storage boxes - render the actual 3D models */}
      {effectiveItemManager.items.storage_box.map((box) => (
        <StorageBox
          key={box.id}
          id={box.id}
          position={box.position}
          normal={box.normal || [0, 1, 0]}
          isGhost={false}
          scale={1}
        />
      ))}

      {/* Placed campfires - render the actual 3D models */}
      {effectiveItemManager.items.campfire.map((campfire) => {
        // Get the campfire data from the campfire context to check if it's active
        const campfireData = campfires.get(campfire.id)
        const isActive = campfireData?.isActive || false

        return (
          <Campfire
            key={campfire.id}
            id={campfire.id}
            position={campfire.position}
            normal={campfire.normal || [0, 1, 0]}
            isGhost={false}
            scale={1}
            isActive={isActive}
          />
        )
      })}

      {/* Placed campfire interactions */}
      {effectiveItemManager.items.campfire.map((campfire) => (
        <CampfireInteraction
          key={`interaction-${campfire.id}`}
          id={campfire.id}
          position={campfire.position}
          onInteract={handleCampfireInteract}
          disabled={gameStatus !== "playing" || isInventoryOpen}
        />
      ))}

      {/* Placed storage box interactions */}
      {effectiveItemManager.items.storage_box.map((box) => (
        <StorageBoxInteraction
          key={`interaction-${box.id}`}
          id={box.id}
          position={box.position}
          onInteract={handleStorageBoxInteract}
          disabled={gameStatus !== "playing" || isInventoryOpen}
        />
      ))}

      {/* Placed doors */}
      {effectiveItemManager.items.door.map((door) => (
        <Door
          key={door.id}
          id={door.id}
          position={door.position}
          rotation={door.rotation || [0, 0, 0]}
          isOpen={door.isOpen || false}
        />
      ))}
    </>
  )
}
