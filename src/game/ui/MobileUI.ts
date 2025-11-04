// Sistema de UI móvil para Agario Roles
// Joystick virtual y botones de habilidades

export interface TouchPoint {
    id: number;
    x: number;
    y: number;
}

export interface JoystickState {
    isActive: boolean;
    centerX: number;
    centerY: number;
    currentX: number;
    currentY: number;
    deltaX: number;
    deltaY: number;
    distance: number;
    angle: number;
}

export interface MobileUICallbacks {
    onJoystickMove: (deltaX: number, deltaY: number) => void;
    onSplitPress: () => void;
    onAbilityQ: () => void;
    onAbilityE: () => void;
    onAbilityR: () => void;
}

export class MobileUI {
    private canvas: HTMLCanvasElement;
    private container: HTMLElement;
    private callbacks: MobileUICallbacks;
    
    private joystick: JoystickState;
    private activeTouches: Map<number, TouchPoint> = new Map();
    
    // UI Elements
    private joystickRadius: number = 60;
    private joystickKnobRadius: number = 25;
    private buttonRadius: number = 35;
    
    private splitButton: { x: number; y: number; pressed: boolean } = { x: 0, y: 0, pressed: false };
    private qButton: { x: number; y: number; pressed: boolean; cooldown: number } = { x: 0, y: 0, pressed: false, cooldown: 0 };
    private eButton: { x: number; y: number; pressed: boolean; cooldown: number } = { x: 0, y: 0, pressed: false, cooldown: 0 };
    private rButton: { x: number; y: number; pressed: boolean; cooldown: number } = { x: 0, y: 0, pressed: false, cooldown: 0 };
    
    private isVisible: boolean = false;
    
    constructor(canvas: HTMLCanvasElement, container: HTMLElement, callbacks: MobileUICallbacks) {
        this.canvas = canvas;
        this.container = container;
        this.callbacks = callbacks;
        
        this.joystick = {
            isActive: false,
            centerX: 0,
            centerY: 0,
            currentX: 0,
            currentY: 0,
            deltaX: 0,
            deltaY: 0,
            distance: 0,
            angle: 0
        };
        
        this.setupEventListeners();
        this.updateLayout();
        this.detectMobileDevice();
    }

    private detectMobileDevice(): void {
        // Detectar si es dispositivo móvil
        const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
        const isTouchDevice = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
        
        this.isVisible = isMobile || isTouchDevice;
        
        if (this.isVisible) {
            console.log('📱 Dispositivo móvil detectado - UI táctil activada');
        }
    }

    private setupEventListeners(): void {
        // Touch events
        this.canvas.addEventListener('touchstart', (e) => this.handleTouchStart(e), { passive: false });
        this.canvas.addEventListener('touchmove', (e) => this.handleTouchMove(e), { passive: false });
        this.canvas.addEventListener('touchend', (e) => this.handleTouchEnd(e), { passive: false });
        this.canvas.addEventListener('touchcancel', (e) => this.handleTouchEnd(e), { passive: false });
        
        // Mouse events para testing en desktop
        this.canvas.addEventListener('mousedown', (e) => this.handleMouseDown(e));
        this.canvas.addEventListener('mousemove', (e) => this.handleMouseMove(e));
        this.canvas.addEventListener('mouseup', (e) => this.handleMouseUp(e));
        
        // Resize events
        window.addEventListener('resize', () => this.updateLayout());
        window.addEventListener('orientationchange', () => {
            setTimeout(() => this.updateLayout(), 100);
        });
    }

