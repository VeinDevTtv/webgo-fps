"use client"

import { useEffect, useState } from "react"
import { ToolSystem, type ToolData } from "@/systems/tool-system"
import { GAME_CONFIG } from "@/lib/config/game-config"

interface ToolDurabilityHUDProps {
  toolSystem: ToolSystem
  currentToolId?: string
}

export default function ToolDurabilityHUD({ toolSystem, currentToolId }: ToolDurabilityHUDProps) {
  const [tools, setTools] = useState<ToolData[]>([])
  const [currentTool, setCurrentTool] = useState<ToolData | null>(null)

  useEffect(() => {
    const updateTools = () => {
      setTools(toolSystem.getAllTools())
      if (currentToolId) {
        setCurrentTool(toolSystem.getTool(currentToolId))
      }
    }

    // Initial update
    updateTools()

    // Set up listeners
    toolSystem.onToolUpdateEvent(() => {
      updateTools()
    })

    toolSystem.onToolBreakEvent((tool) => {
      updateTools()
      // Could add notification here
    })

    // Update periodically
    const interval = setInterval(updateTools, 1000)

    return () => {
      clearInterval(interval)
    }
  }, [toolSystem, currentToolId])

  const getDurabilityColor = (percentage: number): string => {
    if (percentage <= GAME_CONFIG.TOOLS.DURABILITY_WARNING_THRESHOLD) {
      return 'bg-red-500'
    } else if (percentage <= 50) {
      return 'bg-yellow-500'
    } else {
      return 'bg-green-500'
    }
  }

  const getDurabilityTextColor = (percentage: number): string => {
    if (percentage <= GAME_CONFIG.TOOLS.DURABILITY_WARNING_THRESHOLD) {
      return 'text-red-400'
    } else if (percentage <= 50) {
      return 'text-yellow-400'
    } else {
      return 'text-green-400'
    }
  }

  if (tools.length === 0) {
    return null
  }

  return (
    <div className="fixed top-4 left-4 bg-black/50 text-white p-4 rounded-lg min-w-[250px]">
      <div className="text-sm font-bold mb-3 text-gray-300">Tool Durability</div>
      
      {/* Current Tool (if any) */}
      {currentTool && (
        <div className="mb-4 p-3 bg-blue-900/30 rounded border border-blue-600">
          <div className="text-xs text-blue-300 mb-1">Current Tool</div>
          <div className="flex items-center gap-2 mb-2">
            <span className="text-lg">{currentTool.icon}</span>
            <div className="flex-1">
              <div className="font-medium text-sm">{currentTool.name}</div>
              <div className={`text-xs ${getDurabilityTextColor((currentTool.durability / currentTool.maxDurability) * 100)}`}>
                {currentTool.durability}/{currentTool.maxDurability}
                {currentTool.durability === 0 && " (BROKEN)"}
              </div>
            </div>
          </div>
          
          {/* Durability Bar */}
          <div className="w-full bg-gray-700 rounded-full h-2">
            <div
              className={`h-2 rounded-full transition-all duration-300 ${getDurabilityColor((currentTool.durability / currentTool.maxDurability) * 100)}`}
              style={{
                width: `${(currentTool.durability / currentTool.maxDurability) * 100}%`,
              }}
            />
          </div>
          
          {/* Warning */}
          {toolSystem.isToolNearBreaking(currentTool.id) && currentTool.durability > 0 && (
            <div className="mt-2 text-xs text-yellow-400 animate-pulse">
              ⚠️ Tool is near breaking!
            </div>
          )}
          
          {currentTool.durability === 0 && (
            <div className="mt-2 text-xs text-red-400 animate-pulse">
              💥 Tool is broken! Repair needed.
            </div>
          )}
        </div>
      )}

      {/* All Tools */}
      <div className="space-y-2">
        {tools.map((tool) => {
          const percentage = (tool.durability / tool.maxDurability) * 100
          const isNearBreaking = toolSystem.isToolNearBreaking(tool.id)
          const isBroken = tool.durability === 0
          const isCurrent = currentToolId === tool.id

          return (
            <div
              key={tool.id}
              className={`flex items-center gap-2 p-2 rounded transition-all ${
                isCurrent ? 'bg-blue-600/20 border border-blue-500' : 'bg-gray-800/50'
              }`}
            >
              <span className="text-sm">{tool.icon}</span>
              
              <div className="flex-1">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium">{tool.name}</span>
                  <span className={`text-xs ${getDurabilityTextColor(percentage)}`}>
                    {tool.durability}/{tool.maxDurability}
                  </span>
                </div>
                
                {/* Mini durability bar */}
                <div className="w-full bg-gray-700 rounded-full h-1 mt-1">
                  <div
                    className={`h-1 rounded-full transition-all duration-300 ${getDurabilityColor(percentage)}`}
                    style={{ width: `${percentage}%` }}
                  />
                </div>
              </div>
              
              {/* Status indicators */}
              <div className="flex flex-col items-center">
                {isBroken && (
                  <span className="text-red-400 text-xs">💥</span>
                )}
                {isNearBreaking && !isBroken && (
                  <span className="text-yellow-400 text-xs animate-pulse">⚠️</span>
                )}
                {isCurrent && (
                  <span className="text-blue-400 text-xs">📍</span>
                )}
              </div>
            </div>
          )
        })}
      </div>

      {/* Repair hint */}
      {tools.some(tool => tool.durability < tool.maxDurability) && (
        <div className="mt-3 pt-3 border-t border-gray-600">
          <div className="text-xs text-gray-400 text-center">
            Visit a workbench to repair tools
          </div>
        </div>
      )}
    </div>
  )
} 