"use client"

import StatusBar from "./status-bar"
import { usePlayerStatus } from "@/lib/player-status-context"

export default function StatusBars() {
  const { health, maxHealth, food, maxFood, water, maxWater } = usePlayerStatus()

  return (
    <div className="absolute bottom-16 right-4 w-64 pointer-events-none">
      <StatusBar type="health" value={health} maxValue={maxHealth} />
      <StatusBar type="food" value={food} maxValue={maxFood} />
      <StatusBar type="water" value={water} maxValue={maxWater} />
    </div>
  )
}
