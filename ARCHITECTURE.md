# 📐 System Architecture & Design Specification

This document details the system design, data models, graph algorithms, noise filtering logic, and real-time streaming infrastructure of the KSPDB Power Fault Localization System.

---

## 1. System Overview & Technology Stack

The KSPDB Power Fault Localization System is built as a reactive, multi-tier asynchronous architecture designed to handle real-time IoT telemetry from thousands of electrical poles with zero blocking execution.

- **Frontend**: React 18 + Vite + Leaflet served via Nginx with WebSocket streaming (`/ws`).
- **Backend**: FastAPI (Python 3.12) running Uvicorn with async context execution.
- **Database**: PostgreSQL 16 with `asyncpg` non-blocking driver and SQLAlchemy 2.0 ORM.
- **AI Engine**: Groq API (`llama-3.3-70b-versatile`) with zero-token PostgreSQL DB caching.

---

## 2. Relational Database Schema

```mermaid
erDiagram
    Substation ||--|{ Feeder : "supplies"
    Feeder ||--|{ DistributionTransformer : "powers"
    DistributionTransformer ||--|{ Pole : "serves"
    Pole ||--o| TelemetryEvent : "emits"
    FaultIncident ||--|{ FaultAffectedPole : "contains"
    Pole ||--o| FaultAffectedPole : "affected_by"

    Substation {
        string id PK "SS-01..04"
        string name
        float lat
        float lon
    }

    Feeder {
        string id PK "F-01-01..31"
        string substation_id FK
        string name
    }

    DistributionTransformer {
        string id PK "D-0001..71"
        string feeder_id FK
        float lat
        float lon
        int capacity_kva
        boolean has_known_topology
    }

    Pole {
        string id PK "P-000001..4774"
        string dt_id FK
        string feeder_id FK
        float lat
        float lon
        string parent_pole_id FK "Self-referential"
        string device_id "Nullable / Unique"
        string fw_version "1.4.2 vs 1.2.3"
    }

    FaultIncident {
        int id PK
        string fault_type "span | dt | feeder"
        string status "detected..closed"
        datetime detected_at
        float fault_location_lat
        float fault_location_lon
        string pincode
        int affected_pole_count
        float confidence
        string topology_source "known | inferred"
        text ai_summary
    }
```

---

## 3. Core Algorithms

### A. Graph Topology Construction (`TopologyService`)
Electrical distribution networks under a Distribution Transformer (DT) form a **Radial Directed Acyclic Graph (Tree DAG)** rooted at the DT location $(lat_{\text{DT}}, lon_{\text{DT}})$.

1. **Known Wiring (52% of DTs)**: Constructed directly from `parent_pole_id` foreign keys.
2. **Missing Topology (48% of DTs)**: Inferred using a **Bearing-Constrained Spatial Nearest-Neighbor Heuristic**:
   - Starting at the DT, the nearest unvisited pole is selected as the initial trunk root.
   - Consecutive poles are connected if the angular bearing deviation $\Delta \theta < 120^\circ$ (preventing sharp backtracking).
   - Unvisited clusters within 200m are attached as spur branches perpendicular to the trunk bearing.

### B. Live/Dark Boundary Localization (`FaultDetector`)
- Walks radial DT trees top-down from root poles to leaves.
- Identifies span breaks using the boundary condition:
  $$\text{State}(P_{\text{parent}}) = \text{LIVE} \quad \land \quad \text{State}(P_{\text{child}}) = \text{DARK}$$
- Calculates mid-span fault coordinates and groups all $N$ downstream dark poles into **1 single incident ticket**.

### C. Dead Sensor Suppression (`NoiseFilter`)
- Prevents false alarms when an IoT sensor fails while power is flowing:
  $$\text{If State}(P) = \text{DARK} \quad \land \quad \exists C \in \text{Children}(P) \text{ s.t. State}(C) = \text{LIVE} \implies \text{DEAD SENSOR (Suppressed)}$$

---

## 4. Ticket Lifecycle State Machine

```mermaid
stateDiagram-v2
    [*] --> detected: Live/Dark Boundary Found
    detected --> acknowledged: Operator Acknowledges
    acknowledged --> crew_assigned: Field Crew Dispatched
    crew_assigned --> resolved: Lineman Marks Resolved
    
    state RestorationCheck <<choice>>
    resolved --> RestorationCheck: Telemetry Evaluation
    RestorationCheck --> verified: 100% Poles Live
    RestorationCheck --> crew_assigned: Poles Still Dark (Rejected)
    
    verified --> closed: Operator Closes Ticket
    closed --> [*]
```

---

## 5. Real-Time Streaming (`ws_manager`)

The system implements a dual-mode communication protocol:
- **WebSocket (`/ws`)**: Pushes real-time JSON events (`ticket_created`, `ticket_verified`) to connected web clients in <100ms.
- **HTTP Polling**: 4-second safety fallback for resilience against temporary connection drops.
