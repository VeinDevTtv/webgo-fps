import GameContainer from "@/components/game/game-container"
import { ItemManagerProvider } from "@/lib/item-manager-context"

export default function Home() {
  return (
    <ItemManagerProvider>
      <main className="w-full h-screen overflow-hidden bg-black">
        <GameContainer />
      </main>
    </ItemManagerProvider>
  )
}
