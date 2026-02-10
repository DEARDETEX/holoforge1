# ══════════════════════════════════════════════════════════════════════════════
# HOLOFORGE - UNIFIED BUILD & ORCHESTRATION SYSTEM
# ══════════════════════════════════════════════════════════════════════════════
#
# SINGLE COMMAND WORKFLOWS:
#   make local          → Start frontend + backend together (RECOMMENDED)
#   make local-build    → Rebuild and start
#   make local-stop     → Stop everything
#
# This Makefile is the ONLY interface developers need.
# No scripts. No manual steps. No host runtime dependencies.
#
# ══════════════════════════════════════════════════════════════════════════════

.PHONY: help local local-build local-stop local-logs local-clean \
        build build-base build-backend build-frontend \
        prod prod-stop prod-logs \
        test lint shell-backend shell-frontend status

# ─────────────────────────────────────────────────────────────────────────────
# CONFIGURATION
# ─────────────────────────────────────────────────────────────────────────────
REGISTRY ?= holoforge
VERSION ?= $(shell git describe --tags --always --dirty 2>/dev/null || echo "dev")

# Compose file paths (relative to Makefile location)
COMPOSE_LOCAL = docker compose -f deploy/compose/docker-compose.local.yml
COMPOSE_DEV   = docker compose -f deploy/compose/docker-compose.dev.yml
COMPOSE_PROD  = docker compose -f deploy/compose/docker-compose.yml

# Terminal colors
GREEN  := $(shell tput -Txterm setaf 2 2>/dev/null || echo "")
YELLOW := $(shell tput -Txterm setaf 3 2>/dev/null || echo "")
CYAN   := $(shell tput -Txterm setaf 6 2>/dev/null || echo "")
RED    := $(shell tput -Txterm setaf 1 2>/dev/null || echo "")
RESET  := $(shell tput -Txterm sgr0 2>/dev/null || echo "")

# ═══════════════════════════════════════════════════════════════════════════════
# HELP
# ═══════════════════════════════════════════════════════════════════════════════
help: ## Show this help
	@echo ''
	@echo '${CYAN}╔═══════════════════════════════════════════════════════════════╗${RESET}'
	@echo '${CYAN}║           HOLOFORGE UNIFIED BUILD SYSTEM                      ║${RESET}'
	@echo '${CYAN}╚═══════════════════════════════════════════════════════════════╝${RESET}'
	@echo ''
	@echo '${GREEN}QUICK START:${RESET}'
	@echo '  ${YELLOW}make local${RESET}        Start frontend + backend together'
	@echo ''
	@echo '${GREEN}ALL COMMANDS:${RESET}'
	@awk 'BEGIN {FS = ":.*?## "} /^[a-zA-Z_-]+:.*?## / {printf "  ${YELLOW}%-18s${RESET} %s\n", $$1, $$2}' $(MAKEFILE_LIST)
	@echo ''
	@echo '${GREEN}ARCHITECTURE:${RESET}'
	@echo '  Frontend: http://localhost:3000 (React dev server)'
	@echo '  Backend:  http://localhost:8000 (FastAPI)'
	@echo '  Network:  Docker internal DNS (service discovery)'
	@echo ''

# ═══════════════════════════════════════════════════════════════════════════════
# LOCAL DEVELOPMENT (UNIFIED ORCHESTRATION)
# ═══════════════════════════════════════════════════════════════════════════════

local: ## 🚀 Start frontend + backend together (RECOMMENDED)
	@echo ''
	@echo '${CYAN}╔═══════════════════════════════════════════════════════════════╗${RESET}'
	@echo '${CYAN}║         STARTING HOLOFORGE LOCAL ENVIRONMENT                  ║${RESET}'
	@echo '${CYAN}╚═══════════════════════════════════════════════════════════════╝${RESET}'
	@echo ''
	@echo '${GREEN}Services:${RESET}'
	@echo '  • Backend (FastAPI):  http://localhost:8000'
	@echo '  • Frontend (React):   http://localhost:3000'
	@echo ''
	@echo '${YELLOW}Starting services...${RESET}'
	@echo ''
	$(COMPOSE_LOCAL) up

local-build: ## 🔨 Rebuild images and start (use after Dockerfile changes)
	@echo '${CYAN}Rebuilding and starting services...${RESET}'
	$(COMPOSE_LOCAL) up --build

local-detach: ## 🚀 Start in background (detached mode)
	@echo '${CYAN}Starting services in background...${RESET}'
	$(COMPOSE_LOCAL) up -d
	@echo ''
	@echo '${GREEN}Services started in background.${RESET}'
	@echo 'Use ${YELLOW}make local-logs${RESET} to view logs'
	@echo 'Use ${YELLOW}make local-stop${RESET} to stop'

local-stop: ## 🛑 Stop all local services
	@echo '${CYAN}Stopping services...${RESET}'
	$(COMPOSE_LOCAL) down
	@echo '${GREEN}Services stopped.${RESET}'

