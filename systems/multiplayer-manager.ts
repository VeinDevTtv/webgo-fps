import { GAME_CONFIG } from '@/lib/config/game-config'

// Message types for multiplayer communication
export enum MessageType {
  // Connection
  PLAYER_JOIN = 'PLAYER_JOIN',
  PLAYER_LEAVE = 'PLAYER_LEAVE',
  PLAYER_LIST = 'PLAYER_LIST',
  
  // Player state
  PLAYER_POSITION = 'PLAYER_POSITION',
  PLAYER_ROTATION = 'PLAYER_ROTATION',
  PLAYER_ANIMATION = 'PLAYER_ANIMATION',
  
  // Actions
  PLAYER_SHOOT = 'PLAYER_SHOOT',
  PLAYER_TOOL_USE = 'PLAYER_TOOL_USE',
  PLAYER_INTERACT = 'PLAYER_INTERACT',
  PLAYER_WEAPON_SWITCH = 'PLAYER_WEAPON_SWITCH',
  PLAYER_WEAPON_STATE = 'PLAYER_WEAPON_STATE',
  
  // World state
  WORLD_UPDATE = 'WORLD_UPDATE',
  ITEM_PLACE = 'ITEM_PLACE',
  ITEM_REMOVE = 'ITEM_REMOVE',
  
  // System
  HEARTBEAT = 'HEARTBEAT',
  ERROR = 'ERROR',
}

export interface PlayerData {
  id: string
  name: string
  position: { x: number; y: number; z: number }
  rotation: { x: number; y: number; z: number }
  health: number
  isGrounded: boolean
  isCrouching: boolean
  isSprinting: boolean
  currentTool?: string
  currentWeapon?: string
  weaponState?: any
  lastUpdate: number
}

export interface MultiplayerMessage {
  type: MessageType
  playerId: string
  timestamp: number
  data: any
}

export interface ShootData {
  position: { x: number; y: number; z: number }
  direction: { x: number; y: number; z: number }
  weaponType: string
}

export interface ToolUseData {
  toolType: string
  targetPosition: { x: number; y: number; z: number }
  targetId?: string
}

export interface WeaponSwitchData {
  weaponId: string
  slotIndex: number
}

export interface WeaponStateData {
  currentSlot: number
  slots: Array<{
    slotIndex: number
    weaponId: string | null
    isUnlocked: boolean
    ammo: { current: number; reserve: number } | null
  }>
  isReloading: boolean
  isSwitching: boolean
}

export class MultiplayerManager {
  private socket: WebSocket | null = null
  private isConnected = false
  private playerId: string | null = null
  private players: Map<string, PlayerData> = new Map()
  private lastHeartbeat = 0
  private heartbeatInterval: number | null = null
  private reconnectAttempts = 0
  private maxReconnectAttempts = 5
  private reconnectDelay = 1000

  // Event callbacks
  private onPlayerJoin?: (player: PlayerData) => void
  private onPlayerLeave?: (playerId: string) => void
  private onPlayerUpdate?: (player: PlayerData) => void
  private onPlayerShoot?: (playerId: string, data: ShootData) => void
  private onPlayerToolUse?: (playerId: string, data: ToolUseData) => void
  private onPlayerWeaponSwitch?: (playerId: string, data: WeaponSwitchData) => void
  private onPlayerWeaponState?: (playerId: string, data: WeaponStateData) => void
  private onWorldUpdate?: (data: any) => void
  private onError?: (error: string) => void

  constructor() {
    this.playerId = this.generatePlayerId()
  }

