"use client"

import { useState, useEffect } from "react"
import { pointerLockManager, type PointerLockState } from "@/utils/pointer-lock-manager"

interface PointerLockOverlayProps {
  gameStatus: string
  isInventoryOpen: boolean
  onPointerLockRequest: () => void
}

export default function PointerLockOverlay({ 
  gameStatus, 
  isInventoryOpen, 
  onPointerLockRequest 
}: PointerLockOverlayProps) {
  const [pointerLockState, setPointerLockState] = useState<PointerLockState>({
    isLocked: false,
    isSupported: true,
    error: null,
    canRequest: true
  })
  const [showOverlay, setShowOverlay] = useState(false)

  useEffect(() => {
    // Update pointer lock state
    const updateState = () => {
      setPointerLockState(pointerLockManager.getState())
    }

    // Set up callbacks
    pointerLockManager.setCallbacks({
      onLockChange: (isLocked) => {
        setPointerLockState(prev => ({ ...prev, isLocked }))
      },
      onError: (error) => {
        setPointerLockState(prev => ({ ...prev, error }))
      },
      onSuccess: () => {
        setPointerLockState(prev => ({ ...prev, error: null }))
      }
    })

    updateState()

    // Update state periodically to catch changes
    const interval = setInterval(updateState, 1000)

    return () => {
      clearInterval(interval)
    }
  }, [])

  useEffect(() => {
    // Show overlay when:
    // - Game is in playing mode
    // - Pointer is not locked
    // - Inventory is not open
    // - Pointer lock is supported
    const shouldShow = gameStatus === "playing" && 
                      !pointerLockState.isLocked && 
                      !isInventoryOpen && 
                      pointerLockState.isSupported

    setShowOverlay(shouldShow)
  }, [gameStatus, pointerLockState.isLocked, isInventoryOpen, pointerLockState.isSupported])

  const handleClick = () => {
    onPointerLockRequest()
  }

  if (!showOverlay) {
    return null
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 pointer-events-auto">
      <div className="bg-gray-900 border border-gray-600 rounded-lg p-8 max-w-md mx-4 text-center">
        {/* Icon */}
        <div className="text-6xl mb-4">🎯</div>
        
        {/* Title */}
        <h2 className="text-2xl font-bold text-white mb-4">
          Click to Enter Game
        </h2>
        
        {/* Description */}
        <p className="text-gray-300 mb-6">
          Click the button below to lock your mouse cursor and start playing. 
          You can press ESC anytime to exit.
        </p>

        {/* Error Message */}
        {pointerLockState.error && (
          <div className="bg-red-900/50 border border-red-600 rounded-md p-3 mb-4">
            <p className="text-red-300 text-sm">{pointerLockState.error}</p>
          </div>
        )}

        {/* Unsupported Browser Warning */}
        {!pointerLockState.isSupported && (
          <div className="bg-yellow-900/50 border border-yellow-600 rounded-md p-3 mb-4">
            <p className="text-yellow-300 text-sm">
              Your browser doesn't support pointer lock. The game may not work properly.
            </p>
          </div>
        )}

        {/* Action Button */}
        <button
          onClick={handleClick}
          disabled={!pointerLockState.canRequest}
          className={`
            px-6 py-3 rounded-lg font-semibold text-lg transition-all duration-200
            ${pointerLockState.canRequest 
              ? 'bg-blue-600 hover:bg-blue-500 text-white hover:scale-105 active:scale-95' 
              : 'bg-gray-600 text-gray-400 cursor-not-allowed'
            }
          `}
        >
          {pointerLockState.canRequest ? 'Enter Game' : 'Please Wait...'}
        </button>

        {/* Instructions */}
        <div className="mt-6 text-sm text-gray-400">
          <p className="mb-2">Controls:</p>
          <div className="flex flex-wrap justify-center gap-2">
            <kbd className="bg-gray-700 px-2 py-1 rounded">WASD</kbd>
            <span>Move</span>
            <kbd className="bg-gray-700 px-2 py-1 rounded">Mouse</kbd>
            <span>Look</span>
            <kbd className="bg-gray-700 px-2 py-1 rounded">ESC</kbd>
            <span>Exit</span>
          </div>
        </div>
      </div>
    </div>
  )
} 