local-logs: ## 📋 View logs (all services)
	$(COMPOSE_LOCAL) logs -f

local-logs-backend: ## 📋 View backend logs only
	$(COMPOSE_LOCAL) logs -f backend

local-logs-frontend: ## 📋 View frontend logs only
	$(COMPOSE_LOCAL) logs -f frontend

local-restart: ## 🔄 Restart all services
	@echo '${CYAN}Restarting services...${RESET}'
	$(COMPOSE_LOCAL) restart

local-clean: ## 🧹 Stop and remove volumes (DESTRUCTIVE)
	@echo '${RED}WARNING: This will delete all local data (uploads, videos, exports)${RESET}'
	@read -p "Are you sure? [y/N] " confirm && [ "$$confirm" = "y" ]
	$(COMPOSE_LOCAL) down -v
	@echo '${GREEN}Cleaned.${RESET}'

# ═══════════════════════════════════════════════════════════════════════════════
# STATUS & DEBUGGING
# ═══════════════════════════════════════════════════════════════════════════════

status: ## 📊 Show service status
	@echo '${CYAN}Service Status:${RESET}'
	@echo ''
	$(COMPOSE_LOCAL) ps
	@echo ''
	@echo '${CYAN}Health Checks:${RESET}'
	@echo ''
	@curl -s http://localhost:8000/api/health 2>/dev/null && echo ' ✓ Backend healthy' || echo ' ✗ Backend not responding'
	@curl -s http://localhost:3000 2>/dev/null | head -c 100 && echo ' ✓ Frontend healthy' || echo ' ✗ Frontend not responding'
	@echo ''

shell-backend: ## 🐚 Open shell in backend container
	$(COMPOSE_LOCAL) exec backend /bin/bash

shell-frontend: ## 🐚 Open shell in frontend container
	$(COMPOSE_LOCAL) exec frontend /bin/sh

# ═══════════════════════════════════════════════════════════════════════════════
# PRODUCTION BUILDS
# ═══════════════════════════════════════════════════════════════════════════════

build: build-base build-backend build-frontend ## 🏗️  Build all production images

build-base: ## Build golden base images
	@echo '${CYAN}Building base images...${RESET}'
	docker build -t $(REGISTRY)/base:build-1.0.0 -f deploy/docker/base.build.Dockerfile .
	docker build -t $(REGISTRY)/base:runtime-1.0.0 -f deploy/docker/base.runtime.Dockerfile .

build-backend: ## Build backend production image
	@echo '${CYAN}Building backend image...${RESET}'
	docker build \
		-t $(REGISTRY)/backend:$(VERSION) \
		-t $(REGISTRY)/backend:latest \
		--build-arg BUILD_VERSION=$(VERSION) \
		-f deploy/docker/backend.Dockerfile .

build-frontend: ## Build frontend production image
	@echo '${CYAN}Building frontend image...${RESET}'
	docker build \
		-t $(REGISTRY)/frontend:$(VERSION) \
		-t $(REGISTRY)/frontend:latest \
		--build-arg BUILD_VERSION=$(VERSION) \
		-f deploy/docker/frontend.Dockerfile .

# ═══════════════════════════════════════════════════════════════════════════════
# PRODUCTION DEPLOYMENT
# ═══════════════════════════════════════════════════════════════════════════════

prod: ## Start production stack
	@echo '${CYAN}Starting production environment...${RESET}'
	$(COMPOSE_PROD) up -d

prod-stop: ## Stop production stack
	$(COMPOSE_PROD) down

prod-logs: ## View production logs
	$(COMPOSE_PROD) logs -f

# ═══════════════════════════════════════════════════════════════════════════════
# QUALITY
# ═══════════════════════════════════════════════════════════════════════════════

test: ## 🧪 Run tests
	@echo '${CYAN}Running backend tests...${RESET}'
	$(COMPOSE_LOCAL) exec backend pytest tests/ -v || true

lint: ## 🔍 Run linters
	@echo '${CYAN}Linting backend...${RESET}'
	$(COMPOSE_LOCAL) exec backend python -m ruff check /app || true

# ═══════════════════════════════════════════════════════════════════════════════
# UTILITIES
# ═══════════════════════════════════════════════════════════════════════════════

version: ## Show version info
	@echo 'Version: $(VERSION)'
	@echo 'Registry: $(REGISTRY)'

clean-all: ## 🧹 Remove ALL Docker resources (VERY DESTRUCTIVE)
	@echo '${RED}WARNING: This will remove all HoloForge containers, images, and volumes${RESET}'
	@read -p "Are you sure? [y/N] " confirm && [ "$$confirm" = "y" ]
	$(COMPOSE_LOCAL) down -v 2>/dev/null || true
	$(COMPOSE_PROD) down -v 2>/dev/null || true
	docker images | grep holoforge | awk '{print $$3}' | xargs -r docker rmi -f
	@echo '${GREEN}All cleaned.${RESET}'