  private generatePlayerId(): string {
    return `player_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
  }

  public connect(serverUrl: string): Promise<void> {
    return new Promise((resolve, reject) => {
      try {
        this.socket = new WebSocket(serverUrl)

        this.socket.onopen = () => {
          console.log('Connected to multiplayer server')
          this.isConnected = true
          this.reconnectAttempts = 0
          this.startHeartbeat()
          
          // Send join message
          this.sendMessage({
            type: MessageType.PLAYER_JOIN,
            playerId: this.playerId!,
            timestamp: Date.now(),
            data: {
              name: `Player_${this.playerId!.slice(-4)}`,
              position: { x: 0, y: 1.7, z: 0 },
              rotation: { x: 0, y: 0, z: 0 },
            },
          })
          
          resolve()
        }

        this.socket.onmessage = (event) => {
          this.handleMessage(JSON.parse(event.data))
        }

        this.socket.onclose = () => {
          console.log('Disconnected from multiplayer server')
          this.isConnected = false
          this.stopHeartbeat()
          this.attemptReconnect(serverUrl)
        }

        this.socket.onerror = (error) => {
          console.error('WebSocket error:', error)
          this.onError?.('Connection error')
          reject(error)
        }

      } catch (error) {
        reject(error)
      }
    })
  }

  private attemptReconnect(serverUrl: string): void {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.error('Max reconnection attempts reached')
      this.onError?.('Failed to reconnect to server')
      return
    }

    this.reconnectAttempts++
    console.log(`Attempting to reconnect (${this.reconnectAttempts}/${this.maxReconnectAttempts})...`)

    setTimeout(() => {
      this.connect(serverUrl).catch(() => {
        // Reconnection failed, will try again
      })
    }, this.reconnectDelay * this.reconnectAttempts)
  }

  private startHeartbeat(): void {
    this.heartbeatInterval = window.setInterval(() => {
      if (this.isConnected) {
        this.sendMessage({
          type: MessageType.HEARTBEAT,
          playerId: this.playerId!,
          timestamp: Date.now(),
          data: {},
        })
      }
    }, GAME_CONFIG.MULTIPLAYER.HEARTBEAT_INTERVAL)
  }

  private stopHeartbeat(): void {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval)
      this.heartbeatInterval = null
    }
  }

  private sendMessage(message: MultiplayerMessage): void {
    if (this.socket && this.isConnected) {
      this.socket.send(JSON.stringify(message))
    }
  }

  private handleMessage(message: MultiplayerMessage): void {
    switch (message.type) {
      case MessageType.PLAYER_JOIN:
        this.handlePlayerJoin(message)
        break
      case MessageType.PLAYER_LEAVE:
        this.handlePlayerLeave(message)
        break
      case MessageType.PLAYER_LIST:
        this.handlePlayerList(message)
        break
      case MessageType.PLAYER_POSITION:
        this.handlePlayerPosition(message)
        break
      case MessageType.PLAYER_ROTATION:
        this.handlePlayerRotation(message)
        break
      case MessageType.PLAYER_SHOOT:
        this.handlePlayerShoot(message)
        break
      case MessageType.PLAYER_TOOL_USE:
        this.handlePlayerToolUse(message)
        break
      case MessageType.PLAYER_WEAPON_SWITCH:
        this.handlePlayerWeaponSwitch(message)
        break
      case MessageType.PLAYER_WEAPON_STATE:
        this.handlePlayerWeaponState(message)
        break
      case MessageType.WORLD_UPDATE:
        this.handleWorldUpdate(message)
        break
      case MessageType.ERROR:
        this.handleError(message)
        break
    }
  }

  private handlePlayerJoin(message: MultiplayerMessage): void {
    if (message.playerId === this.playerId) return // Ignore own join

    const playerData: PlayerData = {
      id: message.playerId,
      name: message.data.name,
      position: message.data.position,
      rotation: message.data.rotation,
      health: 100,
      isGrounded: true,
      isCrouching: false,
      isSprinting: false,
      lastUpdate: message.timestamp,
    }

    this.players.set(message.playerId, playerData)
    this.onPlayerJoin?.(playerData)
  }

  private handlePlayerLeave(message: MultiplayerMessage): void {
    this.players.delete(message.playerId)
    this.onPlayerLeave?.(message.playerId)
  }

  private handlePlayerList(message: MultiplayerMessage): void {
    // Update player list from server
    const playerList: PlayerData[] = message.data.players
    this.players.clear()
    
    for (const player of playerList) {
      if (player.id !== this.playerId) {
        this.players.set(player.id, player)
      }
    }
  }

  private handlePlayerPosition(message: MultiplayerMessage): void {
    const player = this.players.get(message.playerId)
    if (player) {
      player.position = message.data.position
      player.lastUpdate = message.timestamp
      this.onPlayerUpdate?.(player)
    }
  }

  private handlePlayerRotation(message: MultiplayerMessage): void {
    const player = this.players.get(message.playerId)
    if (player) {
      player.rotation = message.data.rotation
      player.lastUpdate = message.timestamp
      this.onPlayerUpdate?.(player)
    }
  }

  private handlePlayerShoot(message: MultiplayerMessage): void {
    this.onPlayerShoot?.(message.playerId, message.data)
  }

  private handlePlayerToolUse(message: MultiplayerMessage): void {
    this.onPlayerToolUse?.(message.playerId, message.data)
  }

  private handlePlayerWeaponSwitch(message: MultiplayerMessage): void {
    const player = this.players.get(message.playerId)
    if (player) {
      player.currentWeapon = message.data.weaponId
      player.lastUpdate = message.timestamp
      this.onPlayerUpdate?.(player)
    }
    this.onPlayerWeaponSwitch?.(message.playerId, message.data)
  }

  private handlePlayerWeaponState(message: MultiplayerMessage): void {
    const player = this.players.get(message.playerId)
    if (player) {
      player.weaponState = message.data
      player.lastUpdate = message.timestamp
      this.onPlayerUpdate?.(player)
    }
    this.onPlayerWeaponState?.(message.playerId, message.data)
  }

  private handleWorldUpdate(message: MultiplayerMessage): void {
    this.onWorldUpdate?.(message.data)
  }

  private handleError(message: MultiplayerMessage): void {
    console.error('Server error:', message.data.error)
    this.onError?.(message.data.error)
  }

  // Public API methods
  public updatePlayerPosition(position: { x: number; y: number; z: number }): void {
    if (!this.isConnected) return

    this.sendMessage({
      type: MessageType.PLAYER_POSITION,
      playerId: this.playerId!,
      timestamp: Date.now(),
      data: { position },
    })
  }

  public updatePlayerRotation(rotation: { x: number; y: number; z: number }): void {
    if (!this.isConnected) return

    this.sendMessage({
      type: MessageType.PLAYER_ROTATION,
      playerId: this.playerId!,
      timestamp: Date.now(),
      data: { rotation },
    })
  }

  public sendShoot(data: ShootData): void {
    if (!this.isConnected) return

    this.sendMessage({
      type: MessageType.PLAYER_SHOOT,
      playerId: this.playerId!,
      timestamp: Date.now(),
      data,
    })
  }

  public sendToolUse(data: ToolUseData): void {
    if (!this.isConnected) return

    this.sendMessage({
      type: MessageType.PLAYER_TOOL_USE,
      playerId: this.playerId!,
      timestamp: Date.now(),
      data,
    })
  }

  public sendWeaponSwitch(data: WeaponSwitchData): void {
    if (!this.isConnected) return

    this.sendMessage({
      type: MessageType.PLAYER_WEAPON_SWITCH,
      playerId: this.playerId!,
      timestamp: Date.now(),
      data,
    })
  }

  public sendWeaponState(data: WeaponStateData): void {
    if (!this.isConnected) return

    this.sendMessage({
      type: MessageType.PLAYER_WEAPON_STATE,
      playerId: this.playerId!,
      timestamp: Date.now(),
      data,
    })
  }

  public getPlayers(): PlayerData[] {
    return Array.from(this.players.values())
  }

  public getPlayer(playerId: string): PlayerData | undefined {
    return this.players.get(playerId)
  }

  public isPlayerConnected(): boolean {
    return this.isConnected
  }

  public getPlayerId(): string | null {
    return this.playerId
  }

  // Event listeners
  public onPlayerJoinEvent(callback: (player: PlayerData) => void): void {
    this.onPlayerJoin = callback
  }

  public onPlayerLeaveEvent(callback: (playerId: string) => void): void {
    this.onPlayerLeave = callback
  }

  public onPlayerUpdateEvent(callback: (player: PlayerData) => void): void {
    this.onPlayerUpdate = callback
  }

  public onPlayerShootEvent(callback: (playerId: string, data: ShootData) => void): void {
    this.onPlayerShoot = callback
  }

  public onPlayerToolUseEvent(callback: (playerId: string, data: ToolUseData) => void): void {
    this.onPlayerToolUse = callback
  }

  public onPlayerWeaponSwitchEvent(callback: (playerId: string, data: WeaponSwitchData) => void): void {
    this.onPlayerWeaponSwitch = callback
  }

  public onPlayerWeaponStateEvent(callback: (playerId: string, data: WeaponStateData) => void): void {
    this.onPlayerWeaponState = callback
  }

  public onWorldUpdateEvent(callback: (data: any) => void): void {
    this.onWorldUpdate = callback
  }

  public onErrorEvent(callback: (error: string) => void): void {
    this.onError = callback
  }

  public disconnect(): void {
    if (this.socket) {
      this.socket.close()
      this.socket = null
    }
    this.isConnected = false
    this.stopHeartbeat()
    this.players.clear()
  }
} 