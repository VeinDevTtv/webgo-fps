"use client"

import { useRef, useEffect, useState } from "react"
import { useFrame, useThree } from "@react-three/fiber"
import * as THREE from "three"
import Enemy from "./enemy"
import { EnemyAISystem, Enemy as EnemyData, EnemyState } from "@/systems/enemy-ai-system"
import { CombatSystem } from "@/systems/combat-system"
import { useGameModeStore } from "@/stores/game-mode-store"
import { useGameState } from "@/lib/game-state-context"
import { useNotifications } from "@/lib/notification-context"
import { GAME_CONFIG } from "@/lib/config/game-config"

interface EnemyManagerProps {
  terrainHeightData: number[][]
  playerPosition: THREE.Vector3
  isGameActive: boolean
  onPlayerDamage?: (damage: number) => void
  onWeaponFire?: (combatSystem: CombatSystem) => void
}

export default function EnemyManager({ 
  terrainHeightData, 
  playerPosition, 
  isGameActive,
  onPlayerDamage,
  onWeaponFire
}: EnemyManagerProps) {
  const { camera } = useThree()
  const { gameMode, playerCount } = useGameModeStore()
  const { gameStatus } = useGameState()
  const { addNotification } = useNotifications()
  
  const [enemies, setEnemies] = useState<EnemyData[]>([])
  const [currentWave, setCurrentWave] = useState(1)
  const [waveEnemiesKilled, setWaveEnemiesKilled] = useState(0)
  const [totalEnemiesKilled, setTotalEnemiesKilled] = useState(0)
  const [waveInProgress, setWaveInProgress] = useState(false)
  const [waveStartTime, setWaveStartTime] = useState(0)
  
  const enemySystemRef = useRef<EnemyAISystem | null>(null)
  const combatSystemRef = useRef<CombatSystem | null>(null)
  const lastPlayerUpdateTime = useRef(0)
  const waveCheckInterval = useRef<NodeJS.Timeout | null>(null)

  // Initialize enemy AI system and combat system
  useEffect(() => {
    if (!gameMode) return

    console.log("Initializing Enemy AI System for mode:", gameMode)
    
    const systemGameMode = gameMode === 'sp' ? 'single_player' : 'multiplayer'
    enemySystemRef.current = new EnemyAISystem(systemGameMode)
    combatSystemRef.current = new CombatSystem()

    // Connect combat system to enemy system
    combatSystemRef.current.setEnemySystem(enemySystemRef.current)

    // Set up combat hit callback
    combatSystemRef.current.onHit((hit) => {
      console.log(`Hit enemy ${hit.enemyId} for ${hit.damage} damage`)
      addNotification({
        message: `Hit! ${Math.ceil(hit.damage)} damage`,
        type: "info"
      })
    })

    // Expose combat system to parent
    if (onWeaponFire && combatSystemRef.current) {
      onWeaponFire(combatSystemRef.current)
    }

    // Set up event callbacks
    enemySystemRef.current.onEnemySpawnEvent((enemy) => {
      console.log("Enemy spawned:", enemy.id)
      addNotification({
        message: "Enemy spawned nearby!",
        type: "warning"
      })
    })

    enemySystemRef.current.onEnemyDeathEvent((enemy, loot) => {
      console.log("Enemy killed:", enemy.id)
      setWaveEnemiesKilled(prev => prev + 1)
      setTotalEnemiesKilled(prev => prev + 1)
      addNotification({
        message: "Enemy eliminated! (+25 XP)",
        type: "info"
      })
    })

    enemySystemRef.current.onEnemyAttackEvent((enemy, targetId, damage) => {
      console.log("Enemy attack:", enemy.id, "->", targetId, "damage:", damage)
      if (targetId === "player" && onPlayerDamage) {
        onPlayerDamage(damage)
        addNotification({
          message: `You took ${damage} damage!`,
          type: "error"
        })
      }
    })

    // Set terrain height data
    if (terrainHeightData.length > 0) {
      enemySystemRef.current.setTerrainData(terrainHeightData)
    }

    return () => {
      if (enemySystemRef.current) {
        enemySystemRef.current.dispose()
        enemySystemRef.current = null
      }
      if (combatSystemRef.current) {
        combatSystemRef.current.dispose()
        combatSystemRef.current = null
      }
      if (waveCheckInterval.current) {
        clearInterval(waveCheckInterval.current)
      }
    }
  }, [gameMode, terrainHeightData, addNotification, onPlayerDamage, onWeaponFire])

  // Update player information in enemy system
  useFrame(() => {
    if (!enemySystemRef.current || !isGameActive) return

    const now = Date.now()
    
    // Update player position every 100ms to avoid excessive updates
    if (now - lastPlayerUpdateTime.current > 100) {
      enemySystemRef.current.updatePlayerInfo("player", playerPosition, 100) // Assume 100 health for now
      lastPlayerUpdateTime.current = now
    }

    // Update enemy system
    const deltaTime = 0.016 // Approximate 60fps
    enemySystemRef.current.update(deltaTime)

    // Get updated enemies
    const updatedEnemies = enemySystemRef.current.getEnemies()
    setEnemies(updatedEnemies)
  })

  // Wave management
  useEffect(() => {
    if (!isGameActive || gameStatus !== "playing") return

    // Start first wave
    if (!waveInProgress && currentWave === 1) {
      startWave(1)
    }

    // Check for wave completion
    waveCheckInterval.current = setInterval(() => {
      if (waveInProgress && enemySystemRef.current) {
        const aliveEnemies = enemySystemRef.current.getEnemies().filter(e => e.isAlive).length
        const waveEnemyTarget = getWaveEnemyCount(currentWave)
        
        // Wave complete if all enemies killed
        if (waveEnemiesKilled >= waveEnemyTarget && aliveEnemies === 0) {
          completeWave()
        }
      }
    }, 1000)

    return () => {
      if (waveCheckInterval.current) {
        clearInterval(waveCheckInterval.current)
      }
    }
  }, [isGameActive, gameStatus, waveInProgress, currentWave, waveEnemiesKilled])

  const getWaveEnemyCount = (wave: number): number => {
    // Base enemies + scaling per wave
    return Math.min(3 + Math.floor(wave * 1.5), 10) // Cap at 10 enemies
  }

  const startWave = (waveNumber: number) => {
    console.log(`Starting wave ${waveNumber}`)
    setCurrentWave(waveNumber)
    setWaveInProgress(true)
    setWaveStartTime(Date.now())
    setWaveEnemiesKilled(0)
    
    addNotification({
      message: `Wave ${waveNumber} starting!`,
      type: "info"
    })

    // Force spawn enemies for this wave
    if (enemySystemRef.current) {
      const enemyCount = getWaveEnemyCount(waveNumber)
      for (let i = 0; i < enemyCount; i++) {
        // Trigger enemy spawning by temporarily reducing player count
        enemySystemRef.current.updatePlayerInfo("player", playerPosition, 100)
      }
    }
  }

  const completeWave = () => {
    console.log(`Wave ${currentWave} completed!`)
    setWaveInProgress(false)
    
    const waveTime = Math.floor((Date.now() - waveStartTime) / 1000)
    addNotification({
      message: `Wave ${currentWave} cleared in ${waveTime}s!`,
      type: "info"
    })

    // Start next wave after delay
    setTimeout(() => {
      if (currentWave < 10) { // Max 10 waves
        startWave(currentWave + 1)
      } else {
        addNotification({
          message: "All waves completed! You survived!",
          type: "info"
        })
      }
    }, 10000) // 10 second delay
  }

  // Handle enemy damage (for click-to-damage, will be replaced by weapon system)
  const handleEnemyDamage = (enemyId: string, damage: number, attackerId: string) => {
    if (!enemySystemRef.current) return

    const killed = enemySystemRef.current.damageEnemy(enemyId, damage, attackerId)
    if (killed) {
      console.log("Enemy killed by player:", enemyId)
    }
  }

  // Filter enemies for rendering (only alive or recently dead)
  const renderableEnemies = enemies.filter(enemy => {
    if (enemy.isAlive) return true
    if (enemy.state === EnemyState.DEAD && enemy.deathTime) {
      // Show dead enemies for 5 seconds
      return Date.now() - enemy.deathTime < 5000
    }
    return false
  })

  return (
    <>
      {/* Render all enemies */}
      {renderableEnemies.map(enemy => (
        <Enemy
          key={enemy.id}
          enemy={enemy}
          onDamage={handleEnemyDamage}
          playerPosition={playerPosition}
        />
      ))}

      {/* Wave UI Info (invisible but tracked) */}
      {waveInProgress && (
        <group position={[playerPosition.x, playerPosition.y + 10, playerPosition.z]}>
          {/* This could be used for 3D wave indicators if needed */}
        </group>
      )}
    </>
  )
} 