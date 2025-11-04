// Motor de renderizado para Agario Roles
import type { Entity, Vector2D } from './PhysicsEngine';

export interface Camera {
    position: Vector2D;
    zoom: number;
}

export class RenderEngine {
    private canvas: HTMLCanvasElement;
    private ctx: CanvasRenderingContext2D;
    private camera: Camera;
    private debugMode: boolean = false;

    constructor(canvas: HTMLCanvasElement) {
        this.canvas = canvas;
        const context = canvas.getContext('2d');
        if (!context) {
            throw new Error('No se pudo obtener el contexto 2D del canvas');
        }
        this.ctx = context;
        
        this.camera = {
            position: { x: 0, y: 0 },
            zoom: 1
        };

        this.setupCanvas();
    }

    private setupCanvas(): void {
        // Configurar canvas para alta resolución
        const dpr = window.devicePixelRatio || 1;
        const rect = this.canvas.getBoundingClientRect();
        
        this.canvas.width = rect.width * dpr;
        this.canvas.height = rect.height * dpr;
        
        this.ctx.scale(dpr, dpr);
        this.canvas.style.width = rect.width + 'px';
        this.canvas.style.height = rect.height + 'px';
    }

    // Configurar cámara para seguir al jugador
    updateCamera(playerPosition: Vector2D): void {
        const centerX = this.canvas.width / (2 * window.devicePixelRatio);
        const centerY = this.canvas.height / (2 * window.devicePixelRatio);
        
        this.camera.position.x = playerPosition.x - centerX;
        this.camera.position.y = playerPosition.y - centerY;
    }

    // Convertir coordenadas del mundo a coordenadas de pantalla
    worldToScreen(worldPos: Vector2D): Vector2D {
        return {
            x: (worldPos.x - this.camera.position.x) * this.camera.zoom,
            y: (worldPos.y - this.camera.position.y) * this.camera.zoom
        };
    }

    // Limpiar canvas
    clear(): void {
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        
        // Fondo con gradiente sutil
        const gradient = this.ctx.createRadialGradient(
            this.canvas.width / 2, this.canvas.height / 2, 0,
            this.canvas.width / 2, this.canvas.height / 2, Math.max(this.canvas.width, this.canvas.height)
        );
        gradient.addColorStop(0, '#1a1a2e');
        gradient.addColorStop(1, '#16213e');
        
        this.ctx.fillStyle = gradient;
        this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
    }

    // Renderizar grid de fondo
    renderGrid(gridSize: number = 50): void {
        const screenPos = this.worldToScreen({ x: 0, y: 0 });
        const offsetX = screenPos.x % (gridSize * this.camera.zoom);
        const offsetY = screenPos.y % (gridSize * this.camera.zoom);
        
        this.ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)';
        this.ctx.lineWidth = 1;
        
        // Líneas verticales
        for (let x = offsetX; x < this.canvas.width; x += gridSize * this.camera.zoom) {
            this.ctx.beginPath();
            this.ctx.moveTo(x, 0);
            this.ctx.lineTo(x, this.canvas.height);
            this.ctx.stroke();
        }
        
