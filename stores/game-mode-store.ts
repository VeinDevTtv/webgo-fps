import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { GAME_CONFIG } from '@/lib/config/game-config'
import { MultiplayerManager } from '@/systems/multiplayer-manager'
import { EnemyAISystem } from '@/systems/enemy-ai-system'
import { EnhancedCollisionSystem } from '@/systems/enhanced-collision-system'

export type GameMode = 'sp' | 'mp' | null
export type GameState = typeof GAME_CONFIG.GAME_STATES[keyof typeof GAME_CONFIG.GAME_STATES]

export interface GameModeState {
  gameMode: GameMode
  isConnecting: boolean
  isConnected: boolean
  playerCount: number
  connectionError: string | null
  lastSelectedMode: GameMode
  
  // Multiplayer
  multiplayerManager: MultiplayerManager | null
  playerName: string
  serverUrl: string
  
  // Systems
  enemyAISystem: EnemyAISystem | null
  collisionSystem: EnhancedCollisionSystem | null
  
  // Game Loop
  currentWave: number
  waveStartTime: number
  isWaveActive: boolean
  waveBreakTime: number
  playerLevel: number
  playerXP: number
  survivalTime: number
  
  // Performance
  fps: number
  entityCount: number
  memoryUsage: number
  
  // Debug
  showDebugInfo: boolean
  showCollisionBoxes: boolean
  showEnemyPaths: boolean
}

export interface GameModeActions {
  setGameMode: (mode: GameMode) => void
  setConnecting: (connecting: boolean) => void
  setConnected: (connected: boolean) => void
  setPlayerCount: (count: number) => void
  setConnectionError: (error: string | null) => void
  testMultiplayerConnection: () => Promise<boolean>
  resetConnection: () => void
  
  // System Actions
  initializeSystems: () => void
  disposeSystems: () => void
  
  // Game Loop Actions
  startWave: (waveNumber: number) => void
  endWave: () => void
  addXP: (amount: number) => void
  levelUp: () => void
  updateSurvivalTime: (deltaTime: number) => void
  
  // Performance Actions
  updatePerformanceStats: (fps: number, entityCount: number, memoryUsage: number) => void
  
  // Debug Actions
  toggleDebugInfo: () => void
  toggleCollisionBoxes: () => void
  toggleEnemyPaths: () => void
  
  // Reset
  resetGame: () => void
}

export type GameModeStore = GameModeState & GameModeActions

const WEBSOCKET_URL = process.env.NEXT_PUBLIC_WEBSOCKET_URL || 'ws://localhost:8080'

const initialState: GameModeState = {
  gameMode: null,
  isConnecting: false,
  isConnected: false,
  playerCount: 0,
  connectionError: null,
  lastSelectedMode: null,
  
  multiplayerManager: null,
  playerName: '',
  serverUrl: GAME_CONFIG.GAME_MODE.DEFAULT_SERVER_URL,
  
  enemyAISystem: null,
  collisionSystem: null,
  
  currentWave: 0,
  waveStartTime: 0,
  isWaveActive: false,
  waveBreakTime: 0,
  playerLevel: 1,
  playerXP: 0,
  survivalTime: 0,
  
  fps: 60,
  entityCount: 0,
  memoryUsage: 0,
  
  showDebugInfo: false,
  showCollisionBoxes: false,
  showEnemyPaths: false,
}