    private updateLayout(): void {
        const rect = this.canvas.getBoundingClientRect();
        const width = rect.width;
        const height = rect.height;
        
        // Posicionar joystick (izquierda inferior)
        this.joystick.centerX = this.joystickRadius + 20;
        this.joystick.centerY = height - this.joystickRadius - 20;
        
        // Posicionar botones (derecha)
        const rightMargin = 20;
        const buttonSpacing = this.buttonRadius * 2 + 15;
        
        // Split button (más grande, centro derecha)
        this.splitButton.x = width - rightMargin - this.buttonRadius;
        this.splitButton.y = height / 2;
        
        // Botones de habilidades (arriba del split)
        this.qButton.x = width - rightMargin - this.buttonRadius - buttonSpacing * 0.8;
        this.qButton.y = height / 2 - buttonSpacing * 1.2;
        
        this.eButton.x = width - rightMargin - this.buttonRadius;
        this.eButton.y = height / 2 - buttonSpacing * 1.8;
        
        this.rButton.x = width - rightMargin - this.buttonRadius + buttonSpacing * 0.8;
        this.rButton.y = height / 2 - buttonSpacing * 1.2;
    }

    private handleTouchStart(event: TouchEvent): void {
        event.preventDefault();
        
        for (let i = 0; i < event.changedTouches.length; i++) {
            const touch = event.changedTouches[i];
            const rect = this.canvas.getBoundingClientRect();
            const x = touch.clientX - rect.left;
            const y = touch.clientY - rect.top;
            
            this.activeTouches.set(touch.identifier, { id: touch.identifier, x, y });
            this.processTouchStart(x, y, touch.identifier);
        }
    }

    private handleTouchMove(event: TouchEvent): void {
        event.preventDefault();
        
        for (let i = 0; i < event.changedTouches.length; i++) {
            const touch = event.changedTouches[i];
            const rect = this.canvas.getBoundingClientRect();
            const x = touch.clientX - rect.left;
            const y = touch.clientY - rect.top;
            
            if (this.activeTouches.has(touch.identifier)) {
                this.activeTouches.set(touch.identifier, { id: touch.identifier, x, y });
                this.processTouchMove(x, y, touch.identifier);
            }
        }
    }

    private handleTouchEnd(event: TouchEvent): void {
        event.preventDefault();
        
        for (let i = 0; i < event.changedTouches.length; i++) {
            const touch = event.changedTouches[i];
            
            if (this.activeTouches.has(touch.identifier)) {
                this.processTouchEnd(touch.identifier);
                this.activeTouches.delete(touch.identifier);
            }
        }
    }

    // Mouse events para testing
    private handleMouseDown(event: MouseEvent): void {
        if (!this.isVisible) return; // Solo en mobile o cuando está forzado
        
        const rect = this.canvas.getBoundingClientRect();
        const x = event.clientX - rect.left;
        const y = event.clientY - rect.top;
        
        this.processTouchStart(x, y, -1); // ID especial para mouse
    }

    private handleMouseMove(event: MouseEvent): void {
        if (!this.isVisible) return;
        
        const rect = this.canvas.getBoundingClientRect();
        const x = event.clientX - rect.left;
        const y = event.clientY - rect.top;
        
        if (event.buttons === 1) { // Solo si está presionado
            this.processTouchMove(x, y, -1);
        }
    }

    private handleMouseUp(event: MouseEvent): void {
        if (!this.isVisible) return;
        
        this.processTouchEnd(-1);
    }

    private processTouchStart(x: number, y: number, touchId: number): void {
        // Verificar joystick
        const joystickDistance = Math.sqrt(
            (x - this.joystick.centerX) ** 2 + (y - this.joystick.centerY) ** 2
        );
        
        if (joystickDistance <= this.joystickRadius && !this.joystick.isActive) {
            this.joystick.isActive = true;
            this.joystick.currentX = x;
            this.joystick.currentY = y;
            this.updateJoystickState();
            return;
        }
        
        // Verificar botones
        this.checkButtonPress(x, y);
    }

    private processTouchMove(x: number, y: number, touchId: number): void {
        if (this.joystick.isActive) {
            this.joystick.currentX = x;
            this.joystick.currentY = y;
            this.updateJoystickState();
        }
    }

