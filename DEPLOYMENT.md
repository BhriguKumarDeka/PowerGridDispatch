# 🚀 Production Deployment & Operations Guide

This guide details how to build, run, configure, and maintain the KSPDB Power Fault Localization System across local, containerized, and production environments.

---

## 1. Local Docker Setup (Development & Evaluation)

### Prerequisites
- [Docker Desktop](https://www.docker.com/products/docker-desktop/) (v24.0+ recommended)
- Git

### Quickstart Commands

1. **Clone & Enter Workspace**:
   ```bash
   git clone https://github.com/your-org/kspdb-fault-system.git
   cd kspdb-fault-system
   ```

2. **Configure Environment Variables**:
   ```bash
   cp .env.example .env
   ```

3. **Start All Services**:
   - **Windows (PowerShell)**:
     ```powershell
     docker compose down -v; docker compose up --build -d
     ```
   - **Linux / macOS (Bash)**:
     ```bash
     docker compose down -v && docker compose up --build -d
     ```

4. **Verify Container Health**:
   ```bash
   docker compose ps
   ```
   All 3 services (`db`, `backend`, `frontend`) must show status `running` / `healthy`.

---

## 2. Environment Variables Configuration

| Variable | Default Value | Description |
| :--- | :--- | :--- |
| `POSTGRES_USER` | `propel` | Database username |
| `POSTGRES_PASSWORD` | `propel_dev` | Database password |
| `POSTGRES_DB` | `propel` | Database name |
| `DATABASE_URL` | `postgresql+asyncpg://propel:propel_dev@db:5432/propel` | Async SQLAlchemy connection string |
| `SEED_ON_STARTUP` | `true` | Auto-seed 4,774 synthetic poles on startup |
| `GROQ_API_KEY` | `""` | Free Groq API Key from console.groq.com |
| `GROQ_MODEL` | `llama-3.3-70b-versatile` | Groq LLM model identifier |
| `OPENAI_API_KEY` | `""` | Optional fallback OpenAI API Key |

---

## 3. Production Deployment (Cloud Hosting)

### Deploying to Render / Railway / Fly.io

1. **Database Service**:
   - Provision a managed PostgreSQL 16 instance.
   - Set environment variable `DATABASE_URL` pointing to the managed DB connection URI.

2. **Backend Web Service**:
   - Dockerfile path: `./backend/Dockerfile`
   - Expose Port: `8000`
   - Start Command: `uvicorn app.main:app --host 0.0.0.0 --port 8000`
   - Set env vars: `DATABASE_URL`, `GROQ_API_KEY`, `SEED_ON_STARTUP=true`.

3. **Frontend Static Web Service**:
   - Dockerfile path: `./frontend/Dockerfile`
   - Expose Port: `80`
   - Nginx proxy configuration maps `/api/` and `/ws` to the backend URL.

---

## 4. Troubleshooting

### Container Won't Start
| Symptom | Cause | Fix |
|---------|-------|-----|
| `Cannot connect to Docker daemon` | Docker Desktop not running | Start Docker Desktop, wait for engine to initialize |
| `port 8000 already in use` | Another service on port 8000 | `docker compose down` or change port in `docker-compose.yml` |
| `port 3000 already in use` | Another service on port 3000 | Same as above |
| Backend crashes on startup | DB not ready yet | The `depends_on: condition: service_healthy` should handle this. If not, run `docker compose up -d db` first, wait 10s, then `docker compose up -d` |

### Database Issues
| Symptom | Cause | Fix |
|---------|-------|-----|
| `asyncpg.InvalidCatalogNameError` | DB not created | `docker compose down -v` to wipe volume, then `docker compose up --build` |
| Seed data missing (empty map) | Seed failed silently | Check backend logs: `docker compose logs backend --tail 100` |
| Stale data after code changes | Old seed persists | `docker compose down -v && docker compose up --build -d` |

### Frontend Issues
| Symptom | Cause | Fix |
|---------|-------|-----|
| Blank white page at localhost:3000 | Build failed or nginx misconfigured | Check `docker compose logs frontend` for build errors |
| Map doesn't load | CARTO tile CDN blocked | Check network connectivity; tiles load from `basemaps.cartocdn.com` |
| API calls fail (network error) | Backend URL mismatch | Frontend expects backend at `localhost:8000`; verify with `curl http://localhost:8000/api/health` |

### Common Gotchas
- **Windows PowerShell**: Use `;` instead of `&&` to chain commands
- **WSL2 + Docker**: Ensure WSL integration is enabled in Docker Desktop settings
- **Firewall**: Ports 3000 and 8000 must be open for local access

---

## 5. Clean Reset

To completely reset the system to a fresh state (wipe all data, rebuild from scratch):

```bash
docker compose down -v          # Stop all containers, delete volumes
docker compose up --build -d    # Rebuild images, start fresh with new seed
```

To reset only tickets and telemetry (keep network data):
```bash
curl -X POST http://localhost:8000/api/simulator/reset
```

---

## 6. Maintenance & Monitoring

- **View Live Backend Logs**:
  ```bash
  docker compose logs backend --tail 50 -f
  ```

- **Check System Health**:
  ```bash
  curl http://localhost:8000/api/health
  # Returns: {"status": "ok", "service": "kspdb-fault-system"}
  ```

- **Check Simulator State**:
  ```bash
  curl http://localhost:8000/api/simulator/status
  # Returns: {"telemetry_events": N, "active_tickets": M}
  ```

- **View API Documentation**:
  Open [http://localhost:8000/docs](http://localhost:8000/docs) for the interactive Swagger UI.

