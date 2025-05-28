"use client"

import { useState, useEffect } from "react"
import Image from "next/image"
import type { Notification } from "@/lib/notification-context"

interface NotificationProps {
  notification: Notification
  index: number
  onRemove: (id: string) => void
}

export default function NotificationItem({ notification, index, onRemove }: NotificationProps) {
  const [isVisible, setIsVisible] = useState(false)
  const [isExiting, setIsExiting] = useState(false)

  // Animate in on mount
  useEffect(() => {
    // Small delay to ensure CSS transition works
    const timer = setTimeout(() => {
      setIsVisible(true)
    }, 10)

    return () => clearTimeout(timer)
  }, [])

  // Handle removal
  useEffect(() => {
    const duration = notification.duration || 5000

    // Start exit animation slightly before removal
    const exitTimer = setTimeout(() => {
      setIsExiting(true)
    }, duration - 300)

    // Remove after duration
    const removeTimer = setTimeout(() => {
      onRemove(notification.id)
    }, duration)

    return () => {
      clearTimeout(exitTimer)
      clearTimeout(removeTimer)
    }
  }, [notification, onRemove])

  // Determine background color based on notification type
  const getBgColor = () => {
    switch (notification.type) {
      case "resource":
        return "bg-green-800/80"
      case "info":
        return "bg-blue-800/80"
      case "warning":
        return "bg-yellow-800/80"
      case "error":
        return "bg-red-800/80"
      default:
        return "bg-gray-800/80"
    }
  }

  // Remove the mb-${index * 2} class which was adding extra margin between items
  // and reduce the translation amount for stacking

  return (
    <div
      className={`
        transform transition-all duration-300 ease-in-out
        ${isVisible ? "translate-y-0 opacity-100" : "translate-y-10 opacity-0"}
        ${isExiting ? "opacity-0" : ""}
        ${getBgColor()} text-white px-4 py-1 rounded-md shadow-lg
        flex items-center gap-2 min-w-[120px] max-w-[250px] z-50
        translate-y-[-${index * 50}%]
      `}
    >
      {notification.icon && (
        <div className="flex-shrink-0 w-5 h-5 relative">
          <Image src={notification.icon || "/placeholder.svg"} alt="" fill className="object-contain" />
        </div>
      )}
      <div className="flex-grow text-sm font-medium">{notification.message}</div>
    </div>
  )
}
