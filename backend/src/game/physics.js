/**
 * Módulo de física para el motor de juego Agario
 * Implementa las fórmulas específicas de la Fase 2
 */

/**
 * Calcula el radio a partir de la masa
 * Fórmula: r = √(m/π)
 * @param {number} mass - Masa de la entidad
 * @returns {number} Radio correspondiente
 */
export function radiusFromMass(mass) {
  if (mass <= 0) return 0;
  return Math.sqrt(mass / Math.PI);
}

/**
 * Calcula la masa a partir del radio
 * Fórmula: m = πr²
 * @param {number} radius - Radio de la entidad
 * @returns {number} Masa correspondiente
 */
export function massFromRadius(radius) {
  if (radius <= 0) return 0;
  return Math.PI * radius * radius;
}

/**
 * Calcula la velocidad máxima basada en la masa
 * Fórmula: v_max = clamp(220 / m^(1/4), 18, 220)
 * @param {number} mass - Masa de la entidad
 * @returns {number} Velocidad máxima
 */
export function vMaxFromMass(mass) {
  if (mass <= 0) return 220; // velocidad máxima para masa 0
  
  const baseSpeed = 220 / Math.pow(mass, 0.25);
  return Math.max(18, Math.min(220, baseSpeed));
}

/**
 * Aplica amortiguamiento de velocidad
 * @param {number} velocity - Velocidad actual
 * @param {number} dampingFactor - Factor de amortiguamiento (default: 0.98)
 * @returns {number} Velocidad con amortiguamiento aplicado
 */
export function applyDamping(velocity, dampingFactor = 0.98) {
  return velocity * dampingFactor;
}

/**
 * Verifica colisión entre dos círculos
 * @param {Object} entity1 - Primera entidad {x, y, radius}
 * @param {Object} entity2 - Segunda entidad {x, y, radius}
 * @returns {boolean} True si hay colisión
 */
export function checkCollision(entity1, entity2) {
  const dx = entity2.x - entity1.x;
  const dy = entity2.y - entity1.y;
  const distance = Math.sqrt(dx * dx + dy * dy);
  const minDistance = entity1.radius + entity2.radius;
  
  return distance < minDistance;
}

/**
 * Calcula la distancia entre dos puntos
 * @param {Object} pos1 - Posición 1 {x, y}
 * @param {Object} pos2 - Posición 2 {x, y}
 * @returns {number} Distancia euclidiana
 */
export function distance(pos1, pos2) {
  const dx = pos2.x - pos1.x;
  const dy = pos2.y - pos1.y;
  return Math.sqrt(dx * dx + dy * dy);
}

/**
 * Normaliza un vector
 * @param {Object} vector - Vector {x, y}
 * @returns {Object} Vector normalizado
 */
export function normalize(vector) {
  const magnitude = Math.sqrt(vector.x * vector.x + vector.y * vector.y);
  if (magnitude === 0) return { x: 0, y: 0 };
  
  return {
    x: vector.x / magnitude,
    y: vector.y / magnitude
  };
}

/**
 * Limita un vector a una magnitud máxima
 * @param {Object} vector - Vector {x, y}
 * @param {number} maxMagnitude - Magnitud máxima
 * @returns {Object} Vector limitado
 */
export function limitVector(vector, maxMagnitude) {
  const magnitude = Math.sqrt(vector.x * vector.x + vector.y * vector.y);
  if (magnitude <= maxMagnitude) return vector;
  
  const scale = maxMagnitude / magnitude;
  return {
    x: vector.x * scale,
    y: vector.y * scale
  };
}

/**
 * Mantiene una posición dentro de los límites del mundo
 * @param {Object} position - Posición {x, y}
 * @param {number} radius - Radio de la entidad
 * @param {Object} worldBounds - Límites {width, height}
 * @returns {Object} Posición ajustada
 */
export function clampToWorld(position, radius, worldBounds) {
  return {
    x: Math.max(radius, Math.min(worldBounds.width - radius, position.x)),
    y: Math.max(radius, Math.min(worldBounds.height - radius, position.y))
  };
}

/**
 * Integra velocidad en posición usando Euler
 * @param {Object} entity - Entidad con {x, y, vx, vy}
 * @param {number} deltaTime - Tiempo en segundos
 * @returns {Object} Nueva posición
 */
