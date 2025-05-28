"use client"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"

interface DoorUIProps {
  doorId: string
  onClose: () => void
  onToggleDoor: (doorId: string, isOpen: boolean) => void
  isOpen: boolean
}

export default function DoorUI({ doorId, onClose, onToggleDoor, isOpen }: DoorUIProps) {
  return (
    <div className="fixed inset-0 flex items-center justify-center bg-black/50 z-50">
      <Card className="w-80">
        <CardHeader>
          <CardTitle>Door</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex justify-center">
            <Button onClick={() => onToggleDoor(doorId, !isOpen)} className="w-full">
              {isOpen ? "Close Door" : "Open Door"}
            </Button>
          </div>
          <Button onClick={onClose} variant="outline" className="w-full">
            Close
          </Button>
        </CardContent>
      </Card>
    </div>
  )
}
