import * as THREE from 'three'
import { GAME_CONFIG } from '@/lib/config/game-config'

export interface WeaponData {
  id: string
  name: string
  fireRate: number
  damage: number
  range: number
  accuracy: number
  recoil: number
  ammo: { current: number; reserve: number }
  icon: string
  model: string
}

export interface WeaponSlot {
  slotIndex: number
  weapon: WeaponData | null
  isUnlocked: boolean
}

export interface WeaponState {
  currentSlot: number
  slots: WeaponSlot[]
  isReloading: boolean
  isSwitching: boolean
  lastFireTime: number
  lastSwitchTime: number
  recoilAccumulation: number
}

export class WeaponSystem {
  private state: WeaponState
  private onWeaponSwitch?: (weaponId: string | null) => void
  private onAmmoUpdate?: (current: number, reserve: number) => void
  private onWeaponFire?: (weaponData: WeaponData, direction: THREE.Vector3) => void

  constructor() {
    this.state = {
      currentSlot: 0,
      slots: this.initializeSlots(),
      isReloading: false,
      isSwitching: false,
      lastFireTime: 0,
      lastSwitchTime: 0,
      recoilAccumulation: 0,
    }

    // Start with rifle equipped
    this.equipWeapon(0, GAME_CONFIG.WEAPONS.TYPES.RIFLE)
  }

  private initializeSlots(): WeaponSlot[] {
    return Array.from({ length: 5 }, (_, index) => ({
      slotIndex: index,
      weapon: null,
      isUnlocked: index < 3, // First 3 slots unlocked by default
    }))
  }

  public getCurrentWeapon(): WeaponData | null {
    return this.state.slots[this.state.currentSlot]?.weapon || null
  }

  public getCurrentSlot(): number {
    return this.state.currentSlot
  }

  public getSlots(): WeaponSlot[] {
    return [...this.state.slots]
  }

  public isReloading(): boolean {
    return this.state.isReloading
  }

  public isSwitching(): boolean {
    return this.state.isSwitching
  }

  public equipWeapon(slotIndex: number, weaponData: WeaponData): boolean {
    if (slotIndex < 0 || slotIndex >= this.state.slots.length) {
      return false
    }

    const slot = this.state.slots[slotIndex]
    if (!slot.isUnlocked) {
      return false
    }

    // Create a copy of weapon data to avoid mutations
    slot.weapon = { ...weaponData }
    return true
  }

  public switchToSlot(slotIndex: number): boolean {
    if (slotIndex < 0 || slotIndex >= this.state.slots.length) {
      return false
    }

    const slot = this.state.slots[slotIndex]
    if (!slot.isUnlocked || !slot.weapon) {
      return false
    }

    // Check switch cooldown
    const now = Date.now()
    if (now - this.state.lastSwitchTime < GAME_CONFIG.WEAPONS.SWITCH_COOLDOWN) {
      return false
    }

    // Can't switch while reloading
    if (this.state.isReloading) {
      return false
    }

    const previousSlot = this.state.currentSlot
    this.state.currentSlot = slotIndex
    this.state.isSwitching = true
    this.state.lastSwitchTime = now

    // Reset recoil when switching
    this.state.recoilAccumulation = 0

    // Notify listeners
    this.onWeaponSwitch?.(slot.weapon.id)

    // End switching animation after a delay
    setTimeout(() => {
      this.state.isSwitching = false
    }, GAME_CONFIG.WEAPONS.SWITCH_COOLDOWN)

    return true
  }

  public canFire(): boolean {
    const weapon = this.getCurrentWeapon()
    if (!weapon) return false

    const now = Date.now()
    return (
      !this.state.isReloading &&
      !this.state.isSwitching &&
      weapon.ammo.current > 0 &&
      now - this.state.lastFireTime >= weapon.fireRate
    )
  }

  public fire(direction: THREE.Vector3): boolean {
    if (!this.canFire()) return false

    const weapon = this.getCurrentWeapon()!
    const now = Date.now()

    // Consume ammo
    weapon.ammo.current--
    this.state.lastFireTime = now

    // Add recoil
    this.state.recoilAccumulation = Math.min(
      this.state.recoilAccumulation + weapon.recoil,
      GAME_CONFIG.WEAPONS.MAX_RECOIL
    )

    // Apply accuracy and recoil to direction
    const spread = (1 - weapon.accuracy) + this.state.recoilAccumulation
    const fireDirection = direction.clone()
    fireDirection.x += (Math.random() - 0.5) * spread
    fireDirection.y += (Math.random() - 0.5) * spread
    fireDirection.z += (Math.random() - 0.5) * spread
    fireDirection.normalize()

    // Notify listeners
    this.onWeaponFire?.(weapon, fireDirection)
    this.onAmmoUpdate?.(weapon.ammo.current, weapon.ammo.reserve)

    // Auto-reload if empty
    if (weapon.ammo.current === 0 && weapon.ammo.reserve > 0) {
      this.startReload()
    }

    return true
  }

