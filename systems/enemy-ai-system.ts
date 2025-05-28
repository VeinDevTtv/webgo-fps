import * as THREE from 'three'
import { GAME_CONFIG } from '@/lib/config/game-config'
import { MultiplayerManager } from './multiplayer-manager'

export interface Enemy {
  id: string
  position: THREE.Vector3
  rotation: THREE.Euler
  health: number
  maxHealth: number
  state: EnemyState
  target: THREE.Vector3 | null
  targetPlayerId: string | null
  spawnPoint: THREE.Vector3
  lastAttackTime: number
  lastUpdateTime: number
  patrolTarget: THREE.Vector3
  patrolDirection: number
  isAlive: boolean
  deathTime?: number
  lootDropped: boolean
}

export enum EnemyState {
  SPAWNING = 'spawning',
  PATROLLING = 'patrolling',
  CHASING = 'chasing',
  ATTACKING = 'attacking',
  DEAD = 'dead',
  RESPAWNING = 'respawning',
}

export interface PlayerInfo {
  id: string
  position: THREE.Vector3
  health: number
  isAlive: boolean
}

export interface LootDrop {
  id: string
  position: THREE.Vector3
  items: Array<{
    type: string
    quantity: number
  }>
  spawnTime: number
}

export class EnemyAISystem {
  private enemies: Map<string, Enemy> = new Map()
  private players: Map<string, PlayerInfo> = new Map()
  private lootDrops: Map<string, LootDrop> = new Map()
  private multiplayerManager?: MultiplayerManager
  private gameMode: 'single_player' | 'multiplayer' = 'single_player'
  private lastSpawnCheck = 0
  private lastUpdateTime = 0
  private updateInterval: number | null = null
  private terrainHeightData: number[][] = []

  // Event callbacks
  private onEnemySpawn?: (enemy: Enemy) => void
  private onEnemyDeath?: (enemy: Enemy, loot: LootDrop) => void
  private onEnemyAttack?: (enemy: Enemy, targetId: string, damage: number) => void
  private onLootSpawn?: (loot: LootDrop) => void
  private onLootPickup?: (lootId: string, playerId: string) => void

  constructor(gameMode: 'single_player' | 'multiplayer', multiplayerManager?: MultiplayerManager) {
    this.gameMode = gameMode
    this.multiplayerManager = multiplayerManager
    this.startUpdateLoop()
    console.log(`Enemy AI System initialized in ${gameMode} mode`)
  }

  public setTerrainData(terrainHeightData: number[][]): void {
    this.terrainHeightData = terrainHeightData
  }

  public updatePlayerInfo(playerId: string, position: THREE.Vector3, health: number): void {
    this.players.set(playerId, {
      id: playerId,
      position: position.clone(),
      health,
      isAlive: health > 0,
    })
  }

  public removePlayer(playerId: string): void {
    this.players.delete(playerId)
    
    // Remove this player as target from all enemies
    for (const enemy of this.enemies.values()) {
      if (enemy.targetPlayerId === playerId) {
        enemy.targetPlayerId = null
        enemy.target = null
        enemy.state = EnemyState.PATROLLING
      }
    }
  }

  public update(deltaTime: number): void {
    const now = Date.now()
    
    // Update enemies
    for (const enemy of this.enemies.values()) {
      this.updateEnemy(enemy, deltaTime, now)
    }

    // Check for spawning new enemies
    if (now - this.lastSpawnCheck > 5000) { // Check every 5 seconds
      this.checkSpawning()
      this.lastSpawnCheck = now
    }

    // Clean up old loot
    this.cleanupLoot(now)

    this.lastUpdateTime = now
  }

