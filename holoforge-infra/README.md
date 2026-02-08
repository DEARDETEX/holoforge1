# HoloForge 3D - Infrastructure

## Production-Grade SaaS Architecture

This repository contains the **infrastructure layer** for HoloForge 3D, a hologram generation and video export platform.

---

## 🏗 Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                            HOLOFORGE ARCHITECTURE                           │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│   ┌──────────────┐     ┌──────────────┐     ┌──────────────┐               │
│   │   Frontend   │────▶│   Backend    │────▶│   MongoDB    │               │
│   │   (Nginx)    │     │  (FastAPI)   │     │  (Database)  │               │
│   └──────────────┘     └──────────────┘     └──────────────┘               │
│         │                     │                                             │
│         │                     │                                             │
│         │              ┌──────┴──────┐                                      │
│         │              │   FFmpeg    │                                      │
│         │              │  (Bundled)  │                                      │
│         │              └─────────────┘                                      │
│         │                     │                                             │
│         │              ┌──────┴──────┐                                      │
│         │              │  Volumes    │                                      │
│         └─────────────▶│  (uploads,  │                                      │
│                        │   videos,   │                                      │
│                        │   exports)  │                                      │
│                        └─────────────┘                                      │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 📁 Directory Structure

```
holoforge/
├── src/                        # Application source code
│   ├── backend/                # FastAPI backend
│   └── frontend/               # React frontend
│
├── deploy/                     # Deployment configuration
│   ├── docker/                 # Dockerfiles
│   │   ├── base.build.Dockerfile     # Golden build image
│   │   ├── base.runtime.Dockerfile   # Golden runtime image
│   │   ├── backend.Dockerfile        # Backend multi-stage build
│   │   ├── frontend.Dockerfile       # Frontend multi-stage build
│   │   ├── entrypoint.sh             # Backend entrypoint script
│   │   └── nginx.conf                # Nginx configuration
│   │
│   ├── compose/               # Docker Compose files
│   │   ├── docker-compose.yml        # Production
│   │   └── docker-compose.dev.yml    # Development
│   │
│   └── k8s/                   # Kubernetes manifests (future)
│
├── configs/                   # Configuration templates
│   └── templates/
│       ├── backend.env.template
│       └── requirements.lock.txt
│
├── .dockerignore
├── .env.example
├── Makefile                   # Build automation
└── README.md
```

---

## 🚀 Quick Start

### Prerequisites

- Docker 24.0+
- Docker Compose 2.20+
- GNU Make (optional, for convenience)

### Development

```bash
# Clone repository
git clone https://github.com/DEARDETEX/holoforge1backup.git holoforge
cd holoforge

# Copy environment template
cp .env.example .env

# Start development environment
make dev

# Or without Make:
docker compose -f deploy/compose/docker-compose.dev.yml up --build
```

### Production

```bash
# Build all images
make build

# Start production stack
make prod

# Or manually:
docker compose -f deploy/compose/docker-compose.yml up -d
```

---

## 🔧 Configuration

### Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `MONGO_URL` | MongoDB connection string | **Required** |
| `DB_NAME` | Database name | `holoforge` |
| `SECRET_KEY` | JWT signing key | **Required in prod** |
| `LOG_LEVEL` | Logging verbosity | `INFO` |
| `REACT_APP_BACKEND_URL` | Backend API URL | - |

### Volumes

| Volume | Purpose | Container Path |
|--------|---------|----------------|
| `uploads_data` | 3D model uploads | `/app/uploads` |
| `videos_data` | Captured videos | `/app/videos` |
| `exports_data` | Exported files | `/app/exports` |
| `mongodb_data` | Database storage | `/data/db` |

---

## 🐳 Docker Images

### Base Images (Build Once)

```bash
# Build golden images
make build-base

# Images created:
# - holoforge/base:build-1.0.0   (compilation environment)
# - holoforge/base:runtime-1.0.0 (minimal runtime)
```

### Application Images

```bash
# Build application images
make build-backend
make build-frontend

# Images created:
# - holoforge/backend:latest
# - holoforge/frontend:latest
```

---

## 🔒 Security Considerations

### Image Security

- ✅ Multi-stage builds (no build tools in production)
- ✅ Non-root user execution
- ✅ Minimal base images (debian:slim)
- ✅ Explicit dependency versions (no `latest` tags)
- ✅ Health checks enabled

### Runtime Security

- ✅ Tini as init system (signal handling, zombie reaping)
- ✅ Read-only filesystem recommended
- ✅ Resource limits enforced
- ✅ Network isolation

### Secrets Management

- ❌ Do NOT commit `.env` files
- ✅ Use environment variables or secrets management
- ✅ Rotate secrets regularly

---

## 📊 Monitoring

### Health Checks

```bash
# Backend health
curl http://localhost:8000/api/health

# Frontend health
curl http://localhost:80/health
```

### Logs

```bash
# All logs
make dev-logs   # Development
make prod-logs  # Production

# Specific service
docker logs holoforge-backend -f
docker logs holoforge-frontend -f
```

---

## 🔄 CI/CD Integration

### GitHub Actions (Example)

```yaml
name: Build and Push

on:
  push:
    branches: [main]
    tags: ['v*']

jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      
      - name: Build images
        run: |
          make build-base
          make build
        env:
          VERSION: ${{ github.sha }}
          
      - name: Push to registry
        run: |
          docker push holoforge/backend:${{ github.sha }}
          docker push holoforge/frontend:${{ github.sha }}
```

---

## 📝 Maintenance

### Updating Dependencies

```bash
# Backend
pip-compile requirements.in -o requirements.lock.txt

# Frontend
cd src/frontend && yarn upgrade-interactive
```

### Cleaning Up

```bash
# Remove all containers and volumes
make clean

# Prune Docker system
docker system prune -af
```

---

## 🆘 Troubleshooting

### Common Issues

**1. FFmpeg not found**
```
Cause: Base image not built correctly
Fix: make build-base
```

**2. MongoDB connection refused**
```
Cause: MongoDB not ready yet
Fix: Check health with `docker compose ps`
```

**3. Frontend can't reach backend**
```
Cause: CORS or network issue
Fix: Check REACT_APP_BACKEND_URL and CORS_ORIGINS
```

### Debug Mode

```bash
# Run backend with debug
docker compose -f deploy/compose/docker-compose.dev.yml run backend python -m debugpy ...

# Shell access
make shell-backend
make shell-frontend
```

---

## 📜 License

Proprietary - HoloForge Platform

---

## 👥 Contributing

See CONTRIBUTING.md for development guidelines.
