"use client"

import { useNotifications } from "@/lib/notification-context"
import NotificationItem from "./notification"

export default function NotificationContainer() {
  const { notifications, removeNotification } = useNotifications()

  // Only show the most recent 5 notifications to prevent overcrowding
  const visibleNotifications = notifications.slice(-5)

  return (
    <div className="fixed bottom-[140px] right-4 p-4 z-50 pointer-events-none">
      <div className="flex flex-col-reverse gap-1">
        {visibleNotifications.map((notification, index) => (
          <NotificationItem
            key={notification.id}
            notification={notification}
            index={index}
            onRemove={removeNotification}
          />
        ))}
      </div>
    </div>
  )
}