  public damageEnemy(enemyId: string, damage: number, attackerId: string): boolean {
    const enemy = this.enemies.get(enemyId)
    if (!enemy || !enemy.isAlive) return false

    enemy.health -= damage
    
    if (enemy.health <= 0) {
      enemy.health = 0
      enemy.isAlive = false
      enemy.state = EnemyState.DEAD
      enemy.deathTime = Date.now()
      
      // Drop loot
      const loot = this.createLootDrop(enemy.position)
      this.lootDrops.set(loot.id, loot)
      
      this.onEnemyDeath?.(enemy, loot)
      this.onLootSpawn?.(loot)
      
      // Sync with multiplayer
      if (this.multiplayerManager && this.gameMode === 'multiplayer') {
        // Send enemy death event
      }
      
      return true
    }

    // Set attacker as target if not already targeting someone
    if (!enemy.targetPlayerId) {
      enemy.targetPlayerId = attackerId
      const player = this.players.get(attackerId)
      if (player) {
        enemy.target = player.position.clone()
        enemy.state = EnemyState.CHASING
      }
    }

    return false
  }

  public tryPickupLoot(playerId: string, playerPosition: THREE.Vector3): LootDrop | null {
    for (const loot of this.lootDrops.values()) {
      const distance = playerPosition.distanceTo(loot.position)
      if (distance <= GAME_CONFIG.LOOT.PICKUP_RADIUS) {
        this.lootDrops.delete(loot.id)
        this.onLootPickup?.(loot.id, playerId)
        return loot
      }
    }
    return null
  }

  public getEnemies(): Enemy[] {
    return Array.from(this.enemies.values())
  }

  public getLootDrops(): LootDrop[] {
    return Array.from(this.lootDrops.values())
  }

  public getEnemy(id: string): Enemy | undefined {
    return this.enemies.get(id)
  }

  private startUpdateLoop(): void {
    this.updateInterval = window.setInterval(() => {
      const deltaTime = GAME_CONFIG.PERFORMANCE.ENEMY_UPDATE_INTERVAL / 1000
      this.update(deltaTime)
    }, GAME_CONFIG.PERFORMANCE.ENEMY_UPDATE_INTERVAL)
  }

  private updateEnemy(enemy: Enemy, deltaTime: number, now: number): void {
    if (!enemy.isAlive) {
      // Handle respawning
      if (enemy.deathTime && now - enemy.deathTime > GAME_CONFIG.ENEMY_AI.RESPAWN_DELAY) {
        this.respawnEnemy(enemy)
      }
      return
    }

    switch (enemy.state) {
      case EnemyState.SPAWNING:
        this.updateSpawning(enemy, deltaTime)
        break
      case EnemyState.PATROLLING:
        this.updatePatrolling(enemy, deltaTime)
        break
      case EnemyState.CHASING:
        this.updateChasing(enemy, deltaTime)
        break
      case EnemyState.ATTACKING:
        this.updateAttacking(enemy, deltaTime, now)
        break
    }

    // Update position based on terrain
    this.updateEnemyPosition(enemy)
  }

  private updateSpawning(enemy: Enemy, deltaTime: number): void {
    // Simple spawn animation - just set to patrolling after a moment
    enemy.state = EnemyState.PATROLLING
    this.setRandomPatrolTarget(enemy)
  }

  private updatePatrolling(enemy: Enemy, deltaTime: number): void {
    // Check for nearby players
    const nearestPlayer = this.findNearestPlayer(enemy.position)
    if (nearestPlayer && nearestPlayer.distance <= GAME_CONFIG.ENEMY_AI.CHASE_RADIUS) {
      enemy.targetPlayerId = nearestPlayer.player.id
      enemy.target = nearestPlayer.player.position.clone()
      enemy.state = EnemyState.CHASING
      return
    }

    // Move towards patrol target
    const direction = enemy.patrolTarget.clone().sub(enemy.position)
    direction.y = 0 // Keep movement horizontal
    
    if (direction.length() < 1.0) {
      // Reached patrol target, set new one
      this.setRandomPatrolTarget(enemy)
    } else {
      direction.normalize()
      const moveDistance = GAME_CONFIG.ENEMY_AI.MOVEMENT_SPEED * deltaTime
      enemy.position.add(direction.multiplyScalar(moveDistance))
      
      // Update rotation to face movement direction
      enemy.rotation.y = Math.atan2(direction.x, direction.z)
    }
  }

