// Sistema de Split/Merge para Agario Roles
import type { Entity, Vector2D } from './PhysicsEngine';
import { PhysicsEngine } from './PhysicsEngine';

export interface SplitConfig {
    minMassToSplit: number;
    splitRatio: number; // Porcentaje de masa que va a la nueva célula
    splitForce: number; // Fuerza inicial de separación
    splitCooldown: number; // Cooldown en ms
    maxSplitParts: number; // Máximo número de partes que puede tener un jugador
    mergeTime: number; // Tiempo antes de que las partes puedan fusionarse (ms)
}

export interface PlayerSplit {
    id: string;
    parentId: string;
    createdAt: number;
    canMerge: boolean;
}

export class SplitMergeSystem {
    private physicsEngine: PhysicsEngine;
    private config: SplitConfig;
    private playerSplits: Map<string, PlayerSplit[]> = new Map();
    private lastSplitTime: Map<string, number> = new Map();

    constructor(physicsEngine: PhysicsEngine, config: Partial<SplitConfig> = {}) {
        this.physicsEngine = physicsEngine;
        this.config = {
            minMassToSplit: 35,
            splitRatio: 0.5, // Nueva célula toma 50% de la masa
            splitForce: 300,
            splitCooldown: 1000, // 1 segundo
            maxSplitParts: 16,
            mergeTime: 30000, // 30 segundos antes de poder fusionarse
            ...config
        };
    }

    // Verificar si un jugador puede hacer split
    canPlayerSplit(playerId: string): boolean {
        const player = this.physicsEngine.getEntity(playerId);
        if (!player) return false;

        // Verificar masa mínima
        if (player.mass < this.config.minMassToSplit) return false;

        // Verificar cooldown
        const lastSplit = this.lastSplitTime.get(playerId) || 0;
        if (Date.now() - lastSplit < this.config.splitCooldown) return false;

        // Verificar número máximo de partes
        const splits = this.playerSplits.get(playerId) || [];
        if (splits.length >= this.config.maxSplitParts - 1) return false; // -1 porque el original cuenta

        return true;
    }

    // Realizar split del jugador
    performSplit(playerId: string, direction?: Vector2D): boolean {
        if (!this.canPlayerSplit(playerId)) return false;

        const player = this.physicsEngine.getEntity(playerId);
        if (!player) return false;

        // Calcular dirección del split
        let splitDirection = direction || { x: 0, y: -1 }; // Por defecto hacia arriba
        
        // Normalizar dirección
        const magnitude = Math.sqrt(splitDirection.x ** 2 + splitDirection.y ** 2);
        if (magnitude > 0) {
            splitDirection.x /= magnitude;
            splitDirection.y /= magnitude;
        }

        // Calcular masas después del split
        const newCellMass = player.mass * this.config.splitRatio;
        const remainingMass = player.mass - newCellMass;

        // Actualizar masa del jugador original
        this.physicsEngine.updateEntityMass(playerId, remainingMass);

        // Crear nueva célula
        const newCellId = `${playerId}_split_${Date.now()}`;
        const newCellPosition = {
            x: player.position.x + splitDirection.x * (player.radius + 10),
            y: player.position.y + splitDirection.y * (player.radius + 10)
        };

        const newCell = this.physicsEngine.createEntity(
            newCellId,
            player.type,
            newCellMass,
            newCellPosition
        );

        // Aplicar fuerza de separación
        this.physicsEngine.applyMovement(newCellId, {
            x: splitDirection.x * this.config.splitForce,
            y: splitDirection.y * this.config.splitForce
        });

        // Aplicar fuerza opuesta al jugador original
        this.physicsEngine.applyMovement(playerId, {
            x: -splitDirection.x * (this.config.splitForce * 0.3),
            y: -splitDirection.y * (this.config.splitForce * 0.3)
        });

        // Registrar split
        const playerSplits = this.playerSplits.get(playerId) || [];
        playerSplits.push({
            id: newCellId,
            parentId: playerId,
            createdAt: Date.now(),
            canMerge: false
        });
        this.playerSplits.set(playerId, playerSplits);

        // Actualizar tiempo del último split
        this.lastSplitTime.set(playerId, Date.now());

        console.log(`🔥 Split realizado: ${playerId} → ${newCellId}`, {
            originalMass: remainingMass.toFixed(1),
            newCellMass: newCellMass.toFixed(1)
        });

        return true;
    }