export function integratePosition(entity, deltaTime) {
  return {
    x: entity.x + entity.vx * deltaTime,
    y: entity.y + entity.vy * deltaTime
  };
}

/**
 * Calcula si una entidad puede comer a otra
 * Regla: el comedor debe ser al menos 10% más grande
 * @param {Object} predator - Entidad cazadora
 * @param {Object} prey - Entidad presa
 * @returns {boolean} True si puede comer
 */
export function canEat(predator, prey) {
  return predator.mass > prey.mass * 1.1;
}

/**
 * Calcula la nueva masa después de comer
 * @param {number} predatorMass - Masa del cazador
 * @param {number} preyMass - Masa de la presa
 * @param {number} efficiency - Eficiencia de absorción (default: 1.0)
 * @returns {number} Nueva masa del cazador
 */
export function calculateNewMass(predatorMass, preyMass, efficiency = 1.0) {
  return predatorMass + (preyMass * efficiency);
}

/**
 * Genera posición aleatoria válida en el mundo
 * @param {Object} worldBounds - Límites {width, height}
 * @param {number} radius - Radio de la entidad
 * @param {Array} avoidAreas - Áreas a evitar (opcional)
 * @returns {Object} Posición {x, y}
 */
export function generateRandomPosition(worldBounds, radius, avoidAreas = []) {
  let attempts = 0;
  const maxAttempts = 50;
  
  while (attempts < maxAttempts) {
    const x = radius + Math.random() * (worldBounds.width - 2 * radius);
    const y = radius + Math.random() * (worldBounds.height - 2 * radius);
    
    // Verificar si está muy cerca de áreas a evitar
    let valid = true;
    for (const area of avoidAreas) {
      if (distance({ x, y }, area) < area.radius + radius + 50) {
        valid = false;
        break;
      }
    }
    
    if (valid) {
      return { x, y };
    }
    
    attempts++;
  }
  
  // Si no se encuentra posición válida, usar posición aleatoria simple
  return {
    x: radius + Math.random() * (worldBounds.width - 2 * radius),
    y: radius + Math.random() * (worldBounds.height - 2 * radius)
  };
}

/**
 * Constantes físicas del juego
 */
export const PHYSICS_CONSTANTS = {
  DEFAULT_DAMPING: 0.98,
  MIN_SPEED: 18,
  MAX_SPEED: 220,
  EAT_RATIO: 1.1, // El cazador debe ser 10% más grande
  PELLET_MASS: 1,
  INITIAL_PLAYER_MASS: 100,
  WORLD_FRICTION: 0.02
};

/**
 * Validaciones de physics para seguridad del servidor
 */
export const PhysicsValidator = {
  /**
   * Valida que un movimiento es físicamente posible
   * @param {Object} entity - Entidad actual
   * @param {Object} newPosition - Nueva posición propuesta
   * @param {number} deltaTime - Tiempo transcurrido
   * @returns {boolean} True si el movimiento es válido
   */
  isValidMovement(entity, newPosition, deltaTime) {
    const maxSpeed = vMaxFromMass(entity.mass);
    const maxDistance = maxSpeed * deltaTime;
    const actualDistance = distance(entity, newPosition);
    
    // Permitir un 10% de margen por latencia/interpolación
    return actualDistance <= maxDistance * 1.1;
  },

  /**
   * Valida que un cambio de masa es razonable
   * @param {number} oldMass - Masa anterior
   * @param {number} newMass - Nueva masa propuesta
   * @param {number} deltaTime - Tiempo transcurrido
   * @returns {boolean} True si el cambio es válido
   */
  isValidMassChange(oldMass, newMass, deltaTime) {
    // La masa no puede cambiar drásticamente sin una razón
    const maxChangeRate = 100; // unidades de masa por segundo
    const maxChange = maxChangeRate * deltaTime;
    const actualChange = Math.abs(newMass - oldMass);
    
    return actualChange <= maxChange;
  },

  /**
   * Valida que una entidad está dentro de límites razonables
   * @param {Object} entity - Entidad a validar
   * @param {Object} worldBounds - Límites del mundo
   * @returns {boolean} True si está dentro de límites
   */
  isWithinBounds(entity, worldBounds) {
    return entity.x >= 0 && entity.x <= worldBounds.width &&
           entity.y >= 0 && entity.y <= worldBounds.height &&
           entity.mass > 0 && entity.mass < 10000; // límite de masa razonable
  }
};