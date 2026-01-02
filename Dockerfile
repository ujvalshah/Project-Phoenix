# ================================================
# Project Nuggets - Production Dockerfile
# Multi-stage build for optimal image size and security
# ================================================

# ================================================
# STAGE 1: Build Frontend
# ================================================
FROM node:20-alpine AS frontend-build

WORKDIR /app

# Install dependencies first (better layer caching)
COPY package.json package-lock.json* ./
RUN npm ci --prefer-offline --no-audit --no-fund

# Copy source files
COPY . .

# Build frontend
RUN npm run build

# Verify build output exists
RUN test -d dist && echo "✓ Frontend build successful"

# ================================================
# STAGE 2: Production Runtime
# ================================================
FROM node:20-alpine AS runtime

WORKDIR /app

# Install dumb-init for proper signal handling
RUN apk add --no-cache dumb-init

# Security: Create non-root user
RUN addgroup -S appgroup && adduser -S appuser -G appgroup

# Set production environment
ENV NODE_ENV=production
ENV PORT=5000

# Install only production dependencies
COPY package.json package-lock.json* ./
RUN npm ci --only=production --prefer-offline --no-audit --no-fund && \
    npm cache clean --force

# Copy built frontend from stage 1
COPY --from=frontend-build /app/dist ./dist

# Copy server source (TypeScript compiled at runtime via tsx)
COPY server ./server
COPY tsconfig.json ./

# Copy env.example for reference
COPY env.example ./

# Change ownership to non-root user
RUN chown -R appuser:appgroup /app

# Health check
# Note: Uses wget as it's available in Alpine by default
HEALTHCHECK --interval=30s --timeout=10s --start-period=10s --retries=3 \
    CMD wget --no-verbose --tries=1 --spider http://localhost:5000/api/health || exit 1

# Expose port
EXPOSE 5000

# Switch to non-root user
USER appuser

# Use dumb-init to handle signals properly
# This ensures graceful shutdown works correctly
ENTRYPOINT ["dumb-init", "--"]

# Start server
# Using tsx for TypeScript execution
CMD ["node", "--import", "tsx", "server/src/index.ts"]




