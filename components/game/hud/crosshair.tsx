"use client"

export default function Crosshair() {
  return (
    <div className="absolute inset-0 flex items-center justify-center">
      <div className="relative w-6 h-6">
        {/* Horizontal line */}
        <div className="absolute top-1/2 left-0 w-full h-0.5 bg-white/70 transform -translate-y-1/2"></div>

        {/* Vertical line */}
        <div className="absolute top-0 left-1/2 w-0.5 h-full bg-white/70 transform -translate-x-1/2"></div>

        {/* Center dot */}
        <div className="absolute top-1/2 left-1/2 w-1 h-1 bg-white/90 transform -translate-x-1/2 -translate-y-1/2 rounded-full"></div>
      </div>
    </div>
  )
}
