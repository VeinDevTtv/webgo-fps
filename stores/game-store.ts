import { create } from 'zustand'
import type * as THREE from 'three'
import { GAME_CONFIG, type GameState } from '@/lib/config/game-config'

// Core game state interfaces
export interface BulletTrail {
  start: THREE.Vector3
  end: THREE.Vector3
  timestamp: number
  intensity?: number
}

export interface PlayerState {
  position: { x: number; y: number; z: number }
  rotation: { x: number; y: number; z: number }
  velocity: { x: number; y: number; z: number }
  health: number
  hunger: number
  thirst: number
  isGrounded: boolean
  isCrouching: boolean
  isSprinting: boolean
  isJumping: boolean
}

export interface WeaponState {
  currentAmmo: number
  reserveAmmo: number
  isReloading: boolean
  lastFireTime: number
  recoil: number
}

export interface InventoryItem {
  id: string
  type: string
  name: string
  icon: string
  quantity?: number
}

export interface GameStore {
  // Game State
  gameState: GameState
  isLoading: boolean
  isLocked: boolean
  terrainReady: boolean
  
  // Player State
  player: PlayerState
  
  // Weapon State
  weapon: WeaponState
  
  // Inventory State
  inventory: {
    items: (InventoryItem | null)[]
    isOpen: boolean
    selectedSlot: number
  }
  
  // Toolbar State
  toolbar: {
    items: (InventoryItem | null)[]
    selectedSlot: number
  }
  
  // World State
  world: {
    bulletTrails: BulletTrail[]
    placedCampfires: Array<{
      id: string
      position: [number, number, number]
      isActive?: boolean
    }>
    placedStorageBoxes: Array<{
      id: string
      position: [number, number, number]
      normal?: [number, number, number]
    }>
  }
  
  // UI State
  ui: {
    showDebug: boolean
    showCrosshair: boolean
    activeCampfire: string | null
    activeStorageBox: string | null
    notifications: Array<{
      id: string
      message: string
      type: 'info' | 'success' | 'warning' | 'error'
      timestamp: number
    }>
  }
  
  // Settings State
  settings: {
    graphics: {
      maxRenderDistance: number
      fogDensity: number
      enableShadows: boolean
      quality: 'low' | 'medium' | 'high'
    }
    controls: {
      mouseSensitivity: number
      invertY: boolean
    }
    audio: {
      masterVolume: number
      sfxVolume: number
    }
    gameplay: {
      fov: number
      showFps: boolean
      showCrosshair: boolean
      enableHud: boolean
    }
  }
  
  // Actions
  actions: {
    // Game State Actions
    setGameState: (state: GameState) => void
    setIsLoading: (loading: boolean) => void
    setIsLocked: (locked: boolean) => void
    setTerrainReady: (ready: boolean) => void
    
    // Player Actions
    updatePlayerPosition: (position: { x: number; y: number; z: number }) => void
    updatePlayerRotation: (rotation: { x: number; y: number; z: number }) => void
    updatePlayerVelocity: (velocity: { x: number; y: number; z: number }) => void
    updatePlayerHealth: (health: number) => void
    updatePlayerHunger: (hunger: number) => void
    updatePlayerThirst: (thirst: number) => void
    setPlayerGrounded: (grounded: boolean) => void
    setPlayerCrouching: (crouching: boolean) => void
    setPlayerSprinting: (sprinting: boolean) => void
    setPlayerJumping: (jumping: boolean) => void
    
    // Weapon Actions
    updateAmmo: (current: number, reserve: number) => void
    setReloading: (reloading: boolean) => void
    updateLastFireTime: (time: number) => void
    updateRecoil: (recoil: number) => void
    
    // Inventory Actions
    setInventoryOpen: (open: boolean) => void
    updateInventoryItem: (index: number, item: InventoryItem | null) => void
    setInventorySelectedSlot: (slot: number) => void
    addInventoryItem: (item: InventoryItem) => boolean
    removeInventoryItem: (index: number) => InventoryItem | null
    
    // Toolbar Actions
    updateToolbarItem: (index: number, item: InventoryItem | null) => void
    setToolbarSelectedSlot: (slot: number) => void
    
    // World Actions
    addBulletTrail: (trail: BulletTrail) => void
    clearOldBulletTrails: () => void
    addCampfire: (campfire: { id: string; position: [number, number, number]; isActive?: boolean }) => void
    updateCampfire: (id: string, updates: Partial<{ position: [number, number, number]; isActive: boolean }>) => void
    removeCampfire: (id: string) => void
    addStorageBox: (box: { id: string; position: [number, number, number]; normal?: [number, number, number] }) => void
    removeStorageBox: (id: string) => void
    
    // UI Actions
    setShowDebug: (show: boolean) => void
    setShowCrosshair: (show: boolean) => void
    setActiveCampfire: (id: string | null) => void
    setActiveStorageBox: (id: string | null) => void
    addNotification: (notification: { message: string; type: 'info' | 'success' | 'warning' | 'error' }) => void
    removeNotification: (id: string) => void
    
    // Settings Actions
    updateGraphicsSettings: (settings: Partial<GameStore['settings']['graphics']>) => void
    updateControlsSettings: (settings: Partial<GameStore['settings']['controls']>) => void
    updateAudioSettings: (settings: Partial<GameStore['settings']['audio']>) => void
    updateGameplaySettings: (settings: Partial<GameStore['settings']['gameplay']>) => void
    resetSettings: () => void
  }
}

