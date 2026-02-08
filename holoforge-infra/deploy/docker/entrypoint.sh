#!/bin/sh
# ══════════════════════════════════════════════════════════════════════════════
# HOLOFORGE BACKEND ENTRYPOINT
# ══════════════════════════════════════════════════════════════════════════════
# Purpose: Runtime initialization wrapper
# - Environment variable injection
# - Configuration templating
# - Health checks
# - Signal forwarding (via exec)
# ══════════════════════════════════════════════════════════════════════════════

set -e

echo "════════════════════════════════════════════════════════════════"
echo "  HoloForge Backend Container Starting"
echo "════════════════════════════════════════════════════════════════"
echo "[$(date -Iseconds)] Bootstrapping container..."

# ─────────────────────────────────────────────────────────────────────────────
# Environment validation
# ─────────────────────────────────────────────────────────────────────────────
validate_env() {
    local missing=""
    
    # Required environment variables
    [ -z "$MONGO_URL" ] && missing="$missing MONGO_URL"
    [ -z "$DB_NAME" ] && missing="$missing DB_NAME"
    
    if [ -n "$missing" ]; then
        echo "[ERROR] Missing required environment variables:$missing"
        echo "[ERROR] Container cannot start without proper configuration"
        exit 1
    fi
    
    echo "[OK] Environment variables validated"
}

# ─────────────────────────────────────────────────────────────────────────────
# System dependency checks
# ─────────────────────────────────────────────────────────────────────────────
check_dependencies() {
    echo "[CHECK] Verifying system dependencies..."
    
    # FFmpeg check (CRITICAL for video processing)
    if ! command -v ffmpeg >/dev/null 2>&1; then
        echo "[ERROR] FFmpeg not found - video processing will fail"
        exit 1
    fi
    
    FFMPEG_VERSION=$(ffmpeg -version 2>&1 | head -1)
    echo "[OK] FFmpeg: $FFMPEG_VERSION"
    
    # Python check
    PYTHON_VERSION=$(python --version 2>&1)
    echo "[OK] Python: $PYTHON_VERSION"
}

# ─────────────────────────────────────────────────────────────────────────────
# Directory setup
# ─────────────────────────────────────────────────────────────────────────────
setup_directories() {
    echo "[CHECK] Ensuring runtime directories exist..."
    
    for dir in /app/uploads /app/videos /app/exports; do
        if [ ! -d "$dir" ]; then
            mkdir -p "$dir"
            echo "[CREATED] $dir"
        fi
    done
    
    echo "[OK] Runtime directories ready"
}

# ─────────────────────────────────────────────────────────────────────────────
# Configuration templating (if templates exist)
# ─────────────────────────────────────────────────────────────────────────────
apply_config_templates() {
    if [ -f "/configs/backend.env.template" ]; then
        echo "[CONFIG] Applying environment template..."
        
        # Check if envsubst is available
        if command -v envsubst >/dev/null 2>&1; then
            envsubst < /configs/backend.env.template > /app/.env
            echo "[OK] Environment configuration applied"
        else
            echo "[WARN] envsubst not available, skipping template processing"
        fi
    fi
}

# ─────────────────────────────────────────────────────────────────────────────
# Main execution
# ─────────────────────────────────────────────────────────────────────────────
main() {
    echo ""
    echo "[STEP 1/4] Validating environment..."
    validate_env
    
    echo ""
    echo "[STEP 2/4] Checking system dependencies..."
    check_dependencies
    
    echo ""
    echo "[STEP 3/4] Setting up directories..."
    setup_directories
    
    echo ""
    echo "[STEP 4/4] Applying configurations..."
    apply_config_templates
    
    echo ""
    echo "════════════════════════════════════════════════════════════════"
    echo "  Container Ready - Starting Application"
    echo "════════════════════════════════════════════════════════════════"
    echo "[$(date -Iseconds)] Executing: $@"
    echo ""
    
    # CRITICAL: exec replaces shell with application process
    # This ensures signal forwarding works correctly (SIGTERM, etc.)
    exec "$@"
}

main "$@"
