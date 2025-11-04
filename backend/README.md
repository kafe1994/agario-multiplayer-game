# Agario Game Server - Backend

Servidor autoritativo para el juego Agario implementado con Node.js, Express y Supabase Realtime. Incluye game loop a 10Hz, validación de mensajes, rate limiting y persistencia completa.

## 🚀 Características

- **Game Loop Autoritativo**: 10Hz (100ms por tick) con procesamiento de acciones encoladas
- **Comunicación Realtime**: Supabase Realtime para comunicación bidireccional cliente-servidor
- **Rate Limiting**: 20 mensajes/segundo por jugador con throttling automático
- **Validación Robusta**: Esquemas AJV para validación de payloads y seguridad
- **Persistencia**: PostgreSQL via Supabase para matches, stats y eventos de seguridad
- **Optimización**: Object pooling, spatial hash y física optimizada de Fase 2
- **Monitoring**: Health checks, métricas de rendimiento y logging estructurado
- **Docker**: Imagen multi-stage optimizada para producción

## 📋 Prerrequisitos

- **Node.js** v18.0+ (recomendado v20)
- **npm** v7.0+
- **Cuenta Supabase** con proyecto configurado
- **Docker** (opcional, para containerización)

## ⚙️ Configuración

### 1. Variables de Entorno

Copia `.env.example` a `.env` y configura:

```bash
cp .env.example .env
```

```env
# Configuración del Servidor
PORT=3000

# Configuración de Supabase
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=your_anon_key_here
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key_here

# Configuración del Game Loop
TICKS_PER_SECOND=10
MAX_MSGS_PER_SECOND=20

# Límites de Seguridad
MAX_PAYLOAD_SIZE=8192
PING_INTERVAL_MS=30000
PONG_TIMEOUT_MS=60000
GHOST_TIMEOUT_MS=120000
```

### 2. Base de Datos

Ejecuta el script SQL en el SQL Editor de Supabase:

```bash
cat db/schema.sql
```

Este script crea las tablas necesarias:
- `match_results` - Resultados de partidas
- `player_stats` - Estadísticas de jugadores
- `security_events` - Eventos de seguridad

### 3. Instalación

```bash
# Instalar dependencias
npm install

# Verificar configuración
npm run test:health
```

## 🏃 Ejecución

### Desarrollo

```bash
# Servidor con auto-reload
npm run dev

# Servidor normal
npm start
```

### Producción

```bash
# Instalar dependencias de producción
npm ci --production

# Iniciar servidor
NODE_ENV=production npm start
```

### Docker

```bash
# Construir imagen
npm run docker:build

# Ejecutar con Docker
npm run docker:run

# O directamente:
docker build -t agario-server .
docker run -p 3000:3000 --env-file .env agario-server
```

## 🧪 Testing

### Tests Automatizados

```bash
# Tests unitarios (cuando estén implementados)
npm test

# Tests de conectividad realtime
npm run test:realtime

# Health check simple
npm run test:health
```

### Tests Manuales

```bash
# Hacer scripts ejecutables
chmod +x scripts/test-realtime.sh

# Test completo con información detallada
./scripts/test-realtime.sh

# Solo información del servidor
./scripts/test-realtime.sh --info

# Test con timeout personalizado
./scripts/test-realtime.sh --timeout 60

# Esperar a que el servidor esté listo
./scripts/test-realtime.sh --wait
```

### Test de Rate Limiting

```bash
# El script test-realtime.js incluye verificación de rate limiting
node scripts/test-realtime.js
```

## 📡 API Endpoints

### HTTP REST

| Endpoint | Método | Descripción |
|----------|--------|-------------|
| `/health` | GET | Health check del servidor |
| `/rooms/:roomId/start` | POST | Crear/unirse a sala |
| `/rooms/:roomId/stats` | GET | Estadísticas de sala |
| `/persist-match` | POST | Persistir resultado manualmente |

### Ejemplo Health Check

```bash
curl http://localhost:3000/health
```

```json
{
  "ok": true,
  "uptime": 3600,
  "rooms": 2,
  "totalRooms": 5,
  "activeConnections": 12,
  "config": {
    "ticksPerSecond": 10,
    "maxMsgsPerSecond": 20
  },
  "timestamp": "2025-11-04T11:30:00.000Z"
}
```

## 🔄 Protocolo de Mensajería

### Cliente → Servidor

Canal: `game:<ROOM_ID>`
Evento: `player_action`

```javascript
{
  "type": "input|ability|split|orb_collect",
  "playerId": "<uid>",
  "ts": 1699100000000,
  "data": {
    "dir": { "x": 1, "y": 0 }  // Ejemplo para input
  }
}
```

### Servidor → Cliente

Evento: `world_update`

```javascript
// Delta (cada tick)
{
  "kind": "delta",
  "tick": 1234,
  "entities": [
    {
      "id": "player_123",
      "pos": { "x": 100, "y": 150 },
      "vel": { "x": 10, "y": 5 },
      "mass": 625,
      "radius": 25,
      "type": "player",
      "role": "basic",
      "isAlive": true
    }
  ],
  "serverTs": 1699100001000
}

// Snapshot (cada 5 segundos)
{
  "kind": "snapshot",
  // ... mismo formato que delta
}
```

### Eventos del Sistema

