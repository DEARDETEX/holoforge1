# ══════════════════════════════════════════════════════════════════════════════
# HOLOFORGE - MAKEFILE
# ══════════════════════════════════════════════════════════════════════════════
# Production-grade build automation
# 
# Usage:
#   make help          - Show available commands
#   make build         - Build all images
#   make dev           - Start development environment
#   make prod          - Start production environment
#   make clean         - Remove all containers and volumes
# ══════════════════════════════════════════════════════════════════════════════

.PHONY: help build build-base build-backend build-frontend dev prod stop clean test lint

# Configuration
REGISTRY ?= holoforge
VERSION ?= $(shell git describe --tags --always --dirty 2>/dev/null || echo "dev")
COMPOSE_DEV = docker compose -f deploy/compose/docker-compose.dev.yml
COMPOSE_PROD = docker compose -f deploy/compose/docker-compose.yml

# Colors for output
GREEN  := $(shell tput -Txterm setaf 2)
YELLOW := $(shell tput -Txterm setaf 3)
CYAN   := $(shell tput -Txterm setaf 6)
RESET  := $(shell tput -Txterm sgr0)

# ═══════════════════════════════════════════════════════════════════════════════
# HELP
# ═══════════════════════════════════════════════════════════════════════════════
help: ## Show this help
	@echo ''
	@echo '${CYAN}HoloForge Build System${RESET}'
	@echo ''
	@echo 'Usage:'
	@echo '  ${YELLOW}make${RESET} ${GREEN}<target>${RESET}'
	@echo ''
	@echo 'Targets:'
	@awk 'BEGIN {FS = ":.*?## "} /^[a-zA-Z_-]+:.*?## / {printf "  ${YELLOW}%-15s${RESET} %s\n", $$1, $$2}' $(MAKEFILE_LIST)

# ═══════════════════════════════════════════════════════════════════════════════
# BUILD TARGETS
# ═══════════════════════════════════════════════════════════════════════════════
build: build-base build-backend build-frontend ## Build all images

build-base: ## Build base images (build + runtime)
	@echo "${CYAN}Building base build image...${RESET}"
	docker build \
		-t $(REGISTRY)/base:build-1.0.0 \
		-f deploy/docker/base.build.Dockerfile .
	@echo "${CYAN}Building base runtime image...${RESET}"
	docker build \
		-t $(REGISTRY)/base:runtime-1.0.0 \
		-f deploy/docker/base.runtime.Dockerfile .

build-backend: ## Build backend image
	@echo "${CYAN}Building backend image...${RESET}"
	docker build \
		-t $(REGISTRY)/backend:$(VERSION) \
		-t $(REGISTRY)/backend:latest \
		--build-arg BUILD_VERSION=$(VERSION) \
		-f deploy/docker/backend.Dockerfile .

build-frontend: ## Build frontend image
	@echo "${CYAN}Building frontend image...${RESET}"
	docker build \
		-t $(REGISTRY)/frontend:$(VERSION) \
		-t $(REGISTRY)/frontend:latest \
		--build-arg BUILD_VERSION=$(VERSION) \
		--build-arg REACT_APP_BACKEND_URL=$(REACT_APP_BACKEND_URL) \
		-f deploy/docker/frontend.Dockerfile .

# ═══════════════════════════════════════════════════════════════════════════════
# DEVELOPMENT
# ═══════════════════════════════════════════════════════════════════════════════
dev: ## Start development environment
	@echo "${GREEN}Starting development environment...${RESET}"
	$(COMPOSE_DEV) up --build

dev-detach: ## Start development environment (detached)
	@echo "${GREEN}Starting development environment (detached)...${RESET}"
	$(COMPOSE_DEV) up -d --build

dev-logs: ## View development logs
	$(COMPOSE_DEV) logs -f

dev-stop: ## Stop development environment
	$(COMPOSE_DEV) down

# ═══════════════════════════════════════════════════════════════════════════════
# PRODUCTION
# ═══════════════════════════════════════════════════════════════════════════════
prod: ## Start production environment
	@echo "${GREEN}Starting production environment...${RESET}"
	$(COMPOSE_PROD) up -d

prod-logs: ## View production logs
	$(COMPOSE_PROD) logs -f

prod-stop: ## Stop production environment
	$(COMPOSE_PROD) down

# ═══════════════════════════════════════════════════════════════════════════════
# CLEANUP
# ═══════════════════════════════════════════════════════════════════════════════
stop: ## Stop all environments
	$(COMPOSE_DEV) down 2>/dev/null || true
	$(COMPOSE_PROD) down 2>/dev/null || true

clean: stop ## Remove all containers, volumes, and images
	@echo "${YELLOW}Removing all HoloForge containers and volumes...${RESET}"
	docker volume rm $$(docker volume ls -q | grep holoforge) 2>/dev/null || true
	docker rmi $$(docker images | grep holoforge | awk '{print $$3}') 2>/dev/null || true
	@echo "${GREEN}Cleanup complete${RESET}"

# ═══════════════════════════════════════════════════════════════════════════════
# TESTING & QUALITY
# ═══════════════════════════════════════════════════════════════════════════════
test: ## Run tests
	@echo "${CYAN}Running backend tests...${RESET}"
	docker run --rm $(REGISTRY)/backend:$(VERSION) pytest tests/ -v

lint: ## Run linters
	@echo "${CYAN}Running backend linter...${RESET}"
	docker run --rm -v $(PWD)/src/backend:/app $(REGISTRY)/base:build-1.0.0 \
		sh -c "pip install ruff && ruff check /app"

# ═══════════════════════════════════════════════════════════════════════════════
# UTILITIES
# ═══════════════════════════════════════════════════════════════════════════════
shell-backend: ## Open shell in backend container
	$(COMPOSE_DEV) exec backend /bin/bash

shell-frontend: ## Open shell in frontend container
	$(COMPOSE_DEV) exec frontend /bin/sh

db-shell: ## Open MongoDB shell
	$(COMPOSE_DEV) exec mongodb mongosh

version: ## Show current version
	@echo "Version: $(VERSION)"