        // Líneas horizontales
        for (let y = offsetY; y < this.canvas.height; y += gridSize * this.camera.zoom) {
            this.ctx.beginPath();
            this.ctx.moveTo(0, y);
            this.ctx.lineTo(this.canvas.width, y);
            this.ctx.stroke();
        }
    }

    // Renderizar spatial hash grid (para debug)
    renderSpatialHashGrid(spatialGrid: any): void {
        if (!this.debugMode) return;

        this.ctx.save();
        
        // Obtener área visible
        const canvasSize = this.getCanvasSize();
        const worldMinX = this.camera.position.x;
        const worldMinY = this.camera.position.y;
        const worldMaxX = worldMinX + canvasSize.width;
        const worldMaxY = worldMinY + canvasSize.height;
        
        // Obtener celdas visibles
        const visibleCells = spatialGrid.getVisibleCells(worldMinX, worldMinY, canvasSize.width, canvasSize.height);
        
        // Renderizar celdas activas
        for (const cell of visibleCells) {
            const cellSize = spatialGrid.getStats().cellSize;
            const worldX = cell.x * cellSize;
            const worldY = cell.y * cellSize;
            
            const screenPos = this.worldToScreen({ x: worldX, y: worldY });
            const screenSize = cellSize * this.camera.zoom;
            
            // Color basado en número de entidades
            const entityCount = cell.entities.size;
            const alpha = Math.min(0.6, entityCount * 0.1 + 0.1);
            const hue = Math.min(120, entityCount * 20); // Verde a rojo
            
            this.ctx.fillStyle = `hsla(${hue}, 70%, 50%, ${alpha})`;
            this.ctx.fillRect(screenPos.x, screenPos.y, screenSize, screenSize);
            
            // Borde de celda
            this.ctx.strokeStyle = 'rgba(255, 255, 255, 0.3)';
            this.ctx.lineWidth = 1;
            this.ctx.strokeRect(screenPos.x, screenPos.y, screenSize, screenSize);
            
            // Mostrar número de entidades si hay zoom suficiente
            if (this.camera.zoom > 0.5 && entityCount > 0) {
                this.ctx.fillStyle = 'white';
                this.ctx.font = `${Math.max(10, 12 * this.camera.zoom)}px Arial`;
                this.ctx.textAlign = 'center';
                this.ctx.fillText(
                    entityCount.toString(),
                    screenPos.x + screenSize / 2,
                    screenPos.y + screenSize / 2 + 4
                );
            }
        }
        
        this.ctx.restore();
    }

    // Renderizar entidad individual
    renderEntity(entity: Entity): void {
        const screenPos = this.worldToScreen(entity.position);
        const screenRadius = entity.radius * this.camera.zoom;
        
        // No renderizar si está fuera de la pantalla
        if (screenPos.x + screenRadius < 0 || screenPos.x - screenRadius > this.canvas.width ||
            screenPos.y + screenRadius < 0 || screenPos.y - screenRadius > this.canvas.height) {
            return;
        }

        this.ctx.save();
        
        // Colores por tipo de entidad
        switch (entity.type) {
            case 'player':
                this.renderPlayer(entity, screenPos, screenRadius);
                break;
            case 'bot':
                this.renderBot(entity, screenPos, screenRadius);
                break;
            case 'pellet':
                this.renderPellet(entity, screenPos, screenRadius);
                break;
        }
        
        this.ctx.restore();
    }

    private renderPlayer(entity: Entity, screenPos: Vector2D, screenRadius: number): void {
        // Círculo del jugador con gradiente
        const gradient = this.ctx.createRadialGradient(
            screenPos.x, screenPos.y, 0,
            screenPos.x, screenPos.y, screenRadius
        );
        gradient.addColorStop(0, '#4facfe');
        gradient.addColorStop(1, '#00f2fe');
        
        this.ctx.fillStyle = gradient;
        this.ctx.beginPath();
        this.ctx.arc(screenPos.x, screenPos.y, screenRadius, 0, Math.PI * 2);
        this.ctx.fill();
        
        // Borde
        this.ctx.strokeStyle = '#ffffff';
        this.ctx.lineWidth = 2;
        this.ctx.stroke();
        
        // Mostrar masa si está en debug mode
        if (this.debugMode) {
            this.ctx.fillStyle = '#ffffff';
            this.ctx.font = '12px Arial';
            this.ctx.textAlign = 'center';
            this.ctx.fillText(
                `m:${entity.mass.toFixed(0)}`,
                screenPos.x,
                screenPos.y - screenRadius - 5
            );
        }
    }

    private renderBot(entity: Entity, screenPos: Vector2D, screenRadius: number): void {
        // Círculo del bot con color rojizo
        const gradient = this.ctx.createRadialGradient(
            screenPos.x, screenPos.y, 0,
            screenPos.x, screenPos.y, screenRadius
        );
        gradient.addColorStop(0, '#ff6b6b');
        gradient.addColorStop(1, '#ee5a52');
        
        this.ctx.fillStyle = gradient;
        this.ctx.beginPath();
        this.ctx.arc(screenPos.x, screenPos.y, screenRadius, 0, Math.PI * 2);
        this.ctx.fill();
        
        // Borde más delgado para bots
        this.ctx.strokeStyle = '#ffffff';
        this.ctx.lineWidth = 1;
        this.ctx.stroke();
    }

    private renderPellet(entity: Entity, screenPos: Vector2D, screenRadius: number): void {
        // Pellet pequeño con color aleatorio basado en ID
        const colors = ['#feca57', '#ff9ff3', '#54a0ff', '#5f27cd', '#00d2d3', '#ff9f43'];
        const colorIndex = parseInt(entity.id.slice(-1), 16) % colors.length;
        
        this.ctx.fillStyle = colors[colorIndex];
        this.ctx.beginPath();
        this.ctx.arc(screenPos.x, screenPos.y, Math.max(screenRadius, 2), 0, Math.PI * 2);
        this.ctx.fill();
    }

    // Renderizar todas las entidades
    renderEntities(entities: Entity[]): void {
        // Ordenar por tamaño (más pequeños primero para que los grandes se vean encima)
        const sortedEntities = entities.sort((a, b) => a.radius - b.radius);
        
        for (const entity of sortedEntities) {
            this.renderEntity(entity);
        }
    }

    // Renderizar debug overlay
    renderDebugOverlay(fps: number, entityCount: number, playerDebugInfo: any, splitInfo?: any, spatialGrid?: any): void {
        if (!this.debugMode) return;
        
        this.ctx.save();
        
        // Fondo semi-transparente para el debug (expandido)
        this.ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
        this.ctx.fillRect(10, 10, 280, 240);
        
        // Texto de debug
        this.ctx.fillStyle = '#ffffff';
        this.ctx.font = '12px monospace';
        this.ctx.textAlign = 'left';
        
        let y = 30;
        const lineHeight = 15;
        
        this.ctx.fillText(`FPS: ${fps.toFixed(1)}`, 20, y);
        y += lineHeight;
        
        this.ctx.fillText(`Entidades: ${entityCount}`, 20, y);
        y += lineHeight;
        
        if (playerDebugInfo) {
            this.ctx.fillText(`Masa: ${playerDebugInfo.mass}`, 20, y);
            y += lineHeight;
            
            this.ctx.fillText(`Radio: ${playerDebugInfo.radius}`, 20, y);
            y += lineHeight;
            
            this.ctx.fillText(`V_max: ${playerDebugInfo.maxVelocity}`, 20, y);
            y += lineHeight;
            
            this.ctx.fillText(`V_actual: ${playerDebugInfo.currentVelocity}`, 20, y);
            y += lineHeight;
            
            this.ctx.fillText(`Pos: (${playerDebugInfo.position.x}, ${playerDebugInfo.position.y})`, 20, y);
            y += lineHeight;
        }
        
        // Información de split/merge
        if (splitInfo) {
            y += 5; // Espacio extra
            this.ctx.fillText(`--- SPLIT/MERGE ---`, 20, y);
            y += lineHeight;
            
            this.ctx.fillText(`Células: ${splitInfo.splitCount + 1}`, 20, y);
            y += lineHeight;
            
            this.ctx.fillText(`Puede split: ${splitInfo.canSplit ? 'SÍ' : 'NO'}`, 20, y);
            y += lineHeight;
            
            if (splitInfo.cooldownRemaining > 0) {
                this.ctx.fillText(`Cooldown: ${(splitInfo.cooldownRemaining / 1000).toFixed(1)}s`, 20, y);
                y += lineHeight;
            }
        }
        
        // Información de Spatial Hash
        if (spatialGrid) {
            y += 5; // Espacio extra
            this.ctx.fillText(`--- SPATIAL HASH ---`, 20, y);
            y += lineHeight;
            
            this.ctx.fillText(`Celdas activas: ${spatialGrid.totalCells}`, 20, y);
            y += lineHeight;
            
            this.ctx.fillText(`Tamaño celda: ${spatialGrid.cellSize}px`, 20, y);
            y += lineHeight;
            
            this.ctx.fillText(`Ent/celda avg: ${spatialGrid.averageEntitiesPerCell.toFixed(1)}`, 20, y);
            y += lineHeight;
            
            this.ctx.fillText(`Max ent/celda: ${spatialGrid.maxEntitiesInCell}`, 20, y);
        }
        
        this.ctx.restore();
    }

    // Toggle debug mode
    toggleDebugMode(): void {
        this.debugMode = !this.debugMode;
    }

    // Getter para debug mode
    isDebugMode(): boolean {
        return this.debugMode;
    }

    // Resize canvas
    resize(): void {
        this.setupCanvas();
    }

    // Obtener dimensiones del canvas
    getCanvasSize(): { width: number; height: number } {
        return {
            width: this.canvas.width / (window.devicePixelRatio || 1),
            height: this.canvas.height / (window.devicePixelRatio || 1)
        };
    }
    
    // Getter para el contexto (para UI externa)
    getContext(): CanvasRenderingContext2D {
        return this.ctx;
    }
}