"use client"

import { useState, useEffect } from "react"
import Image from "next/image"

export type StatusType = "health" | "food" | "water"

interface StatusBarProps {
  type: StatusType
  value: number
  maxValue: number
  icon?: string
  showText?: boolean
}

export default function StatusBar({ type, value, maxValue, icon, showText = true }: StatusBarProps) {
  const [displayValue, setDisplayValue] = useState(value)

  // Animate value changes
  useEffect(() => {
    setDisplayValue(value)
  }, [value])

  // Calculate percentage
  const percentage = Math.max(0, Math.min(100, (displayValue / maxValue) * 100))

  // Determine color based on type and value
  const getBarColor = () => {
    if (type === "health") {
      if (percentage < 25) return "bg-red-600"
      if (percentage < 50) return "bg-red-500"
      return "bg-red-400"
    }
    if (type === "food") {
      if (percentage < 25) return "bg-yellow-700"
      if (percentage < 50) return "bg-yellow-600"
      return "bg-yellow-500"
    }
    if (type === "water") {
      if (percentage < 25) return "bg-blue-700"
      if (percentage < 50) return "bg-blue-600"
      return "bg-blue-500"
    }
    return "bg-gray-500"
  }

  // Get icon based on type
  const getIcon = () => {
    if (icon) return icon

    if (type === "health") return "/icons/heart.png"
    if (type === "food") return "/icons/food.png"
    if (type === "water") return "/icons/water.png"

    return "/icons/status.png"
  }

  return (
    <div className="flex items-center gap-2 mb-1">
      <div className="w-6 h-6 relative flex-shrink-0">
        <Image src={getIcon() || "/placeholder.svg"} alt={type} width={24} height={24} className="object-contain" />
      </div>
      <div className="flex-grow h-4 bg-gray-800 rounded-full overflow-hidden border border-gray-700">
        <div
          className={`h-full ${getBarColor()} transition-all duration-300 ease-out`}
          style={{ width: `${percentage}%` }}
        />
      </div>
      {showText && (
        <div className="text-white text-xs font-medium w-12 text-right">
          {Math.round(displayValue)}/{maxValue}
        </div>
      )}
    </div>
  )
}
