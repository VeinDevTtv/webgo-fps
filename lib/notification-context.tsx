"use client"

import { createContext, useContext, useState, useCallback, type ReactNode } from "react"

// Define notification types
export type NotificationType = "resource" | "info" | "warning" | "error"

// Define notification structure
export interface Notification {
  id: string
  message: string
  type: NotificationType
  icon?: string
  timestamp: number
  duration?: number // Duration in milliseconds
}

// Define context type
interface NotificationContextType {
  notifications: Notification[]
  addNotification: (notification: Omit<Notification, "id" | "timestamp">) => void
  removeNotification: (id: string) => void
  clearNotifications: () => void
}

// Create context
const NotificationContext = createContext<NotificationContextType | null>(null)

// Export the context so other modules can use it directly
export { NotificationContext }

// Default notification duration (5 seconds)
const DEFAULT_DURATION = 5000

export function NotificationProvider({ children }: { children: ReactNode }) {
  const [notifications, setNotifications] = useState<Notification[]>([])

  // Add a new notification
  const addNotification = useCallback((notification: Omit<Notification, "id" | "timestamp">) => {
    const id = `notification-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`
    const timestamp = Date.now()
    const duration = notification.duration || DEFAULT_DURATION

    setNotifications((prev) => [
      ...prev,
      {
        ...notification,
        id,
        timestamp,
        duration,
      },
    ])

    // Automatically remove notification after duration
    setTimeout(() => {
      removeNotification(id)
    }, duration)
  }, [])

  // Remove a notification by ID
  const removeNotification = useCallback((id: string) => {
    setNotifications((prev) => prev.filter((notification) => notification.id !== id))
  }, [])

  // Clear all notifications
  const clearNotifications = useCallback(() => {
    setNotifications([])
  }, [])

  return (
    <NotificationContext.Provider
      value={{
        notifications,
        addNotification,
        removeNotification,
        clearNotifications,
      }}
    >
      {children}
    </NotificationContext.Provider>
  )
}

// Hook for using notifications
export function useNotifications() {
  const context = useContext(NotificationContext)
  if (!context) {
    throw new Error("useNotifications must be used within a NotificationProvider")
  }
  return context
}