  private updateChasing(enemy: Enemy, deltaTime: number): void {
    if (!enemy.targetPlayerId) {
      enemy.state = EnemyState.PATROLLING
      return
    }

    const targetPlayer = this.players.get(enemy.targetPlayerId)
    if (!targetPlayer || !targetPlayer.isAlive) {
      enemy.targetPlayerId = null
      enemy.target = null
      enemy.state = EnemyState.PATROLLING
      return
    }

    const distanceToTarget = enemy.position.distanceTo(targetPlayer.position)
    
    // Check if target is too far away
    if (distanceToTarget > GAME_CONFIG.ENEMY_AI.CHASE_RADIUS * 1.5) {
      enemy.targetPlayerId = null
      enemy.target = null
      enemy.state = EnemyState.PATROLLING
      return
    }

    // Check if close enough to attack
    if (distanceToTarget <= GAME_CONFIG.ENEMY_AI.ATTACK_RANGE) {
      enemy.state = EnemyState.ATTACKING
      return
    }

    // Move towards target
    const direction = targetPlayer.position.clone().sub(enemy.position)
    direction.y = 0 // Keep movement horizontal
    direction.normalize()
    
    const moveDistance = GAME_CONFIG.ENEMY_AI.CHASE_SPEED * deltaTime
    enemy.position.add(direction.multiplyScalar(moveDistance))
    
    // Update rotation to face target
    enemy.rotation.y = Math.atan2(direction.x, direction.z)
    
    // Update target position
    enemy.target = targetPlayer.position.clone()
  }

  private updateAttacking(enemy: Enemy, deltaTime: number, now: number): void {
    if (!enemy.targetPlayerId) {
      enemy.state = EnemyState.PATROLLING
      return
    }

    const targetPlayer = this.players.get(enemy.targetPlayerId)
    if (!targetPlayer || !targetPlayer.isAlive) {
      enemy.targetPlayerId = null
      enemy.target = null
      enemy.state = EnemyState.PATROLLING
      return
    }

    const distanceToTarget = enemy.position.distanceTo(targetPlayer.position)
    
    // Check if target moved out of attack range
    if (distanceToTarget > GAME_CONFIG.ENEMY_AI.ATTACK_RANGE * 1.2) {
      enemy.state = EnemyState.CHASING
      return
    }

    // Face the target
    const direction = targetPlayer.position.clone().sub(enemy.position)
    direction.y = 0
    direction.normalize()
    enemy.rotation.y = Math.atan2(direction.x, direction.z)

    // Attack if cooldown is over
    if (now - enemy.lastAttackTime >= GAME_CONFIG.ENEMY_AI.ATTACK_COOLDOWN) {
      this.performAttack(enemy, targetPlayer)
      enemy.lastAttackTime = now
    }
  }

  private performAttack(enemy: Enemy, target: PlayerInfo): void {
    // Calculate attack accuracy based on distance
    const distance = enemy.position.distanceTo(target.position)
    const accuracy = Math.max(0.3, 1.0 - (distance / GAME_CONFIG.ENEMY_AI.ATTACK_RANGE))
    
    if (Math.random() < accuracy) {
      // Hit the target
      this.onEnemyAttack?.(enemy, target.id, GAME_CONFIG.ENEMY_AI.ATTACK_DAMAGE)
    }
  }

  private findNearestPlayer(position: THREE.Vector3): { player: PlayerInfo; distance: number } | null {
    let nearest: { player: PlayerInfo; distance: number } | null = null
    
    for (const player of this.players.values()) {
      if (!player.isAlive) continue
      
      const distance = position.distanceTo(player.position)
      if (!nearest || distance < nearest.distance) {
        nearest = { player, distance }
      }
    }
    
    return nearest
  }