  public startReload(): boolean {
    const weapon = this.getCurrentWeapon()
    if (!weapon || this.state.isReloading || this.state.isSwitching) {
      return false
    }

    if (weapon.ammo.reserve === 0 || weapon.ammo.current === weapon.ammo.current) {
      return false
    }

    this.state.isReloading = true

    // Calculate reload time based on weapon type
    const reloadTime = weapon.id === 'shotgun' ? 2000 : 1500

    setTimeout(() => {
      if (weapon && this.state.isReloading) {
        const maxAmmo = GAME_CONFIG.WEAPONS.TYPES[weapon.id.toUpperCase() as keyof typeof GAME_CONFIG.WEAPONS.TYPES]?.ammo.current || 30
        const ammoNeeded = maxAmmo - weapon.ammo.current
        const ammoToReload = Math.min(ammoNeeded, weapon.ammo.reserve)

        weapon.ammo.current += ammoToReload
        weapon.ammo.reserve -= ammoToReload

        this.state.isReloading = false
        this.onAmmoUpdate?.(weapon.ammo.current, weapon.ammo.reserve)
      }
    }, reloadTime)

    return true
  }

  public updateRecoilRecovery(deltaTime: number): void {
    if (this.state.recoilAccumulation > 0) {
      this.state.recoilAccumulation = Math.max(
        0,
        this.state.recoilAccumulation - GAME_CONFIG.WEAPONS.RECOIL_RECOVERY * deltaTime
      )
    }
  }

  public handleNumberKey(keyNumber: number): boolean {
    // Keys 1-5 correspond to weapon slots 0-4
    const slotIndex = keyNumber - 1
    if (slotIndex >= 0 && slotIndex < 5) {
      return this.switchToSlot(slotIndex)
    }
    return false
  }

  public addAmmo(weaponId: string, amount: number): boolean {
    for (const slot of this.state.slots) {
      if (slot.weapon?.id === weaponId) {
        const maxReserve = GAME_CONFIG.WEAPONS.TYPES[weaponId.toUpperCase() as keyof typeof GAME_CONFIG.WEAPONS.TYPES]?.ammo.reserve || 90
        slot.weapon.ammo.reserve = Math.min(slot.weapon.ammo.reserve + amount, maxReserve)
        
        if (slot.weapon === this.getCurrentWeapon()) {
          this.onAmmoUpdate?.(slot.weapon.ammo.current, slot.weapon.ammo.reserve)
        }
        return true
      }
    }
    return false
  }

  public unlockSlot(slotIndex: number): boolean {
    if (slotIndex >= 0 && slotIndex < this.state.slots.length) {
      this.state.slots[slotIndex].isUnlocked = true
      return true
    }
    return false
  }

  // Multiplayer synchronization
  public getStateForSync(): any {
    return {
      currentSlot: this.state.currentSlot,
      slots: this.state.slots.map(slot => ({
        slotIndex: slot.slotIndex,
        weaponId: slot.weapon?.id || null,
        isUnlocked: slot.isUnlocked,
        ammo: slot.weapon?.ammo || null,
      })),
      isReloading: this.state.isReloading,
      isSwitching: this.state.isSwitching,
    }
  }

  public applyStateFromSync(syncData: any): void {
    this.state.currentSlot = syncData.currentSlot
    this.state.isReloading = syncData.isReloading
    this.state.isSwitching = syncData.isSwitching

    // Update slots
    for (const slotData of syncData.slots) {
      const slot = this.state.slots[slotData.slotIndex]
      if (slot) {
        slot.isUnlocked = slotData.isUnlocked
        
        if (slotData.weaponId) {
          const weaponTemplate = Object.values(GAME_CONFIG.WEAPONS.TYPES).find(w => w.id === slotData.weaponId)
          if (weaponTemplate) {
            slot.weapon = {
              ...weaponTemplate,
              ammo: slotData.ammo || weaponTemplate.ammo,
            }
          }
        } else {
          slot.weapon = null
        }
      }
    }
  }

  // Event listeners
  public onWeaponSwitchEvent(callback: (weaponId: string | null) => void): void {
    this.onWeaponSwitch = callback
  }

  public onAmmoUpdateEvent(callback: (current: number, reserve: number) => void): void {
    this.onAmmoUpdate = callback
  }

  public onWeaponFireEvent(callback: (weaponData: WeaponData, direction: THREE.Vector3) => void): void {
    this.onWeaponFire = callback
  }
} 