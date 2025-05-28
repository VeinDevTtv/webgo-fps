"use client"

import { useRef, useMemo, useState, useEffect } from "react"
import { useFrame } from "@react-three/fiber"
import * as THREE from "three"
import { Text } from "@react-three/drei"
import { Enemy as EnemyData, EnemyState } from "@/systems/enemy-ai-system"
import { PhysicsSystem, RigidBody } from "@/systems/physics-system"

interface RagdollEnemyProps {
  enemy: EnemyData
  onDamage?: (enemyId: string, damage: number, attackerId: string) => void
  playerPosition?: THREE.Vector3
  physicsSystem: PhysicsSystem
}

export default function RagdollEnemy({ enemy, onDamage, playerPosition, physicsSystem }: RagdollEnemyProps) {
  const groupRef = useRef<THREE.Group>(null)
  const bodyRef = useRef<THREE.Mesh>(null)
  const healthBarRef = useRef<THREE.Group>(null)
  const [animationTime, setAnimationTime] = useState(0)
  const [ragdollId, setRagdollId] = useState<string | null>(null)
  const [ragdollBodies, setRagdollBodies] = useState<RigidBody[]>([])
  const [deathTime, setDeathTime] = useState<number | null>(null)
  const [isRagdollActive, setIsRagdollActive] = useState(false)

  // Create enemy materials
  const bodyMaterial = useMemo(() => {
    const color = enemy.state === EnemyState.DEAD ? 0x666666 : 
                  enemy.state === EnemyState.ATTACKING ? 0xff4444 :
                  enemy.state === EnemyState.CHASING ? 0xff8844 : 0x444444
    
    return new THREE.MeshStandardMaterial({
      color,
      roughness: 0.8,
      metalness: 0.2,
    })
  }, [enemy.state])

  const healthBarMaterial = useMemo(() => {
    const healthPercent = enemy.health / enemy.maxHealth
    const color = healthPercent > 0.6 ? 0x00ff00 : 
                  healthPercent > 0.3 ? 0xffff00 : 0xff0000
    
    return new THREE.MeshBasicMaterial({ color })
  }, [enemy.health, enemy.maxHealth])

  const healthBarBgMaterial = useMemo(() => {
    return new THREE.MeshBasicMaterial({ color: 0x333333 })
  }, [])

  // Handle death and ragdoll creation
  useEffect(() => {
    if (enemy.state === EnemyState.DEAD && !ragdollId && !isRagdollActive) {
      // Create ragdoll physics
      const impulse = new THREE.Vector3(
        (Math.random() - 0.5) * 10,
        Math.random() * 5 + 2,
        (Math.random() - 0.5) * 10
      )
      
      const newRagdollId = physicsSystem.createRagdoll(enemy.position, impulse)
      setRagdollId(newRagdollId)
      setDeathTime(Date.now())
      setIsRagdollActive(true)
      
      // Get ragdoll bodies for rendering
      const bodies = physicsSystem.getRagdollBodies(newRagdollId)
      setRagdollBodies(bodies)
    }
  }, [enemy.state, ragdollId, isRagdollActive, physicsSystem, enemy.position])

  // Cleanup ragdoll after 10 seconds
  useEffect(() => {
    if (deathTime && ragdollId) {
      const cleanup = setTimeout(() => {
        physicsSystem.cleanupRagdoll(ragdollId)
        setRagdollId(null)
        setRagdollBodies([])
        setIsRagdollActive(false)
      }, 10000) // 10 seconds

      return () => clearTimeout(cleanup)
    }
  }, [deathTime, ragdollId, physicsSystem])

  // Update ragdoll bodies
  useFrame((state, delta) => {
    if (!groupRef.current) return

    if (isRagdollActive && ragdollId) {
      // Update physics
      physicsSystem.step(delta)
      
      // Update ragdoll body positions
      const updatedBodies = physicsSystem.getRagdollBodies(ragdollId)
      setRagdollBodies(updatedBodies)
      
      // Hide the main enemy mesh
      if (bodyRef.current) {
        bodyRef.current.visible = false
      }
      
      return // Skip normal animation when ragdoll is active
    }

    // Normal enemy behavior when alive
    if (enemy.state !== EnemyState.DEAD) {
      // Update position
      groupRef.current.position.copy(enemy.position)
      groupRef.current.rotation.copy(enemy.rotation)

      // Update animation time
      setAnimationTime(prev => prev + delta)

      // Simple walking animation when moving
      if (bodyRef.current && (enemy.state === EnemyState.PATROLLING || enemy.state === EnemyState.CHASING)) {
        const bobAmount = Math.sin(animationTime * 8) * 0.1
        bodyRef.current.position.y = 1.0 + bobAmount
      } else if (bodyRef.current) {
        bodyRef.current.position.y = 1.0
      }

      // Make health bar face camera
      if (healthBarRef.current && state.camera) {
        healthBarRef.current.lookAt(state.camera.position)
      }
    }
  })

  // Handle click for damage (temporary - will be replaced by weapon system)
  const handleClick = () => {
    if (enemy.state !== EnemyState.DEAD && onDamage) {
      onDamage(enemy.id, 25, "player") // Temporary damage amount
    }
  }

  const healthPercent = enemy.health / enemy.maxHealth

  // Render ragdoll bodies if active
  if (isRagdollActive && ragdollBodies.length > 0) {
    return (
      <group ref={groupRef}>
        {ragdollBodies.map((body, index) => {
          const isHead = body.id.includes('head')
          const isTorso = body.id.includes('torso')
          
          return (
            <mesh
              key={body.id}
              position={[body.position.x, body.position.y, body.position.z]}
              material={bodyMaterial}
            >
              {isHead ? (
                <sphereGeometry args={[body.size.x, 8, 8]} />
              ) : (
                <boxGeometry args={[body.size.x, body.size.y, body.size.z]} />
              )}
            </mesh>
          )
        })}
      </group>
    )
  }

  // Normal enemy rendering when alive
  return (
    <group ref={groupRef} position={[enemy.position.x, enemy.position.y, enemy.position.z]}>
      {/* Enemy Body */}
      <mesh 
        ref={bodyRef} 
        position={[0, 1, 0]} 
        onClick={handleClick}
        material={bodyMaterial}
      >
        {/* Simple humanoid shape */}
        <boxGeometry args={[0.6, 1.8, 0.3]} />
      </mesh>

      {/* Enemy Head */}
      <mesh position={[0, 2.2, 0]} material={bodyMaterial}>
        <sphereGeometry args={[0.3, 8, 8]} />
      </mesh>

      {/* Arms */}
      <mesh position={[-0.5, 1.5, 0]} material={bodyMaterial}>
        <boxGeometry args={[0.2, 1.0, 0.2]} />
      </mesh>
      <mesh position={[0.5, 1.5, 0]} material={bodyMaterial}>
        <boxGeometry args={[0.2, 1.0, 0.2]} />
      </mesh>

      {/* Legs */}
      <mesh position={[-0.2, 0.4, 0]} material={bodyMaterial}>
        <boxGeometry args={[0.2, 0.8, 0.2]} />
      </mesh>
      <mesh position={[0.2, 0.4, 0]} material={bodyMaterial}>
        <boxGeometry args={[0.2, 0.8, 0.2]} />
      </mesh>

      {/* Health Bar (only show if alive and damaged) */}
      {enemy.state !== EnemyState.DEAD && enemy.health < enemy.maxHealth && (
        <group ref={healthBarRef} position={[0, 3, 0]}>
          {/* Health Bar Background */}
          <mesh position={[0, 0, 0.01]}>
            <planeGeometry args={[2, 0.2]} />
            <primitive object={healthBarBgMaterial} />
          </mesh>
          
          {/* Health Bar Fill */}
          <mesh position={[-(1 - healthPercent), 0, 0.02]} scale={[healthPercent, 1, 1]}>
            <planeGeometry args={[2, 0.2]} />
            <primitive object={healthBarMaterial} />
          </mesh>

          {/* Health Text */}
          <Text
            position={[0, 0.3, 0]}
            fontSize={0.3}
            color="white"
            anchorX="center"
            anchorY="middle"
          >
            {`${Math.ceil(enemy.health)}/${enemy.maxHealth}`}
          </Text>
        </group>
      )}

      {/* State Indicator */}
      {enemy.state === EnemyState.ATTACKING && (
        <mesh position={[0, 3.5, 0]}>
          <sphereGeometry args={[0.1, 8, 8]} />
          <meshBasicMaterial color={0xff0000} />
        </mesh>
      )}

      {/* Attack Range Indicator (debug) */}
      {enemy.state === EnemyState.ATTACKING && (
        <mesh position={[0, 0.1, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <ringGeometry args={[0, 8, 16]} />
          <meshBasicMaterial color={0xff0000} transparent opacity={0.1} />
        </mesh>
      )}
    </group>
  )
} 