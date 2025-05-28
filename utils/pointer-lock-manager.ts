export interface PointerLockState {
  isLocked: boolean
  isSupported: boolean
  error: string | null
  canRequest: boolean
}

export interface PointerLockCallbacks {
  onLockChange?: (isLocked: boolean) => void
  onError?: (error: string) => void
  onSuccess?: () => void
}

export class PointerLockManager {
  private static instance: PointerLockManager | null = null
  private callbacks: PointerLockCallbacks = {}
  private isSupported: boolean = false
  private lastRequestTime: number = 0
  private readonly REQUEST_COOLDOWN = 1250 // Chrome has 1.25s timeout between requests

  constructor() {
    this.isSupported = this.checkSupport()
    this.setupEventListeners()
  }

  public static getInstance(): PointerLockManager {
    if (!PointerLockManager.instance) {
      PointerLockManager.instance = new PointerLockManager()
    }
    return PointerLockManager.instance
  }

  private checkSupport(): boolean {
    if (typeof document === 'undefined') return false
    
    return !!(
      'pointerLockElement' in document ||
      'mozPointerLockElement' in document ||
      'webkitPointerLockElement' in document
    )
  }

  private setupEventListeners(): void {
    if (typeof document === 'undefined') return

    const handleLockChange = () => {
      const canvas = this.getCanvas()
      const isLocked = document.pointerLockElement === canvas
      this.callbacks.onLockChange?.(isLocked)
    }

    const handleLockError = (event: Event) => {
      console.error('Pointer lock error:', event)
      const errorMessage = this.getErrorMessage(event)
      this.callbacks.onError?.(errorMessage)
    }

    // Add all vendor-prefixed event listeners
    document.addEventListener('pointerlockchange', handleLockChange)
    document.addEventListener('mozpointerlockchange', handleLockChange)
    document.addEventListener('webkitpointerlockchange', handleLockChange)

    document.addEventListener('pointerlockerror', handleLockError)
    document.addEventListener('mozpointerlockerror', handleLockError)
    document.addEventListener('webkitpointerlockerror', handleLockError)
  }

  private getCanvas(): HTMLCanvasElement | null {
    const canvas = document.querySelector('canvas')
    
    // Validate canvas is in DOM and not stale
    if (!canvas || !document.body.contains(canvas)) {
      return null
    }
    
    return canvas
  }

  private getErrorMessage(event: Event): string {
    // Common pointer lock error messages
    if (event.type.includes('error')) {
      return 'Pointer lock request failed. Please try clicking again.'
    }
    return 'Unknown pointer lock error occurred.'
  }

  private canRequestPointerLock(): { canRequest: boolean; reason?: string } {
    if (!this.isSupported) {
      return { canRequest: false, reason: 'Pointer lock not supported in this browser' }
    }

    const canvas = this.getCanvas()
    if (!canvas) {
      return { canRequest: false, reason: 'Canvas not found or removed from DOM' }
    }

    // Check Chrome's cooldown period
    const now = Date.now()
    if (now - this.lastRequestTime < this.REQUEST_COOLDOWN) {
      const remaining = Math.ceil((this.REQUEST_COOLDOWN - (now - this.lastRequestTime)) / 1000)
      return { canRequest: false, reason: `Please wait ${remaining} seconds before trying again` }
    }

    // Check if already locked
    if (document.pointerLockElement === canvas) {
      return { canRequest: false, reason: 'Pointer is already locked' }
    }

    return { canRequest: true }
  }

  public async requestPointerLock(element?: HTMLElement): Promise<void> {
    // Check if pointer lock is already active
    if (document.pointerLockElement) {
      // Already locked - call success callback and return silently
      this.callbacks.onSuccess?.()
      return Promise.resolve()
    }

    if (!this.isSupported) {
      const error = "Pointer Lock API is not supported in this browser"
      this.callbacks.onError?.(error)
      return Promise.reject(new Error(error))
    }

    // Check cooldown to prevent rapid requests
    const now = Date.now()
    if (now - this.lastRequestTime < this.REQUEST_COOLDOWN) {
      const error = `Please wait ${Math.ceil((this.REQUEST_COOLDOWN - (now - this.lastRequestTime)) / 1000)} seconds before requesting pointer lock again`
      this.callbacks.onError?.(error)
      return Promise.reject(new Error(error))
    }

    const targetElement = element || document.querySelector("canvas")
    if (!targetElement) {
      const error = "No target element found for pointer lock"
      this.callbacks.onError?.(error)
      return Promise.reject(new Error(error))
    }

    // Validate element is in DOM
    if (!document.body.contains(targetElement)) {
      const error = "Target element is not in the DOM"
      this.callbacks.onError?.(error)
      return Promise.reject(new Error(error))
    }

    this.lastRequestTime = now

    try {
      // Try modern promise-based API first
      if (typeof targetElement.requestPointerLock === "function") {
        const result = targetElement.requestPointerLock({ unadjustedMovement: true })
        
        if (result && typeof result.then === "function") {
          // Promise-based API
          return result.catch((error: Error) => {
            if (error.name === "NotSupportedError") {
              // Fallback to regular pointer lock
              return targetElement.requestPointerLock()
            }
            throw error
          })
        } else {
          // Legacy API - return a resolved promise
          return Promise.resolve()
        }
      } else {
        const error = "requestPointerLock method not available"
        this.callbacks.onError?.(error)
        return Promise.reject(new Error(error))
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Unknown pointer lock error"
      this.callbacks.onError?.(errorMessage)
      return Promise.reject(error)
    }
  }

  public exitPointerLock(): void {
    if (typeof document === 'undefined') return

    try {
      if (document.exitPointerLock) {
        document.exitPointerLock()
      } else if ((document as any).mozExitPointerLock) {
        (document as any).mozExitPointerLock()
      } else if ((document as any).webkitExitPointerLock) {
        (document as any).webkitExitPointerLock()
      }
    } catch (error) {
      console.error('Error exiting pointer lock:', error)
    }
  }

  public isLocked(): boolean {
    if (typeof document === 'undefined') return false
    const canvas = this.getCanvas()
    return document.pointerLockElement === canvas
  }

  public getState(): PointerLockState {
    const validation = this.canRequestPointerLock()
    
    return {
      isLocked: this.isLocked(),
      isSupported: this.isSupported,
      error: validation.canRequest ? null : validation.reason || null,
      canRequest: validation.canRequest
    }
  }

  public setCallbacks(callbacks: PointerLockCallbacks): void {
    this.callbacks = { ...this.callbacks, ...callbacks }
  }

  public clearCallbacks(): void {
    this.callbacks = {}
  }

  public dispose(): void {
    this.clearCallbacks()
    // Event listeners are global and should persist
  }
}

// Export singleton instance
export const pointerLockManager = PointerLockManager.getInstance() 