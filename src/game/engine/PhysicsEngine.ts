// Motor de física para Agario Roles
// Implementa fórmulas específicas de radius/mass y velocidad

import { SpatialHashGrid } from './SpatialHashGrid';

export interface Vector2D {
    x: number;
    y: number;
}

export interface Entity {
    id: string;
    position: Vector2D;
    velocity: Vector2D;
    mass: number;
    radius: number;
    type: 'player' | 'pellet' | 'bot';
}

export class PhysicsEngine {
    private entities: Map<string, Entity> = new Map();
    private lastUpdate: number = 0;
    private readonly targetFPS: number = 60;
    private readonly deltaTime: number = 1000 / this.targetFPS; // ms
    private spatialGrid: SpatialHashGrid;

    constructor() {
        this.lastUpdate = performance.now();
        this.spatialGrid = new SpatialHashGrid(150); // Celdas de 150x150
    }

    // Fórmulas fundamentales radius/mass
    static calculateRadius(mass: number): number {
        // r = √(m/π) para área = πr² = m
        return Math.sqrt(mass / Math.PI);
    }

    static calculateMass(radius: number): number {
        // m = πr²
        return Math.PI * radius * radius;
    }

    // Fórmula de velocidad específica del juego
    static calculateMaxVelocity(mass: number): number {
        // v_max = clamp(220 / m^(1/4), 18, 220)
        const baseVelocity = 220 / Math.pow(mass, 1/4);
        return Math.max(18, Math.min(220, baseVelocity));
    }

    // Crear entidad con mass y calcular radius automáticamente
    createEntity(id: string, type: Entity['type'], mass: number, position: Vector2D): Entity {
        const entity: Entity = {
            id,
            type,
            mass,
            radius: PhysicsEngine.calculateRadius(mass),
            position: { ...position },
            velocity: { x: 0, y: 0 }
        };

        this.entities.set(id, entity);
        this.spatialGrid.insert(entity);
        return entity;
    }

    // Actualizar masa de entidad y recalcular radius
    updateEntityMass(entityId: string, newMass: number): void {
        const entity = this.entities.get(entityId);
        if (entity) {
            entity.mass = newMass;
            entity.radius = PhysicsEngine.calculateRadius(newMass);
            this.spatialGrid.update(entity); // Actualizar en spatial grid
        }
    }

    // Aplicar movimiento con límite de velocidad
    applyMovement(entityId: string, direction: Vector2D): void {
        const entity = this.entities.get(entityId);
        if (!entity) return;

        // Calcular velocidad máxima para esta masa
        const maxVelocity = PhysicsEngine.calculateMaxVelocity(entity.mass);
        
        // Normalizar dirección y aplicar velocidad máxima
        const magnitude = Math.sqrt(direction.x * direction.x + direction.y * direction.y);
        if (magnitude > 0) {
            entity.velocity.x = (direction.x / magnitude) * maxVelocity;
            entity.velocity.y = (direction.y / magnitude) * maxVelocity;
        } else {
            entity.velocity.x = 0;
            entity.velocity.y = 0;
        }
    }

    // Detectar colisión entre dos entidades
    checkCollision(entity1: Entity, entity2: Entity): boolean {
        const dx = entity1.position.x - entity2.position.x;
        const dy = entity1.position.y - entity2.position.y;
        const distance = Math.sqrt(dx * dx + dy * dy);
        
        return distance < (entity1.radius + entity2.radius);
    }

    // Procesar colisión entre jugador y pellet (comer)
    processEatingCollision(predatorId: string, preyId: string): boolean {
        const predator = this.entities.get(predatorId);
        const prey = this.entities.get(preyId);
        
        if (!predator || !prey) return false;
        
        // Solo puede comer si el predator es más grande
        if (predator.radius <= prey.radius) return false;
        
        if (this.checkCollision(predator, prey)) {
            // Transferir masa del prey al predator
            const newMass = predator.mass + prey.mass;
            this.updateEntityMass(predatorId, newMass);
            
            // Eliminar el prey
            this.entities.delete(preyId);
            
            return true;
        }
        
        return false;
    }

    // Actualizar todas las posiciones basadas en velocidad
    updatePositions(deltaTime: number): void {
        for (const entity of this.entities.values()) {
            // Actualizar posición basada en velocidad
            entity.position.x += entity.velocity.x * (deltaTime / 1000);
            entity.position.y += entity.velocity.y * (deltaTime / 1000);
            
            // Aplicar fricción gradual
            entity.velocity.x *= 0.95;
            entity.velocity.y *= 0.95;
            
            // Actualizar en spatial grid
            this.spatialGrid.update(entity);
        }
    }

    // Step principal del motor de física
    update(): void {
        const currentTime = performance.now();
        const deltaTime = currentTime - this.lastUpdate;
        
        // Limitar delta time para evitar grandes saltos
        const clampedDelta = Math.min(deltaTime, this.deltaTime * 2);
        
        this.updatePositions(clampedDelta);
        
        this.lastUpdate = currentTime;
    }

    // Obtener entidad por ID
    getEntity(id: string): Entity | undefined {
        return this.entities.get(id);
    }

    // Obtener todas las entidades
    getAllEntities(): Entity[] {
        return Array.from(this.entities.values());
    }

    // Obtener entidades por tipo
    getEntitiesByType(type: Entity['type']): Entity[] {
        return Array.from(this.entities.values()).filter(e => e.type === type);
    }

    // Eliminar entidad
    removeEntity(id: string): void {
        this.spatialGrid.remove(id);
        this.entities.delete(id);
    }

    // Limpiar todas las entidades
    clear(): void {
        this.spatialGrid.clear();
        this.entities.clear();
    }

    // Obtener spatial grid (para debug)
    getSpatialGrid(): SpatialHashGrid {
        return this.spatialGrid;
    }

    // Debug: obtener información de una entidad
    getEntityDebugInfo(id: string): any {
        const entity = this.entities.get(id);
        if (!entity) return null;
        
        return {
            id: entity.id,
            type: entity.type,
            mass: entity.mass.toFixed(2),
            radius: entity.radius.toFixed(2),
            maxVelocity: PhysicsEngine.calculateMaxVelocity(entity.mass).toFixed(2),
            currentVelocity: Math.sqrt(entity.velocity.x ** 2 + entity.velocity.y ** 2).toFixed(2),
            position: {
                x: entity.position.x.toFixed(1),
                y: entity.position.y.toFixed(1)
            }
        };
    }
}