"use client"

interface AmmoCounterProps {
  current: number
  reserve: number
}

export default function AmmoCounter({ current, reserve }: AmmoCounterProps) {
  return (
    <div className="absolute bottom-4 right-8 text-white font-mono text-2xl">
      <div className="flex items-center">
        <span className={`${current === 0 ? "text-red-500" : ""}`}>{current}</span>
        <span className="mx-2 text-gray-400">/</span>
        <span className="text-gray-400">{reserve}</span>
      </div>
    </div>
  )
}