    private processTouchEnd(touchId: number): void {
        if (this.joystick.isActive) {
            this.joystick.isActive = false;
            this.joystick.deltaX = 0;
            this.joystick.deltaY = 0;
            this.joystick.distance = 0;
            this.callbacks.onJoystickMove(0, 0);
        }
        
        // Resetear botones
        this.splitButton.pressed = false;
        this.qButton.pressed = false;
        this.eButton.pressed = false;
        this.rButton.pressed = false;
    }

    private updateJoystickState(): void {
        const deltaX = this.joystick.currentX - this.joystick.centerX;
        const deltaY = this.joystick.currentY - this.joystick.centerY;
        const distance = Math.sqrt(deltaX ** 2 + deltaY ** 2);
        
        // Limitar al radio del joystick
        const maxDistance = this.joystickRadius - this.joystickKnobRadius;
        const clampedDistance = Math.min(distance, maxDistance);
        
        if (distance > 0) {
            const normalizedX = deltaX / distance;
            const normalizedY = deltaY / distance;
            
            this.joystick.deltaX = normalizedX * (clampedDistance / maxDistance);
            this.joystick.deltaY = normalizedY * (clampedDistance / maxDistance);
            this.joystick.distance = clampedDistance;
            this.joystick.angle = Math.atan2(deltaY, deltaX);
            
            // Actualizar posición visual del knob
            this.joystick.currentX = this.joystick.centerX + normalizedX * clampedDistance;
            this.joystick.currentY = this.joystick.centerY + normalizedY * clampedDistance;
        } else {
            this.joystick.deltaX = 0;
            this.joystick.deltaY = 0;
            this.joystick.distance = 0;
        }
        
        // Notificar callback
        this.callbacks.onJoystickMove(this.joystick.deltaX, this.joystick.deltaY);
    }

    private checkButtonPress(x: number, y: number): void {
        // Split button
        if (this.isPointInButton(x, y, this.splitButton.x, this.splitButton.y)) {
            this.splitButton.pressed = true;
            this.callbacks.onSplitPress();
            return;
        }
        
        // Q button
        if (this.isPointInButton(x, y, this.qButton.x, this.qButton.y) && this.qButton.cooldown <= 0) {
            this.qButton.pressed = true;
            this.callbacks.onAbilityQ();
            return;
        }
        
        // E button
        if (this.isPointInButton(x, y, this.eButton.x, this.eButton.y) && this.eButton.cooldown <= 0) {
            this.eButton.pressed = true;
            this.callbacks.onAbilityE();
            return;
        }
        
        // R button
        if (this.isPointInButton(x, y, this.rButton.x, this.rButton.y) && this.rButton.cooldown <= 0) {
            this.rButton.pressed = true;
            this.callbacks.onAbilityR();
            return;
        }
    }

    private isPointInButton(x: number, y: number, buttonX: number, buttonY: number): boolean {
        const distance = Math.sqrt((x - buttonX) ** 2 + (y - buttonY) ** 2);
        return distance <= this.buttonRadius;
    }

    // Renderizar UI móvil
    render(ctx: CanvasRenderingContext2D): void {
        if (!this.isVisible) return;
        
        ctx.save();
        
        this.renderJoystick(ctx);
        this.renderButtons(ctx);
        
        ctx.restore();
    }

    private renderJoystick(ctx: CanvasRenderingContext2D): void {
        // Base del joystick
        ctx.fillStyle = 'rgba(255, 255, 255, 0.2)';
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.5)';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(this.joystick.centerX, this.joystick.centerY, this.joystickRadius, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
        
        // Knob del joystick
        const knobX = this.joystick.isActive ? this.joystick.currentX : this.joystick.centerX;
        const knobY = this.joystick.isActive ? this.joystick.currentY : this.joystick.centerY;
        
