# Dockerfile para Agario Game Server
# Multi-stage build para optimización de tamaño

# Etapa 1: Build dependencies
FROM node:20-alpine AS dependencies

# Metadatos
LABEL maintainer="MiniMax Agent" \
      description="Agario Game Server with Supabase Realtime" \
      version="1.0.0"

# Instalar herramientas necesarias para compilación
RUN apk add --no-cache \
    dumb-init \
    curl \
    jq

# Crear directorio de trabajo
WORKDIR /app

# Copiar archivos de configuración de dependencias
COPY package*.json ./

# Instalar dependencias de producción
RUN npm ci --only=production --frozen-lockfile

# Limpiar cache de npm
RUN npm cache clean --force

# Etapa 2: Runtime
FROM node:20-alpine AS runtime

# Instalar herramientas runtime necesarias
RUN apk add --no-cache \
    dumb-init \
    curl \
    jq \
    && addgroup -g 1001 -S nodejs \
    && adduser -S agario -u 1001

# Establecer directorio de trabajo
WORKDIR /app

# Copiar dependencias desde etapa anterior
COPY --from=dependencies /app/node_modules ./node_modules

# Copiar código fuente
COPY --chown=agario:nodejs . .

# Crear directorios necesarios con permisos correctos
RUN mkdir -p /app/logs \
    && chown -R agario:nodejs /app

# Cambiar a usuario no-root
USER agario

# Variables de entorno por defecto
ENV NODE_ENV=production \
    PORT=3000 \
    TICKS_PER_SECOND=10 \
    MAX_MSGS_PER_SECOND=20 \
    MAX_PAYLOAD_SIZE=8192 \
    PING_INTERVAL_MS=30000 \
    PONG_TIMEOUT_MS=60000 \
    GHOST_TIMEOUT_MS=120000 \
    LOG_LEVEL=info

# Exponer puerto
EXPOSE $PORT

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD curl -f http://localhost:$PORT/health || exit 1

# Usar dumb-init como proceso principal para manejo correcto de señales
ENTRYPOINT ["dumb-init", "--"]

# Comando por defecto
CMD ["node", "src/server.js"]

# Metadata adicional
LABEL org.opencontainers.image.title="Agario Game Server" \
      org.opencontainers.image.description="Servidor autoritativo para juego Agario con Supabase Realtime y game loop a 10Hz" \
      org.opencontainers.image.version="1.0.0" \
      org.opencontainers.image.authors="MiniMax Agent" \
      org.opencontainers.image.source="https://github.com/your-repo/agario-game" \
      org.opencontainers.image.licenses="MIT"