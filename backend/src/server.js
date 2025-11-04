/**
 * Servidor Autoritativo Agario con Supabase Realtime
 * Maneja salas de juego, validación de mensajes y game loop a 10Hz
 */

import express from 'express';
import { createClient } from '@supabase/supabase-js';
import Ajv from 'ajv';
import { config } from 'dotenv';
import { createGame } from './game/index.js';
import { initSupabase, saveMatchResult, LogHelpers } from './persistence.js';

// Cargar variables de entorno
config();

const app = express();
const PORT = process.env.PORT || 3000;

// Configuración
const CONFIG = {
  ticksPerSecond: parseInt(process.env.TICKS_PER_SECOND) || 10,
  maxMsgsPerSecond: parseInt(process.env.MAX_MSGS_PER_SECOND) || 20,
  maxPayloadSize: parseInt(process.env.MAX_PAYLOAD_SIZE) || 8192,
  pingInterval: parseInt(process.env.PING_INTERVAL_MS) || 30000,
  pongTimeout: parseInt(process.env.PONG_TIMEOUT_MS) || 60000,
  ghostTimeout: parseInt(process.env.GHOST_TIMEOUT_MS) || 120000,
  worldBounds: { width: 2000, height: 2000 }
};

// Validación de esquemas con AJV
const ajv = new Ajv();

const playerActionSchema = {
  type: 'object',
  properties: {
    type: { type: 'string', enum: ['input', 'ability', 'split', 'orb_collect'] },
    playerId: { type: 'string', minLength: 1, maxLength: 100 },
    ts: { type: 'number' },
    data: { type: 'object' }
  },
  required: ['type', 'playerId', 'ts'],
  additionalProperties: false
};

const validatePlayerAction = ajv.compile(playerActionSchema);

// Inicializar Supabase
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseAnonKey || !supabaseServiceKey) {
  console.error('❌ Missing required Supabase environment variables');
  process.exit(1);
}

// Cliente para suscripciones (usando anon key)
const supabaseClient = createClient(supabaseUrl, supabaseAnonKey, {
  realtime: {
    params: {
      eventsPerSecond: 100 // Aumentar límite de eventos
    }
  }
});

// Inicializar persistencia (usando service role key)
initSupabase(supabaseUrl, supabaseServiceKey);

// Estado del servidor
const serverState = {
  rooms: new Map(), // Map<roomId, roomData>
  rateLimits: new Map(), // Map<playerId, rateLimitData>
  startTime: Date.now(),
  totalConnections: 0,
  activeConnections: 0
};

// Estructura de datos para sala
function createRoomData(roomId) {
  return {
    roomId,
    game: null,
    channel: null,
    players: new Set(),
    createdAt: Date.now(),
    lastActivity: Date.now(),
    isActive: false
  };
}

// Rate limiting por jugador
function checkRateLimit(playerId) {
  const now = Date.now();
  const windowMs = 1000; // Ventana de 1 segundo
  
  if (!serverState.rateLimits.has(playerId)) {
    serverState.rateLimits.set(playerId, {
      messages: [],
      blockedUntil: 0
    });
  }
  
  const playerLimits = serverState.rateLimits.get(playerId);
  
  // Si está bloqueado, verificar si ya pasó el tiempo
  if (playerLimits.blockedUntil > now) {
    return false; // Aún bloqueado
  }
  
  // Limpiar mensajes antiguos de la ventana
  playerLimits.messages = playerLimits.messages.filter(ts => now - ts < windowMs);
  
  // Verificar si excede el límite
  if (playerLimits.messages.length >= CONFIG.maxMsgsPerSecond) {
    // Bloquear por 3 segundos
    playerLimits.blockedUntil = now + 3000;
    
    // Log del evento de rate limiting
    LogHelpers.rateLimitEvent(playerId, null, {
      messagesInWindow: playerLimits.messages.length,
      windowMs,
      blockedFor: 3000
    });
    
    return false;
  }
  
  // Agregar timestamp del mensaje actual
  playerLimits.messages.push(now);
  return true;
}

// Middleware de Express
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true }));

