"use client"

import { useRef, useMemo, useEffect, useState } from "react"
import * as THREE from "three"
import { useFrame, useThree } from "@react-three/fiber"
import { StoneGenerator, type StoneNodeInstance } from "@/lib/stone-generator"
import { useGameState } from "@/lib/game-context"
import { useSoundManager } from "@/lib/sound-manager"
import { useInventory } from "@/lib/inventory-context"
import { useNotifications } from "@/lib/notification-context"

interface StoneNodesProps {
  terrainHeightData: number[][]
  terrainSize: { width: number; depth: number }
  waterLevel: number
  maxRenderDistance?: number
  onStoneInstancesUpdate?: (stones: StoneNodeInstance[]) => void
}

export default function StoneNodes({
  terrainHeightData,
  terrainSize,
  waterLevel,
  maxRenderDistance = 150,
  onStoneInstancesUpdate,
}: StoneNodesProps) {
  const { playerPosition } = useGameState()
  const { camera } = useThree()
  const soundManager = useSoundManager()
  const { addItem } = useInventory()
  const { addNotification } = useNotifications()

  // References for instanced meshes
  const stoneRef1 = useRef<THREE.InstancedMesh>(null)
  const stoneRef2 = useRef<THREE.InstancedMesh>(null)
  const stoneRef3 = useRef<THREE.InstancedMesh>(null)

  // State for stone instances
  const [stoneInstances, setStoneInstances] = useState<StoneNodeInstance[]>([])

  // Generate stones only once
  useEffect(() => {
    if (!terrainHeightData || terrainHeightData.length === 0 || stoneInstances.length > 0) {
      return
    }

    console.log("Generating stone instances...")

    // Create stone generator
    const generator = new StoneGenerator(terrainHeightData, terrainSize, waterLevel, {
      count: 200, // Generate 200 stone nodes
      minSize: 0.8,
      maxSize: 2.0,
      distribution: 0.8, // More clustered than trees
      avoidWaterDepth: 3.0, // Increased to ensure stones are well away from water
    })

    // Generate stones
    const stones = generator.generateStones()
    console.log(`Generated ${stones.length} stones`)
    setStoneInstances(stones)

    // Notify parent component about stone instances
    if (onStoneInstancesUpdate) {
      onStoneInstancesUpdate(stones)
    }
  }, [terrainHeightData, terrainSize, waterLevel, stoneInstances.length, onStoneInstancesUpdate])

  // Create materials
  const stoneMaterials = useMemo(() => {
    return [
      new THREE.MeshStandardMaterial({
        color: 0x777777, // Gray
        roughness: 0.9,
        metalness: 0.1,
        frustumCulled: false, // Disable frustum culling
      }),
      new THREE.MeshStandardMaterial({
        color: 0x8b8878, // Darker gray with brown tint
        roughness: 0.8,
        metalness: 0.2,
        frustumCulled: false, // Disable frustum culling
      }),
      new THREE.MeshStandardMaterial({
        color: 0x696969, // Dark gray
        roughness: 0.7,
        metalness: 0.3,
        frustumCulled: false, // Disable frustum culling
      }),
    ]
  }, [])

  // Create geometries for different stone types
  const stoneGeometries = useMemo(() => {
    return [
      new THREE.DodecahedronGeometry(1, 1), // Rough boulder
      new THREE.IcosahedronGeometry(1, 0), // Angular rock
      new THREE.OctahedronGeometry(1, 0), // Sharp rock
    ]
  }, [])

  // Handle stone hit
  const handleStoneHit = (stoneId: number, damage = 1) => {
    console.log(`Stone hit: ${stoneId}, damage: ${damage}`)

    setStoneInstances((prevStones) => {
      const updatedStones = prevStones.map((stone) => {
        if (stone.id === stoneId && !stone.isMined) {
          // Calculate new health
          const newHealth = stone.health - damage

          // Create a stone item with exactly 20 quantity
          const stoneItem = {
            id: `stone_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
            type: "resource",
            name: "Stone",
            icon: "/stone.png", // Updated path
            quantity: 20, // Explicitly set to 20
          }

          // Add stone to inventory
          console.log("Adding stone item with quantity:", stoneItem.quantity)
          const added = addItem(stoneItem)
          console.log("Stone added successfully:", added)

          // Trigger a notification for harvested stone
          addNotification({
            message: `+${stoneItem.quantity} Stone`,
            type: "resource",
            icon: "/stone.png", // Updated path
          })

          // Check if stone is now mined
          if (newHealth <= 0) {
            console.log(`Stone ${stoneId} mined!`)

            // Calculate random respawn time (3-8 minutes)
            const minRespawnTime = 3 * 60 * 1000 // 3 minutes in ms
            const maxRespawnTime = 8 * 60 * 1000 // 8 minutes in ms
            const respawnDelay = minRespawnTime + Math.random() * (maxRespawnTime - minRespawnTime)
            const respawnTime = Date.now() + respawnDelay

            return {
              ...stone,
              health: 0,
              isMined: true,
              respawnTime,
            }
          }

          // Just update health
          return {
            ...stone,
            health: newHealth,
          }
        }
        return stone
      })

      // Notify parent component about updated stone instances
      if (onStoneInstancesUpdate) {
        onStoneInstancesUpdate(updatedStones)
      }

      return updatedStones
    })
  }

  // Check for stone respawns
  useFrame(() => {
    // Only check every second or so for performance
    if (Math.random() > 0.01) return

    const now = Date.now()
    let needsUpdate = false

    // Check if any stones need to respawn
    setStoneInstances((prevStones) => {
      const updatedStones = prevStones.map((stone) => {
        if (stone.isMined && stone.respawnTime && now >= stone.respawnTime) {
          needsUpdate = true
          console.log(`Stone ${stone.id} respawned!`)
          return {
            ...stone,
            health: stone.maxHealth,
            isMined: false,
            respawnTime: null,
          }
        }
        return stone
      })

      // Notify parent component about updated stone instances if needed
      if (needsUpdate && onStoneInstancesUpdate) {
        onStoneInstancesUpdate(updatedStones)
      }

      return needsUpdate ? updatedStones : prevStones
    })
  })

  // Set up instanced meshes - update when stone instances change
  useEffect(() => {
    if (!stoneRef1.current || !stoneRef2.current || !stoneRef3.current || stoneInstances.length === 0) {
      return
    }

    console.log("Updating stone instances...")

    // Disable frustum culling on the instanced meshes
    if (stoneRef1.current) stoneRef1.current.frustumCulled = false
    if (stoneRef2.current) stoneRef2.current.frustumCulled = false
    if (stoneRef3.current) stoneRef3.current.frustumCulled = false

    // Temporary transform matrices
    const tempMatrix = new THREE.Matrix4()
    const tempPosition = new THREE.Vector3()
    const tempRotation = new THREE.Euler()
    const tempScale = new THREE.Vector3()

    // Track counts per type
    const typeCount = [0, 0, 0]

    // Set up each stone instance
    stoneInstances.forEach((stone) => {
      // Skip if stone is mined
      if (stone.isMined) {
        return
      }

      // Get the correct reference based on type
      let ref
      let index

      switch (stone.type) {
        case 0:
          ref = stoneRef1.current
          index = typeCount[0]++
          break
        case 1:
          ref = stoneRef2.current
          index = typeCount[1]++
          break
        case 2:
          ref = stoneRef3.current
          index = typeCount[2]++
          break
        default:
          ref = stoneRef1.current
          index = typeCount[0]++
      }

      if (!ref || index >= ref.count) return

      // Set position and scale
      tempPosition.copy(stone.position)
      tempPosition.y += stone.scale * 0.5 // Move up by half height
      tempRotation.copy(stone.rotation)
      tempScale.set(stone.scale, stone.scale, stone.scale)

      tempMatrix.compose(tempPosition, new THREE.Quaternion().setFromEuler(tempRotation), tempScale)
      ref.setMatrixAt(index, tempMatrix)
      ref.instanceMatrix.needsUpdate = true
    })

    console.log(`Stone update complete: Type 0: ${typeCount[0]}, Type 1: ${typeCount[1]}, Type 2: ${typeCount[2]}`)
  }, [stoneInstances])

  // Make stone data available for pickaxe interaction
  useEffect(() => {
    // @ts-ignore
    window.stoneInstances = stoneInstances

    // Setup stone hit handler
    // @ts-ignore
    window.handleStoneHit = handleStoneHit

    return () => {
      // @ts-ignore
      delete window.stoneInstances
      // @ts-ignore
      delete window.handleStoneHit
    }
  }, [stoneInstances])

  // Calculate maximum number of instances needed per type
  // Divide total count by 3 (approximately) to distribute among types
  const maxInstancesPerType = Math.ceil((stoneInstances.length || 200) / 3)

  return (
    <>
      <instancedMesh
        ref={stoneRef1}
        args={[stoneGeometries[0], stoneMaterials[0], maxInstancesPerType]}
        castShadow
        receiveShadow
        frustumCulled={false}
      />
      <instancedMesh
        ref={stoneRef2}
        args={[stoneGeometries[1], stoneMaterials[1], maxInstancesPerType]}
        castShadow
        receiveShadow
        frustumCulled={false}
      />
      <instancedMesh
        ref={stoneRef3}
        args={[stoneGeometries[2], stoneMaterials[2], maxInstancesPerType]}
        castShadow
        receiveShadow
        frustumCulled={false}
      />
    </>
  )
}
