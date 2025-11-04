// Agario Roles - FASE 1: Prototipo local
import { GameEngine } from './game/engine/GameEngine';

console.log('🎮 Agario Roles FASE 1 - Prototipo local iniciando...');

// Configuración del juego para FASE 1
const GAME_CONFIG = {
    worldWidth: 2000,
    worldHeight: 2000,
    playerStartMass: 100, // Para testing: debería dar v_max ≈ 69.7
    pelletMass: 5,
    maxPellets: 200,
    targetFPS: 60
};

// Aplicación principal del juego
class AgarioGameApp {
    private gameEngine: GameEngine | null = null;
    private canvas: HTMLCanvasElement | null = null;

    constructor() {
        console.log('🚀 Inicializando Agario Roles...');
    }

    async init() {
        try {
            // Configurar canvas
            await this.setupCanvas();
            
            // Inicializar motor de juego
            this.initGameEngine();
            
            // Configurar UI
            this.setupUI();
            
            // Iniciar juego
            this.startGame();
            
            console.log('✅ Agario Roles FASE 1 inicializado correctamente');
            console.log('📊 TESTING: Verificar que para masa m=100, v_max ≈ 69.7 en debug overlay');
            console.log('🎯 Criterios de aceptación: Sin errores de consola durante 60s, FPS ≥ 40');
            
        } catch (error) {
            console.error('❌ Error inicializando aplicación:', error);
        }
    }

    private async setupCanvas(): Promise<void> {
        this.canvas = document.getElementById('gameCanvas') as HTMLCanvasElement;
        if (!this.canvas) {
            throw new Error('No se encontró el elemento canvas');
        }

        // Configurar tamaño del canvas
        this.resizeCanvas();
        
        // Listener para redimensionar
        window.addEventListener('resize', () => this.resizeCanvas());
        
        console.log('🖼️ Canvas configurado');
    }

    private resizeCanvas(): void {
        if (!this.canvas) return;
        
        const container = document.getElementById('gameContainer');
        if (!container) return;
        
        this.canvas.width = container.clientWidth;
        this.canvas.height = container.clientHeight;
        
        this.canvas.style.width = container.clientWidth + 'px';
        this.canvas.style.height = container.clientHeight + 'px';
    }

    private initGameEngine(): void {
        if (!this.canvas) {
            throw new Error('Canvas no inicializado');
        }

        this.gameEngine = new GameEngine(this.canvas, GAME_CONFIG);
        console.log('⚙️ Motor de juego inicializado');
    }

    private setupUI(): void {
        // Debug toggle button
        const debugToggle = document.getElementById('debugToggle');
        if (debugToggle) {
            debugToggle.addEventListener('click', () => {
                if (this.gameEngine) {
                    this.gameEngine.toggleDebug();
                }
            });
        }

        console.log('🎨 UI configurada');
    }

    private startGame(): void {
        if (!this.gameEngine) {
            throw new Error('Motor de juego no inicializado');
        }

        this.gameEngine.start();
        console.log('🎮 Juego iniciado');
        
        // Mostrar estadísticas cada 5 segundos para testing
        setInterval(() => {
            if (this.gameEngine) {
                const stats = this.gameEngine.getGameStats();
                console.log('📊 Stats FASE 1:', {
                    fps: stats.fps.toFixed(1),
                    entities: stats.entityCount,
                    pellets: stats.pelletCount,
                    playerMass: stats.playerInfo?.mass,
                    playerVMax: stats.playerInfo?.maxVelocity
                });
            }
        }, 5000);
    }

    // API para testing en consola
    public setPlayerMass(mass: number): void {
        if (this.gameEngine) {
            this.gameEngine.setPlayerMass(mass);
        }
    }

    public getGameStats(): any {
        return this.gameEngine ? this.gameEngine.getGameStats() : null;
    }

    public toggleDebug(): void {
        if (this.gameEngine) {
            this.gameEngine.toggleDebug();
        }
    }
}

// Inicializar cuando DOM esté listo
document.addEventListener('DOMContentLoaded', () => {
    const app = new AgarioGameApp();
    app.init().catch(console.error);
    
    // Exponer app globalmente para testing en consola
    (window as any).agarioApp = app;
    
    console.log('💡 Para testing en consola (FASE 1):');
    console.log('  agarioApp.setPlayerMass(100) // Establecer masa=100 para verificar v_max≈69.7');
    console.log('  agarioApp.getGameStats()     // Obtener estadísticas del juego');
    console.log('  agarioApp.toggleDebug()     // Toggle debug overlay');
    console.log('🎯 CRITERIOS DE ACEPTACIÓN FASE 1:');
    console.log('  - Jugar 60s sin errores de consola');
    console.log('  - FPS ≥ 40 en desktop');
    console.log('  - Para masa m=100, verificar v_max ≈ 69.7');
});