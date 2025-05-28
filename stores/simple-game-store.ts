import { create } from 'zustand'
import { GAME_CONFIG, type GameState } from '@/lib/config/game-config'

// Simplified interfaces for immediate use
export interface PlayerState {
  position: { x: number; y: number; z: number }
  health: number
  hunger: number
  thirst: number
}

export interface GameStore {
  // Game State
  gameState: GameState
  isLoading: boolean
  isLocked: boolean
  
  // Player State
  player: PlayerState
  
  // Actions
  setGameState: (state: GameState) => void
  setIsLoading: (loading: boolean) => void
  setIsLocked: (locked: boolean) => void
  updatePlayerPosition: (position: { x: number; y: number; z: number }) => void
  updatePlayerHealth: (health: number) => void
  updatePlayerHunger: (hunger: number) => void
  updatePlayerThirst: (thirst: number) => void
}

export const useGameStore = create<GameStore>((set) => ({
  // Initial State
  gameState: GAME_CONFIG.GAME_STATES.LOADING,
  isLoading: true,
  isLocked: false,
  
  player: {
    position: { x: 0, y: GAME_CONFIG.PLAYER.HEIGHT, z: 0 },
    health: 100,
    hunger: 100,
    thirst: 100,
  },
  
  // Actions
  setGameState: (state) => set((prev) => ({ ...prev, gameState: state })),
  setIsLoading: (loading) => set((prev) => ({ ...prev, isLoading: loading })),
  setIsLocked: (locked) => set((prev) => ({ ...prev, isLocked: locked })),
  updatePlayerPosition: (position) => set((prev) => ({ 
    ...prev, 
    player: { ...prev.player, position } 
  })),
  updatePlayerHealth: (health) => set((prev) => ({ 
    ...prev, 
    player: { ...prev.player, health: Math.max(0, Math.min(100, health)) } 
  })),
  updatePlayerHunger: (hunger) => set((prev) => ({ 
    ...prev, 
    player: { ...prev.player, hunger: Math.max(0, Math.min(100, hunger)) } 
  })),
  updatePlayerThirst: (thirst) => set((prev) => ({ 
    ...prev, 
    player: { ...prev.player, thirst: Math.max(0, Math.min(100, thirst)) } 
  })),
}))

// Selector hooks for performance
export const usePlayer = () => useGameStore(state => state.player)
export const useGameState = () => useGameStore(state => state.gameState)
export const useIsLoading = () => useGameStore(state => state.isLoading)
export const useIsLocked = () => useGameStore(state => state.isLocked) 