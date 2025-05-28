// Example: How to integrate the Audio System into existing WebGO components

import { useEffect, useRef, useState } from 'react'
import * as THREE from 'three'
import { AudioManager } from '@/systems/audio-manager'
import { WeaponSystem } from '@/systems/weapon-system'
import { ToolSystem } from '@/systems/tool-system'
import { BuildingSystem } from '@/systems/building-system'
import AudioSettingsHUD from '@/components/game/hud/audio-settings-hud'

// Example: Game Component Integration
export function GameComponentWithAudio() {
  const audioManagerRef = useRef<AudioManager | null>(null)
  const cameraRef = useRef<THREE.Camera | null>(null)

  useEffect(() => {
    // Initialize audio system when component mounts
    if (cameraRef.current) {
      audioManagerRef.current = new AudioManager({
        camera: cameraRef.current,
        // multiplayerManager: multiplayerManagerInstance, // Optional
      })

      // Set up audio system event listeners
      audioManagerRef.current.onSystemReadyEvent(() => {
        console.log('Audio system ready!')
      })

      audioManagerRef.current.onErrorEvent((error) => {
        console.error('Audio system error:', error)
      })
    }

    return () => {
      // Cleanup audio system when component unmounts
      audioManagerRef.current?.dispose()
    }
  }, [])

  // Example: Player movement with footsteps
  const handlePlayerMovement = (position: THREE.Vector3, isMoving: boolean) => {
    if (audioManagerRef.current) {
      audioManagerRef.current.updatePlayerState({
        position,
        isMoving,
        surfaceType: 'GRASS', // Detect surface type based on terrain
      })
    }
  }

  // Example: Game context updates for music
  const updateGameContext = (playerPos: THREE.Vector3, timeOfDay: number) => {
    if (audioManagerRef.current) {
      audioManagerRef.current.updateGameContext({
        playerPosition: playerPos,
        isInCombat: false, // Detect combat state
        nearbyEnemies: [], // List of enemy positions
        timeOfDay,
        isInMenu: false,
        playerHealth: 100,
      })
    }
  }

  return (
    <div>
      {/* Your game content here */}
    </div>
  )
}

// Example: Weapon System Integration
export function WeaponComponentWithAudio({ 
  weaponSystem, 
  audioManager 
}: { 
  weaponSystem: WeaponSystem
  audioManager: AudioManager 
}) {
  
  useEffect(() => {
    // Listen for weapon events and play appropriate sounds
    weaponSystem.onWeaponFireEvent((weaponData, direction) => {
      const weaponType = weaponData.id.toUpperCase() as 'RIFLE' | 'SHOTGUN' | 'PISTOL'
      const playerPosition = new THREE.Vector3(0, 1.7, 0) // Get actual player position
      
      audioManager.playWeaponSound(weaponType, 'FIRE', playerPosition)
    })

    weaponSystem.onWeaponSwitchEvent((weaponId) => {
      audioManager.playUISound('EQUIP')
    })

    weaponSystem.onAmmoUpdateEvent((current, reserve) => {
      if (current === 0) {
        audioManager.playWeaponSound('RIFLE', 'EMPTY_CLICK') // Use current weapon type
      }
    })

  }, [weaponSystem, audioManager])

  const handleReload = () => {
    const success = weaponSystem.startReload()
    if (success) {
      const currentWeapon = weaponSystem.getCurrentWeapon()
      if (currentWeapon) {
        const weaponType = currentWeapon.id.toUpperCase() as 'RIFLE' | 'SHOTGUN' | 'PISTOL'
        audioManager.playWeaponSound(weaponType, 'RELOAD')
      }
    }
  }

  return (
    <button onClick={handleReload}>
      Reload Weapon
    </button>
  )
}

// Example: Tool System Integration
export function ToolComponentWithAudio({ 
  toolSystem, 
  audioManager 
}: { 
  toolSystem: ToolSystem
  audioManager: AudioManager 
}) {

  const handleToolUse = (toolId: string, targetPosition: THREE.Vector3) => {
    const tool = toolSystem.getTool(toolId)
    if (tool && toolSystem.canUseTool(toolId)) {
      
      // Use the tool
      const result = toolSystem.useTool(toolId, 'tree') // or 'stone', 'dirt'
      
      if (result.success) {
        // Play tool sound
        const toolType = tool.type.toUpperCase() as 'HATCHET' | 'PICKAXE' | 'SHOVEL'
        audioManager.playToolSound(toolType, targetPosition)
        
        // Play tool break sound if tool broke
        if (result.toolBroken) {
          audioManager.playUISound('ALERT')
        }
      }
    }
  }

  return (
    <button onClick={() => handleToolUse('hatchet_1', new THREE.Vector3(5, 0, 5))}>
      Use Tool
    </button>
  )
}