        ctx.fillStyle = this.joystick.isActive ? 'rgba(74, 172, 255, 0.8)' : 'rgba(255, 255, 255, 0.6)';
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.8)';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(knobX, knobY, this.joystickKnobRadius, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
    }

    private renderButtons(ctx: CanvasRenderingContext2D): void {
        // Split button (más grande)
        ctx.fillStyle = this.splitButton.pressed ? 'rgba(255, 99, 71, 0.8)' : 'rgba(255, 255, 255, 0.3)';
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.8)';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(this.splitButton.x, this.splitButton.y, this.buttonRadius, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
        
        // Texto "SPLIT"
        ctx.fillStyle = 'white';
        ctx.font = 'bold 12px Arial';
        ctx.textAlign = 'center';
        ctx.fillText('SPLIT', this.splitButton.x, this.splitButton.y + 4);
        
        // Botón Q
        this.renderAbilityButton(ctx, this.qButton, 'Q');
        
        // Botón E
        this.renderAbilityButton(ctx, this.eButton, 'E');
        
        // Botón R (Ultimate)
        this.renderAbilityButton(ctx, this.rButton, 'R', true);
    }

    private renderAbilityButton(ctx: CanvasRenderingContext2D, button: any, label: string, isUltimate: boolean = false): void {
        // Color base
        let fillColor = 'rgba(255, 255, 255, 0.3)';
        let strokeColor = 'rgba(255, 255, 255, 0.8)';
        
        if (button.pressed) {
            fillColor = 'rgba(74, 172, 255, 0.8)';
        } else if (button.cooldown > 0) {
            fillColor = 'rgba(128, 128, 128, 0.5)';
            strokeColor = 'rgba(128, 128, 128, 0.8)';
        } else if (isUltimate) {
            fillColor = 'rgba(255, 215, 0, 0.4)'; // Dorado para ultimate
            strokeColor = 'rgba(255, 215, 0, 0.8)';
        }
        
        ctx.fillStyle = fillColor;
        ctx.strokeStyle = strokeColor;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(button.x, button.y, this.buttonRadius * 0.8, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
        
        // Cooldown overlay
        if (button.cooldown > 0) {
            const cooldownAngle = (button.cooldown / 10000) * Math.PI * 2; // Asumiendo 10s max cooldown
            ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';
            ctx.beginPath();
            ctx.moveTo(button.x, button.y);
            ctx.arc(button.x, button.y, this.buttonRadius * 0.8, -Math.PI / 2, -Math.PI / 2 + cooldownAngle);
            ctx.closePath();
            ctx.fill();
        }
        
        // Texto
        ctx.fillStyle = button.cooldown > 0 ? 'rgba(255, 255, 255, 0.5)' : 'white';
        ctx.font = 'bold 14px Arial';
        ctx.textAlign = 'center';
        ctx.fillText(label, button.x, button.y + 4);
    }

    // API pública
    show(): void {
        this.isVisible = true;
    }

    hide(): void {
        this.isVisible = false;
    }

    toggle(): void {
        this.isVisible = !this.isVisible;
    }

    isShowing(): boolean {
        return this.isVisible;
    }

    // Actualizar cooldowns (llamar desde game loop)
    update(deltaTime: number): void {
        if (this.qButton.cooldown > 0) {
            this.qButton.cooldown = Math.max(0, this.qButton.cooldown - deltaTime);
        }
        if (this.eButton.cooldown > 0) {
            this.eButton.cooldown = Math.max(0, this.eButton.cooldown - deltaTime);
        }
        if (this.rButton.cooldown > 0) {
            this.rButton.cooldown = Math.max(0, this.rButton.cooldown - deltaTime);
        }
    }

    // Establecer cooldowns
    setAbilityCooldown(ability: 'Q' | 'E' | 'R', cooldownMs: number): void {
        switch (ability) {
            case 'Q':
                this.qButton.cooldown = cooldownMs;
                break;
            case 'E':
                this.eButton.cooldown = cooldownMs;
                break;
            case 'R':
                this.rButton.cooldown = cooldownMs;
                break;
        }
    }
}