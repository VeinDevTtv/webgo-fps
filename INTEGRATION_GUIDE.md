# Phase 5 Integration Guide

## Quick Integration Steps

To fully integrate the Phase 5 systems into the existing game, follow these steps:

### 1. Update Game Container

Add these imports to `components/game/game-container.tsx`:

```typescript
import { useGameModeStore } from "@/stores/game-mode-store"
import GameModeSelection from "./ui/game-mode-selection"
import PerformanceDebugOverlay from "./ui/performance-debug-overlay"
```

### 2. Add Game Mode Store Integration

In the `GameContainerInner` function, add:

```typescript
const { 
  gameState, 
  setGameState, 
  setGameMode,
  initializeMultiplayer,
  initializeSystems,
  disposeSystems 
} = useGameModeStore()
```

### 3. Update Game State Logic

Replace the existing game status logic with the new game state system:

```typescript
// Replace gameStatus with gameState from the store
// Add mode selection handling
const handleModeSelect = async (mode: 'single_player' | 'multiplayer', playerName?: string, serverUrl?: string) => {
  if (mode === 'single_player') {
    setGameMode('single_player')
    setGameState('title')
  } else if (mode === 'multiplayer' && playerName && serverUrl) {
    const connected = await initializeMultiplayer(playerName, serverUrl)
    if (connected) {
      setGameMode('multiplayer')
      setGameState('title')
    }
  }
}
```

### 4. Add Mode Selection to Render Function

Update the `renderContent()` function to include:

```typescript
case "mode_selection":
  return (
    <GameModeSelection onModeSelect={handleModeSelect} />
  )
```

### 5. Add Performance Overlay

In the playing state, add the performance overlay:

```typescript
{gameState === "playing" && (
  <>
    {/* existing HUD and game content */}
    <PerformanceDebugOverlay />
  </>
)}
```

### 6. Initialize Systems

Add system initialization when entering the game:

```typescript
useEffect(() => {
  if (gameState === 'playing') {
    initializeSystems()
  }
  
  return () => {
    if (gameState !== 'playing') {
      disposeSystems()
    }
  }
}, [gameState])
```

### 7. Update Initial Game State

Change the initial game state to start with mode selection:

```typescript
// In useState or initial state
const [gameStatus, setGameStatus] = useState("mode_selection") // instead of "loading"
```

## Testing the Integration

1. **Start the game** - Should show mode selection screen
2. **Choose Single Player** - Should proceed to title screen
3. **Choose Multiplayer** - Should test connection and proceed if successful
4. **Press F3 in-game** - Should show debug overlay
5. **Test collision** - Walk into trees/stones (should not pass through)
6. **Wait for enemies** - AI enemies should spawn in single player mode

## Quick Fixes for Common Issues

### If Game Mode Selection Doesn't Show
- Check that `gameState` is set to `"mode_selection"` initially
- Verify the import paths are correct
- Make sure the component is properly exported

### If Systems Don't Initialize
- Check that `initializeSystems()` is called when entering the game
- Verify the game mode store is properly imported
- Check browser console for any errors

### If Collision Doesn't Work
- Ensure the collision system is initialized
- Check that collision objects are being added to the system
- Verify terrain data is being passed to the collision system

### If Enemies Don't Spawn
- Make sure you're in single player mode
- Check that the enemy AI system is initialized
- Verify player position is being updated in the AI system

## Performance Considerations

- The new systems are designed to be efficient, but monitor performance with F3
- Collision detection uses spatial grids for O(1) lookups
- Enemy AI updates are throttled to maintain 60 FPS
- Debug overlays can be disabled in production builds

## Next Steps

Once integrated, you can:
1. Customize enemy behavior in `GAME_CONFIG.ENEMY_AI`
2. Adjust collision parameters in `GAME_CONFIG.COLLISION`
3. Modify wave timing in `GAME_CONFIG.GAME_LOOP`
4. Add new loot types in `GAME_CONFIG.LOOT`

The systems are modular and can be extended independently for future features. 