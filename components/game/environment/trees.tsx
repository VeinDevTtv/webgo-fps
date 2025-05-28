"use client"

import { useRef, useMemo, useEffect, useState } from "react"
import * as THREE from "three"
import { useFrame, useThree } from "@react-three/fiber"
import { TreeGenerator, type TreeInstance } from "@/lib/tree-generator"
import { useGameState } from "@/lib/game-context"
import { useSoundManager } from "@/lib/sound-manager"
import { useInventory } from "@/lib/inventory-context"
import { useNotifications } from "@/lib/notification-context"

interface TreesProps {
  terrainHeightData: number[][]
  terrainSize: { width: number; depth: number }
  waterLevel: number
  maxRenderDistance?: number
}

export default function Trees({ terrainHeightData, terrainSize, waterLevel, maxRenderDistance = 150 }: TreesProps) {
  const { playerPosition } = useGameState()
  const { camera } = useThree()
  const soundManager = useSoundManager()
  const { addItem } = useInventory()
  const { addNotification } = useNotifications()

  // References for instanced meshes
  const trunkRef = useRef<THREE.InstancedMesh>(null)
  const foliageRef = useRef<THREE.InstancedMesh>(null)
  const foliage2Ref = useRef<THREE.InstancedMesh>(null)

  // Track if trees have been initialized
  const initialized = useRef(false)

  // State for tree instances (need to use state to trigger re-renders when trees are chopped)
  const [treeInstances, setTreeInstances] = useState<TreeInstance[]>([])

  // Generate trees only once
  useEffect(() => {
    if (!terrainHeightData || terrainHeightData.length === 0 || treeInstances.length > 0) {
      return
    }

    console.log("Generating tree instances...")

    // Create tree generator
    const generator = new TreeGenerator(terrainHeightData, terrainSize, waterLevel, {
      count: 800, // Number of trees to generate
      minHeight: 2,
      maxHeight: 6,
      distribution: 0.7, // More clustered
    })

    // Generate trees
    const trees = generator.generateTrees()
    console.log(`Generated ${trees.length} trees`)
    setTreeInstances(trees)
  }, [terrainHeightData, terrainSize, waterLevel, treeInstances.length])

  // Create materials
  const trunkMaterial = useMemo(() => {
    return new THREE.MeshStandardMaterial({
      color: 0x8b4513, // Brown
      roughness: 0.9,
      metalness: 0.1,
    })
  }, [])

  const foliageMaterial = useMemo(() => {
    return new THREE.MeshStandardMaterial({
      color: 0x2e8b57, // Sea green
      roughness: 0.8,
      metalness: 0.0,
    })
  }, [])

  const foliageMaterial2 = useMemo(() => {
    return new THREE.MeshStandardMaterial({
      color: 0x3cb371, // Medium sea green (slightly different shade)
      roughness: 0.8,
      metalness: 0.0,
    })
  }, [])

  // Create geometries
  const trunkGeometry = useMemo(() => {
    return new THREE.CylinderGeometry(1, 1, 1, 8)
  }, [])

  const foliageGeometry = useMemo(() => {
    return new THREE.ConeGeometry(1, 1, 8)
  }, [])

  const foliageGeometry2 = useMemo(() => {
    return new THREE.SphereGeometry(1, 8, 6, 0, Math.PI * 2, 0, Math.PI / 2)
  }, [])

  // Handle tree hit - FIXED to ensure 20 wood is added per hit
  const handleTreeHit = (treeId: number, damage = 1) => {
    console.log(`Tree hit: ${treeId}, damage: ${damage}`)

    setTreeInstances((prevTrees) => {
      return prevTrees.map((tree) => {
        if (tree.id === treeId && !tree.isChopped) {
          // Calculate new health
          const newHealth = tree.health - damage

          // Remove the chop sound from here since we're playing it in the hatchet animation

          // FIXED: Create a wood item with exactly 20 quantity
          const woodItem = {
            id: `wood_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
            type: "resource",
            name: "Wood",
            icon: "/wood.png", // Updated path
            quantity: 20, // Explicitly set to 20
          }

          // Add wood to inventory - log before and after to verify
          console.log("Adding wood item with quantity:", woodItem.quantity)
          const added = addItem(woodItem)
          console.log("Wood added successfully:", added)

          // Trigger a notification for harvested wood
          addNotification({
            message: `+${woodItem.quantity} Wood`,
            type: "resource",
            icon: "/wood.png", // Updated path
          })

          // Check if tree is now chopped
          if (newHealth <= 0) {
            console.log(`Tree ${treeId} chopped down!`)

            // Calculate random respawn time (3-8 minutes)
            const minRespawnTime = 3 * 60 * 1000 // 3 minutes in ms
            const maxRespawnTime = 8 * 60 * 1000 // 8 minutes in ms
            const respawnDelay = minRespawnTime + Math.random() * (maxRespawnTime - minRespawnTime)
            const respawnTime = Date.now() + respawnDelay

            return {
              ...tree,
              health: 0,
              isChopped: true,
              respawnTime,
            }
          }

          // Just update health
          return {
            ...tree,
            health: newHealth,
          }
        }
        return tree
      })
    })
  }

  // Check for tree respawns
  useFrame(() => {
    // Only check every second or so for performance
    if (Math.random() > 0.01) return

    const now = Date.now()
    let needsUpdate = false

    // Check if any trees need to respawn
    setTreeInstances((prevTrees) => {
      const updatedTrees = prevTrees.map((tree) => {
        if (tree.isChopped && tree.respawnTime && now >= tree.respawnTime) {
          needsUpdate = true
          console.log(`Tree ${tree.id} respawned!`)
          return {
            ...tree,
            health: tree.maxHealth,
            isChopped: false,
            respawnTime: null,
          }
        }
        return tree
      })

      return needsUpdate ? updatedTrees : prevTrees
    })
  })

  // Set up instanced meshes - update when tree instances change
  useEffect(() => {
    if (!trunkRef.current || !foliageRef.current || !foliage2Ref.current || treeInstances.length === 0) {
      return
    }

    console.log("Updating tree instances...")

    // Temporary transform matrices
    const tempMatrix = new THREE.Matrix4()
    const tempPosition = new THREE.Vector3()
    const tempRotation = new THREE.Euler()
    const tempScale = new THREE.Vector3()

    // Set up each tree instance
    treeInstances.forEach((tree, i) => {
      // Skip if we've reached the instance count
      if (i >= trunkRef.current!.count) return

      // Skip if tree is chopped
      if (tree.isChopped) {
        // Hide the tree by scaling to 0
        tempScale.set(0, 0, 0)
        tempMatrix.compose(tree.position, new THREE.Quaternion(), tempScale)

        trunkRef.current!.setMatrixAt(i, tempMatrix)
        foliageRef.current!.setMatrixAt(i, tempMatrix)
        foliage2Ref.current!.setMatrixAt(i, tempMatrix)
        return
      }

      // Tree type specific adjustments
      let trunkRadius, trunkHeight, foliageScale, foliageY, foliageHeight

      switch (tree.type) {
        case 0: // Pine tree - FIX: Make trunk shorter and foliage taller
          trunkRadius = 0.2 * tree.scale
          trunkHeight = tree.height * 0.6 * tree.scale // SHORTER trunk (60% of height instead of 100%)
          foliageScale = 1.2 * tree.scale
          foliageHeight = tree.height * 0.9 * tree.scale // TALLER foliage (90% of height instead of 70%)
          foliageY = trunkHeight * 0.8 // Position foliage lower on the trunk
          break
        case 1: // Oak tree
          trunkRadius = 0.3 * tree.scale
          trunkHeight = tree.height * 0.8 * tree.scale
          foliageScale = 1.5 * tree.scale
          foliageHeight = tree.height * 0.7 * tree.scale
          foliageY = trunkHeight * 0.7
          break
        case 2: // Bush
          trunkRadius = 0.15 * tree.scale
          trunkHeight = tree.height * 0.5 * tree.scale
          foliageScale = 1.3 * tree.scale
          foliageHeight = tree.height * 0.6 * tree.scale
          foliageY = trunkHeight * 0.5
          break
        default:
          trunkRadius = 0.2 * tree.scale
          trunkHeight = tree.height * tree.scale
          foliageScale = 1.2 * tree.scale
          foliageHeight = tree.height * 0.7 * tree.scale
          foliageY = trunkHeight * 0.6
      }

      // Set trunk instance
      tempPosition.copy(tree.position)
      tempPosition.y += trunkHeight / 2 // Move up to half height
      tempRotation.copy(tree.rotation)
      tempScale.set(trunkRadius, trunkHeight, trunkRadius)

      tempMatrix.compose(tempPosition, new THREE.Quaternion().setFromEuler(tempRotation), tempScale)
      trunkRef.current!.setMatrixAt(i, tempMatrix)

      // Set foliage instance based on tree type
      if (tree.type === 0) {
        // Pine tree - cone foliage
        tempPosition.copy(tree.position)
        tempPosition.y += foliageY
        tempScale.set(foliageScale, foliageHeight, foliageScale) // Use taller foliage height

        tempMatrix.compose(tempPosition, new THREE.Quaternion().setFromEuler(tree.rotation), tempScale)
        foliageRef.current!.setMatrixAt(i, tempMatrix)

        // Hide the second foliage for pine trees
        tempScale.set(0, 0, 0)
        tempMatrix.compose(tempPosition, new THREE.Quaternion(), tempScale)
        foliage2Ref.current!.setMatrixAt(i, tempMatrix)
      } else {
        // Oak tree or bush - spherical foliage
        // Hide the cone foliage
        tempScale.set(0, 0, 0)
        tempMatrix.compose(tempPosition, new THREE.Quaternion(), tempScale)
        foliageRef.current!.setMatrixAt(i, tempMatrix)

        // Set spherical foliage
        tempPosition.copy(tree.position)
        tempPosition.y += foliageY
        tempScale.set(foliageScale * 1.2, foliageScale * 1.2, foliageScale * 1.2)

        tempMatrix.compose(tempPosition, new THREE.Quaternion().setFromEuler(tree.rotation), tempScale)
        foliage2Ref.current!.setMatrixAt(i, tempMatrix)
      }

      // Store collision data in the tree instance
      if (tree.type === 0) {
        // Pine tree
        tree.trunkRadius = trunkRadius
        tree.trunkHeight = trunkHeight
        tree.foliageRadius = foliageScale
        tree.foliageBottom = tree.position.y + foliageY - foliageHeight * 0.5
        tree.foliageTop = tree.position.y + foliageY + foliageHeight * 0.5
      } else {
        // Oak tree or bush
        tree.trunkRadius = trunkRadius
        tree.trunkHeight = trunkHeight
        tree.foliageRadius = foliageScale * 1.2
        tree.foliageBottom = tree.position.y + foliageY - foliageScale * 1.2
        tree.foliageTop = tree.position.y + foliageY + foliageScale * 1.2
      }
    })

    // Update the instance matrices
    trunkRef.current.instanceMatrix.needsUpdate = true
    foliageRef.current.instanceMatrix.needsUpdate = true
    foliage2Ref.current.instanceMatrix.needsUpdate = true

    console.log("Tree update complete")
    initialized.current = true
  }, [treeInstances])

  // Visibility culling based on distance from player
  useFrame(() => {
    if (
      !trunkRef.current ||
      !foliageRef.current ||
      !foliage2Ref.current ||
      treeInstances.length === 0 ||
      !initialized.current
    ) {
      return
    }

    // Only update every few frames for performance
    if (Math.random() > 0.05) return

    const playerPos = new THREE.Vector3(playerPosition.x, playerPosition.y, playerPosition.z)
    const tempMatrix = new THREE.Matrix4()
    const tempPosition = new THREE.Vector3()
    const tempScale = new THREE.Vector3()
    const tempRotation = new THREE.Quaternion()

    // Maximum distance for tree visibility - use the provided maxRenderDistance
    const maxDistanceSq = maxRenderDistance * maxRenderDistance

    // Check each tree
    treeInstances.forEach((tree, i) => {
      // Skip if we've reached the instance count
      if (i >= trunkRef.current!.count) return

      // Skip if tree is chopped
      if (tree.isChopped) return

      // Calculate distance to player
      const distSq = playerPos.distanceToSquared(tree.position)

      // Get current matrix
      trunkRef.current!.getMatrixAt(i, tempMatrix)
      tempMatrix.decompose(tempPosition, tempRotation, tempScale)

      // If tree is too far, scale it to 0 to hide it
      if (distSq > maxDistanceSq) {
        if (tempScale.x !== 0) {
          // Hide the tree
          tempScale.set(0, 0, 0)
          tempMatrix.compose(tempPosition, tempRotation, tempScale)
          trunkRef.current!.setMatrixAt(i, tempMatrix)
          foliageRef.current!.setMatrixAt(i, tempMatrix)
          foliage2Ref.current!.setMatrixAt(i, tempMatrix)

          trunkRef.current!.instanceMatrix.needsUpdate = true
          foliageRef.current!.instanceMatrix.needsUpdate = true
          foliage2Ref.current!.instanceMatrix.needsUpdate = true
        }
      } else if (tempScale.x === 0) {
        // Tree is in range but hidden, show it again
        // We need to recalculate its matrix

        // Tree type specific adjustments
        let trunkRadius, trunkHeight, foliageScale, foliageY, foliageHeight

        switch (tree.type) {
          case 0: // Pine tree - FIX: Make trunk shorter and foliage taller
            trunkRadius = 0.2 * tree.scale
            trunkHeight = tree.height * 0.6 * tree.scale // SHORTER trunk (60% of height instead of 100%)
            foliageScale = 1.2 * tree.scale
            foliageHeight = tree.height * 0.9 * tree.scale // TALLER foliage (90% of height instead of 70%)
            foliageY = trunkHeight * 0.8 // Position foliage lower on the trunk
            break
          case 1: // Oak tree
            trunkRadius = 0.3 * tree.scale
            trunkHeight = tree.height * 0.8 * tree.scale
            foliageScale = 1.5 * tree.scale
            foliageHeight = tree.height * 0.7 * tree.scale
            foliageY = trunkHeight * 0.7
            break
          case 2: // Bush
            trunkRadius = 0.15 * tree.scale
            trunkHeight = tree.height * 0.5 * tree.scale
            foliageScale = 1.3 * tree.scale
            foliageHeight = tree.height * 0.6 * tree.scale
            foliageY = trunkHeight * 0.5
            break
          default:
            trunkRadius = 0.2 * tree.scale
            trunkHeight = tree.height * tree.scale
            foliageScale = 1.2 * tree.scale
            foliageHeight = tree.height * 0.7 * tree.scale
            foliageY = trunkHeight * 0.6
        }

        // Set trunk instance
        tempPosition.copy(tree.position)
        tempPosition.y += trunkHeight / 2 // Move up to half height
        tempScale.set(trunkRadius, trunkHeight, trunkRadius)

        tempMatrix.compose(tempPosition, new THREE.Quaternion().setFromEuler(tempRotation), tempScale)
        trunkRef.current!.setMatrixAt(i, tempMatrix)

        // Set foliage instance based on tree type
        if (tree.type === 0) {
          // Pine tree - cone foliage
          tempPosition.copy(tree.position)
          tempPosition.y += foliageY
          tempScale.set(foliageScale, foliageHeight, foliageScale) // Use taller foliage height

          tempMatrix.compose(tempPosition, new THREE.Quaternion().setFromEuler(tree.rotation), tempScale)
          foliageRef.current!.setMatrixAt(i, tempMatrix)

          // Hide the second foliage for pine trees
          tempScale.set(0, 0, 0)
          tempMatrix.compose(tempPosition, new THREE.Quaternion(), tempScale)
          foliage2Ref.current!.setMatrixAt(i, tempMatrix)
        } else {
          // Oak tree or bush - spherical foliage
          // Hide the cone foliage
          tempScale.set(0, 0, 0)
          tempMatrix.compose(tempPosition, new THREE.Quaternion(), tempScale)
          foliageRef.current!.setMatrixAt(i, tempMatrix)

          // Set spherical foliage
          tempPosition.copy(tree.position)
          tempPosition.y += foliageY
          tempScale.set(foliageScale * 1.2, foliageScale * 1.2, foliageScale * 1.2)

          tempMatrix.compose(tempPosition, new THREE.Quaternion().setFromEuler(tree.rotation), tempScale)
          foliage2Ref.current!.setMatrixAt(i, tempMatrix)
        }

        // Update the tree collision data when showing trees again
        if (tree.type === 0) {
          // Pine tree
          tree.trunkRadius = trunkRadius
          tree.trunkHeight = trunkHeight
          tree.foliageRadius = foliageScale
          tree.foliageBottom = tree.position.y + foliageY - foliageHeight * 0.5
          tree.foliageTop = tree.position.y + foliageY + foliageHeight * 0.5
        } else {
          // Oak tree or bush
          tree.trunkRadius = trunkRadius
          tree.trunkHeight = trunkHeight
          tree.foliageRadius = foliageScale * 1.2
          tree.foliageBottom = tree.position.y + foliageY - foliageScale * 1.2
          tree.foliageTop = tree.position.y + foliageY + foliageScale * 1.2
        }

        trunkRef.current!.instanceMatrix.needsUpdate = true
        foliageRef.current!.instanceMatrix.needsUpdate = true
        foliage2Ref.current!.instanceMatrix.needsUpdate = true
      }
    })
  })

  // Make tree data available for hatchet interaction
  useEffect(() => {
    // @ts-ignore
    window.treeInstances = treeInstances

    // Setup tree hit handler
    // @ts-ignore
    window.handleTreeHit = handleTreeHit

    return () => {
      // @ts-ignore
      delete window.treeInstances
      // @ts-ignore
      delete window.handleTreeHit
    }
  }, [treeInstances])

  // Calculate the maximum number of instances needed
  const instanceCount = Math.min(treeInstances.length, 1000) // Limit to 1000 trees for performance

  return (
    <>
      <instancedMesh ref={trunkRef} args={[trunkGeometry, trunkMaterial, instanceCount]} castShadow receiveShadow />
      <instancedMesh
        ref={foliageRef}
        args={[foliageGeometry, foliageMaterial, instanceCount]}
        castShadow
        receiveShadow
      />
      <instancedMesh
        ref={foliage2Ref}
        args={[foliageGeometry2, foliageMaterial2, instanceCount]}
        castShadow
        receiveShadow
      />
    </>
  )
}
