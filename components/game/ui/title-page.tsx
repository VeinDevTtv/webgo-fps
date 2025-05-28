"use client"

import { useState, useEffect } from "react"
import { useGameModeStore } from "@/stores/game-mode-store"

interface TitlePageProps {
  onStartGame: () => void
  onSettings: () => void
  onHowToPlay: () => void
}

export default function TitlePage({ onStartGame, onSettings, onHowToPlay }: TitlePageProps) {
  const {
    gameMode,
    isConnecting,
    isConnected,
    playerCount,
    connectionError,
    lastSelectedMode,
    setGameMode,
    testMultiplayerConnection,
    resetConnection
  } = useGameModeStore()

  const [selectedMode, setSelectedMode] = useState<'sp' | 'mp' | null>(null)

  // Auto-select last used mode on mount
  useEffect(() => {
    if (lastSelectedMode && !selectedMode) {
      setSelectedMode(lastSelectedMode)
      
      // Test multiplayer connection if last mode was MP
      if (lastSelectedMode === 'mp') {
        testMultiplayerConnection()
      }
    }
  }, [lastSelectedMode, selectedMode, testMultiplayerConnection])

  // Test multiplayer connection when MP is selected
  useEffect(() => {
    if (selectedMode === 'mp' && !isConnected && !isConnecting) {
      testMultiplayerConnection()
    }
  }, [selectedMode, isConnected, isConnecting, testMultiplayerConnection])

  const handleModeSelect = (mode: 'sp' | 'mp') => {
    setSelectedMode(mode)
    
    if (mode === 'mp') {
      // Test connection for multiplayer
      testMultiplayerConnection()
    } else {
      // Reset connection state for single player
      resetConnection()
    }
  }

  const handleStartGame = () => {
    if (!selectedMode) return
    
    // Set the game mode in the store
    setGameMode(selectedMode)
    
    // Start the game
    onStartGame()
  }

  const isMultiplayerDisabled = selectedMode === 'mp' && (!isConnected || !!connectionError)
  const canStartGame = selectedMode && (selectedMode === 'sp' || (selectedMode === 'mp' && isConnected))

  return (
    <div className="fixed inset-0 bg-gradient-to-b from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center">
      {/* Background Effects */}
      <div className="absolute inset-0 bg-[url('/noise.png')] opacity-5"></div>
      <div className="absolute inset-0 bg-gradient-to-r from-blue-900/20 via-transparent to-green-900/20"></div>
      
      {/* Main Content */}
      <div className="relative z-10 text-center space-y-8 max-w-md mx-auto px-6">
        {/* Title */}
        <div className="space-y-4">
          <h1 className="text-6xl font-bold text-white tracking-wider">
            WEB<span className="text-blue-400">GO</span>
          </h1>
          <p className="text-xl text-gray-300 font-light">
            First Person Survival
          </p>
        </div>

        {/* Game Mode Selection */}
        <div className="space-y-6">
          <h2 className="text-2xl font-semibold text-white mb-4">Choose Game Mode</h2>
          
          <div className="space-y-4">
            {/* Single Player Button */}
            <button
              onClick={() => handleModeSelect('sp')}
              className={`w-full p-4 rounded-lg border-2 transition-all duration-300 ${
                selectedMode === 'sp'
                  ? 'border-blue-400 bg-blue-400/20 text-white'
                  : 'border-gray-600 bg-gray-800/50 text-gray-300 hover:border-gray-500 hover:bg-gray-700/50'
              }`}
            >
              <div className="flex items-center justify-center space-x-3">
                <span className="text-2xl">🎮</span>
                <div className="text-left">
                  <div className="text-lg font-semibold">Single Player</div>
                  <div className="text-sm opacity-75">Play offline with AI enemies</div>
                </div>
              </div>
            </button>

            {/* Multiplayer Button */}
            <button
              onClick={() => handleModeSelect('mp')}
              disabled={isConnecting}
              className={`w-full p-4 rounded-lg border-2 transition-all duration-300 ${
                selectedMode === 'mp'
                  ? isConnected
                    ? 'border-green-400 bg-green-400/20 text-white'
                    : 'border-red-400 bg-red-400/20 text-white'
                  : 'border-gray-600 bg-gray-800/50 text-gray-300 hover:border-gray-500 hover:bg-gray-700/50'
              } ${isConnecting ? 'opacity-50 cursor-not-allowed' : ''}`}
            >
              <div className="flex items-center justify-center space-x-3">
                <span className="text-2xl">🌐</span>
                <div className="text-left">
                  <div className="text-lg font-semibold">
                    Multiplayer
                    {isConnecting && <span className="ml-2 text-sm">Connecting...</span>}
                  </div>
                  <div className="text-sm opacity-75">
                    {selectedMode === 'mp' ? (
                      isConnected ? (
                        `Online • ${playerCount} player${playerCount !== 1 ? 's' : ''}`
                      ) : connectionError ? (
                        connectionError
                      ) : (
                        'Checking connection...'
                      )
                    ) : (
                      'Play online with other players'
                    )}
                  </div>
                </div>
              </div>
            </button>
          </div>

          {/* Connection Error */}
          {selectedMode === 'mp' && connectionError && (
            <div className="p-3 bg-red-900/30 border border-red-500/50 rounded-lg">
              <p className="text-red-300 text-sm">{connectionError}</p>
              <button
                onClick={() => testMultiplayerConnection()}
                className="mt-2 text-xs text-red-200 hover:text-white underline"
              >
                Retry Connection
              </button>
            </div>
          )}
        </div>

        {/* Start Game Button */}
        <button
          onClick={handleStartGame}
          disabled={!canStartGame}
          className={`w-full py-4 px-8 rounded-lg font-semibold text-lg transition-all duration-300 ${
            canStartGame
              ? 'bg-gradient-to-r from-blue-600 to-green-600 hover:from-blue-500 hover:to-green-500 text-white shadow-lg hover:shadow-xl transform hover:scale-105'
              : 'bg-gray-700 text-gray-400 cursor-not-allowed'
          }`}
        >
          {!selectedMode ? 'Select Game Mode' : 
           selectedMode === 'mp' && !isConnected ? 'Connection Required' :
           'Start Game'}
        </button>

        {/* Menu Buttons */}
        <div className="space-y-3">
          <button
            onClick={onSettings}
            className="w-full py-3 px-6 bg-gray-800/70 hover:bg-gray-700/70 text-gray-300 hover:text-white rounded-lg transition-all duration-300 border border-gray-600 hover:border-gray-500"
          >
            Settings
          </button>
          
          <button
            onClick={onHowToPlay}
            className="w-full py-3 px-6 bg-gray-800/70 hover:bg-gray-700/70 text-gray-300 hover:text-white rounded-lg transition-all duration-300 border border-gray-600 hover:border-gray-500"
          >
            How to Play
          </button>
        </div>

        {/* Version Info */}
        <div className="text-xs text-gray-500 mt-8">
          WebGO v1.0 • Built with Three.js & React
        </div>
      </div>
    </div>
  )
}
