// Motor principal del juego Agario Roles
import { PhysicsEngine, type Entity, type Vector2D } from './PhysicsEngine';
import { RenderEngine } from './RenderEngine';
import { SplitMergeSystem } from './SplitMergeSystem';
import { MobileUI, type MobileUICallbacks } from '../ui/MobileUI';

export interface GameConfig {
    worldWidth: number;
    worldHeight: number;
    playerStartMass: number;
    pelletMass: number;
    maxPellets: number;
    targetFPS: number;
}

export class GameEngine {
    private physicsEngine: PhysicsEngine;
    private renderEngine: RenderEngine;
    private splitMergeSystem: SplitMergeSystem;
    private mobileUI: MobileUI;
    private config: GameConfig;
    
    private playerId: string = 'player';
    private isRunning: boolean = false;
    private lastFrameTime: number = 0;
    private frameCount: number = 0;
    private fpsHistory: number[] = [];
    
    // Input state
    private inputDirection: Vector2D = { x: 0, y: 0 };
    
    constructor(canvas: HTMLCanvasElement, config: Partial<GameConfig> = {}) {
        this.config = {
            worldWidth: 2000,
            worldHeight: 2000,
            playerStartMass: 100, // Para testing: m=100 debería dar v_max ≈ 69.7
            pelletMass: 5,
            maxPellets: 200,
            targetFPS: 60,
            ...config
        };
        
        this.physicsEngine = new PhysicsEngine();
        this.renderEngine = new RenderEngine(canvas);
        this.splitMergeSystem = new SplitMergeSystem(this.physicsEngine);
        
        // Configurar callbacks para la UI móvil
        const mobileCallbacks: MobileUICallbacks = {
            onJoystickMove: (deltaX: number, deltaY: number) => {
                this.inputDirection.x = deltaX;
                this.inputDirection.y = deltaY;
            },
            onSplitPress: () => {
                const splitDirection = this.inputDirection.x !== 0 || this.inputDirection.y !== 0 
                    ? { ...this.inputDirection } 
                    : { x: 0, y: -1 };
                this.splitMergeSystem.handleSplitInput(this.playerId, splitDirection);
            },
            onAbilityQ: () => {
                console.log('🎯 Habilidad Q activada');
                this.mobileUI.setAbilityCooldown('Q', 5000); // 5s cooldown
                // TODO: Implementar habilidad Q en siguiente fase
            },
            onAbilityE: () => {
                console.log('🎯 Habilidad E activada');
                this.mobileUI.setAbilityCooldown('E', 8000); // 8s cooldown
                // TODO: Implementar habilidad E en siguiente fase
            },
            onAbilityR: () => {
                console.log('🎯 Ultimate R activada');
                this.mobileUI.setAbilityCooldown('R', 30000); // 30s cooldown
                // TODO: Implementar ultimate R en siguiente fase
            }
        };
        
        const container = canvas.parentElement || document.body;
        this.mobileUI = new MobileUI(canvas, container, mobileCallbacks);
        
        this.setupEventListeners();
        this.initializeGame();
    }

    private setupEventListeners(): void {
        // Keyboard input
        document.addEventListener('keydown', (e) => this.handleKeyDown(e));
        document.addEventListener('keyup', (e) => this.handleKeyUp(e));
        
        // Window resize
        window.addEventListener('resize', () => this.renderEngine.resize());
        
        // Debug toggle (F3)
        document.addEventListener('keydown', (e) => {
            if (e.key === 'F3') {
                e.preventDefault();
                this.renderEngine.toggleDebugMode();
            }
        });
    }

