const WebSocket = require('ws');
const http = require('http');

// Configuration
const PORT = process.env.PORT || 8080;
const MAX_PLAYERS = 4;
const HEARTBEAT_INTERVAL = 30000; // 30 seconds

// Game state
const players = new Map();
const worldState = {
  placedItems: [],
  lastUpdate: Date.now(),
};

// Create HTTP server
const server = http.createServer();

// Create WebSocket server
const wss = new WebSocket.Server({ server });

// Message types (should match client-side enum)
const MessageType = {
  PLAYER_JOIN: 'PLAYER_JOIN',
  PLAYER_LEAVE: 'PLAYER_LEAVE',
  PLAYER_LIST: 'PLAYER_LIST',
  PLAYER_POSITION: 'PLAYER_POSITION',
  PLAYER_ROTATION: 'PLAYER_ROTATION',
  PLAYER_ANIMATION: 'PLAYER_ANIMATION',
  PLAYER_SHOOT: 'PLAYER_SHOOT',
  PLAYER_TOOL_USE: 'PLAYER_TOOL_USE',
  PLAYER_INTERACT: 'PLAYER_INTERACT',
  PLAYER_WEAPON_SWITCH: 'PLAYER_WEAPON_SWITCH',
  PLAYER_WEAPON_STATE: 'PLAYER_WEAPON_STATE',
  WORLD_UPDATE: 'WORLD_UPDATE',
  ITEM_PLACE: 'ITEM_PLACE',
  ITEM_REMOVE: 'ITEM_REMOVE',
  HEARTBEAT: 'HEARTBEAT',
  ERROR: 'ERROR',
};

// Utility functions
function broadcast(message, excludePlayerId = null) {
  const messageStr = JSON.stringify(message);
  
  for (const [playerId, playerData] of players) {
    if (playerId !== excludePlayerId && playerData.ws.readyState === WebSocket.OPEN) {
      playerData.ws.send(messageStr);
    }
  }
}

function sendToPlayer(playerId, message) {
  const player = players.get(playerId);
  if (player && player.ws.readyState === WebSocket.OPEN) {
    player.ws.send(JSON.stringify(message));
  }
}

function createErrorMessage(playerId, error) {
  return {
    type: MessageType.ERROR,
    playerId: 'server',
    timestamp: Date.now(),
    data: { error },
  };
}

function createPlayerListMessage() {
  const playerList = Array.from(players.values()).map(player => ({
    id: player.id,
    name: player.name,
    position: player.position,
    rotation: player.rotation,
    health: player.health,
    isGrounded: player.isGrounded,
    isCrouching: player.isCrouching,
    isSprinting: player.isSprinting,
    currentTool: player.currentTool,
    lastUpdate: player.lastUpdate,
  }));

  return {
    type: MessageType.PLAYER_LIST,
    playerId: 'server',
    timestamp: Date.now(),
    data: { players: playerList },
  };
}

