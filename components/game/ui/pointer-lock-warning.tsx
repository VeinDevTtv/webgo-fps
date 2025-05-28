"use client"

interface PointerLockWarningProps {
  visible: boolean
  error: any
  onDismiss: () => void
}

export default function PointerLockWarning({ visible, error, onDismiss }: PointerLockWarningProps) {
  if (!visible) return null

  return (
    <div className="fixed top-0 left-0 right-0 bg-red-600 text-white p-3 z-50">
      <div className="container mx-auto flex items-center justify-between">
        <div>
          <strong>Mouse Lock Error:</strong> Unable to lock the mouse pointer. This may affect gameplay. Try clicking
          the game again or check browser permissions.
        </div>
        <button onClick={onDismiss} className="bg-white text-red-600 px-2 py-1 rounded text-sm font-bold">
          Dismiss
        </button>
      </div>
    </div>
  )
}
