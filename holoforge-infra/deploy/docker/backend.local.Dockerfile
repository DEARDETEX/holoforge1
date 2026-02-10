# ══════════════════════════════════════════════════════════════════════════════
# HOLOFORGE BACKEND - LOCAL DEVELOPMENT DOCKERFILE
# ══════════════════════════════════════════════════════════════════════════════
#
# PURPOSE:
#   Self-contained development image that requires NO pre-built base images
#   Designed for local development and CI validation
#
# KEY DIFFERENCES FROM PRODUCTION:
#   - Single stage (no multi-stage complexity)
#   - Includes development tools
#   - FFmpeg bundled directly
#   - Hot reload friendly
#
# USAGE:
#   Built automatically by docker-compose.local.yml
#
# ══════════════════════════════════════════════════════════════════════════════

FROM python:3.11-slim-bookworm

LABEL maintainer="holoforge-platform"
LABEL image.purpose="local-development"
LABEL image.service="backend"

# ─────────────────────────────────────────────────────────────────────────────
# Build Arguments
# ─────────────────────────────────────────────────────────────────────────────
ARG BUILD_ENV=local
ARG DEBIAN_FRONTEND=noninteractive

# ─────────────────────────────────────────────────────────────────────────────
# Environment Configuration
# ─────────────────────────────────────────────────────────────────────────────
ENV LANG=C.UTF-8 \
    LC_ALL=C.UTF-8 \
    TZ=UTC \
    PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PYTHONPATH=/app \
    PIP_NO_CACHE_DIR=1 \
    PIP_DISABLE_PIP_VERSION_CHECK=1

# ─────────────────────────────────────────────────────────────────────────────
# System Dependencies
# ─────────────────────────────────────────────────────────────────────────────
# CRITICAL: FFmpeg is bundled here - no external dependency
#
RUN apt-get update && apt-get install -y --no-install-recommends \
    # FFmpeg for video processing (CRITICAL)
    ffmpeg \
    # OpenCV runtime dependencies
    libgl1 \
    libglib2.0-0 \
    libsm6 \
    libxext6 \
    libxrender1 \
    # Networking tools (for health checks)
    curl \
    wget \
    # Security
    ca-certificates \
    && apt-get clean \
    && rm -rf /var/lib/apt/lists/* /tmp/* /var/tmp/*

# ─────────────────────────────────────────────────────────────────────────────
# Verify FFmpeg Installation
# ─────────────────────────────────────────────────────────────────────────────
RUN ffmpeg -version && echo "✓ FFmpeg installed successfully"

# ─────────────────────────────────────────────────────────────────────────────
# Python Dependencies
# ─────────────────────────────────────────────────────────────────────────────
WORKDIR /app

# Copy requirements first (Docker layer caching)
COPY src/backend/requirements.txt /tmp/requirements.txt

# Install Python dependencies
RUN pip install --upgrade pip setuptools wheel \
    && pip install -r /tmp/requirements.txt \
    && rm /tmp/requirements.txt

# ─────────────────────────────────────────────────────────────────────────────
# Application Setup
# ─────────────────────────────────────────────────────────────────────────────
# Create directories for runtime data
RUN mkdir -p /app/uploads /app/videos /app/exports

# Note: Source code is mounted at runtime via volume
# This allows hot reload without rebuilding

# ─────────────────────────────────────────────────────────────────────────────
# Runtime Configuration
# ─────────────────────────────────────────────────────────────────────────────
EXPOSE 8000
EXPOSE 5678

# Default command (can be overridden in compose)
CMD ["uvicorn", "server:app", "--host", "0.0.0.0", "--port", "8000", "--reload"]
