"use client"

import type { ReactNode } from "react"
import { SettingsProvider } from "@/lib/settings-context"
import { GameProvider } from "@/lib/game-context"
import { GameStateProvider } from "@/lib/game-state-context"
import { PlayerStatusProvider } from "@/lib/player-status-context"
import { ToolbarProvider } from "@/lib/toolbar-context"
import { InventoryProvider } from "@/lib/inventory-context"
import { NotificationProvider } from "@/lib/notification-context"
import { CampfireProvider } from "@/lib/campfire-context"
import { StorageBoxProvider } from "@/lib/storage-box-context"
import { CraftingProvider } from "@/lib/crafting-context"
import { ItemManagerProvider } from "@/lib/item-manager-context"
import { InteractionProvider } from "@/lib/interaction-context"

export function Providers({ children }: { children: ReactNode }) {
  return (
    <SettingsProvider>
      <GameStateProvider>
        <GameProvider>
          <PlayerStatusProvider>
            <NotificationProvider>
              <ToolbarProvider>
                <InventoryProvider>
                  <CampfireProvider>
                    <StorageBoxProvider>
                      <CraftingProvider>
                        <ItemManagerProvider>
                          <InteractionProvider>{children}</InteractionProvider>
                        </ItemManagerProvider>
                      </CraftingProvider>
                    </StorageBoxProvider>
                  </CampfireProvider>
                </InventoryProvider>
              </ToolbarProvider>
            </NotificationProvider>
          </PlayerStatusProvider>
        </GameProvider>
      </GameStateProvider>
    </SettingsProvider>
  )
}
