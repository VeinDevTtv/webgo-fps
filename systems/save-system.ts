import { GAME_CONFIG } from '@/lib/config/game-config'

export interface SaveData {
  id: string
  name: string
  timestamp: number
  version: string
  playerData: {
    position: { x: number; y: number; z: number }
    health: number
    hunger: number
    thirst: number
    inventory: any[]
    toolbar: any[]
  }
  worldData: {
    buildings: any[]
    resources: Record<string, number>
    placedItems: any[]
  }
  gameState: {
    playTime: number
    difficulty: string
    gameMode: string
  }
  weaponData: {
    weapons: any[]
    currentSlot: number
  }
  toolData: {
    tools: any[]
  }
}

export interface SaveSlot {
  id: string
  name: string
  timestamp: number
  preview: {
    playerLevel: number
    playTime: number
    location: string
  }
}

export class SaveSystem {
  private db: IDBDatabase | null = null
  private autoSaveInterval: number | null = null
  private isInitialized = false
  
  private onSaveComplete?: (saveId: string) => void
  private onLoadComplete?: (saveData: SaveData) => void
  private onError?: (error: string) => void

  constructor() {
    this.initializeDatabase()
  }

  private async initializeDatabase(): Promise<void> {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(
        GAME_CONFIG.SAVE_SYSTEM.DATABASE_NAME,
        GAME_CONFIG.SAVE_SYSTEM.DATABASE_VERSION
      )

      request.onerror = () => {
        console.error('Failed to open IndexedDB:', request.error)
        this.onError?.('Failed to initialize save system')
        reject(request.error)
      }

      request.onsuccess = () => {
        this.db = request.result
        this.isInitialized = true
        console.log('Save system initialized')
        resolve()
      }

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result

        // Create object stores
        if (!db.objectStoreNames.contains(GAME_CONFIG.SAVE_SYSTEM.STORES.GAME_SAVES)) {
          const saveStore = db.createObjectStore(GAME_CONFIG.SAVE_SYSTEM.STORES.GAME_SAVES, {
            keyPath: 'id'
          })
          saveStore.createIndex('timestamp', 'timestamp', { unique: false })
          saveStore.createIndex('name', 'name', { unique: false })
        }

        if (!db.objectStoreNames.contains(GAME_CONFIG.SAVE_SYSTEM.STORES.SETTINGS)) {
          db.createObjectStore(GAME_CONFIG.SAVE_SYSTEM.STORES.SETTINGS, {
            keyPath: 'key'
          })
        }

        if (!db.objectStoreNames.contains(GAME_CONFIG.SAVE_SYSTEM.STORES.PLAYER_DATA)) {
          db.createObjectStore(GAME_CONFIG.SAVE_SYSTEM.STORES.PLAYER_DATA, {
            keyPath: 'playerId'
          })
        }
      }
    })
  }

  private async waitForInitialization(): Promise<void> {
    if (this.isInitialized) return

    return new Promise((resolve) => {
      const checkInterval = setInterval(() => {
        if (this.isInitialized) {
          clearInterval(checkInterval)
          resolve()
        }
      }, 100)
    })
  }

  private compressData(data: any): string {
    if (!GAME_CONFIG.SAVE_SYSTEM.COMPRESSION_ENABLED) {
      return JSON.stringify(data)
    }

    // Simple compression using JSON.stringify with replacer
    // In a real implementation, you might use a library like pako for gzip compression
    const jsonString = JSON.stringify(data)
    
    // Basic run-length encoding for demonstration
    // This is not a real compression algorithm, just a placeholder
    return jsonString
  }

  private decompressData(compressedData: string): any {
    if (!GAME_CONFIG.SAVE_SYSTEM.COMPRESSION_ENABLED) {
      return JSON.parse(compressedData)
    }

    // Decompress the data (placeholder implementation)
    return JSON.parse(compressedData)
  }

  public async saveGame(
    saveData: Omit<SaveData, 'id' | 'timestamp'>,
    saveName?: string
  ): Promise<string> {
    await this.waitForInitialization()
    
    if (!this.db) {
      throw new Error('Database not initialized')
    }

    const saveId = `save_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
    const timestamp = Date.now()

    const fullSaveData: SaveData = {
      ...saveData,
      id: saveId,
      name: saveName || `Save ${new Date(timestamp).toLocaleString()}`,
      timestamp,
      version: '1.0.0',
    }

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(
        [GAME_CONFIG.SAVE_SYSTEM.STORES.GAME_SAVES],
        'readwrite'
      )

      const store = transaction.objectStore(GAME_CONFIG.SAVE_SYSTEM.STORES.GAME_SAVES)
      
      // Compress the save data
      const compressedData = {
        ...fullSaveData,
        data: this.compressData(fullSaveData),
      }

      const request = store.add(compressedData)

      request.onsuccess = () => {
        console.log('Game saved successfully:', saveId)
        this.onSaveComplete?.(saveId)
        resolve(saveId)
      }

      request.onerror = () => {
        console.error('Failed to save game:', request.error)
        this.onError?.('Failed to save game')
        reject(request.error)
      }
    })
  }

  public async loadGame(saveId: string): Promise<SaveData> {
    await this.waitForInitialization()
    
    if (!this.db) {
      throw new Error('Database not initialized')
    }

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(
        [GAME_CONFIG.SAVE_SYSTEM.STORES.GAME_SAVES],
        'readonly'
      )

      const store = transaction.objectStore(GAME_CONFIG.SAVE_SYSTEM.STORES.GAME_SAVES)
      const request = store.get(saveId)

      request.onsuccess = () => {
        if (request.result) {
          try {
            const saveData = this.decompressData(request.result.data) as SaveData
            console.log('Game loaded successfully:', saveId)
            this.onLoadComplete?.(saveData)
            resolve(saveData)
          } catch (error) {
            console.error('Failed to decompress save data:', error)
            this.onError?.('Failed to load game: corrupted save data')
            reject(error)
          }
        } else {
          const error = new Error('Save not found')
          this.onError?.('Save file not found')
          reject(error)
        }
      }

      request.onerror = () => {
        console.error('Failed to load game:', request.error)
        this.onError?.('Failed to load game')
        reject(request.error)
      }
    })
  }

  public async getSaveSlots(): Promise<SaveSlot[]> {
    await this.waitForInitialization()
    
    if (!this.db) {
      throw new Error('Database not initialized')
    }

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(
        [GAME_CONFIG.SAVE_SYSTEM.STORES.GAME_SAVES],
        'readonly'
      )

      const store = transaction.objectStore(GAME_CONFIG.SAVE_SYSTEM.STORES.GAME_SAVES)
      const request = store.getAll()

      request.onsuccess = () => {
        const saves = request.result.map((save: any) => ({
          id: save.id,
          name: save.name,
          timestamp: save.timestamp,
          preview: {
            playerLevel: 1, // Could be calculated from save data
            playTime: save.gameState?.playTime || 0,
            location: 'Unknown', // Could be derived from position
          },
        }))

        // Sort by timestamp (newest first)
        saves.sort((a: SaveSlot, b: SaveSlot) => b.timestamp - a.timestamp)

        resolve(saves)
      }

      request.onerror = () => {
        console.error('Failed to get save slots:', request.error)
        reject(request.error)
      }
    })
  }

  public async deleteSave(saveId: string): Promise<void> {
    await this.waitForInitialization()
    
    if (!this.db) {
      throw new Error('Database not initialized')
    }

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(
        [GAME_CONFIG.SAVE_SYSTEM.STORES.GAME_SAVES],
        'readwrite'
      )

      const store = transaction.objectStore(GAME_CONFIG.SAVE_SYSTEM.STORES.GAME_SAVES)
      const request = store.delete(saveId)

      request.onsuccess = () => {
        console.log('Save deleted successfully:', saveId)
        resolve()
      }

      request.onerror = () => {
        console.error('Failed to delete save:', request.error)
        reject(request.error)
      }
    })
  }

  public async quickSave(gameData: any): Promise<string> {
    const saveData = this.createSaveDataFromGameState(gameData)
    return this.saveGame(saveData, 'Quick Save')
  }

  public async autoSave(gameData: any): Promise<string> {
    const saveData = this.createSaveDataFromGameState(gameData)
    return this.saveGame(saveData, 'Auto Save')
  }

  private createSaveDataFromGameState(gameData: any): Omit<SaveData, 'id' | 'timestamp'> {
    return {
      name: '', // Will be set by saveGame
      version: '1.0.0',
      playerData: {
        position: gameData.player?.position || { x: 0, y: 1.7, z: 0 },
        health: gameData.player?.health || 100,
        hunger: gameData.player?.hunger || 100,
        thirst: gameData.player?.thirst || 100,
        inventory: gameData.inventory?.items || [],
        toolbar: gameData.toolbar?.items || [],
      },
      worldData: {
        buildings: gameData.buildings || [],
        resources: gameData.resources || {},
        placedItems: gameData.placedItems || [],
      },
      gameState: {
        playTime: gameData.playTime || 0,
        difficulty: gameData.difficulty || 'normal',
        gameMode: gameData.gameMode || 'survival',
      },
      weaponData: {
        weapons: gameData.weapons || [],
        currentSlot: gameData.currentWeaponSlot || 0,
      },
      toolData: {
        tools: gameData.tools || [],
      },
    }
  }

  public startAutoSave(getGameData: () => any): void {
    if (this.autoSaveInterval) {
      this.stopAutoSave()
    }

    this.autoSaveInterval = window.setInterval(async () => {
      try {
        const gameData = getGameData()
        await this.autoSave(gameData)
        console.log('Auto-save completed')
      } catch (error) {
        console.error('Auto-save failed:', error)
      }
    }, GAME_CONFIG.SAVE_SYSTEM.AUTO_SAVE_INTERVAL)

    console.log('Auto-save started')
  }

  public stopAutoSave(): void {
    if (this.autoSaveInterval) {
      clearInterval(this.autoSaveInterval)
      this.autoSaveInterval = null
      console.log('Auto-save stopped')
    }
  }

  public async exportSave(saveId: string): Promise<string> {
    const saveData = await this.loadGame(saveId)
    return JSON.stringify(saveData, null, 2)
  }

  public async importSave(saveDataJson: string): Promise<string> {
    try {
      const saveData = JSON.parse(saveDataJson) as SaveData
      
      // Generate new ID to avoid conflicts
      const newSaveData = {
        ...saveData,
        name: `${saveData.name} (Imported)`,
      }
      
      return await this.saveGame(newSaveData)
    } catch (error) {
      throw new Error('Invalid save data format')
    }
  }

  // Event listeners
  public onSaveCompleteEvent(callback: (saveId: string) => void): void {
    this.onSaveComplete = callback
  }

  public onLoadCompleteEvent(callback: (saveData: SaveData) => void): void {
    this.onLoadComplete = callback
  }

  public onErrorEvent(callback: (error: string) => void): void {
    this.onError = callback
  }

  public dispose(): void {
    this.stopAutoSave()
    
    if (this.db) {
      this.db.close()
      this.db = null
    }
    
    this.isInitialized = false
  }
} 