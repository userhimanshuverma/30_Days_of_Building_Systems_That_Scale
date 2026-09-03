# Milestone v3-cached-data — Read Replicas & Distributed In-Memory Caching

> **System Evolution Stage**: `v3-cached-data`  
> **Previous Milestone**: [`v2-scaled-compute`](../v2-scaled-compute/README.md)  
> **Related Guides**:  
> - [Day 07 — Read Replicas: The First Escape Route](../../days/phase-2-database-becomes-the-problem/day-07-read-replicas/README.md)  
> - [Day 08 — Caching Is Easy Until It Isn't](../../days/phase-2-database-becomes-the-problem/day-08-caching-easy-until-not/README.md)  
> **Next Milestone**: `v4-async-workers` (Phase 3)

---

## 🎯 Architecture Overview

`v3-cached-data` represents the third major architectural milestone of **ShopScale**: fundamentally transforming our data access layer to survive read-intensive production scale (90%+ read traffic).

In `v2-scaled-compute`, horizontally scaling our application nodes simply pushed the bottleneck downward, overwhelming the central PostgreSQL instance with concurrent connections, repetitive joins, and disk I/O queueing. 

In `v3-cached-data`, we decouple state access through two complementary tiers:

1. **Read/Write Database Separation**:
   * **Primary Node**: Dedicated exclusively to write mutations (`INSERT`, `UPDATE`, `DELETE`, transactions).
   * **Asynchronous Read Replicas**: Multiple hot-standby instances replaying the primary's Write-Ahead Log (WAL) to serve read queries (`SELECT`).
   * **PgBouncer Pooling Tier**: Multiplexes application connections into bounded physical pools for both primary and replica nodes.
   * **Session-Based Write Pinning**: Enforces "Read-Your-Own-Writes" consistency by pinning recently mutating users to the primary for a brief safety window.

2. **Distributed In-Memory Caching (Redis)**:
   * Intercepts repetitive, high-frequency read traffic (e.g., top 100 flash sale products, user profiles, category listings) before it ever hits SQL query execution.
   * **Pattern**: Cache-Aside (Lazy Loading) with active invalidation (`DEL` on write), safety TTLs with randomized jitter (preventing cache avalanches), and distributed mutex locks (preventing cache stampedes / thundering herds).

```text
                        [ Client Browsers / Mobile Apps ]
                                        │
                                   HTTP / HTTPS
                                        │
                                        ▼
                        ┌───────────────────────────────┐
                        │    Load Balancer / Ingress    │
                        └───────────────┬───────────────┘
                                        │
                 ┌──────────────────────┼──────────────────────┐
                 ▼                      ▼                      ▼
        ┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
        │ App Instance 01 │    │ App Instance 02 │    │ App Instance 10 │
        └────────┬────────┘    └────────┬────────┘    └────────┬────────┘
                 │                      │                      │
                 └──────────────────────┼──────────────────────┘
                                        │
            ┌───────────────────────────┴───────────────────────────┐
            │                                                       │
            ▼                                                       ▼
┌───────────────────────────────┐               ┌───────────────────────────────────────┐
│   Redis Distributed Cache     │               │        Connection & Routing Tier      │
│   (Cache-Aside Tier)          │               │        (Dual-Pool PgBouncer)          │
├───────────────────────────────┤               ├───────────────────┬───────────────────┤
│ • Product Catalog & Metadata  │               │ Writer Pool       │ Reader Pool       │
│ • User Sessions & Tokens      │               │ (Mutations + Pins)│ (General SELECTs) │
│ • Distributed Mutex Locks     │               └─────────┬─────────┴─────────┬─────────┘
│ • Stampede Guards & Sentinels │                         │                   │
└───────────────────────────────┘                         ▼                   ▼
                                                ┌──────────────────┐┌──────────────────┐
                                                │ PostgreSQL       ││ PostgreSQL       │
                                                │ Primary (RW)     ││ Replicas (RO)    │
                                                └─────────┬────────┘└─────────▲────────┘
                                                          │                   │
                                                          └───(Streaming WAL)─┘
```

---

## 📋 System Characteristics Matrix

| Attribute | Specification |
|---|---|
| **Topology** | Load Balancer + N Stateless App Nodes + Distributed Redis Cache + PgBouncer + PostgreSQL Primary + Asynchronous Read Replicas |
| **Max Tested Throughput** | ~25,000 - 45,000 RPS (85%+ absorbed by Redis, remainder distributed across replicas) |
| **P99 Read Latency** | **Cache Hits**: < 2ms \| **Replica Queries**: < 15ms (Uncached) |
| **P99 Write Latency** | < 25ms (Primary database with isolated write pool) |
| **Compute Tier** | Horizontally Scaled Stateless Nodes (`app-01` to `app-10+`) |
| **Caching Tier** | Dedicated Redis Cluster with fail-open circuit breaking, TTL jitter, and mutex locks |
| **Database Tier** | 1x PostgreSQL Primary + 2x Hot Standby Replicas with streaming physical replication |
| **Connection Pooling** | PgBouncer in transaction pooling mode (Writer Pool: 25 conns, Reader Pool: 50 conns) |
| **Target Availability** | 99.95% for Reads (Reads survive primary outages via replica pool and Redis cache) |

---

## 🧩 Component Breakdown

1. **Ingress Load Balancer**: Terminates TLS and distributes HTTP requests evenly across stateless application workers.
2. **Stateless App Nodes (`app-01` to `app-10`)**: Execute business logic with dual connection routers (`ReaderSessionLocal` vs `WriterSessionLocal`) and integrated cache decorators.
3. **Redis Caching Tier**:
   * Stores pre-serialized JSON entities with key naming conventions (`product:{id}`, `user:{id}:profile`).
   * Provides atomic distributed locking via `SET lock:{key} {token} NX EX {ttl}` to serialize recomputations during cache misses.
   * Serves negative lookup sentinels to neutralize cache penetration attempts.
4. **PgBouncer Multiplexing Tier**: Maintains lightweight client connections while capping physical backend PostgreSQL connections to optimal concurrency limits.
5. **PostgreSQL Primary Database**: The canonical, authoritative source of truth handling all transactional state changes and generating streaming WAL records.
6. **PostgreSQL Read Replicas**: Hot standbys continuously replaying WAL bytes to serve catalog browsing, reporting, and read queries.

---

## 🚀 How to Launch This Milestone

You can spin up the complete `v3-cached-data` environment (App nodes, Redis, PgBouncer, PostgreSQL Primary, and Read Replica) using Docker Compose:

```bash
cd system-evolution/v3-cached-data
docker compose up -d --build
```

### Verification & Health Check

1. **Verify Redis Cache Operations**:
   ```bash
   # Confirm Redis is responding
   docker compose exec redis redis-cli ping
   # Expected output: PONG
   ```

2. **Verify PostgreSQL Streaming Replication**:
   ```bash
   # Inspect primary replication status
   docker compose exec postgres-primary psql -U postgres -d shopscale -c \
     "SELECT client_addr, state, sync_state, replay_lag FROM pg_stat_replication;"
   ```

3. **Verify Read-After-Write Consistency**:
   ```bash
   # 1. Update product price (hits Primary and invalidates Redis cache)
   curl -X PUT http://localhost:80/api/products/1042 \
     -H "Content-Type: application/json" \
     -d '{"title": "Noise-Cancelling Headphones", "price": 199.99}'

   # 2. Immediately fetch product (Served via DB or cache repopulation)
   curl -s http://localhost:80/api/products/1042 | jq .
   ```

---

## 🏛️ Associated Architectural Decisions (ADRs)

* **[ADR-07: Read/Write Separation with Asynchronous Streaming Replicas](../../days/phase-2-database-becomes-the-problem/day-07-read-replicas/README.md)**: Separated mutations from queries using dual connection pools and implemented session-based write pinning to guarantee Read-Your-Own-Writes consistency.
* **[ADR-08: Adopt Cache-Aside with Active Invalidation & Stampede Mutex](../../days/phase-2-database-becomes-the-problem/day-08-caching-easy-until-not/README.md)**: Standardized on Cache-Aside with delete-on-write invalidation, randomized TTL jitter, negative caching, and distributed locks for hot keys.
