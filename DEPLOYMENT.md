# Docker Deployment Guide

## Overview
This application consists of a Go backend API and Next.js frontend, containerized for deployment on RHEL8 using Docker and Docker Compose.

## Prerequisites
- Docker 20.10+
- Docker Compose 2.0+
- RHEL8 system with SELinux configured appropriately

## Quick Start

### Development Mode
```bash
# Clone and navigate to project
git clone <repository-url>
cd bpo_provider_validation_ui

# Copy environment file
cp .env.example .env

# Build and start services
docker-compose up --build
```

Access:
- Frontend: http://localhost:3000
- Backend API: http://localhost:8080

### Production Mode
```bash
# Use production compose file
docker-compose -f docker-compose.prod.yml up -d --build

# Check service status
docker-compose -f docker-compose.prod.yml ps
```

Access:
- Application: http://localhost (via Nginx)

## Architecture

### Services
- **Backend**: Go API server (port 8080)
- **Frontend**: Next.js application (port 3000)
- **Nginx**: Reverse proxy (port 80, production only)

### Volumes
- `data`: Persistent SQLite database storage
- `migrations`: Database migration files

### Networks
- `bpo-network`: Internal bridge network for service communication

## Configuration

### Environment Variables
Copy `.env.example` to `.env` and customize:

```bash
# Backend
DB_PATH=/data/auth.db
PORT=8080
CORS_ORIGINS=http://localhost:3000

# Frontend
NEXT_PUBLIC_API_URL=http://localhost:8080
NODE_ENV=production
```

### RHEL8 Specific Setup

1. **Install Docker**:
```bash
sudo dnf config-manager --add-repo=https://download.docker.com/linux/centos/docker-ce.repo
sudo dnf install docker-ce docker-ce-cli containerd.io
sudo systemctl enable --now docker
```

2. **Install Docker Compose**:
```bash
sudo curl -L "https://github.com/docker/compose/releases/latest/download/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
sudo chmod +x /usr/local/bin/docker-compose
```

3. **SELinux Configuration**:
```bash
# Allow container access to host files
setsebool -P container_manage_cgroup on
```

4. **Firewall Configuration**:
```bash
sudo firewall-cmd --permanent --add-port=80/tcp
sudo firewall-cmd --permanent --add-port=3000/tcp
sudo firewall-cmd --permanent --add-port=8080/tcp
sudo firewall-cmd --reload
```

## Monitoring & Logs

### View Logs
```bash
# All services
docker-compose logs -f

# Specific service
docker-compose logs -f backend
docker-compose logs -f frontend
```

### Health Checks
All services include health checks:
- Backend: `http://localhost:8080/api/auth/me`
- Frontend: `http://localhost:3000`
- Nginx: `http://localhost/health`

Check health status:
```bash
docker-compose ps
```

## Database Management

### Migrations
Database migrations are automatically available in the backend container:
```bash
docker-compose exec backend ./main migrate
```

### Backup Database
```bash
# Copy database from container
docker cp bpo-validation-backend:/data/auth.db ./backup-$(date +%Y%m%d).db
```

### Restore Database
```bash
# Copy database to container
docker cp ./backup.db bpo-validation-backend:/data/auth.db
docker-compose restart backend
```

## Troubleshooting

### Common Issues

1. **Port Conflicts**:
   - Modify ports in docker-compose.yml
   - Check for existing services: `sudo netstat -tlnp | grep :8080`

2. **Permission Issues**:
   - Ensure Docker daemon is running: `sudo systemctl status docker`
   - Add user to docker group: `sudo usermod -aG docker $USER`

3. **Build Failures**:
   - Clear Docker cache: `docker system prune -a`
   - Rebuild without cache: `docker-compose build --no-cache`

### Performance Tuning

1. **Resource Limits** (add to docker-compose.yml):
```yaml
services:
  backend:
    deploy:
      resources:
        limits:
          memory: 512M
          cpus: '0.5'
```

2. **Logging Configuration**:
```yaml
services:
  backend:
    logging:
      driver: "json-file"
      options:
        max-size: "10m"
        max-file: "3"
```

## Security Considerations

1. **Production Setup**:
   - Use secrets management for sensitive data
   - Enable HTTPS with SSL certificates
   - Configure proper CORS origins
   - Use non-root users in containers

2. **Network Security**:
   - Expose only necessary ports
   - Use internal networks for service communication
   - Configure firewall rules appropriately

## Maintenance

### Updates
```bash
# Pull latest images
docker-compose pull

# Restart with new images
docker-compose up -d

# Clean unused resources
docker system prune
```

### Scaling (if needed)
```bash
# Scale frontend instances
docker-compose up -d --scale frontend=3
```