// Middleware de logging
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} ${req.method} ${req.path}`);
  next();
});

// Rutas HTTP

/**
 * Health check endpoint
 */
app.get('/health', (req, res) => {
  const uptime = Date.now() - serverState.startTime;
  const activeRooms = Array.from(serverState.rooms.values()).filter(room => room.isActive).length;
  
  res.json({
    ok: true,
    uptime: Math.floor(uptime / 1000), // en segundos
    rooms: activeRooms,
    totalRooms: serverState.rooms.size,
    activeConnections: serverState.activeConnections,
    totalConnections: serverState.totalConnections,
    config: {
      ticksPerSecond: CONFIG.ticksPerSecond,
      maxMsgsPerSecond: CONFIG.maxMsgsPerSecond
    },
    timestamp: new Date().toISOString()
  });
});

/**
 * Iniciar o unirse a una sala
 */
app.post('/rooms/:roomId/start', async (req, res) => {
  const { roomId } = req.params;
  
  if (!roomId || typeof roomId !== 'string' || roomId.length > 50) {
    return res.status(400).json({ error: 'Invalid room ID' });
  }
  
  try {
    const room = await ensureRoom(roomId);
    
    res.json({
      success: true,
      roomId: room.roomId,
      isActive: room.isActive,
      playerCount: room.players.size,
      gameStats: room.game ? room.game.getGameStats() : null
    });
    
  } catch (error) {
    console.error(`Error starting room ${roomId}:`, error);
    res.status(500).json({ error: 'Failed to start room' });
  }
});

/**
 * Persistir resultado de partida manualmente
 */
app.post('/persist-match', async (req, res) => {
  try {
    const matchData = req.body;
    
    // Validar estructura básica
    if (!matchData.roomId || !matchData.duration || !Array.isArray(matchData.players)) {
      return res.status(400).json({ error: 'Invalid match data structure' });
    }
    
    const result = await saveMatchResult(matchData);
    
    if (result) {
      res.json({ success: true, matchId: result.id });
    } else {
      res.status(500).json({ error: 'Failed to save match result' });
    }
    
  } catch (error) {
    console.error('Error persisting match:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * Obtener estadísticas de sala
 */
app.get('/rooms/:roomId/stats', (req, res) => {
  const { roomId } = req.params;
  const room = serverState.rooms.get(roomId);
  
  if (!room) {
    return res.status(404).json({ error: 'Room not found' });
  }
  
  res.json({
    roomId: room.roomId,
    isActive: room.isActive,
    playerCount: room.players.size,
    createdAt: room.createdAt,
    lastActivity: room.lastActivity,
    gameStats: room.game ? room.game.getGameStats() : null
  });
});

/**
 * Crear o recuperar una sala de juego
 * @param {string} roomId - ID de la sala
 * @returns {Object} Datos de la sala
 */
async function ensureRoom(roomId) {
  if (serverState.rooms.has(roomId)) {
    const room = serverState.rooms.get(roomId);
    room.lastActivity = Date.now();
    return room;
  }
  
  console.log(`Creating new room: ${roomId}`);
  
  // Crear nueva sala
  const room = createRoomData(roomId);
  
  // Crear instancia del juego
  room.game = createGame({
    roomId,
    tickHz: CONFIG.ticksPerSecond,
    worldBounds: CONFIG.worldBounds
  });
  
  // Suscribirse al canal de Supabase Realtime
  room.channel = supabaseClient.channel(`game:${roomId}`, {
    config: {
      broadcast: { ack: false, self: false }
    }
  });
  
  // Configurar listeners del canal
  setupChannelListeners(room);
  
  // Suscribirse al canal
  const channelResponse = await room.channel.subscribe((status) => {
    console.log(`Room ${roomId} channel status:`, status);
    
    if (status === 'SUBSCRIBED') {
      room.isActive = true;
      
      // Iniciar game loop
      room.game.startLoop((deltaPayload) => {
        publishWorldUpdate(room, deltaPayload);
      });
      
      console.log(`✅ Room ${roomId} is now active`);
    } else if (status === 'CHANNEL_ERROR') {
      console.error(`❌ Channel error for room ${roomId}`);
      room.isActive = false;
    }
  });
  
  if (channelResponse === 'error') {
    throw new Error(`Failed to subscribe to channel for room ${roomId}`);
  }
  
  serverState.rooms.set(roomId, room);
  return room;
}

/**
 * Configura listeners para eventos del canal
 * @param {Object} room - Datos de la sala
 */
function setupChannelListeners(room) {
  // Listener para acciones de jugadores
  room.channel.on('broadcast', { event: 'player_action' }, (payload) => {
    handlePlayerAction(room, payload);
  });
  
  // Listener para conexiones/desconexiones
  room.channel.on('presence', { event: 'sync' }, () => {
    const state = room.channel.presenceState();
    const connectedPlayers = Object.keys(state);
    
    // Actualizar lista de jugadores activos
    room.players.clear();
    connectedPlayers.forEach(playerId => room.players.add(playerId));
    
    room.lastActivity = Date.now();
    console.log(`Room ${room.roomId} presence sync: ${connectedPlayers.length} players`);
  });
  
  room.channel.on('presence', { event: 'join' }, ({ key: playerId }) => {
    room.players.add(playerId);
    room.lastActivity = Date.now();
    
    // Agregar jugador al juego
    room.game.addPlayer(playerId);
    
    console.log(`Player ${playerId} joined room ${room.roomId}`);
    LogHelpers.playerSpawn(playerId, room.roomId, { x: 0, y: 0 }, 100, generateSessionId());
  });
  
  room.channel.on('presence', { event: 'leave' }, ({ key: playerId }) => {
    room.players.delete(playerId);
    room.lastActivity = Date.now();
    
    console.log(`Player ${playerId} left room ${room.roomId}`);
    LogHelpers.playerDisconnect(playerId, room.roomId, { x: 0, y: 0 }, 0, 'left_channel', null);
  });
}

/**
 * Maneja acción de jugador recibida del canal
 * @param {Object} room - Datos de la sala
 * @param {Object} payload - Payload del evento
 */
function handlePlayerAction(room, payload) {
  try {
    const action = payload.payload;
    
    // Validar tamaño del payload
    const payloadSize = JSON.stringify(action).length;
    if (payloadSize > CONFIG.maxPayloadSize) {
      console.warn(`Payload too large: ${payloadSize} bytes from player ${action?.playerId}`);
      
      LogHelpers.invalidPayloadEvent(
        action?.playerId, 
        room.roomId, 
        action, 
        `Payload size ${payloadSize} exceeds limit ${CONFIG.maxPayloadSize}`
      );
      return;
    }
    
    // Validar estructura del mensaje
    if (!validatePlayerAction(action)) {
      console.warn('Invalid player action structure:', validatePlayerAction.errors);
      
      LogHelpers.invalidPayloadEvent(
        action?.playerId,
        room.roomId,
        action,
        `Schema validation failed: ${JSON.stringify(validatePlayerAction.errors)}`
      );
      return;
    }
    
    // Verificar rate limiting
    if (!checkRateLimit(action.playerId)) {
      // Enviar mensaje de throttle al jugador
      room.channel.send({
        type: 'broadcast',
        event: 'system',
        payload: {
          type: 'throttle',
          msg: 'Too many messages, please slow down',
          playerId: action.playerId
        }
      });
      return;
    }
    
    // TODO: Validar autenticación del jugador
    // En una implementación completa, verificar que el playerId 
    // coincida con el usuario autenticado que envió el mensaje
    
    // Encolar acción para procesamiento en el próximo tick
    const success = room.game.enqueueAction(action);
    
    if (!success) {
      console.warn(`Failed to enqueue action from player ${action.playerId}`);
    }
    
    room.lastActivity = Date.now();
    
  } catch (error) {
    console.error('Error handling player action:', error);
    
    LogHelpers.invalidPayloadEvent(
      payload?.payload?.playerId,
      room.roomId,
      payload,
      `Processing error: ${error.message}`
    );
  }
}

/**
 * Publica actualización del mundo a todos los clientes
 * @param {Object} room - Datos de la sala
 * @param {Object} deltaPayload - Delta generado por el juego
 */
function publishWorldUpdate(room, deltaPayload) {
  try {
    // Publicar delta en cada tick
    room.channel.send({
      type: 'broadcast',
      event: 'world_update',
      payload: deltaPayload
    });
    
    // Publicar snapshot cada 5 segundos (50 ticks a 10Hz)
    if (deltaPayload.tick % 50 === 0) {
      const snapshotPayload = {
        ...deltaPayload,
        kind: 'snapshot'
      };
      
      room.channel.send({
        type: 'broadcast',
        event: 'world_update', 
        payload: snapshotPayload
      });
    }
    
  } catch (error) {
    console.error(`Error publishing world update for room ${room.roomId}:`, error);
  }
}

/**
 * Genera ID de sesión único
 * @returns {string} Session ID
 */
function generateSessionId() {
  return `sess_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Limpia salas inactivas periódicamente
 */
