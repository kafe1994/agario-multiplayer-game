/**
 * Módulo de persistencia para Agario Game Server
 * Maneja todas las operaciones de base de datos usando Supabase
 */

import { createClient } from '@supabase/supabase-js';

let supabaseClient = null;

/**
 * Inicializa el cliente de Supabase con service role key
 * @param {string} supabaseUrl - URL del proyecto Supabase
 * @param {string} serviceRoleKey - Service role key para acceso completo
 */
export function initSupabase(supabaseUrl, serviceRoleKey) {
  supabaseClient = createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  });
  
  console.log('Supabase client initialized with service role');
}

/**
 * Guarda el resultado de una partida en la base de datos
 * @param {Object} matchData - Datos del match
 * @param {string} matchData.roomId - ID de la sala
 * @param {number} matchData.duration - Duración en segundos
 * @param {Array} matchData.players - Array de jugadores finales
 * @param {string} matchData.winnerId - ID del ganador (opcional)
 * @param {Object} matchData.metadata - Metadatos adicionales
 * @returns {Promise<Object>} Resultado de la inserción
 */
export async function saveMatchResult(matchData) {
  if (!supabaseClient) {
    throw new Error('Supabase client not initialized');
  }

  try {
    const matchRecord = {
      room_id: matchData.roomId,
      match_duration: matchData.duration,
      players: matchData.players,
      winner_id: matchData.winnerId || null,
      metadata: {
        server_version: '1.0.0',
        total_players: matchData.players.length,
        final_leaderboard: matchData.players
          .sort((a, b) => b.mass - a.mass)
          .slice(0, 10)
          .map(p => ({ id: p.id, mass: p.mass, score: p.score })),
        ...matchData.metadata
      }
    };

    const { data, error } = await supabaseClient
      .from('match_results')
      .insert([matchRecord])
      .select();

    if (error) {
      console.error('Error saving match result:', error);
      throw error;
    }

    console.log(`Match result saved for room ${matchData.roomId}, duration: ${matchData.duration}s`);
    return data[0];
    
  } catch (error) {
    console.error('Failed to save match result:', error);
    // No lanzar el error para evitar bloquear el game loop
    return null;
  }
}

/**
 * Registra una estadística de jugador
 * @param {Object} statData - Datos de la estadística
 * @param {string} statData.playerId - ID del jugador
 * @param {string} statData.roomId - ID de la sala
 * @param {string} statData.eventType - Tipo de evento
 * @param {Object} statData.eventData - Datos del evento
 * @param {number} statData.mass - Masa al momento del evento
 * @param {Object} statData.position - Posición {x, y}
 * @param {string} statData.sessionId - ID de la sesión
 * @returns {Promise<Object>} Resultado de la inserción
 */
export async function logPlayerStat(statData) {
  if (!supabaseClient) {
    console.warn('Supabase client not initialized, skipping stat log');
    return null;
  }

  try {
    const statRecord = {
      player_id: statData.playerId,
      room_id: statData.roomId,
      event_type: statData.eventType,
      event_data: statData.eventData || {},
      mass_at_event: statData.mass || 0,
      position_x: statData.position?.x || 0,
      position_y: statData.position?.y || 0,
      session_id: statData.sessionId || null
    };

    const { data, error } = await supabaseClient
      .from('player_stats')
      .insert([statRecord])
      .select();

    if (error) {
      console.error('Error logging player stat:', error);
      return null;
    }

    return data[0];
    
  } catch (error) {
    console.error('Failed to log player stat:', error);
    // Fire-and-forget: no bloquear el juego por errores de logging
    return null;
  }
}

/**
 * Registra un evento de seguridad
 * @param {Object} securityEvent - Datos del evento
 * @param {string} securityEvent.eventType - Tipo de evento de seguridad
 * @param {string} securityEvent.playerId - ID del jugador (opcional)
 * @param {string} securityEvent.roomId - ID de la sala (opcional)
 * @param {Object} securityEvent.details - Detalles del evento
 * @param {string} securityEvent.severity - Severidad del evento
 * @param {string} securityEvent.ipAddress - IP del cliente (opcional)
 * @param {string} securityEvent.userAgent - User agent (opcional)
 * @returns {Promise<Object>} Resultado de la inserción
 */
export async function logSecurityEvent(securityEvent) {
  if (!supabaseClient) {
    console.warn('Supabase client not initialized, skipping security log');
    return null;
  }

  try {
    const eventRecord = {
      event_type: securityEvent.eventType,
      player_id: securityEvent.playerId || null,
      room_id: securityEvent.roomId || null,
      details: securityEvent.details,
      severity: securityEvent.severity || 'medium',
      ip_address: securityEvent.ipAddress || null,
      user_agent: securityEvent.userAgent || null
    };

    const { data, error } = await supabaseClient
      .from('security_events')
      .insert([eventRecord])
      .select();

    if (error) {
      console.error('Error logging security event:', error);
      return null;
    }

    console.log(`Security event logged: ${securityEvent.eventType} - ${securityEvent.severity}`);
    return data[0];
    
  } catch (error) {
    console.error('Failed to log security event:', error);
    return null;
  }
}

/**
 * Obtiene estadísticas recientes de un jugador
 * @param {string} playerId - ID del jugador
 * @param {number} limitHours - Límite de horas hacia atrás (default: 24)
 * @returns {Promise<Array>} Array de estadísticas
 */