  private setRandomPatrolTarget(enemy: Enemy): void {
    const angle = Math.random() * Math.PI * 2
    const distance = Math.random() * GAME_CONFIG.ENEMY_AI.PATROL_RADIUS
    
    enemy.patrolTarget = enemy.spawnPoint.clone().add(
      new THREE.Vector3(
        Math.cos(angle) * distance,
        0,
        Math.sin(angle) * distance
      )
    )
  }

  private updateEnemyPosition(enemy: Enemy): void {
    // Update Y position based on terrain
    if (this.terrainHeightData.length > 0) {
      const terrainHeight = this.getTerrainHeight(enemy.position.x, enemy.position.z)
      enemy.position.y = terrainHeight + 1.0 // Enemy height offset
    }
  }

  private getTerrainHeight(x: number, z: number): number {
    if (!this.terrainHeightData || this.terrainHeightData.length === 0) return 0

    const terrainSize = this.terrainHeightData.length
    const halfSize = terrainSize / 2

    const gridX = x + halfSize
    const gridZ = z + halfSize

    const x0 = Math.floor(gridX)
    const z0 = Math.floor(gridZ)
    const x1 = Math.min(x0 + 1, terrainSize - 1)
    const z1 = Math.min(z0 + 1, terrainSize - 1)

    if (x0 < 0 || x0 >= terrainSize || z0 < 0 || z0 >= terrainSize) return 0

    const fx = gridX - x0
    const fz = gridZ - z0

    const h00 = this.terrainHeightData[z0]?.[x0] || 0
    const h10 = this.terrainHeightData[z0]?.[x1] || 0
    const h01 = this.terrainHeightData[z1]?.[x0] || 0
    const h11 = this.terrainHeightData[z1]?.[x1] || 0

    const h0 = h00 * (1 - fx) + h10 * fx
    const h1 = h01 * (1 - fx) + h11 * fx

    return h0 * (1 - fz) + h1 * fz
  }

  private checkSpawning(): void {
    const playerCount = this.players.size
    const shouldSpawnAI = playerCount < GAME_CONFIG.ENEMY_AI.SPAWN_THRESHOLD
    
    if (!shouldSpawnAI) {
      // Remove all AI enemies if we have enough players
      for (const enemy of this.enemies.values()) {
        this.enemies.delete(enemy.id)
      }
      return
    }

    // Calculate desired enemy count
    const maxEnemies = Math.max(1, playerCount * GAME_CONFIG.ENEMY_AI.MAX_ENEMIES_PER_PLAYER)
    const currentEnemies = Array.from(this.enemies.values()).filter(e => e.isAlive).length
    
    if (currentEnemies < maxEnemies) {
      // Spawn new enemies
      const enemiesToSpawn = Math.min(3, maxEnemies - currentEnemies) // Spawn max 3 at once
      
      for (let i = 0; i < enemiesToSpawn; i++) {
        this.spawnEnemy()
      }
    }
  }