// WebSocket connection handler
wss.on('connection', (ws, req) => {
  console.log('New WebSocket connection from:', req.socket.remoteAddress);
  
  let playerId = null;
  
  // Set up ping/pong for connection health
  ws.isAlive = true;
  ws.on('pong', () => {
    ws.isAlive = true;
  });

  ws.on('message', (data) => {
    try {
      const message = JSON.parse(data);
      handleMessage(ws, message);
    } catch (error) {
      console.error('Error parsing message:', error);
      ws.send(JSON.stringify(createErrorMessage(playerId, 'Invalid message format')));
    }
  });

  ws.on('close', () => {
    if (playerId) {
      console.log(`Player ${playerId} disconnected`);
      
      // Remove player from game
      players.delete(playerId);
      
      // Notify other players
      broadcast({
        type: MessageType.PLAYER_LEAVE,
        playerId: playerId,
        timestamp: Date.now(),
        data: {},
      });
      
      // Send updated player list
      broadcast(createPlayerListMessage());
    }
  });

  ws.on('error', (error) => {
    console.error('WebSocket error:', error);
  });

  function handleMessage(ws, message) {
    const { type, playerId: msgPlayerId, timestamp, data } = message;
    
    switch (type) {
      case MessageType.PLAYER_JOIN:
        handlePlayerJoin(ws, message);
        break;
        
      case MessageType.PLAYER_POSITION:
        handlePlayerPosition(message);
        break;
        
      case MessageType.PLAYER_ROTATION:
        handlePlayerRotation(message);
        break;
        
      case MessageType.PLAYER_SHOOT:
        handlePlayerShoot(message);
        break;
        
      case MessageType.PLAYER_TOOL_USE:
        handlePlayerToolUse(message);
        break;
        
      case MessageType.PLAYER_WEAPON_SWITCH:
        handlePlayerWeaponSwitch(message);
        break;
        
      case MessageType.PLAYER_WEAPON_STATE:
        handlePlayerWeaponState(message);
        break;
        
      case MessageType.HEARTBEAT:
        handleHeartbeat(message);
        break;
        
      default:
        console.warn('Unknown message type:', type);
    }
  }

  function handlePlayerJoin(ws, message) {
    const { playerId: msgPlayerId, data } = message;
    
    // Check if server is full
    if (players.size >= MAX_PLAYERS) {
      ws.send(JSON.stringify(createErrorMessage(msgPlayerId, 'Server is full')));
      ws.close();
      return;
    }
    
    // Check if player ID already exists
    if (players.has(msgPlayerId)) {
      ws.send(JSON.stringify(createErrorMessage(msgPlayerId, 'Player ID already exists')));
      ws.close();
      return;
    }
    
    playerId = msgPlayerId;
    
    // Create player data
    const playerData = {
      id: playerId,
      name: data.name,
      position: data.position,
      rotation: data.rotation,
      health: 100,
      isGrounded: true,
      isCrouching: false,
      isSprinting: false,
      currentTool: null,
      currentWeapon: null,
      weaponState: null,
      lastUpdate: Date.now(),
      ws: ws,
    };
    
    players.set(playerId, playerData);
    
    console.log(`Player ${playerId} (${data.name}) joined. Total players: ${players.size}`);
    
    // Send current player list to new player
    ws.send(JSON.stringify(createPlayerListMessage()));
    
    // Notify other players about new player
    broadcast({
      type: MessageType.PLAYER_JOIN,
      playerId: playerId,
      timestamp: Date.now(),
      data: {
        name: data.name,
        position: data.position,
        rotation: data.rotation,
      },
    }, playerId);
    
    // Send updated player list to all players
    broadcast(createPlayerListMessage());
  }

  function handlePlayerPosition(message) {
    const { playerId: msgPlayerId, data } = message;
    const player = players.get(msgPlayerId);
    
    if (player) {
      player.position = data.position;
      player.lastUpdate = Date.now();
      
      // Broadcast position update to other players
      broadcast({
        type: MessageType.PLAYER_POSITION,
        playerId: msgPlayerId,
        timestamp: Date.now(),
        data: { position: data.position },
      }, msgPlayerId);
    }
  }

  function handlePlayerRotation(message) {
    const { playerId: msgPlayerId, data } = message;
    const player = players.get(msgPlayerId);
    
    if (player) {
      player.rotation = data.rotation;
      player.lastUpdate = Date.now();
      
      // Broadcast rotation update to other players
      broadcast({
        type: MessageType.PLAYER_ROTATION,
        playerId: msgPlayerId,
        timestamp: Date.now(),
        data: { rotation: data.rotation },
      }, msgPlayerId);
    }
  }

  function handlePlayerShoot(message) {
    const { playerId: msgPlayerId, data } = message;
    
    // Broadcast shoot event to other players
    broadcast({
      type: MessageType.PLAYER_SHOOT,
      playerId: msgPlayerId,
      timestamp: Date.now(),
      data: data,
    }, msgPlayerId);
  }

  function handlePlayerToolUse(message) {
    const { playerId: msgPlayerId, data } = message;
    
    // Broadcast tool use event to other players
    broadcast({
      type: MessageType.PLAYER_TOOL_USE,
      playerId: msgPlayerId,
      timestamp: Date.now(),
      data: data,
    }, msgPlayerId);
  }

  function handlePlayerWeaponSwitch(message) {
    const { playerId: msgPlayerId, data } = message;
    const player = players.get(msgPlayerId);
    
    if (player) {
      player.currentWeapon = data.weaponId;
      player.lastUpdate = Date.now();
    }
    
    // Broadcast weapon switch to other players
    broadcast({
      type: MessageType.PLAYER_WEAPON_SWITCH,
      playerId: msgPlayerId,
      timestamp: Date.now(),
      data: data,
    }, msgPlayerId);
  }

  function handlePlayerWeaponState(message) {
    const { playerId: msgPlayerId, data } = message;
    const player = players.get(msgPlayerId);
    
    if (player) {
      player.weaponState = data;
      player.lastUpdate = Date.now();
    }
    
    // Broadcast weapon state to other players
    broadcast({
      type: MessageType.PLAYER_WEAPON_STATE,
      playerId: msgPlayerId,
      timestamp: Date.now(),
      data: data,
    }, msgPlayerId);
  }

  function handleHeartbeat(message) {
    const { playerId: msgPlayerId } = message;
    const player = players.get(msgPlayerId);
    
    if (player) {
      player.lastUpdate = Date.now();
    }
  }
});

// Periodic cleanup of inactive players
setInterval(() => {
  const now = Date.now();
  const timeout = 60000; // 1 minute timeout
  
  for (const [playerId, player] of players) {
    if (now - player.lastUpdate > timeout) {
      console.log(`Removing inactive player: ${playerId}`);
      
      // Close connection
      if (player.ws.readyState === WebSocket.OPEN) {
        player.ws.close();
      }
      
      // Remove from players map
      players.delete(playerId);
      
      // Notify other players
      broadcast({
        type: MessageType.PLAYER_LEAVE,
        playerId: playerId,
        timestamp: Date.now(),
        data: {},
      });
    }
  }
}, 30000); // Check every 30 seconds

// Ping all connections periodically
setInterval(() => {
  wss.clients.forEach((ws) => {
    if (ws.isAlive === false) {
      return ws.terminate();
    }
    
    ws.isAlive = false;
    ws.ping();
  });
}, HEARTBEAT_INTERVAL);

// Start server
server.listen(PORT, () => {
  console.log(`WebGO Multiplayer Server running on port ${PORT}`);
  console.log(`Max players: ${MAX_PLAYERS}`);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('Shutting down server...');
  
  // Notify all players
  broadcast({
    type: MessageType.ERROR,
    playerId: 'server',
    timestamp: Date.now(),
    data: { error: 'Server shutting down' },
  });
  
  // Close all connections
  wss.clients.forEach((ws) => {
    ws.close();
  });
  
  server.close(() => {
    console.log('Server shut down');
    process.exit(0);
  });
});

module.exports = { server, wss }; 