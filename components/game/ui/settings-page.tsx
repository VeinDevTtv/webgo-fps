"use client"

import { useState, useEffect } from "react"
import { useSettings } from "@/lib/settings-context"
import { useGameState } from "@/lib/game-state-context"
import { ArrowLeft } from "lucide-react"
import { useSoundManager } from "@/lib/sound-manager"

export default function SettingsPage() {
  const {
    settings,
    updateGraphicsSetting,
    updateControlsSetting,
    updateAudioSetting,
    updateGameplaySetting,
    resetToDefaults,
  } = useSettings()
  const { setGameStatus } = useGameState()

  const [activeTab, setActiveTab] = useState("graphics")

  const soundManager = useSoundManager()

  // Add ESC key handler to return to title
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.code === "Escape") {
        console.log("ESC pressed in settings, returning to title")
        setGameStatus("title")
      }
    }

    window.addEventListener("keydown", handleKeyDown)
    return () => window.removeEventListener("keydown", handleKeyDown)
  }, [setGameStatus])

  // Format a value with specified precision
  const formatValue = (value: number, precision = 1) => {
    return value.toFixed(precision)
  }

  // Handle back button click - always return to title
  const handleBackClick = () => {
    console.log("Settings: Back to title clicked")
    setGameStatus("title")
  }

  return (
    <div className="absolute inset-0 flex items-center justify-center bg-black/90 z-50">
      <div className="bg-gray-900 rounded-lg w-full max-w-2xl max-h-[90vh] overflow-auto">
        <div className="flex items-center justify-between p-4 border-b border-gray-800">
          <button
            onClick={handleBackClick}
            className="flex items-center text-gray-400 hover:text-white transition-colors"
          >
            <ArrowLeft size={20} className="mr-2" />
            Back to Menu
          </button>
          <h2 className="text-xl font-bold text-white">Settings</h2>
        </div>

        <div className="flex border-b border-gray-800">
          <button
            className={`px-4 py-2 ${
              activeTab === "graphics" ? "bg-gray-800 text-white" : "text-gray-400 hover:text-white"
            }`}
            onClick={() => setActiveTab("graphics")}
          >
            Graphics
          </button>
          <button
            className={`px-4 py-2 ${
              activeTab === "controls" ? "bg-gray-800 text-white" : "text-gray-400 hover:text-white"
            }`}
            onClick={() => setActiveTab("controls")}
          >
            Controls
          </button>
          <button
            className={`px-4 py-2 ${
              activeTab === "audio" ? "bg-gray-800 text-white" : "text-gray-400 hover:text-white"
            }`}
            onClick={() => setActiveTab("audio")}
          >
            Audio
          </button>
          <button
            className={`px-4 py-2 ${
              activeTab === "gameplay" ? "bg-gray-800 text-white" : "text-gray-400 hover:text-white"
            }`}
            onClick={() => setActiveTab("gameplay")}
          >
            Gameplay
          </button>
        </div>

        <div className="p-6">
          {/* Graphics Settings */}
          {activeTab === "graphics" && (
            <div className="space-y-6">
              <div className="space-y-2">
                <div className="flex justify-between">
                  <label htmlFor="maxRenderDistance" className="text-white">
                    Max Render Distance: {settings.graphics.maxRenderDistance}
                  </label>
                  <span className="text-gray-400 text-sm">{settings.graphics.maxRenderDistance} units</span>
                </div>
                <input
                  id="maxRenderDistance"
                  type="range"
                  min="50"
                  max="300"
                  step="10"
                  value={settings.graphics.maxRenderDistance}
                  onChange={(e) => updateGraphicsSetting("maxRenderDistance", Number.parseInt(e.target.value))}
                  className="w-full"
                />
                <p className="text-gray-400 text-xs">
                  Lower values improve performance, higher values show more distant objects.
                </p>
              </div>

              <div className="space-y-2">
                <div className="flex justify-between">
                  <label htmlFor="fogDensity" className="text-white">
                    Fog Density: {formatValue(settings.graphics.fogDensity)}
                  </label>
                  <span className="text-gray-400 text-sm">
                    {settings.graphics.fogDensity === 0
                      ? "Off"
                      : settings.graphics.fogDensity < 0.5
                        ? "Light"
                        : settings.graphics.fogDensity < 1.5
                          ? "Medium"
                          : "Heavy"}
                  </span>
                </div>
                <input
                  id="fogDensity"
                  type="range"
                  min="0"
                  max="2"
                  step="0.1"
                  value={settings.graphics.fogDensity}
                  onChange={(e) => updateGraphicsSetting("fogDensity", Number.parseFloat(e.target.value))}
                  className="w-full"
                />
              </div>

              <div className="flex items-center justify-between">
                <label htmlFor="enableShadows" className="text-white">
                  Enable Shadows
                </label>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    id="enableShadows"
                    type="checkbox"
                    checked={settings.graphics.enableShadows}
                    onChange={(e) => updateGraphicsSetting("enableShadows", e.target.checked)}
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-gray-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                </label>
              </div>

              <div className="space-y-2">
                <label htmlFor="quality" className="text-white block">
                  Graphics Quality
                </label>
                <select
                  id="quality"
                  value={settings.graphics.quality}
                  onChange={(e) => updateGraphicsSetting("quality", e.target.value as "low" | "medium" | "high")}
                  className="w-full bg-gray-800 text-white p-2 rounded border border-gray-700"
                >
                  <option value="low">Low</option>
                  <option value="medium">Medium</option>
                  <option value="high">High</option>
                </select>
              </div>
            </div>
          )}

          {/* Controls Settings */}
          {activeTab === "controls" && (
            <div className="space-y-6">
              <div className="space-y-2">
                <div className="flex justify-between">
                  <label htmlFor="mouseSensitivity" className="text-white">
                    Mouse Sensitivity: {formatValue(settings.controls.mouseSensitivity)}
                  </label>
                  <span className="text-gray-400 text-sm">
                    {settings.controls.mouseSensitivity < 0.5
                      ? "Low"
                      : settings.controls.mouseSensitivity < 1.5
                        ? "Medium"
                        : "High"}
                  </span>
                </div>
                <input
                  id="mouseSensitivity"
                  type="range"
                  min="0.1"
                  max="3"
                  step="0.1"
                  value={settings.controls.mouseSensitivity}
                  onChange={(e) => updateControlsSetting("mouseSensitivity", Number.parseFloat(e.target.value))}
                  className="w-full"
                />
              </div>

              <div className="flex items-center justify-between">
                <label htmlFor="invertY" className="text-white">
                  Invert Y-Axis
                </label>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    id="invertY"
                    type="checkbox"
                    checked={settings.controls.invertY}
                    onChange={(e) => updateControlsSetting("invertY", e.target.checked)}
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-gray-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                </label>
              </div>

              <div className="mt-4 p-3 bg-gray-800 rounded">
                <h3 className="text-white font-medium mb-2">Key Bindings</h3>
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div className="text-gray-400">Move Forward</div>
                  <div className="text-white">W</div>
                  <div className="text-gray-400">Move Left</div>
                  <div className="text-white">A</div>
                  <div className="text-gray-400">Move Backward</div>
                  <div className="text-white">S</div>
                  <div className="text-gray-400">Move Right</div>
                  <div className="text-white">D</div>
                  <div className="text-gray-400">Jump</div>
                  <div className="text-white">SPACE</div>
                  <div className="text-gray-400">Sprint</div>
                  <div className="text-white">SHIFT</div>
                  <div className="text-gray-400">Reload</div>
                  <div className="text-white">R</div>
                  <div className="text-gray-400">Menu</div>
                  <div className="text-white">ESC</div>
                </div>
              </div>
            </div>
          )}

          {/* Audio Settings */}
          {activeTab === "audio" && (
            <div className="space-y-6">
              <div className="space-y-2">
                <div className="flex justify-between">
                  <label htmlFor="masterVolume" className="text-white">
                    Master Volume: {Math.round(settings.audio.masterVolume * 100)}%
                  </label>
                </div>
                <input
                  id="masterVolume"
                  type="range"
                  min="0"
                  max="1"
                  step="0.01"
                  value={settings.audio.masterVolume}
                  onChange={(e) => updateAudioSetting("masterVolume", Number.parseFloat(e.target.value))}
                  className="w-full"
                />
              </div>

              <div className="space-y-2">
                <div className="flex justify-between">
                  <label htmlFor="sfxVolume" className="text-white">
                    Sound Effects: {Math.round(settings.audio.sfxVolume * 100)}%
                  </label>
                </div>
                <input
                  id="sfxVolume"
                  type="range"
                  min="0"
                  max="1"
                  step="0.01"
                  value={settings.audio.sfxVolume}
                  onChange={(e) => updateAudioSetting("sfxVolume", Number.parseFloat(e.target.value))}
                  className="w-full"
                />
              </div>

              {/* Sound Test Section */}
              <div className="mt-6 p-4 bg-gray-800 rounded">
                <h3 className="text-white font-medium mb-3">Sound Test</h3>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    className="px-3 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded transition-colors"
                    onClick={() => {
                      try {
                        soundManager.play("shoot")
                      } catch (error) {
                        console.warn("Error playing sound:", error)
                      }
                    }}
                  >
                    Test Gunshot
                  </button>
                  <button
                    className="px-3 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded transition-colors"
                    onClick={() => {
                      try {
                        soundManager.play("reload")
                      } catch (error) {
                        console.warn("Error playing sound:", error)
                      }
                    }}
                  >
                    Test Reload
                  </button>
                  <button
                    className="px-3 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded transition-colors"
                    onClick={() => {
                      try {
                        soundManager.play("chop")
                      } catch (error) {
                        console.warn("Error playing sound:", error)
                      }
                    }}
                  >
                    Test Axe Chop
                  </button>
                  <button
                    className="px-3 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded transition-colors"
                    onClick={() => {
                      try {
                        soundManager.play("stone_hit")
                      } catch (error) {
                        console.warn("Error playing sound:", error)
                      }
                    }}
                  >
                    Test Stone Hit
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Gameplay Settings */}
          {activeTab === "gameplay" && (
            <div className="space-y-6">
              <div className="space-y-2">
                <div className="flex justify-between">
                  <label htmlFor="fov" className="text-white">
                    Field of View: {settings.gameplay.fov}°
                  </label>
                </div>
                <input
                  id="fov"
                  type="range"
                  min="60"
                  max="120"
                  step="1"
                  value={settings.gameplay.fov}
                  onChange={(e) => updateGameplaySetting("fov", Number.parseInt(e.target.value))}
                  className="w-full"
                />
                <p className="text-gray-400 text-xs">
                  Lower values zoom in more, higher values show more peripheral vision.
                </p>
              </div>

              <div className="flex items-center justify-between">
                <label htmlFor="showFps" className="text-white">
                  Show FPS Counter
                </label>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    id="showFps"
                    type="checkbox"
                    checked={settings.gameplay.showFps}
                    onChange={(e) => updateGameplaySetting("showFps", e.target.checked)}
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-gray-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                </label>
              </div>

              <div className="flex items-center justify-between">
                <label htmlFor="showCrosshair" className="text-white">
                  Show Crosshair
                </label>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    id="showCrosshair"
                    type="checkbox"
                    checked={settings.gameplay.showCrosshair}
                    onChange={(e) => updateGameplaySetting("showCrosshair", e.target.checked)}
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-gray-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                </label>
              </div>

              <div className="flex items-center justify-between">
                <label htmlFor="enableHud" className="text-white">
                  Enable HUD
                </label>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    id="enableHud"
                    type="checkbox"
                    checked={settings.gameplay.enableHud}
                    onChange={(e) => updateGameplaySetting("enableHud", e.target.checked)}
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-gray-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                </label>
              </div>
            </div>
          )}

          <div className="mt-8 flex justify-between p-6">
            <button
              onClick={resetToDefaults}
              className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded transition-colors"
            >
              Reset to Defaults
            </button>
            <button
              onClick={handleBackClick}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded transition-colors"
            >
              Save & Close
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