// Create the store
export const useGameStore = create<GameStore>((set, get) => ({
      // Initial State
      gameState: GAME_CONFIG.GAME_STATES.LOADING,
      isLoading: true,
      isLocked: false,
      terrainReady: false,
      
      player: {
        position: { x: 0, y: GAME_CONFIG.PLAYER.HEIGHT, z: 0 },
        rotation: { x: 0, y: 0, z: 0 },
        velocity: { x: 0, y: 0, z: 0 },
        health: 100,
        hunger: 100,
        thirst: 100,
        isGrounded: false,
        isCrouching: false,
        isSprinting: false,
        isJumping: false,
      },
      
      weapon: {
        currentAmmo: GAME_CONFIG.WEAPONS.DEFAULT_AMMO.CURRENT,
        reserveAmmo: GAME_CONFIG.WEAPONS.DEFAULT_AMMO.RESERVE,
        isReloading: false,
        lastFireTime: 0,
        recoil: 0,
      },
      
      inventory: {
        items: Array(GAME_CONFIG.UI.INVENTORY_SIZE).fill(null),
        isOpen: false,
        selectedSlot: 0,
      },
      
      toolbar: {
        items: Array(GAME_CONFIG.UI.TOOLBAR_SIZE).fill(null),
        selectedSlot: 0,
      },
      
      world: {
        bulletTrails: [],
        placedCampfires: [],
        placedStorageBoxes: [],
      },
      
      ui: {
        showDebug: false,
        showCrosshair: true,
        activeCampfire: null,
        activeStorageBox: null,
        notifications: [],
      },
      
      settings: {
        graphics: {
          maxRenderDistance: 100,
          fogDensity: 1.5,
          enableShadows: false,
          quality: 'low',
        },
        controls: {
          mouseSensitivity: GAME_CONFIG.INPUT.MOUSE_SENSITIVITY_DEFAULT,
          invertY: GAME_CONFIG.INPUT.INVERT_Y_DEFAULT,
        },
        audio: {
          masterVolume: GAME_CONFIG.AUDIO.DEFAULT_MASTER_VOLUME,
          sfxVolume: GAME_CONFIG.AUDIO.DEFAULT_SFX_VOLUME,
        },
        gameplay: {
          fov: 75,
          showFps: false,
          showCrosshair: true,
          enableHud: true,
        },
      },
      
              // Actions
        actions: {
          // Game State Actions
          setGameState: (state) => set((prev) => ({ ...prev, gameState: state })),
          setIsLoading: (loading) => set((prev) => ({ ...prev, isLoading: loading })),
          setIsLocked: (locked) => set((prev) => ({ ...prev, isLocked: locked })),
          setTerrainReady: (ready) => set((prev) => ({ ...prev, terrainReady: ready })),
        
                  // Player Actions
          updatePlayerPosition: (position) => set((prev) => ({ 
            ...prev, 
            player: { ...prev.player, position } 
          })),
          updatePlayerRotation: (rotation) => set((prev) => ({ 
            ...prev, 
            player: { ...prev.player, rotation } 
          })),
          updatePlayerVelocity: (velocity) => set((prev) => ({ 
            ...prev, 
            player: { ...prev.player, velocity } 
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
          setPlayerGrounded: (grounded) => set((prev) => ({ 
            ...prev, 
            player: { ...prev.player, isGrounded: grounded } 
          })),
          setPlayerCrouching: (crouching) => set((prev) => ({ 
            ...prev, 
            player: { ...prev.player, isCrouching: crouching } 
          })),
          setPlayerSprinting: (sprinting) => set((prev) => ({ 
            ...prev, 
            player: { ...prev.player, isSprinting: sprinting } 
          })),
          setPlayerJumping: (jumping) => set((prev) => ({ 
            ...prev, 
            player: { ...prev.player, isJumping: jumping } 
          })),
        
        // Weapon Actions
        updateAmmo: (current, reserve) => set((draft) => {
          draft.weapon.currentAmmo = Math.max(0, current)
          draft.weapon.reserveAmmo = Math.max(0, reserve)
        }),
        setReloading: (reloading) => set((draft) => { draft.weapon.isReloading = reloading }),
        updateLastFireTime: (time) => set((draft) => { draft.weapon.lastFireTime = time }),
        updateRecoil: (recoil) => set((draft) => { draft.weapon.recoil = Math.max(0, recoil) }),
        
        // Inventory Actions
        setInventoryOpen: (open) => set((draft) => { draft.inventory.isOpen = open }),
        updateInventoryItem: (index, item) => set((draft) => {
          if (index >= 0 && index < draft.inventory.items.length) {
            draft.inventory.items[index] = item
          }
        }),
        setInventorySelectedSlot: (slot) => set((draft) => { draft.inventory.selectedSlot = slot }),
        addInventoryItem: (item) => {
          const state = get()
          const emptyIndex = state.inventory.items.findIndex(slot => slot === null)
          if (emptyIndex !== -1) {
            set((draft) => { draft.inventory.items[emptyIndex] = item })
            return true
          }
          return false
        },
        removeInventoryItem: (index) => {
          const state = get()
          const item = state.inventory.items[index]
          if (item) {
            set((draft) => { draft.inventory.items[index] = null })
            return item
          }
          return null
        },
        
        // Toolbar Actions
        updateToolbarItem: (index, item) => set((draft) => {
          if (index >= 0 && index < draft.toolbar.items.length) {
            draft.toolbar.items[index] = item
          }
        }),
        setToolbarSelectedSlot: (slot) => set((draft) => { draft.toolbar.selectedSlot = slot }),
        
        // World Actions
        addBulletTrail: (trail) => set((draft) => {
          draft.world.bulletTrails.unshift(trail)
          if (draft.world.bulletTrails.length > GAME_CONFIG.RENDERING.BULLET_TRAIL_LIMIT) {
            draft.world.bulletTrails = draft.world.bulletTrails.slice(0, GAME_CONFIG.RENDERING.BULLET_TRAIL_LIMIT)
          }
        }),
        clearOldBulletTrails: () => set((draft) => {
          const now = Date.now()
          draft.world.bulletTrails = draft.world.bulletTrails.filter(
            trail => now - trail.timestamp < 1000
          )
        }),
        addCampfire: (campfire) => set((draft) => { draft.world.placedCampfires.push(campfire) }),
        updateCampfire: (id, updates) => set((draft) => {
          const campfire = draft.world.placedCampfires.find(c => c.id === id)
          if (campfire) {
            Object.assign(campfire, updates)
          }
        }),
        removeCampfire: (id) => set((draft) => {
          draft.world.placedCampfires = draft.world.placedCampfires.filter(c => c.id !== id)
        }),
        addStorageBox: (box) => set((draft) => { draft.world.placedStorageBoxes.push(box) }),
        removeStorageBox: (id) => set((draft) => {
          draft.world.placedStorageBoxes = draft.world.placedStorageBoxes.filter(b => b.id !== id)
        }),
        
        // UI Actions
        setShowDebug: (show) => set((draft) => { draft.ui.showDebug = show }),
        setShowCrosshair: (show) => set((draft) => { draft.ui.showCrosshair = show }),
        setActiveCampfire: (id) => set((draft) => { draft.ui.activeCampfire = id }),
        setActiveStorageBox: (id) => set((draft) => { draft.ui.activeStorageBox = id }),
        addNotification: (notification) => set((draft) => {
          const id = `notification-${Date.now()}-${Math.random()}`
          draft.ui.notifications.push({
            id,
            ...notification,
            timestamp: Date.now(),
          })
        }),
        removeNotification: (id) => set((draft) => {
          draft.ui.notifications = draft.ui.notifications.filter(n => n.id !== id)
        }),
        
        // Settings Actions
        updateGraphicsSettings: (settings) => set((draft) => {
          Object.assign(draft.settings.graphics, settings)
        }),
        updateControlsSettings: (settings) => set((draft) => {
          Object.assign(draft.settings.controls, settings)
        }),
        updateAudioSettings: (settings) => set((draft) => {
          Object.assign(draft.settings.audio, settings)
        }),
        updateGameplaySettings: (settings) => set((draft) => {
          Object.assign(draft.settings.gameplay, settings)
        }),
        resetSettings: () => set((draft) => {
          draft.settings = {
            graphics: {
              maxRenderDistance: 100,
              fogDensity: 1.5,
              enableShadows: false,
              quality: 'low',
            },
            controls: {
              mouseSensitivity: GAME_CONFIG.INPUT.MOUSE_SENSITIVITY_DEFAULT,
              invertY: GAME_CONFIG.INPUT.INVERT_Y_DEFAULT,
            },
            audio: {
              masterVolume: GAME_CONFIG.AUDIO.DEFAULT_MASTER_VOLUME,
              sfxVolume: GAME_CONFIG.AUDIO.DEFAULT_SFX_VOLUME,
            },
            gameplay: {
              fov: 75,
              showFps: false,
              showCrosshair: true,
              enableHud: true,
            },
          }
        }),
      },
    }))
  )
)

// Selector hooks for performance
export const usePlayer = () => useGameStore(state => state.player)
export const useWeapon = () => useGameStore(state => state.weapon)
export const useInventory = () => useGameStore(state => state.inventory)
export const useToolbar = () => useGameStore(state => state.toolbar)
export const useWorld = () => useGameStore(state => state.world)
export const useUI = () => useGameStore(state => state.ui)
export const useSettings = () => useGameStore(state => state.settings)
export const useGameActions = () => useGameStore(state => state.actions) 