    private handleKeyDown(e: KeyboardEvent): void {
        switch (e.key.toLowerCase()) {
            case 'w':
            case 'arrowup':
                this.inputDirection.y = -1;
                e.preventDefault();
                break;
            case 's':
            case 'arrowdown':
                this.inputDirection.y = 1;
                e.preventDefault();
                break;
            case 'a':
            case 'arrowleft':
                this.inputDirection.x = -1;
                e.preventDefault();
                break;
            case 'd':
            case 'arrowright':
                this.inputDirection.x = 1;
                e.preventDefault();
                break;
            case ' ':
                // Split con dirección de movimiento actual
                const splitDirection = this.inputDirection.x !== 0 || this.inputDirection.y !== 0 
                    ? { ...this.inputDirection } 
                    : { x: 0, y: -1 }; // Por defecto hacia arriba
                
                this.splitMergeSystem.handleSplitInput(this.playerId, splitDirection);
                e.preventDefault();
                break;
            case 'q':
                // Habilidad Q
                console.log('🎯 Habilidad Q activada (teclado)');
                this.mobileUI.setAbilityCooldown('Q', 5000); // 5s cooldown
                // TODO: Implementar habilidad Q en siguiente fase
                e.preventDefault();
                break;
            case 'e':
                // Habilidad E
                console.log('🎯 Habilidad E activada (teclado)');
                this.mobileUI.setAbilityCooldown('E', 8000); // 8s cooldown
                // TODO: Implementar habilidad E en siguiente fase
                e.preventDefault();
                break;
            case 'r':
                // Ultimate R
                console.log('🎯 Ultimate R activada (teclado)');
                this.mobileUI.setAbilityCooldown('R', 30000); // 30s cooldown
                // TODO: Implementar ultimate R en siguiente fase
                e.preventDefault();
                break;
            case 'm':
                // Toggle UI móvil (para testing)
                this.mobileUI.toggle();
                console.log(`📱 UI móvil: ${this.mobileUI.isShowing() ? 'activada' : 'desactivada'}`);
                e.preventDefault();
                break;
        }
    }

    private handleKeyUp(e: KeyboardEvent): void {
        switch (e.key.toLowerCase()) {
            case 'w':
            case 'arrowup':
                if (this.inputDirection.y === -1) this.inputDirection.y = 0;
                break;
            case 's':
            case 'arrowdown':
                if (this.inputDirection.y === 1) this.inputDirection.y = 0;
                break;
            case 'a':
            case 'arrowleft':
                if (this.inputDirection.x === -1) this.inputDirection.x = 0;
                break;
            case 'd':
            case 'arrowright':
                if (this.inputDirection.x === 1) this.inputDirection.x = 0;
                break;
        }
    }

    private initializeGame(): void {
        // Crear jugador en el centro del mundo
        const playerPosition = {
            x: this.config.worldWidth / 2,
            y: this.config.worldHeight / 2
        };
        
        this.physicsEngine.createEntity(
            this.playerId,
            'player',
            this.config.playerStartMass,
            playerPosition
        );
        
        // Generar pellets iniciales
        this.generatePellets();
        
        console.log('🎮 Juego inicializado');
        console.log(`📏 Mundo: ${this.config.worldWidth}x${this.config.worldHeight}`);
        console.log(`🎯 Jugador: masa=${this.config.playerStartMass}, radio=${PhysicsEngine.calculateRadius(this.config.playerStartMass).toFixed(1)}`);
        console.log(`⚡ Velocidad máxima esperada: ${PhysicsEngine.calculateMaxVelocity(this.config.playerStartMass).toFixed(1)}`);
    }

    private generatePellets(): void {
        const currentPellets = this.physicsEngine.getEntitiesByType('pellet');
        const pelletsToGenerate = this.config.maxPellets - currentPellets.length;
        
        for (let i = 0; i < pelletsToGenerate; i++) {
            // Posición aleatoria en el mundo
            const position = {
                x: Math.random() * this.config.worldWidth,
                y: Math.random() * this.config.worldHeight
            };
            
            // Verificar que no esté muy cerca del jugador
            const player = this.physicsEngine.getEntity(this.playerId);
            if (player) {
                const dx = position.x - player.position.x;
                const dy = position.y - player.position.y;
                const distance = Math.sqrt(dx * dx + dy * dy);
                
                // No generar pellets muy cerca del jugador
                if (distance < player.radius + 50) {
                    continue;
                }
            }
            
            this.physicsEngine.createEntity(
                `pellet_${Date.now()}_${i}`,
                'pellet',
                this.config.pelletMass,
                position
            );
        }
    }

    private updateGame(): void {
        const currentTime = performance.now();
        const deltaTime = this.lastFrameTime > 0 ? currentTime - this.lastFrameTime : 16; // Default 16ms
        
        // Aplicar input del jugador a todas sus células
        if (this.inputDirection.x !== 0 || this.inputDirection.y !== 0) {
            this.splitMergeSystem.applyMovementToAllCells(this.playerId, this.inputDirection);
        }
        
        // Actualizar física
        this.physicsEngine.update();
        
        // Actualizar sistema de split/merge
        this.splitMergeSystem.update();
        
        // Actualizar UI móvil (cooldowns)
        this.mobileUI.update(deltaTime);
        
        // Procesar colisiones jugador-pellets
        this.processPlayerCollisions();
        
        // Mantener pellets en el mundo
        this.generatePellets();
        
        // Actualizar cámara para seguir al jugador
        const player = this.physicsEngine.getEntity(this.playerId);
        if (player) {
            this.renderEngine.updateCamera(player.position);
        }
    }

