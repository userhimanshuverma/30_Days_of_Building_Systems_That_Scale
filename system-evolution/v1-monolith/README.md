# Milestone v1-monolith — Single-Server Monolithic Baseline

> **System Evolution Stage**: `v1-monolith`  
> **Related Guide**: [Day 01 — You Don't Need Microservices Yet](../../days/phase-1-one-server-enough/day-01-no-microservices-yet/README.md)  
> **Next Milestone**: `v2-scaled-compute` (Day 05)

---

## 🎯 Architecture Overview

`v1-monolith` represents the foundational starting point of our application: a single-process **Modular Monolith** running on a single server instance backed by a single PostgreSQL database.

All core domain services—Authentication, Catalog, Cart, Checkout, Inventory, and Notifications—run within the same runtime memory space. Communication between modules occurs via in-memory function calls, and all transactional data operations execute within local PostgreSQL ACID transactions (`BEGIN ... COMMIT`).

```text
                    [ Client App / Browser ]
                               │
                          HTTP / REST
                               │
                               ▼
  ┌─────────────────────────────────────────────────────────────┐
  │           Single Application Server (v1-monolith)           │
  │                                                             │
  │                      ┌─────────────┐                        │
  │                      │ API Router  │                        │
  │                      └──┬──┬──┬──┬─┘                        │
  │                         │  │  │  │                          │
  │            ┌────────────┘  │  │  └────────────┐             │
  │            ▼               ▼  ▼               ▼             │
  │   ┌──────────────┐  ┌──────────┐  ┌───────────────────┐    │
  │   │ Auth Module  │  │  Order   │  │ Inventory Module  │    │
  │   │              │  │  Module  │  │                   │    │
  │   └──────────────┘  └────┬─────┘  └─────────┬─────────┘    │
  │                          │                  │               │
  │                          │  In-Memory Call  │               │
  │                          └────────>─────────┘               │
  │                                                             │
  │   ┌──────────────┐                                          │
  │   │Catalog Module│──── In-Memory Call ──> Inventory Module  │
  │   └──────────────┘                                          │
  │                                                             │
  └──────────┬──────────────┬──────────────┬──────────────┬─────┘
             │              │              │              │
        SQL  │         SQL  │    SQL/Txn   │    SQL/Txn   │
             ▼              ▼              ▼              ▼
           ┌──────────────────────────────────────────────┐
           │         PostgreSQL Primary DB               │
           └──────────────────────────────────────────────┘
```

---

## 📋 System Characteristics Matrix

| Attribute | Baseline Value / Specification |
|---|---|
| **Topology** | Single Application Instance + Single Relational Database |
| **Max Tested Throughput** | ~500 - 1,200 RPS (Hardware Dependent) |
| **P99 Latency SLA** | < 45ms (In-Memory Processing & Local DB) |
| **Compute Tier** | Single Process Node |
| **Data Tier** | 1x PostgreSQL (Primary Reads & Writes) |
| **Caching Tier** | None (Direct DB Queries) |
| **Async Worker Tier** | None (Synchronous Request Processing) |
| **Target Availability** | 95.0% (Single Point of Failure) |

---

## 🧩 Component Breakdown

1. **API Router**: Handles incoming HTTP requests and routes them to module handlers.
2. **Order Module**: Manages order creation, order state, and coordinates with inventory within local ACID transactions.
3. **Inventory Module**: Manages item stock counts and stock reservations.
4. **Catalog Module**: Serves product catalog metadata.
5. **PostgreSQL Database**: Single source of truth for all domain tables (`users`, `products`, `orders`, `inventory`).

---

## 🚀 How to Launch This Milestone

You can run the full baseline locally using Docker Compose:

```bash
cd system-evolution/v1-monolith
docker compose up -d
```

Verify the health check endpoint:

```bash
curl http://localhost:8080/health
```

---

## 🏛️ Associated Architectural Decisions (ADRs)

* **[ADR-01: Adopt Modular Monolith for Day 1](../../days/phase-1-one-server-enough/day-01-no-microservices-yet/README.md)**: Chose a single process boundary over microservices to prioritize feature velocity, zero network overhead, and strict transactional consistency.
