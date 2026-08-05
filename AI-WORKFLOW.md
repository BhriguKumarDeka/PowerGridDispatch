# 🤖 AI Assistance & LLM Integration Workflow

This document describes how AI was utilized both during pair-programming development and within the runtime system architecture of the KSPDB Power Fault Localization System.

---

## 1. Runtime GenAI Architecture (Groq API Integration)

### 📌 LLM Use Case: Operator Handoff Briefing
In utility control rooms during severe weather events, operators experience cognitive overload from hundreds of incoming telemetry alarms. The system uses an LLM to generate concise, 2-sentence dispatch briefs for field crew linemen.

```
┌──────────────────────────┐      Query Fault JSON       ┌──────────────────────────┐
│  Fault Localization      ├────────────────────────────►│  Groq API (Llama-3.3)    │
│  Engine (Deterministic)  │                             │  Zero-Token DB Caching   │
└──────────────────────────┘                             └────────────┬─────────────┘
                                                                      │
                                                                      ▼
                                                         ┌──────────────────────────┐
                                                         │ 2-Sentence Operator Brief│
                                                         └──────────────────────────┘
```

### ⚡ Optimization for Free-Tier Rate & Token Limits
- **Ultra-Concise Prompting**: Prompt input is constrained to ~45 tokens to keep usage minimal.
- **Zero-Token Database Caching**: Once generated, `ai_summary` is stored in the `FaultIncident` table in PostgreSQL. Subsequent reads fetch directly from DB storage with **0 tokens spent**.
- **Multi-Tier Fallbacks**:
  1. Groq API (`llama-3.3-70b-versatile`)
  2. OpenAI API (`gpt-4o-mini`) fallback if configured
  3. Deterministic Template Engine fallback (zero cost, instant fallback)

---

## 2. AI-Assisted Pair Programming Workflow

During development, an AI assistant (Antigravity / Gemini) was paired with the engineer to accelerate development while adhering to strict software design practices.

### 🛠️ Key AI Pair-Programming Contributions
1. **Geometric Topology Ingestion Engine**:
   - Collaborated on developing the `move_point` and `random_point_around` geospatial formulas in Python (`backend/app/seeder/generate.py`) to generate realistic synthetic radial networks across Bangalore.
2. **Asynchronous Architecture Setup**:
   - Assisted in configuring async SQLAlchemy 2.0 sessions with `asyncpg` to prevent main loop blocking.
3. **Frontend Design System**:
   - Co-designed the React + Leaflet control room UI featuring a dark theme, pulsing fault markers, state transition controls, and fault simulator drawer.
4. **Resilience & Bug Diagnostics**:
   - Helped diagnose and fix runtime edge cases including asyncpg timezone awareness (`DateTime(timezone=True)`), Leaflet Canvas CSS variable evaluations, and PowerShell execution syntax.

---

## 3. Where AI Was Wrong or Misleading

### Case 1: `npm ci` Freeze in Docker Build
AI initially generated a `frontend/Dockerfile` using `npm ci` for deterministic installs. This **hung indefinitely** in Docker Desktop on Windows due to npm registry timeouts behind corporate/slow networks. The AI did not flag this as a risk. **Fix**: Replaced with `npm install --legacy-peer-deps` and added `.npmrc` with aggressive timeout settings. Lesson: AI assumes ideal network conditions.

### Case 2: Leaflet CSS Variables in Canvas Renderer
AI generated Leaflet marker styles using Tailwind CSS class names (e.g., `text-blue-500`) for SVG icon coloring inside `L.DivIcon`. These classes rely on CSS variables that Leaflet's canvas rendering context cannot evaluate — the icons rendered as invisible/black. AI repeatedly suggested CSS-in-JS solutions that also didn't work. **Fix**: Hardcoded hex color values (`#3b82f6`, `#fbbf24`) directly in SVG attributes. Lesson: AI doesn't understand rendering engine limitations for embedded SVG.

### Case 3: PowerShell `&&` Operator
AI consistently generated bash-style `&&` for chaining commands in terminal instructions. This fails silently in PowerShell on Windows (which requires `;`). Multiple debugging sessions were wasted before identifying this pattern. **Fix**: Switched all compound commands to semicolons. Lesson: AI defaults to Unix shell conventions regardless of the stated OS.

---

## 4. Estimated AI Code Contribution

| Component | AI-Generated | Human-Revised | Notes |
|-----------|-------------|---------------|-------|
| Backend models/schema | ~90% | ~10% | Straightforward SQLAlchemy boilerplate |
| Topology inference algorithm | ~60% | ~40% | Core algorithm logic was AI-seeded but required significant tuning of constants (120°, 150m) and edge case handling |
| Fault detection engine | ~70% | ~30% | Tree walk logic was AI-generated; dead sensor and feeder fault merging required human design |
| Frontend UI/components | ~75% | ~25% | Layout and styling heavily AI-assisted; final aesthetic polish was iterative human feedback |
| Simulator & API endpoints | ~85% | ~15% | Mostly AI-generated CRUD; noise injection logic was human-designed |
| Documentation | ~50% | ~50% | Structure AI-generated; technical accuracy and honest limitations hand-written |

**Overall estimate**: ~70% of code was AI-generated, ~30% was human-written or substantially revised. All code was understood and reviewed by the developer.