    private processPlayerCollisions(): void {
        const playerCells = this.splitMergeSystem.getPlayerCells(this.playerId);
        if (playerCells.length === 0) return;
        
        const pellets = this.physicsEngine.getEntitiesByType('pellet');
        
        // Procesar colisiones para cada célula del jugador
        for (const cell of playerCells) {
            for (const pellet of pellets) {
                if (this.physicsEngine.processEatingCollision(cell.id, pellet.id)) {
                    // Pellet comido, se eliminó automáticamente en processEatingCollision
                    console.log(`🍖 Pellet comido por ${cell.id}! Nueva masa: ${cell.mass.toFixed(1)}`);
                    break; // El pellet ya fue comido, salir del loop interno
                }
            }
        }
    }

    private render(): void {
        // Limpiar canvas
        this.renderEngine.clear();
        
        // Renderizar grid de fondo
        this.renderEngine.renderGrid();
        
        // Renderizar spatial hash grid (si debug está activo)
        if (this.renderEngine.isDebugMode()) {
            this.renderEngine.renderSpatialHashGrid(this.physicsEngine.getSpatialGrid());
        }
        
        // Renderizar todas las entidades
        const entities = this.physicsEngine.getAllEntities();
        this.renderEngine.renderEntities(entities);
        
        // Debug overlay
        if (this.renderEngine.isDebugMode()) {
            const player = this.physicsEngine.getEntity(this.playerId);
            const playerDebugInfo = player ? this.physicsEngine.getEntityDebugInfo(this.playerId) : null;
            const splitInfo = this.splitMergeSystem.getPlayerSplitInfo(this.playerId);
            const spatialStats = this.physicsEngine.getSpatialGrid().getStats();
            
            this.renderEngine.renderDebugOverlay(
                this.getCurrentFPS(),
                entities.length,
                playerDebugInfo,
                splitInfo,
                spatialStats
            );
        }
        
        // Renderizar UI móvil (encima de todo)
        this.mobileUI.render(this.renderEngine.getContext());
    }

    private calculateFPS(currentTime: number): void {
        this.frameCount++;
        
        if (this.lastFrameTime === 0) {
            this.lastFrameTime = currentTime;
            return;
        }
        
        const deltaTime = currentTime - this.lastFrameTime;
        const fps = 1000 / deltaTime;
        
        this.fpsHistory.push(fps);
        if (this.fpsHistory.length > 60) { // Mantener últimos 60 frames
            this.fpsHistory.shift();
        }
        
        this.lastFrameTime = currentTime;
    }

    private getCurrentFPS(): number {
        if (this.fpsHistory.length === 0) return 0;
        
        // Promedio de los últimos frames
        const sum = this.fpsHistory.reduce((a, b) => a + b, 0);
        return sum / this.fpsHistory.length;
    }

    // Game loop principal
    private gameLoop = (currentTime: number): void => {
        if (!this.isRunning) return;
        
        this.calculateFPS(currentTime);
        
        // Update y render
        this.updateGame();
        this.render();
        
        // Continuar el loop
        requestAnimationFrame(this.gameLoop);
    };

    // API pública
    start(): void {
        if (this.isRunning) return;
        
        this.isRunning = true;
        this.lastFrameTime = 0;
        console.log('🚀 Iniciando game loop...');
        requestAnimationFrame(this.gameLoop);
    }

    stop(): void {
        this.isRunning = false;
        console.log('⏸️ Game loop detenido');
    }

    toggleDebug(): void {
        this.renderEngine.toggleDebugMode();
    }

    // Obtener información del jugador
    getPlayerInfo(): any {
        return this.physicsEngine.getEntityDebugInfo(this.playerId);
    }

    // Obtener estadísticas del juego
    getGameStats(): any {
        const entities = this.physicsEngine.getAllEntities();
        return {
            fps: this.getCurrentFPS(),
            entityCount: entities.length,
            pelletCount: this.physicsEngine.getEntitiesByType('pellet').length,
            playerInfo: this.getPlayerInfo()
        };
    }

    // Para testing: establecer masa específica del jugador
    setPlayerMass(mass: number): void {
        this.physicsEngine.updateEntityMass(this.playerId, mass);
        console.log(`🎯 Masa del jugador cambiada a: ${mass}`);
        console.log(`⚡ Nueva velocidad máxima: ${PhysicsEngine.calculateMaxVelocity(mass).toFixed(1)}`);
    }
}