  private spawnEnemy(): void {
    // Find a spawn position near a random player
    const players = Array.from(this.players.values()).filter(p => p.isAlive)
    if (players.length === 0) return

    const targetPlayer = players[Math.floor(Math.random() * players.length)]
    const spawnPosition = this.findSpawnPosition(targetPlayer.position)
    
    if (!spawnPosition) return

    const enemy: Enemy = {
      id: `enemy_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      position: spawnPosition.clone(),
      rotation: new THREE.Euler(0, Math.random() * Math.PI * 2, 0),
      health: GAME_CONFIG.ENEMY_AI.HEALTH,
      maxHealth: GAME_CONFIG.ENEMY_AI.HEALTH,
      state: EnemyState.SPAWNING,
      target: null,
      targetPlayerId: null,
      spawnPoint: spawnPosition.clone(),
      lastAttackTime: 0,
      lastUpdateTime: Date.now(),
      patrolTarget: spawnPosition.clone(),
      patrolDirection: Math.random() * Math.PI * 2,
      isAlive: true,
      lootDropped: false,
    }

    this.enemies.set(enemy.id, enemy)
    this.onEnemySpawn?.(enemy)
  }

  private findSpawnPosition(nearPosition: THREE.Vector3): THREE.Vector3 | null {
    const maxAttempts = 10
    
    for (let i = 0; i < maxAttempts; i++) {
      const angle = Math.random() * Math.PI * 2
      const distance = GAME_CONFIG.ENEMY_AI.SPAWN_RADIUS_MIN + 
                     Math.random() * (GAME_CONFIG.ENEMY_AI.SPAWN_RADIUS_MAX - GAME_CONFIG.ENEMY_AI.SPAWN_RADIUS_MIN)
      
      const spawnPos = new THREE.Vector3(
        nearPosition.x + Math.cos(angle) * distance,
        nearPosition.y,
        nearPosition.z + Math.sin(angle) * distance
      )

      // Update Y position based on terrain
      if (this.terrainHeightData.length > 0) {
        spawnPos.y = this.getTerrainHeight(spawnPos.x, spawnPos.z) + 1.0
      }

      // Check if position is valid (not too close to other enemies or players)
      if (this.isValidSpawnPosition(spawnPos)) {
        return spawnPos
      }
    }

    return null
  }

  private isValidSpawnPosition(position: THREE.Vector3): boolean {
    const minDistance = 5.0

    // Check distance to players
    for (const player of this.players.values()) {
      if (position.distanceTo(player.position) < minDistance) {
        return false
      }
    }

    // Check distance to other enemies
    for (const enemy of this.enemies.values()) {
      if (position.distanceTo(enemy.position) < minDistance) {
        return false
      }
    }

    return true
  }

  private respawnEnemy(enemy: Enemy): void {
    enemy.health = enemy.maxHealth
    enemy.isAlive = true
    enemy.state = EnemyState.SPAWNING
    enemy.target = null
    enemy.targetPlayerId = null
    enemy.deathTime = undefined
    enemy.lootDropped = false
    
    // Find new spawn position
    const newSpawnPos = this.findSpawnPosition(enemy.spawnPoint)
    if (newSpawnPos) {
      enemy.position.copy(newSpawnPos)
      enemy.spawnPoint.copy(newSpawnPos)
    }
  }

  private createLootDrop(position: THREE.Vector3): LootDrop {
    const loot: LootDrop = {
      id: `loot_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      position: position.clone(),
      items: [],
      spawnTime: Date.now(),
    }

    // Generate random loot based on drop chances
    for (const [itemType, dropData] of Object.entries(GAME_CONFIG.LOOT.ENEMY_DROPS)) {
      if (Math.random() < dropData.chance) {
        const quantity = Math.floor(Math.random() * (dropData.max - dropData.min + 1)) + dropData.min
        loot.items.push({
          type: itemType.toLowerCase(),
          quantity,
        })
      }
    }

    return loot
  }

  private cleanupLoot(now: number): void {
    for (const [id, loot] of this.lootDrops) {
      if (now - loot.spawnTime > GAME_CONFIG.LOOT.DESPAWN_TIME) {
        this.lootDrops.delete(id)
      }
    }
  }

  // Event listeners
  public onEnemySpawnEvent(callback: (enemy: Enemy) => void): void {
    this.onEnemySpawn = callback
  }

  public onEnemyDeathEvent(callback: (enemy: Enemy, loot: LootDrop) => void): void {
    this.onEnemyDeath = callback
  }

  public onEnemyAttackEvent(callback: (enemy: Enemy, targetId: string, damage: number) => void): void {
    this.onEnemyAttack = callback
  }

  public onLootSpawnEvent(callback: (loot: LootDrop) => void): void {
    this.onLootSpawn = callback
  }

  public onLootPickupEvent(callback: (lootId: string, playerId: string) => void): void {
    this.onLootPickup = callback
  }

  public dispose(): void {
    if (this.updateInterval) {
      clearInterval(this.updateInterval)
      this.updateInterval = null
    }
    
    this.enemies.clear()
    this.players.clear()
    this.lootDrops.clear()
  }
} 