// Example: Building System Integration
export function BuildingComponentWithAudio({ 
  buildingSystem, 
  audioManager 
}: { 
  buildingSystem: BuildingSystem
  audioManager: AudioManager 
}) {

  const handleBuildingPlace = (buildingType: string, position: THREE.Vector3) => {
    // Validate placement
    const validation = buildingSystem.validatePlacement(
      buildingType,
      position,
      new THREE.Euler(),
      new THREE.Vector3(0, 1.7, 0), // Player position
      0 // Terrain height
    )

    if (validation.isValid) {
      // Place building
      const buildingId = buildingSystem.placeBuilding(
        buildingType,
        validation.snappedPosition,
        validation.snappedRotation
      )

      if (buildingId) {
        audioManager.playBuildingSound('PLACE', validation.snappedPosition)
      }
    } else {
      // Invalid placement
      audioManager.playBuildingSound('INVALID')
    }
  }

  return (
    <button onClick={() => handleBuildingPlace('storage_box', new THREE.Vector3(10, 0, 10))}>
      Place Building
    </button>
  )
}

// Example: UI Component Integration
export function UIComponentWithAudio({ audioManager }: { audioManager: AudioManager }) {
  
  const handleButtonClick = () => {
    audioManager.playUISound('CLICK')
    // Handle button action
  }

  const handleButtonHover = () => {
    audioManager.playUISound('HOVER')
  }

  const handleInventoryMove = () => {
    audioManager.playUISound('INVENTORY_MOVE')
  }

  const handleNotification = () => {
    audioManager.playUISound('NOTIFICATION')
  }

  return (
    <div>
      <button 
        onClick={handleButtonClick}
        onMouseEnter={handleButtonHover}
      >
        Click Me
      </button>
      
      <button onClick={handleInventoryMove}>
        Move Item
      </button>
      
      <button onClick={handleNotification}>
        Show Notification
      </button>
    </div>
  )
}

// Example: Audio Settings Integration
export function GameSettingsWithAudio({ audioManager }: { audioManager: AudioManager }) {
  const [showAudioSettings, setShowAudioSettings] = useState(false)

  const handleOpenAudioSettings = () => {
    audioManager.playUISound('CLICK')
    setShowAudioSettings(true)
  }

  const handleCloseAudioSettings = () => {
    audioManager.playUISound('CLICK')
    setShowAudioSettings(false)
  }

  return (
    <div>
      <button onClick={handleOpenAudioSettings}>
        Audio Settings
      </button>
      
      {showAudioSettings && (
        <div>
          {/* AudioSettingsHUD would need public getters in AudioManager */}
          {/* <AudioSettingsHUD
            audioSystem={audioManager.getSpatialAudioSystem()}
            musicSystem={audioManager.getMusicSystem()}
            isVisible={showAudioSettings}
            onClose={handleCloseAudioSettings}
          /> */}
          <p>Audio Settings Panel (requires public getters in AudioManager)</p>
        </div>
      )}
    </div>
  )
}

// Example: Complete Game Loop Integration
export function GameLoopWithAudio() {
  const audioManagerRef = useRef<AudioManager | null>(null)
  const gameLoopRef = useRef<number | null>(null)

  useEffect(() => {
    // Game loop that updates audio context
    const gameLoop = () => {
      if (audioManagerRef.current) {
        // Update game context for music system
        const currentTime = new Date()
        const timeOfDay = currentTime.getHours() + currentTime.getMinutes() / 60

        audioManagerRef.current.updateGameContext({
          playerPosition: new THREE.Vector3(0, 1.7, 0), // Get actual player position
          isInCombat: false, // Detect combat state
          nearbyEnemies: [], // Get nearby enemy positions
          timeOfDay,
          isInMenu: false, // Check if in menu
          playerHealth: 100, // Get actual player health
        })
      }

      gameLoopRef.current = requestAnimationFrame(gameLoop)
    }

    gameLoop()

    return () => {
      if (gameLoopRef.current) {
        cancelAnimationFrame(gameLoopRef.current)
      }
    }
  }, [])

  return (
    <div>
      {/* Your game components here */}
    </div>
  )
}

export default {
  GameComponentWithAudio,
  WeaponComponentWithAudio,
  ToolComponentWithAudio,
  BuildingComponentWithAudio,
  UIComponentWithAudio,
  GameSettingsWithAudio,
  GameLoopWithAudio,
} 