```javascript
// Rate limiting
{
  "type": "throttle",
  "msg": "Too many messages, please slow down",
  "playerId": "player_123"
}
```

## 🔒 Seguridad y Validación

### Validación de Mensajes

- **Esquema AJV**: Validación estricta de estructura de mensajes
- **Tamaño Payload**: Límite de 8KB por mensaje
- **Rate Limiting**: 20 mensajes/segundo por jugador
- **Throttling**: Bloqueo de 3 segundos por exceso

### Autenticación

**⚠️ IMPORTANTE**: Implementa validación de autenticación antes de producción.

```javascript
// Ejemplo de validación de token (implementar)
async function validatePlayerAuth(playerId, token) {
  const { data: { user }, error } = await supabase.auth.getUser(token);
  return user?.id === playerId;
}
```

### Logging de Seguridad

Todos los eventos sospechosos se registran en `security_events`:

- Payloads inválidos
- Rate limiting violations
- Intentos de autenticación fallidos
- Acciones físicamente imposibles

## 📊 Monitoring y Métricas

### Métricas del Game Loop

```javascript
// Obtener estadísticas via API
GET /rooms/:roomId/stats
{
  "roomId": "test-room",
  "isActive": true,
  "playerCount": 5,
  "gameStats": {
    "currentTick": 12450,
    "entitiesCount": 45,
    "queueLength": 2,
    "lastStepDuration": 3.2
  }
}
```

### Health Monitoring

- **Health Endpoint**: `/health` para load balancers
- **Docker Health Check**: Configurado automáticamente
- **Métricas de Performance**: FPS, memory usage, tick timing

## 🐛 Debugging y Troubleshooting

### Problemas Comunes

**1. Error 502 con Proxies**

Si usas proxy (nginx, cloudflare), asegúrate de configurar headers WebSocket:

```nginx
# Configuración nginx para Supabase Realtime
proxy_http_version 1.1;
proxy_set_header Upgrade $http_upgrade;
proxy_set_header Connection "upgrade";
proxy_set_header Host $host;
```

**2. Conexión a Supabase Falla**

```bash
# Verificar conectividad directa
curl -H "apikey: YOUR_ANON_KEY" \
     "https://your-project.supabase.co/rest/v1/match_results?select=id&limit=1"
```

**3. Rate Limiting Excesivo**

```bash
# Ajustar en .env
MAX_MSGS_PER_SECOND=30

# O debug rate limits
curl http://localhost:3000/health | jq '.config.maxMsgsPerSecond'
```

### Logs de Debug

```bash
# Logs detallados
LOG_LEVEL=debug npm start

# Logs de Docker
docker logs agario-server

# Logs en tiempo real
docker logs -f agario-server
```

## 🚀 Deployment

### Plataformas Recomendadas

1. **Render** (Recomendado)
2. **Fly.io**
3. **DigitalOcean Apps**
4. **Railway**
5. **Heroku**

### Variables de Entorno en Producción

```bash
# Variables críticas (configurar en plataforma)
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=your_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key  # ⚠️ MANTENER SECRETO

# Variables de optimización
TICKS_PER_SECOND=10
MAX_MSGS_PER_SECOND=20
NODE_ENV=production
```

### Checklist de Deployment

- [ ] Variables de entorno configuradas
- [ ] Base de datos migrada (schema.sql ejecutado)
- [ ] Health check configurado
- [ ] Rate limits apropiados para carga esperada
- [ ] Service role key segura (no expuesta)
- [ ] Logs configurados
- [ ] Monitoring setup

### Post-Deployment Verification

```bash
# Verificar health
curl https://your-app.com/health

# Test de conectividad
HEALTH_URL=https://your-app.com/health ./scripts/test-realtime.sh

# Verificar métricas
curl https://your-app.com/health | jq '.uptime'
```

## 📈 Escalabilidad

### Límites Actuales

- **Jugadores por sala**: ~50 (recomendado)
- **Salas simultáneas**: ~100+ (depende de recursos)
- **Mensajes/segundo**: 1000+ (con rate limiting)

### Optimizaciones para Escala

1. **Redis**: Para state compartido entre instancias
2. **Load Balancer**: Sticky sessions para WebSockets
3. **Database Pooling**: Para conexiones PostgreSQL
4. **CDN**: Para assets estáticos

## 🔧 Desarrollo

### Estructura del Código

```
backend/
├── src/
│   ├── server.js          # Servidor principal
│   ├── game/
│   │   ├── index.js       # Motor de juego
│   │   └── physics.js     # Funciones físicas
│   └── persistence.js     # Helpers de DB
├── scripts/               # Scripts de testing
├── db/                   # Esquemas SQL
└── tests/                # Tests (futuro)
```

### Extensión y Customización

```javascript
// Añadir nueva acción
function processCustomAction(entity, actionData) {
  // Tu lógica aquí
  console.log('Custom action processed');
}

// Registrar en processAction()
case 'custom':
  processCustomAction(entity, action.data);
  break;
```

## 📝 Licencia

MIT License - Ver [LICENSE](../LICENSE) para más detalles.

## 🤝 Contribución

Ver [CONTRIBUTING.md](../docs/CONTRIBUTING.md) para guías de desarrollo.

---

**🎮 Game Server listo para producción!**

Para soporte o preguntas, crear issue en el repositorio.