export async function getPlayerRecentStats(playerId, limitHours = 24) {
  if (!supabaseClient) {
    return [];
  }

  try {
    const { data, error } = await supabaseClient
      .from('player_stats')
      .select('*')
      .eq('player_id', playerId)
      .gte('created_at', new Date(Date.now() - limitHours * 60 * 60 * 1000).toISOString())
      .order('created_at', { ascending: false })
      .limit(100);

    if (error) {
      console.error('Error fetching player stats:', error);
      return [];
    }

    return data || [];
    
  } catch (error) {
    console.error('Failed to fetch player stats:', error);
    return [];
  }
}

/**
 * Obtiene eventos de seguridad recientes
 * @param {number} limitHours - Límite de horas hacia atrás (default: 1)
 * @param {string} severity - Filtrar por severidad (opcional)
 * @returns {Promise<Array>} Array de eventos de seguridad
 */
export async function getRecentSecurityEvents(limitHours = 1, severity = null) {
  if (!supabaseClient) {
    return [];
  }

  try {
    let query = supabaseClient
      .from('security_events')
      .select('*')
      .gte('created_at', new Date(Date.now() - limitHours * 60 * 60 * 1000).toISOString())
      .order('created_at', { ascending: false });

    if (severity) {
      query = query.eq('severity', severity);
    }

    const { data, error } = await query.limit(50);

    if (error) {
      console.error('Error fetching security events:', error);
      return [];
    }

    return data || [];
    
  } catch (error) {
    console.error('Failed to fetch security events:', error);
    return [];
  }
}

/**
 * Obtiene el ranking de mejores jugadores
 * @param {number} limit - Número de jugadores a retornar (default: 10)
 * @param {number} hoursBack - Horas hacia atrás para considerar (default: 24)
 * @returns {Promise<Array>} Array de jugadores con sus mejores scores
 */
export async function getTopPlayers(limit = 10, hoursBack = 24) {
  if (!supabaseClient) {
    return [];
  }

  try {
    // Query compleja para obtener la mejor masa de cada jugador
    const { data, error } = await supabaseClient
      .rpc('get_top_players', { 
        time_limit: hoursBack, 
        player_limit: limit 
      });

    if (error) {
      console.error('Error fetching top players:', error);
      // Fallback: obtener datos directamente de player_stats
      return await getTopPlayersFallback(limit, hoursBack);
    }

    return data || [];
    
  } catch (error) {
    console.error('Failed to fetch top players:', error);
    return [];
  }
}

/**
 * Fallback para obtener top players sin stored procedure
 */
async function getTopPlayersFallback(limit, hoursBack) {
  try {
    const { data, error } = await supabaseClient
      .from('player_stats')
      .select('player_id, mass_at_event, created_at')
      .gte('created_at', new Date(Date.now() - hoursBack * 60 * 60 * 1000).toISOString())
      .order('mass_at_event', { ascending: false })
      .limit(limit * 5); // Obtener más datos para procesar localmente

    if (error) {
      return [];
    }

    // Procesar localmente para obtener la mejor masa por jugador
    const playerBestMass = {};
    data.forEach(stat => {
      if (!playerBestMass[stat.player_id] || 
          stat.mass_at_event > playerBestMass[stat.player_id].mass) {
        playerBestMass[stat.player_id] = {
          player_id: stat.player_id,
          mass: stat.mass_at_event,
          timestamp: stat.created_at
        };
      }
    });

    return Object.values(playerBestMass)
      .sort((a, b) => b.mass - a.mass)
      .slice(0, limit);
      
  } catch (error) {
    console.error('Fallback top players query failed:', error);
    return [];
  }
}

/**
 * Verifica la salud de la conexión a la base de datos
 * @returns {Promise<boolean>} True si la conexión es exitosa
 */
export async function checkDatabaseHealth() {
  if (!supabaseClient) {
    return false;
  }

  try {
    const { data, error } = await supabaseClient
      .from('match_results')
      .select('id')
      .limit(1);

    return !error;
    
  } catch (error) {
    console.error('Database health check failed:', error);
    return false;
  }
}

/**
 * Helper para crear logs estructurados
 */
export const LogHelpers = {
  /**
   * Crea un log de spawn de jugador
   */
  playerSpawn(playerId, roomId, position, mass, sessionId) {
    return logPlayerStat({
      playerId,
      roomId,
      eventType: 'spawn',
      eventData: { spawn_time: Date.now() },
      mass,
      position,
      sessionId
    });
  },

  /**
   * Crea un log de muerte de jugador
   */
  playerDeath(playerId, roomId, position, mass, killerId, sessionId) {
    return logPlayerStat({
      playerId,
      roomId,
      eventType: 'death',
      eventData: { 
        killer_id: killerId, 
        death_time: Date.now() 
      },
      mass,
      position,
      sessionId
    });
  },

  /**
   * Crea un log de desconexión
   */
  playerDisconnect(playerId, roomId, position, mass, reason, sessionId) {
    return logPlayerStat({
      playerId,
      roomId,
      eventType: 'disconnect',
      eventData: { 
        reason, 
        disconnect_time: Date.now() 
      },
      mass,
      position,
      sessionId
    });
  },

  /**
   * Crea un log de evento de seguridad por rate limiting
   */
  rateLimitEvent(playerId, roomId, details) {
    return logSecurityEvent({
      eventType: 'rate_limit',
      playerId,
      roomId,
      details,
      severity: 'medium'
    });
  },

  /**
   * Crea un log de payload inválido
   */
  invalidPayloadEvent(playerId, roomId, payload, reason) {
    return logSecurityEvent({
      eventType: 'invalid_payload',
      playerId,
      roomId,
      details: { 
        payload_sample: JSON.stringify(payload).slice(0, 200),
        reason 
      },
      severity: 'medium'
    });
  }
};