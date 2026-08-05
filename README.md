# ⚡ KSPDB Power Fault Localization & Verification System

[![System Status](https://img.shields.io/badge/System-Operational-success)](http://localhost:3000)
[![Tech Stack](https://img.shields.io/badge/Stack-FastAPI%20%7C%20React%20%7C%20PostgreSQL%20%7C%20Leaflet-blue)](https://fastapi.tiangolo.com/)
[![AI Powered](https://img.shields.io/badge/AI-Groq%20LLM%20(Llama--3.3)--70b)-purple)](https://groq.com/)

An AI-enhanced, real-time power fault localization and automated verification platform built for the **Karnataka State Power Distribution Board (KSPDB)**.

This system ingests streaming IoT telemetry from **4,774 LT poles** across **71 Distribution Transformers (DTs)** in Bangalore, reconstructs unmapped grid topology using spatial heuristics, pinpoints exact live/dark wire break boundaries, filters noise (dead sensors and load shedding), auto-verifies restoration telemetry, and generates LLM-powered crew handoff briefs.

---

## 📽️ Demo Video
> 🎬 **[Link to Demo Video (3-5 mins)]**: *(Replace with actual video URL upon upload)*

---

## 🌟 Key Features

- **⚡ Live/Dark Boundary Localization**: Pinpoints exact failed wire spans ($P_{\text{live}} \to P_{\text{dark}}$) and outputs coordinates & PIN codes with up to 95% confidence.
- **🧭 Spatial Topology Reconstruction**: Infer radial tree topology from GPS coordinates for the 48% of transformers lacking official secondary wiring maps.
- **🛡️ Noise Suppression & False Alarm Filter**: Eliminates false positives from dead sensors (dark pole with live children) and scheduled load shedding windows.
- **🤖 Groq LLM Dispatch Briefs**: Generates concise field crew handoff instructions powered by `llama-3.3-70b-versatile` with zero-token database caching.
- **🛠️ Automated Restoration Verification**: Evaluates incoming IoT telemetry when a ticket is marked resolved; rejects resolution if poles remain dark.
- **🧪 Interactive Control Room Simulator**: Live dashboard UI with real-time WebSocket push updates, fault injector, noise injector, and maintenance manager.

---

## 🚀 Quickstart (Local Docker)

### Prerequisites
- [Docker Desktop](https://www.docker.com/products/docker-desktop/) (running on Windows/Linux/macOS)

### Running the Stack
1. Clone the repository and navigate to the directory:
   ```bash
   git clone https://github.com/your-org/kspdb-fault-localization.git
   cd kspdb-fault-localization
   ```

2. Copy the environment configuration:
   ```bash
   cp .env.example .env
   ```
   *(Optionally add your `GROQ_API_KEY` in `.env` for Groq LLM integration)*

3. Start all services using Docker Compose:
   ```bash
   docker compose up --build -d
   ```

4. Access the application:
   - **Operator Console UI**: [http://localhost:3000](http://localhost:3000)
   - **FastAPI REST & WebSocket Docs**: [http://localhost:8000/docs](http://localhost:8000/docs)

---

## 🏗️ System Architecture

```
                                  ┌───────────────────────────────┐
                                  │   IoT Telemetry (4,774 Poles) │
                                  └───────────────┬───────────────┘
                                                  │ HTTP / Batch
                                                  ▼
┌───────────────────────────────┐  POST /telemetry  ┌───────────────────────────────┐
│     Operator Console (UI)     │◄─────────────────┤    FastAPI Ingestion Engine    │
│  (React + Leaflet + WebSocket)│   Live WS Push   │   (Async Python 3.12 / Uvicorn)│
└───────────────┬───────────────┘                  └───────────────┬───────────────┘
                │                                                  │
                │ Trigger Simulator                                │ Query & Persist
                ▼                                                  ▼
┌───────────────────────────────┐                  ┌───────────────────────────────┐
│  Fault Simulator & Noise API  │                  │  PostgreSQL 16 Relational DB  │
└───────────────────────────────┘                  └───────────────────────────────┘
```

---

## 📑 Documentation Directory

- 📐 [**ARCHITECTURE.md**](file:///c:/Users/DEXTER/Desktop/Propel/ARCHITECTURE.md): Deep-dive system design, DAG graph theory, spatial tree reconstruction math, and database schemas.
- 🚀 [**DEPLOYMENT.md**](file:///c:/Users/DEXTER/Desktop/Propel/DEPLOYMENT.md): Step-by-step production deployment, Docker setup, and environment variables.
- ⚖️ [**DECISIONS.md**](file:///c:/Users/DEXTER/Desktop/Propel/DECISIONS.md): Architectural trade-offs, graph theory vs. LLM reasoning, and noise handling rules.
- 🤖 [**AI-WORKFLOW.md**](file:///c:/Users/DEXTER/Desktop/Propel/AI-WORKFLOW.md): AI pair programming process and Groq LLM dispatch brief integration.
- 🎓 [**Interview Prep Guides**](file:///c:/Users/DEXTER/Desktop/Propel/docs/interview_prep/): Comprehensive interview cheatsheets and real-world utility case studies.

---

## 🛠️ Tech Stack

- **Backend**: FastAPI, Async SQLAlchemy, Asyncpg, Pydantic, HTTPX, Dateutil.
- **Frontend**: React 18, Vite, Leaflet, React-Leaflet, Vanilla CSS (Dark Theme System).
- **Database**: PostgreSQL 16 Alpine.
- **AI Integration**: Groq API (`llama-3.3-70b-versatile`), OpenAI SDK compatible.
- **Containerization**: Docker, Docker Compose, Nginx.
