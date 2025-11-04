/**
 * Motor de juego mínimo para Agario Server
 * Implementa game loop autoritativo a 10Hz con sistema de encolado de acciones
 */

import { v4 as uuidv4 } from 'uuid';
import * as Physics from './physics.js';

/**
 * Crea una nueva instancia de juego
 * @param {Object} config - Configuración del juego
 * @param {string} config.roomId - ID de la sala
 * @param {number} config.tickHz - Frecuencia del game loop (default: 10)
 * @param {Object} config.worldBounds - Dimensiones del mundo
 * @returns {Object} Instancia del juego con API pública
 */
export function createGame(config = {}) {
  const {
    roomId = 'default',
    tickHz = 10,
    worldBounds = { width: 2000, height: 2000 }
  } = config;

  // Estado interno del juego
  const gameState = {
    roomId,
    tickHz,
    tickInterval: 1000 / tickHz, // ms por tick
    worldBounds,
    entities: new Map(), // Map<id, entity>
    actionQueue: [], // Cola de acciones pendientes
    isRunning: false,
    currentTick: 0,
    lastTickTime: 0,
    deltaTime: 1 / tickHz, // Tiempo fijo por tick
    
    // Estadísticas del juego
    stats: {
      totalPlayers: 0,
      activePlayers: 0,
      pelletsCount: 0,
      actionsProcessed: 0,
      lastStepDuration: 0
    }
  };

  let gameLoopInterval = null;
  let onUpdateCallback = null;

  /**
   * Encola una acción de jugador para procesamiento en el próximo tick
   * @param {Object} action - Acción del jugador
   */
  function enqueueAction(action) {
    // Validar estructura básica de la acción
    if (!action || !action.type || !action.playerId) {
      console.warn('Invalid action format:', action);
      return false;
    }

    // Agregar timestamp del servidor
    action.serverTimestamp = Date.now();
    action.targetTick = gameState.currentTick + 1;

    gameState.actionQueue.push(action);
    return true;
  }

  /**
   * Procesa todas las acciones encoladas
   */
  function processActionQueue() {
    const startTime = performance.now();
    let processedCount = 0;

    while (gameState.actionQueue.length > 0) {
      const action = gameState.actionQueue.shift();
      processAction(action);
      processedCount++;
      
      // Limitar tiempo de procesamiento para mantener frame rate
      if (performance.now() - startTime > 50) { // máximo 50ms
        console.warn(`Action queue processing took too long, ${gameState.actionQueue.length} actions remaining`);
        break;
      }
    }

    gameState.stats.actionsProcessed += processedCount;
  }

  /**
   * Procesa una acción individual
   * @param {Object} action - Acción a procesar
   */
  function processAction(action) {
    const entity = gameState.entities.get(action.playerId);
    
    if (!entity) {
      // Si el jugador no existe, crear uno nuevo (spawn automático)
      if (action.type === 'input' || action.type === 'spawn') {
        addPlayer(action.playerId);
        return;
      }
      console.warn(`Action for unknown player: ${action.playerId}`);
      return;
    }

    switch (action.type) {
      case 'input':
        processInputAction(entity, action.data);
        break;
      case 'ability':
        processAbilityAction(entity, action.data);
        break;
      case 'split':
        processSplitAction(entity, action.data);
        break;
      case 'orb_collect':
        processOrbCollectAction(entity, action.data);
        break;
      default:
        console.warn(`Unknown action type: ${action.type}`);
    }
  }

  /**
   * Procesa acción de input de movimiento
   * @param {Object} entity - Entidad del jugador
   * @param {Object} inputData - Datos del input
   */
  function processInputAction(entity, inputData) {
    if (!inputData || !inputData.dir) return;

    const { x, y } = inputData.dir;
    
    // Normalizar dirección
    const direction = Physics.normalize({ x, y });
    const maxSpeed = Physics.vMaxFromMass(entity.mass);
    
    // Aplicar velocidad basada en dirección y masa
    entity.vx = direction.x * maxSpeed;
    entity.vy = direction.y * maxSpeed;
    
    entity.lastInputTime = Date.now();
  }

  /**
   * Procesa acción de habilidad
   * @param {Object} entity - Entidad del jugador  
   * @param {Object} abilityData - Datos de la habilidad
   */
  function processAbilityAction(entity, abilityData) {
    // Stub para habilidades - implementar según roles específicos
    console.log(`Player ${entity.id} used ability:`, abilityData);
  }

  /**
   * Procesa acción de split
   * @param {Object} entity - Entidad del jugador
   * @param {Object} splitData - Datos del split
   */
  function processSplitAction(entity, splitData) {
    if (entity.mass < 50) return; // Masa mínima para split
    
    // Split básico: dividir masa en dos entidades
    const newMass = entity.mass / 2;
    entity.mass = newMass;
    entity.radius = Physics.radiusFromMass(newMass);
    
    // Crear fragmento que se mueve hacia adelante
    const fragment = createEntity({
      type: 'fragment',
      ownerId: entity.id,
      x: entity.x + entity.radius * 2,
      y: entity.y,
      mass: newMass,
      vx: entity.vx * 1.5,
      vy: entity.vy * 1.5,
      lifetime: 30000 // 30 segundos antes de merge automático
    });
    
    gameState.entities.set(fragment.id, fragment);
  }

  /**
   * Procesa recolección de orbes/pellets
   * @param {Object} entity - Entidad del jugador
   * @param {Object} orbData - Datos del orbe
   */
  function processOrbCollectAction(entity, orbData) {
    // Stub - en implementación real verificaría colisiones
    console.log(`Player ${entity.id} collected orb:`, orbData);
  }

  /**
   * Ejecuta un paso de simulación del juego
   */
  function step() {
    const stepStartTime = performance.now();
    
    // Procesar acciones encoladas
    processActionQueue();
    
    // Integrar física para todas las entidades
    integratePhysics();
    
    // Procesar colisiones
    processCollisions();
    
    // Limpiar entidades muertas
    cleanupDeadEntities();
    
    // Actualizar estadísticas
    updateStats();
    
    // Generar delta para enviar a clientes
    const delta = generateDelta();
    
    // Llamar callback de actualización si existe
    if (onUpdateCallback) {
      onUpdateCallback(delta);
    }
    
    gameState.currentTick++;
    gameState.stats.lastStepDuration = performance.now() - stepStartTime;
  }

  /**
   * Integra física para todas las entidades
   */
  function integratePhysics() {
    for (const [id, entity] of gameState.entities) {
      if (entity.type === 'pellet') continue; // Los pellets no se mueven
      
      // Integrar posición
      const newPos = Physics.integratePosition(entity, gameState.deltaTime);
      entity.x = newPos.x;
      entity.y = newPos.y;
      
      // Aplicar amortiguamiento
      entity.vx = Physics.applyDamping(entity.vx);
      entity.vy = Physics.applyDamping(entity.vy);
      
      // Mantener dentro de límites del mundo
      const clampedPos = Physics.clampToWorld(entity, entity.radius, gameState.worldBounds);
      entity.x = clampedPos.x;
      entity.y = clampedPos.y;
      
      // Si toca borde, reducir velocidad
      if (clampedPos.x !== entity.x || clampedPos.y !== entity.y) {
        entity.vx *= 0.5;
        entity.vy *= 0.5;
      }
    }
  }

  /**
   * Procesa colisiones entre entidades
   */
  function processCollisions() {
    const entities = Array.from(gameState.entities.values());
    
    for (let i = 0; i < entities.length; i++) {
      for (let j = i + 1; j < entities.length; j++) {
        const entityA = entities[i];
        const entityB = entities[j];
        
        if (Physics.checkCollision(entityA, entityB)) {
          handleCollision(entityA, entityB);
        }
      }
    }
  }

  /**
   * Maneja una colisión entre dos entidades
   * @param {Object} entityA - Primera entidad
   * @param {Object} entityB - Segunda entidad
   */
  function handleCollision(entityA, entityB) {
    // Determinar quién come a quién
    let predator, prey;
    
    if (Physics.canEat(entityA, entityB)) {
      predator = entityA;
      prey = entityB;
    } else if (Physics.canEat(entityB, entityA)) {
      predator = entityB;
      prey = entityA;
    } else {
      return; // No hay colisión de consumo
    }
    
    // Transferir masa
    const newMass = Physics.calculateNewMass(predator.mass, prey.mass);
    predator.mass = newMass;
    predator.radius = Physics.radiusFromMass(newMass);
    
    // Marcar presa como muerta
    prey.isAlive = false;
    prey.killedBy = predator.id;
    prey.deathTime = Date.now();
  }

  /**
   * Limpia entidades muertas del juego
   */
  function cleanupDeadEntities() {
    for (const [id, entity] of gameState.entities) {
      let shouldRemove = false;
      
      if (!entity.isAlive) {
        shouldRemove = true;
      }
      
      // Limpiar fragmentos expirados
      if (entity.type === 'fragment' && entity.lifetime) {
        if (Date.now() - entity.createdAt > entity.lifetime) {
          shouldRemove = true;
        }
      }
      
      // Limpiar jugadores inactivos (sin input por 2 minutos)
      if (entity.type === 'player' && entity.lastInputTime) {
        if (Date.now() - entity.lastInputTime > 120000) {
          shouldRemove = true;
        }
      }
      
      if (shouldRemove) {
        gameState.entities.delete(id);
      }
    }
  }

  /**
   * Actualiza estadísticas del juego
   */
  function updateStats() {
    let playerCount = 0;
    let pelletCount = 0;
    
    for (const entity of gameState.entities.values()) {
      if (entity.type === 'player') playerCount++;
      if (entity.type === 'pellet') pelletCount++;
    }
    
    gameState.stats.activePlayers = playerCount;
    gameState.stats.pelletsCount = pelletCount;
  }

  /**
   * Genera delta para sincronización con clientes
   * @returns {Object} Delta con cambios desde último tick
   */
  function generateDelta() {
    const entities = [];
    
    for (const entity of gameState.entities.values()) {
      entities.push({
        id: entity.id,
        pos: { x: Math.round(entity.x), y: Math.round(entity.y) },
        vel: { x: Math.round(entity.vx), y: Math.round(entity.vy) },
        mass: Math.round(entity.mass),
        radius: Math.round(entity.radius),
        type: entity.type,
        role: entity.role || 'basic',
        isAlive: entity.isAlive
      });
    }
    
    return {
      kind: 'delta',
      tick: gameState.currentTick,
      entities,
      serverTs: Date.now(),
      stats: { ...gameState.stats }
    };
  }

  /**
   * Crea una nueva entidad en el juego
   * @param {Object} config - Configuración de la entidad
   * @returns {Object} Entidad creada
   */
  function createEntity(config) {
    const entity = {
      id: config.id || uuidv4(),
      type: config.type || 'player',
      x: config.x || 0,
      y: config.y || 0,
      vx: config.vx || 0,
      vy: config.vy || 0,
      mass: config.mass || Physics.PHYSICS_CONSTANTS.INITIAL_PLAYER_MASS,
      radius: 0,
      isAlive: true,
      createdAt: Date.now(),
      lastInputTime: Date.now(),
      ...config
    };
    
    entity.radius = Physics.radiusFromMass(entity.mass);
    return entity;
  }

  /**
   * Añade un nuevo jugador al juego
   * @param {string} playerId - ID del jugador
   * @param {Object} config - Configuración adicional
   * @returns {Object} Entidad del jugador creada
   */
  function addPlayer(playerId, config = {}) {
    if (gameState.entities.has(playerId)) {
      return gameState.entities.get(playerId);
    }
    
    const spawnPosition = Physics.generateRandomPosition(
      gameState.worldBounds, 
      25, // radio inicial aproximado
      Array.from(gameState.entities.values()) // evitar spawns encima de otros
    );
    
    const player = createEntity({
      id: playerId,
      type: 'player',
      x: spawnPosition.x,
      y: spawnPosition.y,
      mass: Physics.PHYSICS_CONSTANTS.INITIAL_PLAYER_MASS,
      role: config.role || 'basic',
      color: config.color || `#${Math.floor(Math.random()*16777215).toString(16)}`,
      name: config.name || `Player_${playerId.slice(0, 8)}`
    });
    
    gameState.entities.set(playerId, player);
    gameState.stats.totalPlayers++;
    
    console.log(`Player ${playerId} spawned at (${player.x}, ${player.y})`);
    return player;
  }

  /**
   * Inicia el game loop
   * @param {Function} updateCallback - Función llamada en cada tick
   */
  function startLoop(updateCallback) {
    if (gameState.isRunning) {
      console.warn('Game loop already running');
      return;
    }
    
    onUpdateCallback = updateCallback;
    gameState.isRunning = true;
    gameState.lastTickTime = Date.now();
    
    gameLoopInterval = setInterval(() => {
      step();
    }, gameState.tickInterval);
    
    console.log(`Game loop started for room ${roomId} at ${tickHz}Hz`);
  }

  /**
   * Detiene el game loop
   */
  function stopLoop() {
    if (!gameState.isRunning) {
      return;
    }
    
    gameState.isRunning = false;
    
    if (gameLoopInterval) {
      clearInterval(gameLoopInterval);
      gameLoopInterval = null;
    }
    
    console.log(`Game loop stopped for room ${roomId}`);
  }

  /**
   * Obtiene el estado actual de las entidades
   * @returns {Map} Mapa de entidades
   */
  function getEntities() {
    return new Map(gameState.entities);
  }

  /**
   * Obtiene estadísticas del juego
   * @returns {Object} Estadísticas actuales
   */
  function getGameStats() {
    return {
      ...gameState.stats,
      roomId: gameState.roomId,
      currentTick: gameState.currentTick,
      isRunning: gameState.isRunning,
      entitiesCount: gameState.entities.size,
      queueLength: gameState.actionQueue.length
    };
  }

  // API pública del juego
  return {
    enqueueAction,
    startLoop,
    stopLoop,
    addPlayer,
    getEntities,
    getGameStats,
    
    // Propiedades de solo lectura
    get roomId() { return gameState.roomId; },
    get isRunning() { return gameState.isRunning; },
    get currentTick() { return gameState.currentTick; }
  };
}