    // Actualizar sistema de merge (llamar en game loop)
    update(): void {
        const currentTime = Date.now();

        // Actualizar estado de merge para todas las splits
        for (const [playerId, splits] of this.playerSplits.entries()) {
            for (const split of splits) {
                // Habilitar merge después del tiempo especificado
                if (!split.canMerge && currentTime - split.createdAt > this.config.mergeTime) {
                    split.canMerge = true;
                }
                
                // Intentar merge si está disponible
                if (split.canMerge) {
                    this.attemptMerge(playerId, split.id);
                }
            }
        }
    }

    // Intentar fusionar dos células del mismo jugador
    private attemptMerge(parentId: string, splitId: string): void {
        const parent = this.physicsEngine.getEntity(parentId);
        const split = this.physicsEngine.getEntity(splitId);

        if (!parent || !split) {
            // Limpiar split que ya no existe
            this.removePlayerSplit(parentId, splitId);
            return;
        }

        // Verificar si están lo suficientemente cerca para fusionarse
        const distance = Math.sqrt(
            (parent.position.x - split.position.x) ** 2 +
            (parent.position.y - split.position.y) ** 2
        );

        const mergeDistance = (parent.radius + split.radius) * 0.8; // 80% de la suma de radios

        if (distance < mergeDistance) {
            this.mergeCells(parentId, splitId);
        }
    }

    // Fusionar dos células
    private mergeCells(parentId: string, splitId: string): void {
        const parent = this.physicsEngine.getEntity(parentId);
        const split = this.physicsEngine.getEntity(splitId);

        if (!parent || !split) return;

        // Calcular nueva masa total
        const totalMass = parent.mass + split.mass;

        // Calcular nueva posición (promedio ponderado por masa)
        const newPosition = {
            x: (parent.position.x * parent.mass + split.position.x * split.mass) / totalMass,
            y: (parent.position.y * parent.mass + split.position.y * split.mass) / totalMass
        };

        // Actualizar célula padre
        this.physicsEngine.updateEntityMass(parentId, totalMass);
        parent.position.x = newPosition.x;
        parent.position.y = newPosition.y;

        // Eliminar célula split
        this.physicsEngine.removeEntity(splitId);

        // Limpiar de la lista de splits
        this.removePlayerSplit(parentId, splitId);

        console.log(`🔗 Merge realizado: ${splitId} → ${parentId}`, {
            newMass: totalMass.toFixed(1)
        });
    }

    // Eliminar split de la lista de un jugador
    private removePlayerSplit(playerId: string, splitId: string): void {
        const splits = this.playerSplits.get(playerId) || [];
        const index = splits.findIndex(s => s.id === splitId);
        if (index >= 0) {
            splits.splice(index, 1);
            this.playerSplits.set(playerId, splits);
        }
    }

    // Obtener todas las células de un jugador
    getPlayerCells(playerId: string): Entity[] {
        const cells: Entity[] = [];
        
        // Célula principal
        const mainCell = this.physicsEngine.getEntity(playerId);
        if (mainCell) {
            cells.push(mainCell);
        }

        // Células split
        const splits = this.playerSplits.get(playerId) || [];
        for (const split of splits) {
            const splitCell = this.physicsEngine.getEntity(split.id);
            if (splitCell) {
                cells.push(splitCell);
            }
        }

        return cells;
    }

    // Obtener información de splits para debug
    getPlayerSplitInfo(playerId: string): any {
        const splits = this.playerSplits.get(playerId) || [];
        const lastSplit = this.lastSplitTime.get(playerId) || 0;
        const cooldownRemaining = Math.max(0, this.config.splitCooldown - (Date.now() - lastSplit));

        return {
            splitCount: splits.length,
            canSplit: this.canPlayerSplit(playerId),
            cooldownRemaining: cooldownRemaining,
            splits: splits.map(s => ({
                id: s.id,
                canMerge: s.canMerge,
                timeUntilMerge: Math.max(0, this.config.mergeTime - (Date.now() - s.createdAt))
            }))
        };
    }

    // Manejar input de split para todas las células del jugador
    handleSplitInput(playerId: string, direction?: Vector2D): void {
        const cells = this.getPlayerCells(playerId);
        
        for (const cell of cells) {
            if (this.canPlayerSplit(cell.id)) {
                this.performSplit(cell.id, direction);
            }
        }
    }

    // Aplicar movimiento a todas las células del jugador
    applyMovementToAllCells(playerId: string, direction: Vector2D): void {
        const cells = this.getPlayerCells(playerId);
        
        for (const cell of cells) {
            this.physicsEngine.applyMovement(cell.id, direction);
        }
    }

    // Limpiar sistema (para testing)
    clear(): void {
        this.playerSplits.clear();
        this.lastSplitTime.clear();
    }

    // Getter para configuración
    getConfig(): SplitConfig {
        return { ...this.config };
    }
}