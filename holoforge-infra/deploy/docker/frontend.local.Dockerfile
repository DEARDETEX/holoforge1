# ══════════════════════════════════════════════════════════════════════════════
# HOLOFORGE FRONTEND - LOCAL DEVELOPMENT DOCKERFILE
# ══════════════════════════════════════════════════════════════════════════════
#
# PURPOSE:
#   Self-contained React development environment
#   Zero host Node.js dependency
#   Hot reload enabled
#
# KEY DESIGN DECISIONS:
#   - Uses official Node image (pinned version)
#   - Yarn for package management (faster, more reliable)
#   - node_modules as anonymous volume (prevents host conflicts)
#   - Corepack for consistent Yarn version
#
# USAGE:
#   Built automatically by docker-compose.local.yml
#
# ══════════════════════════════════════════════════════════════════════════════

FROM node:20.11.1-bookworm-slim

LABEL maintainer="holoforge-platform"
LABEL image.purpose="local-development"
LABEL image.service="frontend"

# ─────────────────────────────────────────────────────────────────────────────
# Build Arguments
# ─────────────────────────────────────────────────────────────────────────────
ARG BUILD_ENV=local

# ─────────────────────────────────────────────────────────────────────────────
# Environment Configuration
# ─────────────────────────────────────────────────────────────────────────────
ENV NODE_ENV=development \
    LANG=C.UTF-8 \
    # Disable telemetry
    NEXT_TELEMETRY_DISABLED=1 \
    # Yarn configuration
    YARN_ENABLE_TELEMETRY=false

# ─────────────────────────────────────────────────────────────────────────────
# System Dependencies
# ─────────────────────────────────────────────────────────────────────────────
RUN apt-get update && apt-get install -y --no-install-recommends \
    # Health check tools
    wget \
    curl \
    # Git (for some npm packages)
    git \
    && apt-get clean \
    && rm -rf /var/lib/apt/lists/*

# ─────────────────────────────────────────────────────────────────────────────
# Enable Corepack (Yarn version manager)
# ─────────────────────────────────────────────────────────────────────────────
RUN corepack enable && corepack prepare yarn@4.1.0 --activate

# ─────────────────────────────────────────────────────────────────────────────
# Application Setup
# ─────────────────────────────────────────────────────────────────────────────
WORKDIR /app

# Copy package files first (Docker layer caching)
COPY src/frontend/package.json src/frontend/yarn.lock ./

# Install dependencies
# Note: node_modules will be overridden by anonymous volume at runtime
# This is intentional - it prevents host/container mismatch issues
RUN yarn install

# ─────────────────────────────────────────────────────────────────────────────
# Runtime Configuration
# ─────────────────────────────────────────────────────────────────────────────
EXPOSE 3000

# Health check script
HEALTHCHECK --interval=10s --timeout=5s --start-period=60s --retries=3 \
    CMD wget --no-verbose --tries=1 --spider http://localhost:3000 || exit 1

# ─────────────────────────────────────────────────────────────────────────────
# Entrypoint
# ─────────────────────────────────────────────────────────────────────────────
# Install dependencies on startup (ensures they're in the anonymous volume)
# Then start the development server
CMD ["sh", "-c", "yarn install && yarn start"]
