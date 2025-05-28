import * as THREE from 'three'
import { GAME_CONFIG } from '@/lib/config/game-config'
import { EnemyAISystem, Enemy } from './enemy-ai-system'

export interface CombatHit {
  enemyId: string
  damage: number
  position: THREE.Vector3
  distance: number
}

export interface WeaponFireResult {
  hit: boolean
  hits: CombatHit[]
  bulletTrail: {
    start: THREE.Vector3
    end: THREE.Vector3
  }
}

export class CombatSystem {
  private enemySystem: EnemyAISystem | null = null
  private raycaster: THREE.Raycaster
  private onHitCallback?: (hit: CombatHit) => void

  constructor() {
    this.raycaster = new THREE.Raycaster()
  }

  public setEnemySystem(enemySystem: EnemyAISystem): void {
    this.enemySystem = enemySystem
  }

  public onHit(callback: (hit: CombatHit) => void): void {
    this.onHitCallback = callback
  }

  public fireWeapon(
    origin: THREE.Vector3,
    direction: THREE.Vector3,
    weaponData: {
      damage: number
      range: number
      accuracy: number
      weaponType: 'rifle' | 'shotgun' | 'pistol'
    }
  ): WeaponFireResult {
    const result: WeaponFireResult = {
      hit: false,
      hits: [],
      bulletTrail: {
        start: origin.clone(),
        end: origin.clone().add(direction.clone().multiplyScalar(weaponData.range))
      }
    }

    if (!this.enemySystem) {
      return result
    }

    // Apply weapon accuracy (spread)
    const spread = (1 - weaponData.accuracy) * 0.1 // Convert to radians
    const fireDirection = direction.clone()
    
    // Add random spread
    fireDirection.x += (Math.random() - 0.5) * spread
    fireDirection.y += (Math.random() - 0.5) * spread
    fireDirection.z += (Math.random() - 0.5) * spread
    fireDirection.normalize()

    // Handle different weapon types
    if (weaponData.weaponType === 'shotgun') {
      // Shotgun fires multiple pellets
      const pelletCount = 8
      for (let i = 0; i < pelletCount; i++) {
        const pelletDirection = fireDirection.clone()
        const pelletSpread = spread * 2 // Shotguns have more spread
        
        pelletDirection.x += (Math.random() - 0.5) * pelletSpread
        pelletDirection.y += (Math.random() - 0.5) * pelletSpread
        pelletDirection.z += (Math.random() - 0.5) * pelletSpread
        pelletDirection.normalize()

        const hit = this.performRaycast(origin, pelletDirection, weaponData.range, weaponData.damage / pelletCount)
        if (hit) {
          result.hits.push(hit)
          result.hit = true
        }
      }
    } else {
      // Single projectile weapons (rifle, pistol)
      const hit = this.performRaycast(origin, fireDirection, weaponData.range, weaponData.damage)
      if (hit) {
        result.hits.push(hit)
        result.hit = true
      }
    }

    // Update bullet trail end point based on first hit or max range
    if (result.hits.length > 0) {
      const closestHit = result.hits.reduce((closest, hit) => 
        hit.distance < closest.distance ? hit : closest
      )
      result.bulletTrail.end = closestHit.position.clone()
    }

    // Apply damage to hit enemies
    for (const hit of result.hits) {
      const killed = this.enemySystem.damageEnemy(hit.enemyId, hit.damage, "player")
      this.onHitCallback?.(hit)
      
      if (killed) {
        console.log(`Enemy ${hit.enemyId} killed by weapon fire`)
      }
    }

    return result
  }

  private performRaycast(
    origin: THREE.Vector3,
    direction: THREE.Vector3,
    maxDistance: number,
    damage: number
  ): CombatHit | null {
    if (!this.enemySystem) return null

    this.raycaster.set(origin, direction)
    this.raycaster.far = maxDistance

    const enemies = this.enemySystem.getEnemies().filter(enemy => enemy.isAlive)
    let closestHit: CombatHit | null = null
    let closestDistance = Infinity

    for (const enemy of enemies) {
      // Create a simple bounding sphere for the enemy
      const enemyPosition = enemy.position
      const enemyRadius = 0.8 // Approximate enemy radius

      // Calculate distance from ray to enemy center
      const rayToEnemy = enemyPosition.clone().sub(origin)
      const projectionLength = rayToEnemy.dot(direction)
      
      // Skip if enemy is behind the ray origin
      if (projectionLength < 0) continue
      
      // Skip if enemy is beyond weapon range
      if (projectionLength > maxDistance) continue

      // Calculate closest point on ray to enemy center
      const closestPointOnRay = origin.clone().add(direction.clone().multiplyScalar(projectionLength))
      const distanceToEnemy = closestPointOnRay.distanceTo(enemyPosition)

      // Check if ray intersects enemy's bounding sphere
      if (distanceToEnemy <= enemyRadius && projectionLength < closestDistance) {
        closestDistance = projectionLength
        closestHit = {
          enemyId: enemy.id,
          damage,
          position: closestPointOnRay,
          distance: projectionLength
        }
      }
    }

    return closestHit
  }

  public dispose(): void {
    this.enemySystem = null
    this.onHitCallback = undefined
  }
} 