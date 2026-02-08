# ══════════════════════════════════════════════════════════════════════════════
# HOLOFORGE - GOLDEN RUNTIME IMAGE
# ══════════════════════════════════════════════════════════════════════════════
# Purpose: Minimal runtime environment - NO build tools
# Contains: Only what's needed to RUN the application
# Security: Minimal attack surface, non-root user, read-only recommended
# ══════════════════════════════════════════════════════════════════════════════

FROM debian:12.4-slim

LABEL maintainer="holoforge-platform <devops@holoforge.io>"
LABEL org.opencontainers.image.title="HoloForge Runtime Base"
LABEL org.opencontainers.image.description="Minimal runtime environment for HoloForge services"
LABEL org.opencontainers.image.version="1.0.0"
LABEL image.role="runtime"
LABEL image.type="base"

# ─────────────────────────────────────────────────────────────────────────────
# System configuration
# ─────────────────────────────────────────────────────────────────────────────
ENV LANG=C.UTF-8
ENV LC_ALL=C.UTF-8
ENV TZ=UTC
ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1

# ─────────────────────────────────────────────────────────────────────────────
# Install ONLY runtime dependencies
# Rationale: Absolute minimum for application execution
# ─────────────────────────────────────────────────────────────────────────────
RUN apt-get update && apt-get install -y --no-install-recommends \
    # Python runtime (NO dev packages)
    python3.11 \
    python3-pip \
    # FFmpeg runtime (CRITICAL for video processing)
    ffmpeg \
    # OpenCV runtime deps
    libgl1 \
    libglib2.0-0 \
    libsm6 \
    libxext6 \
    libxrender1 \
    # Process management
    tini \
    # Security
    ca-certificates \
    && apt-get clean \
    && rm -rf /var/lib/apt/lists/* /tmp/* /var/tmp/*

# ─────────────────────────────────────────────────────────────────────────────
# Python configuration
# ─────────────────────────────────────────────────────────────────────────────
RUN update-alternatives --install /usr/bin/python python /usr/bin/python3.11 1 \
    && update-alternatives --install /usr/bin/python3 python3 /usr/bin/python3.11 1

# ─────────────────────────────────────────────────────────────────────────────
# Security: Create non-root user
# ─────────────────────────────────────────────────────────────────────────────
RUN groupadd --gid 10001 appgroup \
    && useradd --create-home --uid 10001 --gid appgroup --shell /bin/bash appuser

# ─────────────────────────────────────────────────────────────────────────────
# Tini as init system (handles zombie processes, signal forwarding)
# ─────────────────────────────────────────────────────────────────────────────
ENTRYPOINT ["/usr/bin/tini", "--"]

# Default to non-root user
USER appuser
WORKDIR /app
