# --- Stage 1: Build the frontend ---
FROM node:20-alpine AS frontend-builder
WORKDIR /app/frontend

COPY frontend/package*.json ./
RUN npm ci --prefer-offline

COPY frontend/ ./
RUN npm run build

# --- Stage 2: Setup the backend ---
FROM node:20-alpine AS backend-builder
WORKDIR /app/backend

COPY backend/package*.json ./
RUN npm ci --prefer-offline --omit=dev

COPY backend/ ./

# --- Stage 3: Final Production Image ---
FROM node:20-alpine
WORKDIR /app

# Security: run as non-root
RUN addgroup -g 1001 -S appgroup && adduser -S appuser -u 1001 -G appgroup

# Copy backend
COPY --from=backend-builder /app/backend /app/backend
# Copy frontend static export
COPY --from=frontend-builder /app/frontend/out /app/frontend/out
# Copy shared prompts
COPY shared /app/shared

# Set ownership
RUN chown -R appuser:appgroup /app

USER appuser
WORKDIR /app/backend

ENV NODE_ENV=production
ENV PORT=8080
EXPOSE 8080

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s \
  CMD wget --no-verbose --tries=1 --spider http://localhost:8080/api/health || exit 1

CMD ["node", "index.js"]
