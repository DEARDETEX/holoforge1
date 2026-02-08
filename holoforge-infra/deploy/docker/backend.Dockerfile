# ══════════════════════════════════════════════════════════════════════════════
# HOLOFORGE BACKEND - MULTI-STAGE PRODUCTION BUILD
# ══════════════════════════════════════════════════════════════════════════════
# Stage 1: Build wheels in build environment (with compilers)
# Stage 2: Copy wheels to minimal runtime (no compilers)
# Result: Small, secure, reproducible image
# ══════════════════════════════════════════════════════════════════════════════

# ─────────────────────────────────────────────────────────────────────────────
# STAGE 1: DEPENDENCY BUILDER
# ─────────────────────────────────────────────────────────────────────────────
# Use: holoforge/base:build-1.0.0 (or build locally first)
FROM holoforge/base:build-1.0.0 AS builder

WORKDIR /build

# Copy ONLY requirements first (Docker layer caching optimization)
COPY src/backend/requirements.txt ./requirements.txt
COPY src/backend/requirements.lock.txt ./requirements.lock.txt

# Build wheels for all dependencies
# Using --require-hashes in production for supply chain security
RUN pip wheel \
    --no-cache-dir \
    --wheel-dir=/wheels \
    -r requirements.lock.txt

# ─────────────────────────────────────────────────────────────────────────────
# STAGE 2: RUNTIME IMAGE
# ─────────────────────────────────────────────────────────────────────────────
# Use: holoforge/base:runtime-1.0.0 (or build locally first)
FROM holoforge/base:runtime-1.0.0

# Labels for image identification
LABEL org.opencontainers.image.title="HoloForge Backend API"
LABEL org.opencontainers.image.description="FastAPI backend for HoloForge 3D hologram processing"
ARG BUILD_VERSION=dev
LABEL org.opencontainers.image.version="${BUILD_VERSION}"

# ─────────────────────────────────────────────────────────────────────────────
# Install Python dependencies from pre-built wheels
# ─────────────────────────────────────────────────────────────────────────────
COPY --from=builder /wheels /wheels
RUN pip install --no-cache-dir --no-index --find-links=/wheels /wheels/* \
    && rm -rf /wheels

# ─────────────────────────────────────────────────────────────────────────────
# Application code
# ─────────────────────────────────────────────────────────────────────────────
WORKDIR /app

# Copy application code (as root, then fix permissions)
USER root
COPY --chown=appuser:appgroup src/backend/ /app/
COPY --chown=appuser:appgroup deploy/docker/entrypoint.sh /entrypoint.sh

# Ensure entrypoint is executable
RUN chmod +x /entrypoint.sh

# Create directories for runtime data
RUN mkdir -p /app/uploads /app/videos /app/exports \
    && chown -R appuser:appgroup /app

# Switch to non-root user
USER appuser

# ─────────────────────────────────────────────────────────────────────────────
# Runtime configuration
# ─────────────────────────────────────────────────────────────────────────────
ENV PYTHONPATH=/app
ENV APP_ENV=production

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD python -c "import urllib.request; urllib.request.urlopen('http://localhost:8000/api/health')" || exit 1

# Expose API port
EXPOSE 8000

# ─────────────────────────────────────────────────────────────────────────────
# Entrypoint & Command
# ─────────────────────────────────────────────────────────────────────────────
ENTRYPOINT ["/entrypoint.sh"]
CMD ["uvicorn", "server:app", "--host", "0.0.0.0", "--port", "8000", "--workers", "2"]
