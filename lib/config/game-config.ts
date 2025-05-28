export const GAME_CONFIG = {
  // Player Configuration
  PLAYER: {
    HEIGHT: 1.7,
    CROUCH_HEIGHT: 1.0,
    RADIUS: 0.5,
    WALK_SPEED: 2.5,
    SPRINT_SPEED: 5.0,
    CROUCH_SPEED: 1.2,
    CROUCH_TRANSITION_SPEED: 5.0,
    JUMP_FORCE: 5.0,
    GRAVITY: 9.8,
    MAX_FALL_SPEED: 20.0,
    TERRAIN_CHECK_OFFSET: 0.1,
    COLLISION_ITERATIONS: 3,
  },

  // Weapon Configuration
  WEAPONS: {
    FIRE_RATE: 125, // milliseconds
    MAX_RECOIL: 0.15,
    RECOIL_AMOUNT: 0.015,
    RECOIL_RECOVERY: 0.02,
    RECOIL_RANDOMNESS: 0.003,
    DEFAULT_AMMO: {
      CURRENT: 30,
      RESERVE: 90,
    },
    MUZZLE_FLASH_DURATION: 50, // milliseconds
    SWITCH_COOLDOWN: 500, // milliseconds
    TYPES: {
      RIFLE: {
        id: 'rifle',
        name: 'Assault Rifle',
        fireRate: 125,
        damage: 25,
        range: 100,
        accuracy: 0.85,
        recoil: 0.015,
        ammo: { current: 30, reserve: 90 },
        icon: '🔫',
        model: 'rifle.glb',
      },
      SHOTGUN: {
        id: 'shotgun',
        name: 'Combat Shotgun',
        fireRate: 800,
        damage: 80,
        range: 30,
        accuracy: 0.6,
        recoil: 0.05,
        ammo: { current: 8, reserve: 32 },
        icon: '🔫',
        model: 'shotgun.glb',
      },
      PISTOL: {
        id: 'pistol',
        name: 'Sidearm',
        fireRate: 200,
        damage: 15,
        range: 50,
        accuracy: 0.9,
        recoil: 0.01,
        ammo: { current: 15, reserve: 60 },
        icon: '🔫',
        model: 'pistol.glb',
      },
    },
  },

  // Tool Configuration
  TOOLS: {
    HATCHET: {
      CHOP_ANIMATION_SPEED: 5.0,
      IDLE_ANIMATION_FREQUENCY: 2.0,
      MAX_HIT_DISTANCE: 5,
      CHOP_COOLDOWN: 200, // milliseconds
      MAX_DURABILITY: 100,
      DURABILITY_LOSS_PER_USE: 1,
      EFFICIENCY: 1.0,
    },
    PICKAXE: {
      MINE_ANIMATION_SPEED: 4.0,
      MAX_HIT_DISTANCE: 4,
      MINE_COOLDOWN: 250, // milliseconds
      MAX_DURABILITY: 80,
      DURABILITY_LOSS_PER_USE: 2,
      EFFICIENCY: 1.2,
    },
    SHOVEL: {
      DIG_ANIMATION_SPEED: 3.5,
      MAX_HIT_DISTANCE: 3,
      DIG_COOLDOWN: 300, // milliseconds
      MAX_DURABILITY: 60,
      DURABILITY_LOSS_PER_USE: 1,
      EFFICIENCY: 0.8,
    },
    DURABILITY_WARNING_THRESHOLD: 20, // Show warning when below 20%
    REPAIR_COST_MULTIPLIER: 0.5, // Cost to repair = 50% of original cost
  },

  // Terrain Configuration
  TERRAIN: {
    DEFAULT_PARAMS: {
      WIDTH: 100,
      DEPTH: 100,
      HEIGHT: 20,
      SCALE: 50,
      OCTAVES: 6,
      PERSISTENCE: 0.5,
      LACUNARITY: 2.0,
      HEIGHT_OFFSET: 0,
      WATER_LEVEL: 0.3,
    },
  },

  // Rendering Configuration
  RENDERING: {
    MAX_RENDER_DISTANCE: 150,
    DEFAULT_FOG_DENSITY: 1.0,
    BULLET_TRAIL_LIMIT: 10,
    BULLET_TRAIL_DISTANCE: 100,
  },

  // Audio Configuration
  AUDIO: {
    DEFAULT_MASTER_VOLUME: 0.8,
    DEFAULT_SFX_VOLUME: 1.0,
    FOOTSTEP_INTERVAL: 400, // milliseconds
    SOUND_POOL_SIZE: 3,
    
    // Spatial Audio Settings
    SPATIAL: {
      MAX_DISTANCE: 50, // Maximum hearing distance
      ROLLOFF_FACTOR: 1, // How quickly sound fades with distance
      REF_DISTANCE: 1, // Reference distance for volume calculation
      CONE_INNER_ANGLE: 360, // Inner cone angle in degrees
      CONE_OUTER_ANGLE: 0, // Outer cone angle in degrees
      CONE_OUTER_GAIN: 0, // Volume outside the outer cone
    },
    
    // Volume Categories
    CATEGORIES: {
      MASTER: { default: 0.8, key: 'audio_master_volume' },
      SFX: { default: 1.0, key: 'audio_sfx_volume' },
      MUSIC: { default: 0.7, key: 'audio_music_volume' },
      UI: { default: 0.8, key: 'audio_ui_volume' },
      AMBIENT: { default: 0.6, key: 'audio_ambient_volume' },
    },
    
    // Music System
    MUSIC: {
      FADE_DURATION: 2000, // milliseconds
      EXPLORATION_TRACKS: [
        'audio/music/exploration_1.mp3',
        'audio/music/exploration_2.mp3',
        'audio/music/ambient_forest.mp3',
      ],
      COMBAT_TRACKS: [
        'audio/music/combat_1.mp3',
        'audio/music/combat_2.mp3',
        'audio/music/action_intense.mp3',
      ],
      NIGHT_TRACKS: [
        'audio/music/night_ambient.mp3',
        'audio/music/peaceful_night.mp3',
      ],
      COMBAT_DETECTION_RADIUS: 20, // Distance to trigger combat music
      NIGHT_START_HOUR: 20, // 8 PM
      NIGHT_END_HOUR: 6, // 6 AM
    },
    
    // Sound Effects
    SFX: {
      FOOTSTEPS: {
        GRASS: ['audio/sfx/footstep_grass_1.mp3', 'audio/sfx/footstep_grass_2.mp3'],
        STONE: ['audio/sfx/footstep_stone_1.mp3', 'audio/sfx/footstep_stone_2.mp3'],
        WOOD: ['audio/sfx/footstep_wood_1.mp3', 'audio/sfx/footstep_wood_2.mp3'],
        WATER: ['audio/sfx/footstep_water_1.mp3', 'audio/sfx/footstep_water_2.mp3'],
      },
      WEAPONS: {
        RIFLE_FIRE: 'audio/sfx/rifle_fire.mp3',
        SHOTGUN_FIRE: 'audio/sfx/shotgun_fire.mp3',
        PISTOL_FIRE: 'audio/sfx/pistol_fire.mp3',
        RELOAD: 'audio/sfx/weapon_reload.mp3',
        SWITCH: 'audio/sfx/weapon_switch.mp3',
        EMPTY_CLICK: 'audio/sfx/weapon_empty.mp3',
      },
      TOOLS: {
        HATCHET_HIT: 'audio/sfx/hatchet_chop.mp3',
        PICKAXE_HIT: 'audio/sfx/pickaxe_mine.mp3',
        SHOVEL_DIG: 'audio/sfx/shovel_dig.mp3',
        TOOL_BREAK: 'audio/sfx/tool_break.mp3',
      },
      BUILDING: {
        PLACE: 'audio/sfx/building_place.mp3',
        REMOVE: 'audio/sfx/building_remove.mp3',
        INVALID: 'audio/sfx/building_invalid.mp3',
      },
      UI: {
        CLICK: 'audio/sfx/ui_click.mp3',
        HOVER: 'audio/sfx/ui_hover.mp3',
        EQUIP: 'audio/sfx/ui_equip.mp3',
        ALERT: 'audio/sfx/ui_alert.mp3',
        INVENTORY_MOVE: 'audio/sfx/inventory_move.mp3',
        NOTIFICATION: 'audio/sfx/notification.mp3',
      },
    },
    
    // Ambient Sounds
    AMBIENT: {
      WIND: 'audio/ambient/wind_loop.mp3',
      BIRDS: 'audio/ambient/birds_loop.mp3',
      RIVER: 'audio/ambient/river_loop.mp3',
      FOREST: 'audio/ambient/forest_loop.mp3',
      NIGHT_CRICKETS: 'audio/ambient/crickets_loop.mp3',
    },
    
    // Audio Pool Settings
    POOL: {
      MAX_INSTANCES: 10, // Maximum instances per sound
      CLEANUP_INTERVAL: 30000, // 30 seconds
      PRELOAD_PRIORITY: ['WEAPONS', 'UI', 'FOOTSTEPS'], // Categories to preload
    },
  },

  // UI Configuration
  UI: {
    INVENTORY_SIZE: 100, // 10x10 grid
    TOOLBAR_SIZE: 9,
    MAX_STACK_SIZE: 100,
    ESC_COOLDOWN: 500, // milliseconds
    TITLE_RETURN_COOLDOWN: 5000, // milliseconds
    POSITION_UPDATE_INTERVAL: 100, // milliseconds
  },

  // Building Configuration
  BUILDING: {
    GRID_SIZE: 1.0, // Snap to 1-unit grid
    MAX_PLACEMENT_DISTANCE: 10.0,
    GHOST_OPACITY: 0.5,
    VALID_COLOR: 0x00ff00, // Green for valid placement
    INVALID_COLOR: 0xff0000, // Red for invalid placement
    
    STORAGE_BOX: {
      WIDTH: 1.2,
      DEPTH: 0.8,
      HEIGHT: 0.5,
      COST: { wood: 10, stone: 5 },
      SNAP_TO_GRID: true,
    },
    WALL: {
      WIDTH: 2.0,
      HEIGHT: 3.0,
      DEPTH: 0.2,
      COST: { wood: 5, stone: 10 },
      SNAP_TO_GRID: true,
    },
    DOOR: {
      WIDTH: 1.0,
      HEIGHT: 2.5,
      DEPTH: 0.1,
      COST: { wood: 8, stone: 2 },
      SNAP_TO_GRID: true,
    },
    FOUNDATION: {
      WIDTH: 4.0,
      HEIGHT: 0.2,
      DEPTH: 4.0,
      COST: { wood: 20, stone: 30 },
      SNAP_TO_GRID: true,
    },
  },

  // Multiplayer Configuration
  MULTIPLAYER: {
    MAX_PLAYERS: 4,
    SYNC_INTERVAL: 50, // milliseconds
    HEARTBEAT_INTERVAL: 1000, // milliseconds
    CONNECTION_TIMEOUT: 5000, // milliseconds
    INTERPOLATION_BUFFER: 100, // milliseconds
  },

  // Game States
  GAME_STATES: {
    LOADING: 'loading',
    MODE_SELECTION: 'mode_selection', // New state for game mode selection
    TITLE: 'title',
    WAKE_UP: 'wake_up',
    PLAYING: 'playing',
    SETTINGS: 'settings',
    HOW_TO_PLAY: 'how_to_play',
  } as const,

  // Input Configuration
  INPUT: {
    MOUSE_SENSITIVITY_DEFAULT: 1.0,
    MOUSE_SENSITIVITY_MIN: 0.1,
    MOUSE_SENSITIVITY_MAX: 3.0,
    INVERT_Y_DEFAULT: false,
  },

  // Resource Configuration
  RESOURCES: {
    WOOD_PER_TREE: 50,
    STONE_PER_NODE: 25,
    TREE_RESPAWN_TIME: 300000, // 5 minutes in milliseconds
    STONE_RESPAWN_TIME: 600000, // 10 minutes in milliseconds
  },

  // Save/Load Configuration
  SAVE_SYSTEM: {
    AUTO_SAVE_INTERVAL: 60000, // 60 seconds
    MAX_SAVE_SLOTS: 5,
    COMPRESSION_ENABLED: true,
    DATABASE_NAME: 'WebGO_SaveData',
    DATABASE_VERSION: 1,
    STORES: {
      GAME_SAVES: 'game_saves',
      SETTINGS: 'settings',
      PLAYER_DATA: 'player_data',
    },
  },

  // Game Mode Configuration
  GAME_MODE: {
    SINGLE_PLAYER: 'single_player',
    MULTIPLAYER: 'multiplayer',
    DEFAULT_SERVER_URL: 'ws://localhost:8080',
  } as const,

  // Enemy AI Configuration
  ENEMY_AI: {
    SPAWN_THRESHOLD: 5, // Spawn AI if player count < 5
    SPAWN_RADIUS_MIN: 15, // Minimum spawn distance from players
    SPAWN_RADIUS_MAX: 25, // Maximum spawn distance from players
    MAX_ENEMIES_PER_PLAYER: 3, // Maximum enemies per player
    PATROL_RADIUS: 10, // How far enemies patrol from spawn point
    CHASE_RADIUS: 20, // How far enemies will chase players
    ATTACK_RANGE: 8, // Range at which enemies attack
    ATTACK_DAMAGE: 15, // Damage per enemy attack
    ATTACK_COOLDOWN: 2000, // Milliseconds between attacks
    HEALTH: 100, // Enemy health points
    MOVEMENT_SPEED: 2.0, // Enemy movement speed
    CHASE_SPEED: 3.5, // Enemy speed when chasing
    RESPAWN_DELAY: 30000, // 30 seconds before respawning
    LOOT_DROP_CHANCE: 0.7, // 70% chance to drop loot
    XP_REWARD: 25, // XP gained for killing enemy
  },

  // Enhanced Collision Configuration
  COLLISION: {
    PLAYER_RADIUS: 0.5,
    TREE_COLLISION_MULTIPLIER: 1.2, // Multiply tree radius for collision
    STONE_COLLISION_MULTIPLIER: 0.8, // Multiply stone radius for collision
    SLOPE_LIMIT: 0.7, // Maximum slope player can walk on (0-1)
    SLIDE_FRICTION: 0.3, // Friction when sliding on slopes
    BOUNCE_DAMPING: 0.5, // Velocity reduction on collision
    MAX_COLLISION_ITERATIONS: 5, // Maximum collision resolution iterations
    GROUND_TOLERANCE: 0.1, // Tolerance for ground detection
  },

  // Game Loop Configuration
  GAME_LOOP: {
    WAVE_DURATION: 300000, // 5 minutes per wave
    WAVE_BREAK_DURATION: 60000, // 1 minute break between waves
    DIFFICULTY_SCALING: 1.2, // Multiply enemy count/health per wave
    MAX_WAVES: 10, // Maximum number of waves
    SURVIVAL_XP_PER_SECOND: 1, // XP gained per second survived
    LEVEL_XP_REQUIREMENT: 100, // Base XP needed for level 2
    LEVEL_XP_MULTIPLIER: 1.5, // XP requirement multiplier per level
  },

  // Loot System Configuration
  LOOT: {
    ENEMY_DROPS: {
      AMMO: { chance: 0.6, min: 5, max: 15 },
      HEALTH_KIT: { chance: 0.3, min: 1, max: 2 },
      WOOD: { chance: 0.4, min: 2, max: 8 },
      STONE: { chance: 0.3, min: 1, max: 5 },
      SCRAP_METAL: { chance: 0.2, min: 1, max: 3 },
    },
    PICKUP_RADIUS: 2.0, // Auto-pickup radius for loot
    DESPAWN_TIME: 300000, // 5 minutes before loot despawns
  },

  // Performance Configuration
  PERFORMANCE: {
    FRAME_RATE_TARGET: 60,
    LOD_DISTANCES: {
      HIGH: 50,
      MEDIUM: 100,
      LOW: 150,
    },
    CHUNK_SIZE: 32,
    MAX_ENTITIES_PER_CHUNK: 50,
    ENEMY_UPDATE_INTERVAL: 100, // Update enemies every 100ms
    PHYSICS_UPDATE_INTERVAL: 16, // Physics updates every 16ms (60fps)
    CULLING_DISTANCE: 200, // Distance beyond which objects are culled
  },

  // Debug Configuration
  DEBUG: {
    SHOW_COLLISION_BOXES: false,
    SHOW_ENEMY_AI_PATHS: false,
    SHOW_PERFORMANCE_STATS: false,
    SHOW_ENTITY_COUNT: false,
    LOG_COLLISION_EVENTS: false,
    LOG_AI_DECISIONS: false,
  },
} as const

export type GameConfig = typeof GAME_CONFIG
export type GameState = typeof GAME_CONFIG.GAME_STATES[keyof typeof GAME_CONFIG.GAME_STATES] 