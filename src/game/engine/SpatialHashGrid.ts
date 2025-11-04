// Sistema de Spatial Hash para optimización de colisiones
import type { Entity, Vector2D } from './PhysicsEngine';

export interface SpatialCell {
    x: number;
    y: number;
    entities: Set<string>;
}

export class SpatialHashGrid {
    private cellSize: number;
    private grid: Map<string, SpatialCell> = new Map();
    private entityCells: Map<string, string[]> = new Map(); // entidad -> celdas que ocupa

    constructor(cellSize: number = 100) {
        this.cellSize = cellSize;
    }

    // Obtener key de celda
    private getCellKey(x: number, y: number): string {
        return `${Math.floor(x / this.cellSize)},${Math.floor(y / this.cellSize)}`;
    }

    // Obtener coordenadas de celda
    private getCellCoords(x: number, y: number): { cellX: number; cellY: number } {
        return {
            cellX: Math.floor(x / this.cellSize),
            cellY: Math.floor(y / this.cellSize)
        };
    }

    // Obtener todas las celdas que ocupa una entidad
    private getEntityCells(entity: Entity): string[] {
        const cells: string[] = [];
        const minX = entity.position.x - entity.radius;
        const maxX = entity.position.x + entity.radius;
        const minY = entity.position.y - entity.radius;
        const maxY = entity.position.y + entity.radius;

        const startCellX = Math.floor(minX / this.cellSize);
        const endCellX = Math.floor(maxX / this.cellSize);
        const startCellY = Math.floor(minY / this.cellSize);
        const endCellY = Math.floor(maxY / this.cellSize);

        for (let x = startCellX; x <= endCellX; x++) {
            for (let y = startCellY; y <= endCellY; y++) {
                cells.push(`${x},${y}`);
            }
        }

        return cells;
    }

    // Insertar entidad en el grid
    insert(entity: Entity): void {
        const cells = this.getEntityCells(entity);
        
        for (const cellKey of cells) {
            if (!this.grid.has(cellKey)) {
                const coords = cellKey.split(',').map(Number);
                this.grid.set(cellKey, {
                    x: coords[0],
                    y: coords[1],
                    entities: new Set()
                });
            }
            
            this.grid.get(cellKey)!.entities.add(entity.id);
        }

        this.entityCells.set(entity.id, cells);
    }

    // Actualizar posición de entidad
    update(entity: Entity): void {
        this.remove(entity.id);
        this.insert(entity);
    }

    // Eliminar entidad del grid
    remove(entityId: string): void {
        const oldCells = this.entityCells.get(entityId) || [];
        
        for (const cellKey of oldCells) {
            const cell = this.grid.get(cellKey);
            if (cell) {
                cell.entities.delete(entityId);
                if (cell.entities.size === 0) {
                    this.grid.delete(cellKey);
                }
            }
        }

        this.entityCells.delete(entityId);
    }

    // Obtener entidades cercanas
    query(entity: Entity): string[] {
        const cells = this.getEntityCells(entity);
        const nearbyEntities = new Set<string>();

        for (const cellKey of cells) {
            const cell = this.grid.get(cellKey);
            if (cell) {
                for (const entityId of cell.entities) {
                    if (entityId !== entity.id) {
                        nearbyEntities.add(entityId);
                    }
                }
            }
        }

        return Array.from(nearbyEntities);
    }

    // Obtener entidades en un área rectangular
    queryArea(minX: number, minY: number, maxX: number, maxY: number): string[] {
        const startCellX = Math.floor(minX / this.cellSize);
        const endCellX = Math.floor(maxX / this.cellSize);
        const startCellY = Math.floor(minY / this.cellSize);
        const endCellY = Math.floor(maxY / this.cellSize);

        const entities = new Set<string>();

        for (let x = startCellX; x <= endCellX; x++) {
            for (let y = startCellY; y <= endCellY; y++) {
                const cellKey = `${x},${y}`;
                const cell = this.grid.get(cellKey);
                if (cell) {
                    for (const entityId of cell.entities) {
                        entities.add(entityId);
                    }
                }
            }
        }

        return Array.from(entities);
    }

    // Reconstruir el grid completo (para usar periódicamente)
    rebuild(entities: Entity[]): void {
        this.clear();
        
        for (const entity of entities) {
            this.insert(entity);
        }
    }

    // Limpiar el grid
    clear(): void {
        this.grid.clear();
        this.entityCells.clear();
    }

    // Obtener estadísticas del grid
    getStats(): {
        totalCells: number;
        totalEntities: number;
        averageEntitiesPerCell: number;
        maxEntitiesInCell: number;
        cellSize: number;
    } {
        let totalEntities = 0;
        let maxEntitiesInCell = 0;

        for (const cell of this.grid.values()) {
            const entityCount = cell.entities.size;
            totalEntities += entityCount;
            maxEntitiesInCell = Math.max(maxEntitiesInCell, entityCount);
        }

        return {
            totalCells: this.grid.size,
            totalEntities,
            averageEntitiesPerCell: this.grid.size > 0 ? totalEntities / this.grid.size : 0,
            maxEntitiesInCell,
            cellSize: this.cellSize
        };
    }

    // Obtener todas las celdas activas (para renderizado de debug)
    getActiveCells(): SpatialCell[] {
        return Array.from(this.grid.values());
    }

    // Obtener celdas visibles en un área (para optimizar renderizado de debug)
    getVisibleCells(viewX: number, viewY: number, viewWidth: number, viewHeight: number): SpatialCell[] {
        const startCellX = Math.floor(viewX / this.cellSize);
        const endCellX = Math.floor((viewX + viewWidth) / this.cellSize);
        const startCellY = Math.floor(viewY / this.cellSize);
        const endCellY = Math.floor((viewY + viewHeight) / this.cellSize);

        const visibleCells: SpatialCell[] = [];

        for (let x = startCellX; x <= endCellX; x++) {
            for (let y = startCellY; y <= endCellY; y++) {
                const cellKey = `${x},${y}`;
                const cell = this.grid.get(cellKey);
                if (cell && cell.entities.size > 0) {
                    visibleCells.push(cell);
                }
            }
        }

        return visibleCells;
    }

    // Verificar si una posición está cerca de entidades
    hasEntitiesNear(position: Vector2D, radius: number): boolean {
        const cellsToCheck = this.getEntityCells({
            id: 'temp',
            position,
            radius,
            velocity: { x: 0, y: 0 },
            mass: 1,
            type: 'pellet'
        } as Entity);

        for (const cellKey of cellsToCheck) {
            const cell = this.grid.get(cellKey);
            if (cell && cell.entities.size > 0) {
                return true;
            }
        }

        return false;
    }
}