function cleanupInactiveRooms() {
  const now = Date.now();
  const inactivityThreshold = 300000; // 5 minutos
  
  for (const [roomId, room] of serverState.rooms) {
    if (now - room.lastActivity > inactivityThreshold) {
      console.log(`Cleaning up inactive room: ${roomId}`);
      
      // Detener game loop
      if (room.game) {
        room.game.stopLoop();
      }
      
      // Unsubscribe del canal
      if (room.channel) {
        room.channel.unsubscribe();
      }
      
      serverState.rooms.delete(roomId);
    }
  }
}

// Limpiar salas inactivas cada 2 minutos
setInterval(cleanupInactiveRooms, 120000);

// Manejo de cierre graceful
process.on('SIGINT', async () => {
  console.log('🛑 Shutting down server...');
  
  // Detener todos los game loops
  for (const room of serverState.rooms.values()) {
    if (room.game) {
      room.game.stopLoop();
    }
    if (room.channel) {
      await room.channel.unsubscribe();
    }
  }
  
  console.log('✅ Server shutdown complete');
  process.exit(0);
});

// Iniciar servidor
app.listen(PORT, () => {
  console.log('🚀 Agario Game Server started');
  console.log(`📡 Server listening on port ${PORT}`);
  console.log(`🎮 Game loop running at ${CONFIG.ticksPerSecond}Hz`);
  console.log(`⚡ Rate limit: ${CONFIG.maxMsgsPerSecond} msgs/s per player`);
  console.log(`📦 Max payload size: ${CONFIG.maxPayloadSize} bytes`);
  console.log('');
  console.log(`Health check: http://localhost:${PORT}/health`);
  console.log('Ready to accept connections! 🎯');
});