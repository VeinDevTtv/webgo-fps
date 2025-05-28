"use client"

import type React from "react"
import { usePlaceableItem, type PlaceableItemConfig } from "@/lib/hooks/use-placeable-item"

interface PlaceableItemProps {
  isLocked: boolean
  terrainHeightData: number[][]
  config: PlaceableItemConfig
  onPlace: (position: [number, number, number], normal: [number, number, number], itemId: string) => void
  renderGhost: (position: [number, number, number], normal: [number, number, number]) => React.ReactNode
}

export default function PlaceableItem({
  isLocked,
  terrainHeightData,
  config,
  onPlace,
  renderGhost,
}: PlaceableItemProps) {
  const { ghostPosition, ghostNormal, showGhost } = usePlaceableItem({
    isLocked,
    terrainHeightData,
    config,
    onPlace,
  })

  return <>{showGhost && isLocked && renderGhost(ghostPosition, ghostNormal)}</>
}
