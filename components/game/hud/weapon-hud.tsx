"use client"

import { useEffect, useState } from "react"
import { WeaponSystem, type WeaponData, type WeaponSlot } from "@/systems/weapon-system"

interface WeaponHUDProps {
  weaponSystem: WeaponSystem
}

export default function WeaponHUD({ weaponSystem }: WeaponHUDProps) {
  const [currentWeapon, setCurrentWeapon] = useState<WeaponData | null>(null)
  const [currentSlot, setCurrentSlot] = useState<number>(0)
  const [slots, setSlots] = useState<WeaponSlot[]>([])
  const [isReloading, setIsReloading] = useState<boolean>(false)
  const [isSwitching, setIsSwitching] = useState<boolean>(false)

  useEffect(() => {
    // Update weapon display
    const updateWeaponDisplay = () => {
      setCurrentWeapon(weaponSystem.getCurrentWeapon())
      setCurrentSlot(weaponSystem.getCurrentSlot())
      setSlots(weaponSystem.getSlots())
      setIsReloading(weaponSystem.isReloading())
      setIsSwitching(weaponSystem.isSwitching())
    }

    // Initial update
    updateWeaponDisplay()

    // Set up listeners
    weaponSystem.onWeaponSwitchEvent(() => {
      updateWeaponDisplay()
    })

    weaponSystem.onAmmoUpdateEvent(() => {
      updateWeaponDisplay()
    })

    // Update every frame for reloading/switching states
    const interval = setInterval(updateWeaponDisplay, 100)

    return () => {
      clearInterval(interval)
    }
  }, [weaponSystem])

  if (!currentWeapon) {
    return (
      <div className="fixed bottom-4 right-4 bg-black/50 text-white p-4 rounded-lg">
        <div className="text-center text-gray-400">No weapon equipped</div>
      </div>
    )
  }

  return (
    <div className="fixed bottom-4 right-4 bg-black/50 text-white p-4 rounded-lg min-w-[200px]">
      {/* Current Weapon Info */}
      <div className="mb-4">
        <div className="flex items-center gap-2 mb-2">
          <span className="text-2xl">{currentWeapon.icon}</span>
          <div>
            <div className="font-bold text-lg">{currentWeapon.name}</div>
            <div className="text-sm text-gray-300">
              {isReloading ? (
                <span className="text-yellow-400 animate-pulse">Reloading...</span>
              ) : isSwitching ? (
                <span className="text-blue-400 animate-pulse">Switching...</span>
              ) : (
                `${currentWeapon.ammo.current} / ${currentWeapon.ammo.reserve}`
              )}
            </div>
          </div>
        </div>

        {/* Ammo Bar */}
        <div className="w-full bg-gray-700 rounded-full h-2 mb-2">
          <div
            className={`h-2 rounded-full transition-all duration-300 ${
              currentWeapon.ammo.current === 0
                ? 'bg-red-500'
                : currentWeapon.ammo.current <= 5
                ? 'bg-yellow-500'
                : 'bg-green-500'
            }`}
            style={{
              width: `${Math.max(0, (currentWeapon.ammo.current / (currentWeapon.ammo.current + currentWeapon.ammo.reserve)) * 100)}%`,
            }}
          />
        </div>
      </div>

      {/* Weapon Slots */}
      <div className="space-y-1">
        <div className="text-xs text-gray-400 mb-2">Weapon Slots</div>
        {slots.map((slot, index) => (
          <div
            key={slot.slotIndex}
            className={`flex items-center gap-2 p-2 rounded transition-all ${
              currentSlot === slot.slotIndex
                ? 'bg-blue-600/50 border border-blue-400'
                : slot.weapon
                ? 'bg-gray-700/50 hover:bg-gray-600/50'
                : 'bg-gray-800/30'
            } ${!slot.isUnlocked ? 'opacity-50' : ''}`}
          >
            <div className="w-6 h-6 bg-gray-600 rounded text-center text-xs leading-6">
              {index + 1}
            </div>
            
            {slot.weapon ? (
              <div className="flex items-center gap-2 flex-1">
                <span className="text-sm">{slot.weapon.icon}</span>
                <div className="flex-1">
                  <div className="text-xs font-medium">{slot.weapon.name}</div>
                  <div className="text-xs text-gray-400">
                    {slot.weapon.ammo.current}/{slot.weapon.ammo.reserve}
                  </div>
                </div>
              </div>
            ) : (
              <div className="text-xs text-gray-500 flex-1">
                {slot.isUnlocked ? 'Empty' : 'Locked'}
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Controls Hint */}
      <div className="mt-3 pt-3 border-t border-gray-600">
        <div className="text-xs text-gray-400 text-center">
          Press 1-5 to switch weapons • R to reload
        </div>
      </div>
    </div>
  )
} 