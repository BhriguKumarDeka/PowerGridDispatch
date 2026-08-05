# ⚖️ Architectural Decisions & Trade-Offs

This document records the key architectural choices, algorithmic trade-offs, and design principles adopted during the development of the KSPDB Power Fault Localization System.

---

## 1. Graph Algorithms vs. Large Language Models (LLMs)

### ❓ Decision Context
A core requirement of the problem statement was deciding where to use deterministic graph-based algorithms versus probabilistic LLMs.

### 💡 Decision & Rationale
- **Deterministic Graph Algorithms for Fault Localization**:
  - Electrical grid fault localization requires 100% mathematical precision based on graph topology and physical power flow.
  - LLMs are probabilistic models prone to hallucinating non-existent pole IDs or inaccurate GPS coordinates.
  - We implemented $O(V+E)$ radial tree traversal algorithms for fault detection, live/dark boundary finding, and dead sensor suppression.
- **LLMs for Natural Language Operator Briefings**:
  - LLMs excel at transforming structured JSON data into natural, human-readable handoff briefings for field crew dispatchers.
  - We integrated Groq's `llama-3.3-70b-versatile` for generating concise 2-sentence operator briefs, backed by zero-token PostgreSQL database caching.

---

## 2. Inferred Spatial Topology for Unmapped Transformers

### ❓ Decision Context
48% of distribution transformers lacked recorded secondary wiring diagrams (`has_known_topology = False`), possessing only GPS coordinates for poles.

### 💡 Decision & Rationale
- **Bearing-Constrained Greedy Nearest-Neighbor Algorithm**:
  - Connecting poles purely by minimum distance leads to zigzagging topologies across streets.
  - We introduced an **angle constraint** (<120° bearing deviation) to enforce linear line propagation along street corridors.
  - Faults detected on inferred topology are explicitly tagged as `inferred` and assigned a lower confidence score (65% vs. 95% for known topology) to inform operators of potential geometric estimation errors.

---

## 3. Asynchronous Non-Blocking I/O Stack

### ❓ Decision Context
The system must process high-frequency streaming telemetry from 4,774 IoT devices without dropping messages or blocking web clients.

### 💡 Decision & Rationale
- **FastAPI + Asyncpg + SQLAlchemy 2.0 Async Engine**:
  - Python's standard `psycopg2` synchronous driver blocks the event loop during database writes.
  - Using `asyncpg` enables non-blocking database queries, allowing the backend to process hundreds of concurrent telemetry events per second on a single event loop.

---

## 4. Telemetry Restoration Auto-Verification ("Don't Believe the Lineman")

### ❓ Decision Context
Field technicians frequently mark repair tickets as "Resolved" before line power is actually restored.

### 💡 Decision & Rationale
- **Automated Verification Guard**:
  - When a ticket status transitions to `resolved`, the system queries current IoT telemetry across all affected poles.
  - If 100% of affected poles return `boot` / `power_restored` telemetry, the ticket is auto-verified to `verified`.
  - If any pole remains dark, the resolution is rejected, and the ticket status automatically reverts to `crew_assigned`.

---

## 5. Assumptions Made

| Assumption | Rationale |
|------------|-----------|
| Power flow is strictly radial (tree, no loops) | Standard for Indian LT distribution networks; KSPDB operates radial topology |
| GPS coordinates are accurate to ±4m | Per problem statement; sufficient for inter-pole distance calculation |
| Heartbeats arrive every 15 minutes under normal conditions | Per problem statement telemetry spec |
| One fault per DT subtree at a time | Simplifies boundary detection; multiple simultaneous breaks on one DT are rare |
| Bangalore flat-Earth approximation valid | At 12.9°N latitude, error is ~0.1% for distances under 5km |
| 30% message loss is uniformly distributed | Simplification; real networks may have spatial correlation in coverage |

---

## 6. What We Would Do With Two More Weeks

| Priority | Feature | Rationale |
|----------|---------|-----------|
| **P0** | Heartbeat watchdog for fw 1.2.x | Background task that flags poles missing 2+ consecutive heartbeats as potentially dark. Currently simulated, not production-implemented. |
| **P0** | Automated tests for fault_detector and topology | `pytest` suite covering known topology walk, inferred topology edge cases, dead sensor suppression, and feeder fault merging. |
| **P1** | PostGIS spatial indexing | Replace $O(N^2)$ brute-force nearest-neighbor with R-tree index for topology inference at scale. |
| **P1** | Multiple simultaneous faults per DT | Currently the tree walk reports the highest boundary only; need to track multiple independent break points. |
| **P2** | Minimum Spanning Tree topology inference | Replace greedy nearest-neighbor with Prim's algorithm using bearing-weighted edges for globally optimal tree reconstruction. |
| **P2** | WebSocket reconnection with state replay | Send missed events on reconnect so the UI never shows stale data after a temporary disconnect. |
| **P3** | Lineman mobile PWA | Progressive Web App for field crew with GPS tracking and ticket status updates. |

---

## 7. Current Fragile / Known Broken Parts

| Component | Issue | Severity |
|-----------|-------|----------|
| Topology inference in dense areas | May connect poles across parallel streets that happen to be within 150m | Medium — causes incorrect fault boundaries |
| Confidence model | Heuristic values (0.65, 0.70, 0.85, 0.90, 0.95) are not calibrated against real fault data | Low — directionally correct but arbitrary precision |
| No automated tests | Core algorithms have no pytest coverage; manually tested via simulator | Medium — regression risk |
| fw 1.2.x heartbeat timeout | Simulated by direct state injection; no actual background watchdog timer | Medium — works for demo but not production-ready |
| Single-process architecture | All fault detection runs on one Uvicorn worker event loop | Low at current scale — would fail above ~50K poles |

