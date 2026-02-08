# ══════════════════════════════════════════════════════════════════════════════
# HOLOFORGE - GOLDEN BUILD IMAGE
# ══════════════════════════════════════════════════════════════════════════════
# Purpose: Compilation environment ONLY - never runs in production
# Contains: Build tools, compilers, dev headers
# Security: Not exposed to runtime - attack surface eliminated after build
# ══════════════════════════════════════════════════════════════════════════════

FROM debian:12.4-slim

LABEL maintainer="holoforge-platform <devops@holoforge.io>"
LABEL org.opencontainers.image.title="HoloForge Build Base"
LABEL org.opencontainers.image.description="Build environment for HoloForge services"
LABEL org.opencontainers.image.version="1.0.0"
LABEL image.role="build"
LABEL image.type="base"

# ─────────────────────────────────────────────────────────────────────────────
# System configuration
# ─────────────────────────────────────────────────────────────────────────────
ENV LANG=C.UTF-8
ENV LC_ALL=C.UTF-8
ENV TZ=UTC
ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1
ENV PIP_NO_CACHE_DIR=1
ENV PIP_DISABLE_PIP_VERSION_CHECK=1

# ─────────────────────────────────────────────────────────────────────────────
# Install build dependencies
# Rationale: These are needed for pip wheel compilation but NOT for runtime
# ─────────────────────────────────────────────────────────────────────────────
RUN apt-get update && apt-get install -y --no-install-recommends \
    # Core build tools
    build-essential \
    gcc \
    g++ \
    make \
    pkg-config \
    # Python build deps
    python3.11 \
    python3.11-dev \
    python3.11-venv \
    python3-pip \
    # FFmpeg (for imageio-ffmpeg wheel building)
    ffmpeg \
    libavcodec-dev \
    libavformat-dev \
    libswscale-dev \
    # OpenCV deps
    libgl1 \
    libglib2.0-0 \
    libsm6 \
    libxext6 \
    libxrender1 \
    # Networking
    curl \
    ca-certificates \
    git \
    && apt-get clean \
    && rm -rf /var/lib/apt/lists/* /tmp/* /var/tmp/*

# ─────────────────────────────────────────────────────────────────────────────
# Security: Create non-root user for build operations
# ─────────────────────────────────────────────────────────────────────────────
RUN useradd --create-home --uid 10001 --shell /bin/bash appuser

# ─────────────────────────────────────────────────────────────────────────────
# Python configuration
# ─────────────────────────────────────────────────────────────────────────────
RUN update-alternatives --install /usr/bin/python python /usr/bin/python3.11 1 \
    && update-alternatives --install /usr/bin/python3 python3 /usr/bin/python3.11 1 \
    && python -m pip install --upgrade pip==24.0 setuptools==69.1.0 wheel==0.42.0

WORKDIR /build
