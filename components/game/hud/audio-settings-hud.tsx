"use client"

import { useEffect, useState } from "react"
import { SpatialAudioSystem, type AudioCategory } from "@/systems/spatial-audio-system"
import { DynamicMusicSystem } from "@/systems/dynamic-music-system"
import { GAME_CONFIG } from "@/lib/config/game-config"

interface AudioSettingsHUDProps {
  audioSystem: SpatialAudioSystem
  musicSystem: DynamicMusicSystem
  isVisible: boolean
  onClose: () => void
}

interface VolumeState {
  master: number
  sfx: number
  music: number
  ui: number
  ambient: number
}

export default function AudioSettingsHUD({ 
  audioSystem, 
  musicSystem, 
  isVisible, 
  onClose 
}: AudioSettingsHUDProps) {
  const [volumes, setVolumes] = useState<VolumeState>({
    master: 0.8,
    sfx: 1.0,
    music: 0.7,
    ui: 0.8,
    ambient: 0.6,
  })
  const [musicEnabled, setMusicEnabled] = useState(true)
  const [isWebAudioSupported, setIsWebAudioSupported] = useState(true)

  useEffect(() => {
    // Load current volume settings
    const loadVolumes = () => {
      setVolumes({
        master: audioSystem.getVolume('MASTER' as AudioCategory),
        sfx: audioSystem.getVolume('SFX'),
        music: audioSystem.getVolume('MUSIC'),
        ui: audioSystem.getVolume('UI'),
        ambient: audioSystem.getVolume('AMBIENT'),
      })
      setMusicEnabled(musicSystem.isEnabled())
    }

    loadVolumes()

    // Check Web Audio API support
    if (!window.AudioContext && !(window as any).webkitAudioContext) {
      setIsWebAudioSupported(false)
    }

    // Set up listeners
    audioSystem.onVolumeChangeEvent((category, volume) => {
      setVolumes(prev => ({
        ...prev,
        [category.toLowerCase()]: volume,
      }))
    })

    audioSystem.onAudioErrorEvent((error) => {
      console.error('Audio error:', error)
      if (error.includes('Web Audio API')) {
        setIsWebAudioSupported(false)
      }
    })

  }, [audioSystem, musicSystem])

  const handleVolumeChange = (category: AudioCategory, value: number) => {
    const volume = value / 100 // Convert from 0-100 to 0-1
    audioSystem.setVolume(category, volume)
    
    // Play a test sound for immediate feedback
    if (category === 'UI') {
      audioSystem.playUISound('CLICK')
    } else if (category === 'SFX') {
      // Could play a test SFX sound
    }
  }

  const handleMusicToggle = (enabled: boolean) => {
    setMusicEnabled(enabled)
    musicSystem.setEnabled(enabled)
    
    if (enabled) {
      // Resume music with current game context
      // This would need to be provided by the parent component
      const dummyContext = {
        playerPosition: { x: 0, y: 0, z: 0 } as any,
        isInCombat: false,
        nearbyEnemies: [],
        timeOfDay: 12,
        isInMenu: false,
        playerHealth: 100,
      }
      musicSystem.resumeMusic(dummyContext)
    }
  }

  const resetToDefaults = () => {
    Object.entries(GAME_CONFIG.AUDIO.CATEGORIES).forEach(([category, config]) => {
      audioSystem.setVolume(category as AudioCategory, config.default)
    })
    
    setMusicEnabled(true)
    musicSystem.setEnabled(true)
    
    // Play confirmation sound
    audioSystem.playUISound('NOTIFICATION')
  }

  const testAudio = (category: AudioCategory) => {
    switch (category) {
      case 'SFX':
        audioSystem.playUISound('EQUIP')
        break
      case 'UI':
        audioSystem.playUISound('CLICK')
        break
      case 'MUSIC':
        // Could trigger a short music preview
        break
      case 'AMBIENT':
        // Could play a short ambient sound
        break
    }
  }

  if (!isVisible) return null

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-gray-900 text-white p-6 rounded-lg min-w-[400px] max-w-[500px] border border-gray-700">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-bold">Audio Settings</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white transition-colors"
          >
            ✕
          </button>
        </div>

        {!isWebAudioSupported && (
          <div className="mb-4 p-3 bg-yellow-900/50 border border-yellow-600 rounded">
            <div className="text-yellow-300 text-sm">
              ⚠️ Web Audio API not supported. Some audio features may not work properly.
            </div>
          </div>
        )}

        <div className="space-y-4">
          {/* Master Volume */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-sm font-medium">Master Volume</label>
              <div className="flex items-center gap-2">
                <span className="text-xs text-gray-400 w-8 text-right">
                  {Math.round(volumes.master * 100)}%
                </span>
                <button
                  onClick={() => testAudio('UI')}
                  className="text-xs text-blue-400 hover:text-blue-300 px-2 py-1 rounded bg-blue-900/30"
                >
                  Test
                </button>
              </div>
            </div>
            <input
              type="range"
              min="0"
              max="100"
              value={volumes.master * 100}
              onChange={(e) => handleVolumeChange('MASTER' as AudioCategory, parseInt(e.target.value))}
              className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer slider"
            />
          </div>

          {/* SFX Volume */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-sm font-medium">Sound Effects</label>
              <div className="flex items-center gap-2">
                <span className="text-xs text-gray-400 w-8 text-right">
                  {Math.round(volumes.sfx * 100)}%
                </span>
                <button
                  onClick={() => testAudio('SFX')}
                  className="text-xs text-blue-400 hover:text-blue-300 px-2 py-1 rounded bg-blue-900/30"
                >
                  Test
                </button>
              </div>
            </div>
            <input
              type="range"
              min="0"
              max="100"
              value={volumes.sfx * 100}
              onChange={(e) => handleVolumeChange('SFX', parseInt(e.target.value))}
              className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer slider"
            />
          </div>

          {/* Music Volume */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-sm font-medium">Music</label>
              <div className="flex items-center gap-2">
                <span className="text-xs text-gray-400 w-8 text-right">
                  {Math.round(volumes.music * 100)}%
                </span>
                <button
                  onClick={() => handleMusicToggle(!musicEnabled)}
                  className={`text-xs px-2 py-1 rounded transition-colors ${
                    musicEnabled 
                      ? 'text-green-300 bg-green-900/30 hover:bg-green-900/50' 
                      : 'text-red-300 bg-red-900/30 hover:bg-red-900/50'
                  }`}
                >
                  {musicEnabled ? 'ON' : 'OFF'}
                </button>
              </div>
            </div>
            <input
              type="range"
              min="0"
              max="100"
              value={volumes.music * 100}
              onChange={(e) => handleVolumeChange('MUSIC', parseInt(e.target.value))}
              disabled={!musicEnabled}
              className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer slider disabled:opacity-50"
            />
          </div>

          {/* UI Volume */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-sm font-medium">User Interface</label>
              <div className="flex items-center gap-2">
                <span className="text-xs text-gray-400 w-8 text-right">
                  {Math.round(volumes.ui * 100)}%
                </span>
                <button
                  onClick={() => testAudio('UI')}
                  className="text-xs text-blue-400 hover:text-blue-300 px-2 py-1 rounded bg-blue-900/30"
                >
                  Test
                </button>
              </div>
            </div>
            <input
              type="range"
              min="0"
              max="100"
              value={volumes.ui * 100}
              onChange={(e) => handleVolumeChange('UI', parseInt(e.target.value))}
              className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer slider"
            />
          </div>

          {/* Ambient Volume */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-sm font-medium">Ambient Sounds</label>
              <div className="flex items-center gap-2">
                <span className="text-xs text-gray-400 w-8 text-right">
                  {Math.round(volumes.ambient * 100)}%
                </span>
                <button
                  onClick={() => testAudio('AMBIENT')}
                  className="text-xs text-blue-400 hover:text-blue-300 px-2 py-1 rounded bg-blue-900/30"
                >
                  Test
                </button>
              </div>
            </div>
            <input
              type="range"
              min="0"
              max="100"
              value={volumes.ambient * 100}
              onChange={(e) => handleVolumeChange('AMBIENT', parseInt(e.target.value))}
              className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer slider"
            />
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center justify-between mt-6 pt-4 border-t border-gray-700">
          <button
            onClick={resetToDefaults}
            className="px-4 py-2 text-sm bg-gray-700 hover:bg-gray-600 rounded transition-colors"
          >
            Reset to Defaults
          </button>
          
          <div className="flex items-center gap-2">
            <div className="text-xs text-gray-400">
              Current Music: {musicSystem.getCurrentState()}
            </div>
            <button
              onClick={onClose}
              className="px-4 py-2 text-sm bg-blue-600 hover:bg-blue-500 rounded transition-colors"
            >
              Done
            </button>
          </div>
        </div>

        {/* Audio Info */}
        <div className="mt-4 pt-4 border-t border-gray-700">
          <div className="text-xs text-gray-400 space-y-1">
            <div>• Spatial audio provides 3D positional sound</div>
            <div>• Music adapts to gameplay and time of day</div>
            <div>• Settings are saved automatically</div>
          </div>
        </div>
      </div>

      <style jsx>{`
        .slider::-webkit-slider-thumb {
          appearance: none;
          height: 16px;
          width: 16px;
          border-radius: 50%;
          background: #3b82f6;
          cursor: pointer;
          border: 2px solid #1e40af;
        }
        
        .slider::-moz-range-thumb {
          height: 16px;
          width: 16px;
          border-radius: 50%;
          background: #3b82f6;
          cursor: pointer;
          border: 2px solid #1e40af;
        }
      `}</style>
    </div>
  )
} 