export const useGameModeStore = create<GameModeStore>()(
  persist(
    (set, get) => ({
      ...initialState,

      // Actions
      setGameMode: (mode) => {
        set({ gameMode: mode, lastSelectedMode: mode })
        
        // Initialize systems based on mode
        if (mode) {
          const state = get()
          
          // Dispose existing systems
          if (state.collisionSystem) {
            state.collisionSystem.dispose()
          }
          if (state.enemyAISystem) {
            state.enemyAISystem.dispose()
          }
          
          // Create new systems
          const collisionSystem = new EnhancedCollisionSystem()
          
          // Map new game mode values to expected values
          const systemGameMode = mode === 'sp' ? 'single_player' : 'multiplayer'
          const enemyAISystem = new EnemyAISystem(systemGameMode, state.multiplayerManager || undefined)
          
          set({
            collisionSystem,
            enemyAISystem,
          })
        }
      },

      setConnecting: (connecting) => {
        set({ isConnecting: connecting })
      },

      setConnected: (connected) => {
        set({ isConnected: connected })
        if (!connected) {
          set({ playerCount: 0 })
        }
      },

      setPlayerCount: (count) => {
        set({ playerCount: count })
      },

      setConnectionError: (error) => {
        set({ connectionError: error })
      },

      testMultiplayerConnection: async () => {
        const { setConnecting, setConnected, setConnectionError, setPlayerCount } = get()
        
        setConnecting(true)
        setConnectionError(null)

        try {
          // Test WebSocket connection
          const ws = new WebSocket(WEBSOCKET_URL)
          
          return new Promise<boolean>((resolve) => {
            const timeout = setTimeout(() => {
              ws.close()
              setConnecting(false)
              setConnected(false)
              setConnectionError('Connection timeout - server may be offline')
              resolve(false)
            }, 5000) // 5 second timeout

            ws.onopen = () => {
              clearTimeout(timeout)
              setConnecting(false)
              setConnected(true)
              setConnectionError(null)
              
              // Request player count
              ws.send(JSON.stringify({ type: 'get_player_count' }))
              
              // Close test connection
              setTimeout(() => {
                ws.close()
              }, 100)
              
              resolve(true)
            }

            ws.onmessage = (event) => {
              try {
                const data = JSON.parse(event.data)
                if (data.type === 'player_count') {
                  setPlayerCount(data.count || 0)
                }
              } catch (error) {
                console.warn('Failed to parse WebSocket message:', error)
              }
            }

            ws.onerror = () => {
              clearTimeout(timeout)
              setConnecting(false)
              setConnected(false)
              setConnectionError('Failed to connect to multiplayer server')
              ws.close()
              resolve(false)
            }

            ws.onclose = () => {
              clearTimeout(timeout)
              setConnecting(false)
            }
          })
        } catch (error) {
          setConnecting(false)
          setConnected(false)
          setConnectionError('Network error - check your connection')
          return false
        }
      },

      resetConnection: () => {
        set({
          isConnecting: false,
          isConnected: false,
          playerCount: 0,
          connectionError: null
        })
      },

      // System Actions
      initializeSystems: () => {
        const state = get()
        
        if (!state.collisionSystem) {
          const collisionSystem = new EnhancedCollisionSystem()
          set({ collisionSystem })
        }
        
        if (!state.enemyAISystem && state.gameMode) {
          // Map new game mode values to expected values
          const systemGameMode = state.gameMode === 'sp' ? 'single_player' : 'multiplayer'
          const enemyAISystem = new EnemyAISystem(systemGameMode, state.multiplayerManager || undefined)
          set({ enemyAISystem })
        }
      },

      disposeSystems: () => {
        const state = get()
        
        if (state.collisionSystem) {
          state.collisionSystem.dispose()
        }
        
        if (state.enemyAISystem) {
          state.enemyAISystem.dispose()
        }
        
        set({
          collisionSystem: null,
          enemyAISystem: null,
        })
      },

      // Game Loop Actions
      startWave: (waveNumber: number) => {
        set({
          currentWave: waveNumber,
          waveStartTime: Date.now(),
          isWaveActive: true,
          waveBreakTime: 0,
        })
      },

      endWave: () => {
        set({
          isWaveActive: false,
          waveBreakTime: Date.now(),
        })
      },

      addXP: (amount: number) => {
        const state = get()
        const newXP = state.playerXP + amount
        const xpForNextLevel = GAME_CONFIG.GAME_LOOP.LEVEL_XP_REQUIREMENT * 
                              Math.pow(GAME_CONFIG.GAME_LOOP.LEVEL_XP_MULTIPLIER, state.playerLevel - 1)
        
        if (newXP >= xpForNextLevel) {
          // Level up
          const remainingXP = newXP - xpForNextLevel
          set({
            playerLevel: state.playerLevel + 1,
            playerXP: remainingXP,
          })
          
          // Trigger level up effects
          get().levelUp()
        } else {
          set({ playerXP: newXP })
        }
      },

      levelUp: () => {
        // Level up effects can be added here
        console.log(`Player leveled up to level ${get().playerLevel}!`)
      },

      updateSurvivalTime: (deltaTime: number) => {
        const state = get()
        const newSurvivalTime = state.survivalTime + deltaTime
        
        // Add survival XP
        const xpGained = Math.floor(deltaTime * GAME_CONFIG.GAME_LOOP.SURVIVAL_XP_PER_SECOND)
        if (xpGained > 0) {
          get().addXP(xpGained)
        }
        
        set({ survivalTime: newSurvivalTime })
      },

      // Performance Actions
      updatePerformanceStats: (fps: number, entityCount: number, memoryUsage: number) => {
        set({ fps, entityCount, memoryUsage })
      },

      // Debug Actions
      toggleDebugInfo: () => {
        set(state => ({ showDebugInfo: !state.showDebugInfo }))
      },

      toggleCollisionBoxes: () => {
        set(state => ({ showCollisionBoxes: !state.showCollisionBoxes }))
      },

      toggleEnemyPaths: () => {
        set(state => ({ showEnemyPaths: !state.showEnemyPaths }))
      },

      // Reset
      resetGame: () => {
        const state = get()
        
        // Dispose systems
        if (state.collisionSystem) {
          state.collisionSystem.dispose()
        }
        if (state.enemyAISystem) {
          state.enemyAISystem.dispose()
        }
        if (state.multiplayerManager) {
          state.multiplayerManager.disconnect()
        }
        
        // Reset to initial state
        set({
          ...initialState,
          gameMode: null,
          isConnecting: false,
          isConnected: false,
          playerCount: 0,
          connectionError: null,
          lastSelectedMode: null,
        })
      },
    }),
    {
      name: 'webgo-game-mode',
      partialize: (state) => ({
        lastSelectedMode: state.lastSelectedMode
      })
    }
  )
)

