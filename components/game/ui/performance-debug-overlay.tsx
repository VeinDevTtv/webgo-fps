"use client"

import { useEffect, useState } from "react"
import { useGameModeStore } from "@/stores/game-mode-store"
import { GAME_CONFIG } from "@/lib/config/game-config"

interface PerformanceStats {
  fps: number
  frameTime: number
  memoryUsage: number
  entityCount: number
  drawCalls: number
  triangles: number
}

export default function PerformanceDebugOverlay() {
  const { 
    showDebugInfo, 
    fps, 
    entityCount, 
    memoryUsage,
    collisionSystem,
    enemyAISystem,
    gameMode,
    currentWave,
    isWaveActive,
    playerLevel,
    playerXP,
    survivalTime,
    toggleDebugInfo,
    toggleCollisionBoxes,
    toggleEnemyPaths,
    showCollisionBoxes,
    showEnemyPaths,
  } = useGameModeStore()

  const [performanceStats, setPerformanceStats] = useState<PerformanceStats>({
    fps: 60,
    frameTime: 16.67,
    memoryUsage: 0,
    entityCount: 0,
    drawCalls: 0,
    triangles: 0,
  })

  const [systemStats, setSystemStats] = useState({
    collisionObjects: 0,
    enemies: 0,
    lootDrops: 0,
    gridCells: 0,
  })

  // Update performance stats
  useEffect(() => {
    const updateStats = () => {
      // Get memory usage if available
      const memory = (performance as any).memory
      const memUsage = memory ? memory.usedJSHeapSize / 1024 / 1024 : 0

      setPerformanceStats(prev => ({
        ...prev,
        fps,
        frameTime: 1000 / Math.max(fps, 1),
        memoryUsage: memUsage,
        entityCount,
      }))

      // Update system stats
      const collisionDebug = collisionSystem?.getDebugInfo()
      const enemies = enemyAISystem?.getEnemies() || []
      const lootDrops = enemyAISystem?.getLootDrops() || []

      setSystemStats({
        collisionObjects: collisionDebug?.totalObjects || 0,
        enemies: enemies.length,
        lootDrops: lootDrops.length,
        gridCells: collisionDebug?.gridCells || 0,
      })
    }

    if (showDebugInfo) {
      const interval = setInterval(updateStats, 1000) // Update every second
      updateStats() // Initial update
      return () => clearInterval(interval)
    }
  }, [showDebugInfo, fps, entityCount, memoryUsage, collisionSystem, enemyAISystem])

  // Handle keyboard shortcuts
  useEffect(() => {
    const handleKeyPress = (e: KeyboardEvent) => {
      if (e.key === 'F3') {
        e.preventDefault()
        toggleDebugInfo()
      } else if (e.key === 'F4' && showDebugInfo) {
        e.preventDefault()
        toggleCollisionBoxes()
      } else if (e.key === 'F5' && showDebugInfo) {
        e.preventDefault()
        toggleEnemyPaths()
      }
    }

    window.addEventListener('keydown', handleKeyPress)
    return () => window.removeEventListener('keydown', handleKeyPress)
  }, [showDebugInfo, toggleDebugInfo, toggleCollisionBoxes, toggleEnemyPaths])

  if (!showDebugInfo) {
    return (
      <div className="fixed top-4 right-4 text-white text-xs bg-black/50 px-2 py-1 rounded">
        Press F3 for debug info
      </div>
    )
  }

  const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60)
    const secs = Math.floor(seconds % 60)
    return `${mins}:${secs.toString().padStart(2, '0')}`
  }

  const formatMemory = (mb: number): string => {
    return `${mb.toFixed(1)} MB`
  }

  const getPerformanceColor = (value: number, good: number, bad: number): string => {
    if (value >= good) return 'text-green-400'
    if (value <= bad) return 'text-red-400'
    return 'text-yellow-400'
  }

  return (
    <div className="fixed top-4 right-4 text-white text-xs font-mono bg-black/80 p-4 rounded-lg border border-gray-600 min-w-[300px]">
      {/* Header */}
      <div className="flex justify-between items-center mb-3 border-b border-gray-600 pb-2">
        <h3 className="text-sm font-bold text-blue-400">WebGO Debug Info</h3>
        <div className="text-xs text-gray-400">
          F3: Toggle | F4: Collision | F5: AI Paths
        </div>
      </div>

      {/* Performance Stats */}
      <div className="mb-3">
        <h4 className="text-xs font-semibold text-yellow-400 mb-1">Performance</h4>
        <div className="grid grid-cols-2 gap-2 text-xs">
          <div>
            FPS: <span className={getPerformanceColor(performanceStats.fps, 50, 30)}>
              {performanceStats.fps.toFixed(1)}
            </span>
          </div>
          <div>
            Frame: <span className={getPerformanceColor(60 - performanceStats.frameTime, 30, 10)}>
              {performanceStats.frameTime.toFixed(1)}ms
            </span>
          </div>
          <div>
            Memory: <span className={getPerformanceColor(200 - performanceStats.memoryUsage, 150, 50)}>
              {formatMemory(performanceStats.memoryUsage)}
            </span>
          </div>
          <div>
            Entities: <span className="text-white">
              {performanceStats.entityCount}
            </span>
          </div>
        </div>
      </div>

      {/* Game State */}
      <div className="mb-3">
        <h4 className="text-xs font-semibold text-green-400 mb-1">Game State</h4>
        <div className="text-xs space-y-1">
          <div>Mode: <span className="text-white">{gameMode || 'None'}</span></div>
          <div>Level: <span className="text-white">{playerLevel}</span></div>
          <div>XP: <span className="text-white">{playerXP}</span></div>
          <div>Survival: <span className="text-white">{formatTime(survivalTime)}</span></div>
          {currentWave > 0 && (
            <div>
              Wave: <span className="text-white">{currentWave}</span>
              <span className={isWaveActive ? 'text-red-400' : 'text-green-400'}>
                {isWaveActive ? ' (Active)' : ' (Break)'}
              </span>
            </div>
          )}
        </div>
      </div>

      {/* System Stats */}
      <div className="mb-3">
        <h4 className="text-xs font-semibold text-purple-400 mb-1">Systems</h4>
        <div className="text-xs space-y-1">
          <div>Collision Objects: <span className="text-white">{systemStats.collisionObjects}</span></div>
          <div>Grid Cells: <span className="text-white">{systemStats.gridCells}</span></div>
          <div>Enemies: <span className="text-white">{systemStats.enemies}</span></div>
          <div>Loot Drops: <span className="text-white">{systemStats.lootDrops}</span></div>
        </div>
      </div>

      {/* Debug Toggles */}
      <div className="mb-3">
        <h4 className="text-xs font-semibold text-orange-400 mb-1">Debug Toggles</h4>
        <div className="text-xs space-y-1">
          <div>
            <button
              onClick={toggleCollisionBoxes}
              className={`mr-2 px-2 py-1 rounded ${
                showCollisionBoxes ? 'bg-green-600' : 'bg-gray-600'
              }`}
            >
              Collision Boxes
            </button>
          </div>
          <div>
            <button
              onClick={toggleEnemyPaths}
              className={`mr-2 px-2 py-1 rounded ${
                showEnemyPaths ? 'bg-green-600' : 'bg-gray-600'
              }`}
            >
              Enemy Paths
            </button>
          </div>
        </div>
      </div>

      {/* Config Info */}
      <div className="border-t border-gray-600 pt-2">
        <h4 className="text-xs font-semibold text-cyan-400 mb-1">Config</h4>
        <div className="text-xs space-y-1">
          <div>Target FPS: <span className="text-white">{GAME_CONFIG.PERFORMANCE.FRAME_RATE_TARGET}</span></div>
          <div>Chunk Size: <span className="text-white">{GAME_CONFIG.PERFORMANCE.CHUNK_SIZE}</span></div>
          <div>LOD High: <span className="text-white">{GAME_CONFIG.PERFORMANCE.LOD_DISTANCES.HIGH}</span></div>
          <div>Enemy Update: <span className="text-white">{GAME_CONFIG.PERFORMANCE.ENEMY_UPDATE_INTERVAL}ms</span></div>
        </div>
      </div>

      {/* Enemy AI Info (if enemies exist) */}
      {systemStats.enemies > 0 && (
        <div className="border-t border-gray-600 pt-2 mt-2">
          <h4 className="text-xs font-semibold text-red-400 mb-1">Enemy AI</h4>
          <div className="text-xs space-y-1">
            <div>Spawn Threshold: <span className="text-white">{GAME_CONFIG.ENEMY_AI.SPAWN_THRESHOLD}</span></div>
            <div>Max Per Player: <span className="text-white">{GAME_CONFIG.ENEMY_AI.MAX_ENEMIES_PER_PLAYER}</span></div>
            <div>Chase Radius: <span className="text-white">{GAME_CONFIG.ENEMY_AI.CHASE_RADIUS}</span></div>
            <div>Attack Range: <span className="text-white">{GAME_CONFIG.ENEMY_AI.ATTACK_RANGE}</span></div>
          </div>
        </div>
      )}

      {/* Performance Warnings */}
      {(performanceStats.fps < 30 || performanceStats.memoryUsage > 200) && (
        <div className="border-t border-red-600 pt-2 mt-2">
          <h4 className="text-xs font-semibold text-red-400 mb-1">⚠️ Performance Warnings</h4>
          <div className="text-xs space-y-1">
            {performanceStats.fps < 30 && (
              <div className="text-red-300">Low FPS detected ({performanceStats.fps.toFixed(1)})</div>
            )}
            {performanceStats.memoryUsage > 200 && (
              <div className="text-red-300">High memory usage ({formatMemory(performanceStats.memoryUsage)})</div>
            )}
          </div>
        </div>
      )}
    </div>
  )
} 