# ══════════════════════════════════════════════════════════════════════════════
# HOLOFORGE FRONTEND - MULTI-STAGE PRODUCTION BUILD
# ══════════════════════════════════════════════════════════════════════════════
# Stage 1: Build React app with Node.js
# Stage 2: Serve static files with Nginx (NO Node.js in production)
# Result: Tiny, fast, secure image serving only static assets
# ══════════════════════════════════════════════════════════════════════════════

# ─────────────────────────────────────────────────────────────────────────────
# STAGE 1: BUILD REACT APPLICATION
# ─────────────────────────────────────────────────────────────────────────────
FROM node:20.11.1-bookworm-slim AS builder

WORKDIR /build

# Enable corepack for consistent yarn version
RUN corepack enable && corepack prepare yarn@4.1.0 --activate

# Copy dependency files first (Docker layer caching)
COPY src/frontend/package.json src/frontend/yarn.lock ./

# Install dependencies with frozen lockfile (reproducible)
RUN yarn install --immutable

# Copy source code
COPY src/frontend/ ./

# Build arguments for environment configuration
ARG REACT_APP_BACKEND_URL
ARG REACT_APP_ENV=production
ARG BUILD_VERSION=dev

ENV REACT_APP_BACKEND_URL=${REACT_APP_BACKEND_URL}
ENV REACT_APP_ENV=${REACT_APP_ENV}
ENV REACT_APP_VERSION=${BUILD_VERSION}
ENV NODE_ENV=production
ENV GENERATE_SOURCEMAP=false

# Build production bundle
RUN yarn build

# ─────────────────────────────────────────────────────────────────────────────
# STAGE 2: NGINX RUNTIME
# ─────────────────────────────────────────────────────────────────────────────
FROM nginx:1.25.4-alpine

LABEL org.opencontainers.image.title="HoloForge Frontend"
LABEL org.opencontainers.image.description="React frontend for HoloForge 3D hologram platform"
ARG BUILD_VERSION=dev
LABEL org.opencontainers.image.version="${BUILD_VERSION}"

# ─────────────────────────────────────────────────────────────────────────────
# Security hardening
# ─────────────────────────────────────────────────────────────────────────────
# Remove default config
RUN rm -rf /etc/nginx/conf.d/default.conf /usr/share/nginx/html/*

# Create non-root user for nginx
RUN addgroup -g 10001 -S appgroup \
    && adduser -u 10001 -S appuser -G appgroup

# ─────────────────────────────────────────────────────────────────────────────
# Copy built assets and nginx config
# ─────────────────────────────────────────────────────────────────────────────
COPY --from=builder /build/build /usr/share/nginx/html
COPY deploy/docker/nginx.conf /etc/nginx/nginx.conf

# Set correct permissions
RUN chown -R appuser:appgroup /usr/share/nginx/html \
    && chown -R appuser:appgroup /var/cache/nginx \
    && chown -R appuser:appgroup /var/log/nginx \
    && touch /var/run/nginx.pid \
    && chown appuser:appgroup /var/run/nginx.pid

# ─────────────────────────────────────────────────────────────────────────────
# Health check
# ─────────────────────────────────────────────────────────────────────────────
HEALTHCHECK --interval=30s --timeout=5s --start-period=5s --retries=3 \
    CMD wget --no-verbose --tries=1 --spider http://localhost:80/ || exit 1

# Expose HTTP port
EXPOSE 80

# Run as non-root
USER appuser

CMD ["nginx", "-g", "daemon off;"]