// Utility functions for external use
export const getGameModeStore = () => useGameModeStore.getState()

export const isMultiplayerMode = () => {
  const state = getGameModeStore()
  return state.gameMode === 'mp' && state.isConnected
}

export const isSinglePlayerMode = () => {
  const state = getGameModeStore()
  return state.gameMode === 'sp'
}

export const getCurrentWaveInfo = () => {
  const state = getGameModeStore()
  return {
    currentWave: state.currentWave,
    isActive: state.isWaveActive,
    timeRemaining: state.isWaveActive 
      ? Math.max(0, GAME_CONFIG.GAME_LOOP.WAVE_DURATION - (Date.now() - state.waveStartTime))
      : 0,
    breakTimeRemaining: !state.isWaveActive && state.waveBreakTime > 0
      ? Math.max(0, GAME_CONFIG.GAME_LOOP.WAVE_BREAK_DURATION - (Date.now() - state.waveBreakTime))
      : 0,
  }
}

export const getPlayerProgressInfo = () => {
  const state = getGameModeStore()
  const xpForNextLevel = GAME_CONFIG.GAME_LOOP.LEVEL_XP_REQUIREMENT * 
                        Math.pow(GAME_CONFIG.GAME_LOOP.LEVEL_XP_MULTIPLIER, state.playerLevel - 1)
  
  return {
    level: state.playerLevel,
    currentXP: state.playerXP,
    xpForNextLevel,
    xpProgress: state.playerXP / xpForNextLevel,
    survivalTime: state.survivalTime,
  }
} 