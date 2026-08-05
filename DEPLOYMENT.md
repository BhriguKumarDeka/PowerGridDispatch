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

## 3. Production Deployment (Cloud Hosting - Render.com)

We have provided a `render.yaml` Infrastructure-as-Code Blueprint specification in the project root. This automates the setup of the PostgreSQL database, the FastAPI backend, and the React frontend on Render.

### Automated Blueprint Deployment (Recommended)

1. **Push your code to a public or private GitHub repository**.
2. **Log in to Render** (https://dashboard.render.com).
3. **Click "New"** at the top right and select **"Blueprint"**.
4. **Connect your GitHub repository** to Render.
5. **Name your Blueprint Group** (e.g., `kspdb-fault-system`).
6. Render will automatically read the `render.yaml` configuration and provision:
   - A **PostgreSQL Database** instance named `propel-db`
   - A **Web Service** named `propel-backend` running the FastAPI backend via Docker
   - A **Web Service** named `propel-frontend` running the React Nginx server via Docker
7. **Configure parameters** before clicking Apply:
   - Provide your `GROQ_API_KEY` (if you want LLM operator briefs enabled).
8. **Click "Apply"**. Render will deploy all three services in the correct order (Database -> Backend -> Frontend).

### Network & Environment Variable Verification
- **`DATABASE_URL`**: Render automatically binds the internal connection string of the database to the backend. Our backend config automatically detects and converts standard PostgreSQL connection strings to `postgresql+asyncpg://` compatibility on startup.
- **`BACKEND_URL`**: The frontend service relies on the internal host/port of the backend service (`propel-backend:8000`). This is mapped automatically by Render via the blueprint. The frontend `start.sh` script templates Nginx at runtime to proxy `/api/` and `/ws` requests to this backend URL.

### Manual Setup (Without Blueprint)
If you prefer not to use the Blueprint, you can create them manually:

1. **Database**:
   - Create a PostgreSQL Database. Retrieve its external/internal connection string.
2. **Backend**:
   - Create a Web Service. Select **Docker** as the runtime. Set the Docker Context to `./backend` and Dockerfile Path to `./backend/Dockerfile`.
   - Set environment variables:
     - `DATABASE_URL` = `postgresql+asyncpg://[db-user]:[db-password]@[db-host]:5432/[db-name]`
     - `SEED_ON_STARTUP` = `true`
     - `GROQ_API_KEY` = `[your-api-key]`
3. **Frontend**:
   - Create a Web Service. Select **Docker** as the runtime. Set the Docker Context to `./frontend` and Dockerfile Path to `./frontend/Dockerfile`.
   - Set environment variable:
     - `BACKEND_URL` = `[internal-host-of-backend]:8000` (e.g. `propel-backend.render.internal:8000` or whatever internal address Render assigns it).

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

