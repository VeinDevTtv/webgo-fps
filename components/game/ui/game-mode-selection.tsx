"use client"

import { useState } from "react"
import { GAME_CONFIG } from "@/lib/config/game-config"

interface GameModeSelectionProps {
  onModeSelect: (mode: 'single_player' | 'multiplayer', playerName?: string, serverUrl?: string) => void
}

export default function GameModeSelection({ onModeSelect }: GameModeSelectionProps) {
  const [selectedMode, setSelectedMode] = useState<'single_player' | 'multiplayer' | null>(null)
  const [playerName, setPlayerName] = useState('')
  const [serverUrl, setServerUrl] = useState<string>(GAME_CONFIG.GAME_MODE.DEFAULT_SERVER_URL)
  const [isConnecting, setIsConnecting] = useState(false)
  const [connectionError, setConnectionError] = useState<string | null>(null)

  const handleSinglePlayer = () => {
    setSelectedMode('single_player')
    onModeSelect('single_player')
  }

  const handleMultiplayerSelect = () => {
    setSelectedMode('multiplayer')
    setConnectionError(null)
  }

  const handleMultiplayerConnect = async () => {
    if (!playerName.trim()) {
      setConnectionError('Please enter a player name')
      return
    }

    if (!serverUrl.trim()) {
      setConnectionError('Please enter a server URL')
      return
    }

    setIsConnecting(true)
    setConnectionError(null)

    try {
      // Test connection to server
      const testSocket = new WebSocket(serverUrl)
      
      testSocket.onopen = () => {
        testSocket.close()
        onModeSelect('multiplayer', playerName.trim(), serverUrl.trim())
      }

      testSocket.onerror = () => {
        setConnectionError('Failed to connect to server. Please check the URL and try again.')
        setIsConnecting(false)
      }

      testSocket.onclose = (event) => {
        if (event.code !== 1000) { // 1000 is normal closure
          setConnectionError('Connection failed. Server may be offline.')
          setIsConnecting(false)
        }
      }

      // Timeout after 5 seconds
      setTimeout(() => {
        if (testSocket.readyState === WebSocket.CONNECTING) {
          testSocket.close()
          setConnectionError('Connection timeout. Please check the server URL.')
          setIsConnecting(false)
        }
      }, 5000)

    } catch (error) {
      setConnectionError('Invalid server URL format')
      setIsConnecting(false)
    }
  }

  const handleBack = () => {
    setSelectedMode(null)
    setConnectionError(null)
    setIsConnecting(false)
  }

  return (
    <div className="fixed inset-0 bg-gradient-to-b from-gray-900 via-gray-800 to-black flex items-center justify-center">
      <div className="text-center max-w-2xl mx-auto px-8">
        {/* Game Title */}
        <div className="mb-12">
          <h1 className="text-6xl font-bold text-white mb-4 tracking-wider">
            WebGO
          </h1>
          <p className="text-xl text-gray-300 mb-2">First Person Survival</p>
          <p className="text-sm text-gray-400">Choose your game mode</p>
        </div>

        {!selectedMode ? (
          /* Mode Selection */
          <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-4xl mx-auto">
              {/* Single Player Mode */}
              <div 
                onClick={handleSinglePlayer}
                className="group bg-gray-800/50 border border-gray-600 rounded-lg p-8 cursor-pointer hover:bg-gray-700/50 hover:border-blue-500 transition-all duration-300 transform hover:scale-105"
              >
                <div className="text-center">
                  <div className="text-4xl mb-4 group-hover:scale-110 transition-transform">
                    ▶️
                  </div>
                  <h2 className="text-2xl font-bold text-white mb-3">Single Player</h2>
                  <p className="text-gray-300 mb-4">
                    Play solo with AI enemies and unlimited time to explore and build.
                  </p>
                  <ul className="text-sm text-gray-400 space-y-1">
                    <li>• AI enemies spawn automatically</li>
                    <li>• No network connection required</li>
                    <li>• Full access to all features</li>
                    <li>• Pause anytime</li>
                  </ul>
                </div>
              </div>

              {/* Multiplayer Mode */}
              <div 
                onClick={handleMultiplayerSelect}
                className="group bg-gray-800/50 border border-gray-600 rounded-lg p-8 cursor-pointer hover:bg-gray-700/50 hover:border-green-500 transition-all duration-300 transform hover:scale-105"
              >
                <div className="text-center">
                  <div className="text-4xl mb-4 group-hover:scale-110 transition-transform">
                    🌐
                  </div>
                  <h2 className="text-2xl font-bold text-white mb-3">Multiplayer</h2>
                  <p className="text-gray-300 mb-4">
                    Join up to 4 players in real-time cooperative survival.
                  </p>
                  <ul className="text-sm text-gray-400 space-y-1">
                    <li>• Up to 4 players</li>
                    <li>• Real-time synchronization</li>
                    <li>• Shared world building</li>
                    <li>• Voice chat ready</li>
                  </ul>
                </div>
              </div>
            </div>

            {/* Additional Info */}
            <div className="mt-12 text-center">
              <p className="text-gray-500 text-sm">
                WebGO FPS - Built with React, Three.js, and WebSocket technology
              </p>
            </div>
          </div>
        ) : selectedMode === 'multiplayer' ? (
          /* Multiplayer Setup */
          <div className="bg-gray-800/50 border border-gray-600 rounded-lg p-8 max-w-md mx-auto">
            <h2 className="text-2xl font-bold text-white mb-6 text-center">Join Multiplayer Game</h2>
            
            <div className="space-y-4">
              {/* Player Name Input */}
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Player Name
                </label>
                <input
                  type="text"
                  value={playerName}
                  onChange={(e) => setPlayerName(e.target.value)}
                  placeholder="Enter your name"
                  maxLength={20}
                  className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-md text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  disabled={isConnecting}
                />
              </div>

              {/* Server URL Input */}
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Server URL
                </label>
                <input
                  type="text"
                  value={serverUrl}
                  onChange={(e) => setServerUrl(e.target.value)}
                  placeholder="ws://localhost:8080"
                  className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-md text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  disabled={isConnecting}
                />
              </div>

              {/* Connection Error */}
              {connectionError && (
                <div className="bg-red-900/50 border border-red-600 rounded-md p-3">
                  <p className="text-red-300 text-sm">{connectionError}</p>
                </div>
              )}

              {/* Action Buttons */}
              <div className="flex space-x-3 pt-4">
                <button
                  onClick={handleBack}
                  disabled={isConnecting}
                  className="flex-1 px-4 py-2 bg-gray-600 hover:bg-gray-500 disabled:bg-gray-700 disabled:cursor-not-allowed text-white rounded-md transition-colors"
                >
                  Back
                </button>
                <button
                  onClick={handleMultiplayerConnect}
                  disabled={isConnecting || !playerName.trim() || !serverUrl.trim()}
                  className="flex-1 px-4 py-2 bg-green-600 hover:bg-green-500 disabled:bg-gray-700 disabled:cursor-not-allowed text-white rounded-md transition-colors flex items-center justify-center"
                >
                  {isConnecting ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                      Connecting...
                    </>
                  ) : (
                    'Connect'
                  )}
                </button>
              </div>
            </div>

            {/* Server Info */}
            <div className="mt-6 pt-4 border-t border-gray-600">
              <p className="text-xs text-gray-400 text-center">
                Make sure the multiplayer server is running on the specified URL.
                <br />
                Default: ws://localhost:8080
              </p>
            </div>
          </div>
        ) : null}

        {/* Controls Info */}
        <div className="mt-8 text-center">
          <p className="text-gray-500 text-xs">
            Press ESC anytime to return to this menu
          </p>
        </div>
      </div>
    </div>
  )
} 