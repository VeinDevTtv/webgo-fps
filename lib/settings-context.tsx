"use client"

import { createContext, useContext, useState, useEffect, type ReactNode } from "react"

// Default settings values
export const DEFAULT_SETTINGS = {
  graphics: {
    maxRenderDistance: 100, // Reduced from 150 to 100
    fogDensity: 1.5, // Increased from 1.0 to 1.5 for more fog (better performance)
    enableShadows: false,
    quality: "low", // Changed from "medium" to "low"
  },
  controls: {
    mouseSensitivity: 1.0,
    invertY: false,
  },
  audio: {
    masterVolume: 0.8,
    sfxVolume: 1.0,
  },
  gameplay: {
    fov: 75,
    showFps: false,
    showCrosshair: true,
    enableHud: true, // Add this new setting with default value true
  },
}

export type Settings = typeof DEFAULT_SETTINGS
type SettingsContextType = {
  settings: Settings
  updateSettings: (newSettings: Partial<Settings>) => void
  updateGraphicsSetting: <K extends keyof Settings["graphics"]>(key: K, value: Settings["graphics"][K]) => void
  updateControlsSetting: <K extends keyof Settings["controls"]>(key: K, value: Settings["controls"][K]) => void
  updateAudioSetting: <K extends keyof Settings["audio"]>(key: K, value: Settings["audio"][K]) => void
  updateGameplaySetting: <K extends keyof Settings["gameplay"]>(key: K, value: Settings["gameplay"][K]) => void
  resetToDefaults: () => void
}

const SettingsContext = createContext<SettingsContextType | null>(null)

export function SettingsProvider({ children }: { children: ReactNode }) {
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS)
  const [initialized, setInitialized] = useState(false)

  // Load settings from localStorage on initial render
  useEffect(() => {
    try {
      const savedSettings = localStorage.getItem("webgo-settings")
      if (savedSettings) {
        const parsedSettings = JSON.parse(savedSettings)
        // Merge with defaults to ensure all properties exist
        setSettings({
          ...DEFAULT_SETTINGS,
          ...parsedSettings,
          // Ensure nested objects are properly merged
          graphics: { ...DEFAULT_SETTINGS.graphics, ...parsedSettings.graphics },
          controls: { ...DEFAULT_SETTINGS.controls, ...parsedSettings.controls },
          audio: { ...DEFAULT_SETTINGS.audio, ...parsedSettings.audio },
          gameplay: { ...DEFAULT_SETTINGS.gameplay, ...parsedSettings.gameplay },
        })
      }
    } catch (error) {
      console.error("Failed to load settings:", error)
    }
    setInitialized(true)
  }, [])

  // Save settings to localStorage whenever they change
  useEffect(() => {
    if (initialized) {
      localStorage.setItem("webgo-settings", JSON.stringify(settings))
    }
  }, [settings, initialized])

  // Update entire settings object
  const updateSettings = (newSettings: Partial<Settings>) => {
    setSettings((prev) => ({
      ...prev,
      ...newSettings,
    }))
  }

  // Update a specific graphics setting
  const updateGraphicsSetting = <K extends keyof Settings["graphics"]>(key: K, value: Settings["graphics"][K]) => {
    setSettings((prev) => ({
      ...prev,
      graphics: {
        ...prev.graphics,
        [key]: value,
      },
    }))
  }

  // Update a specific controls setting
  const updateControlsSetting = <K extends keyof Settings["controls"]>(key: K, value: Settings["controls"][K]) => {
    setSettings((prev) => ({
      ...prev,
      controls: {
        ...prev.controls,
        [key]: value,
      },
    }))
  }

  // Update a specific audio setting
  const updateAudioSetting = <K extends keyof Settings["audio"]>(key: K, value: Settings["audio"][K]) => {
    setSettings((prev) => ({
      ...prev,
      audio: {
        ...prev.audio,
        [key]: value,
      },
    }))
  }

  // Update a specific gameplay setting
  const updateGameplaySetting = <K extends keyof Settings["gameplay"]>(key: K, value: Settings["gameplay"][K]) => {
    setSettings((prev) => ({
      ...prev,
      gameplay: {
        ...prev.gameplay,
        [key]: value,
      },
    }))
  }

  // Reset all settings to defaults
  const resetToDefaults = () => {
    setSettings(DEFAULT_SETTINGS)
  }

  return (
    <SettingsContext.Provider
      value={{
        settings,
        updateSettings,
        updateGraphicsSetting,
        updateControlsSetting,
        updateAudioSetting,
        updateGameplaySetting,
        resetToDefaults,
      }}
    >
      {children}
    </SettingsContext.Provider>
  )
}

export function useSettings() {
  const context = useContext(SettingsContext)
  if (!context) {
    throw new Error("useSettings must be used within a SettingsProvider")
  }
  return context
}
