# Architecture Snapshot — Day 10: Replicated & Cached Data Tier

> **System Evolution Stage**: `v3-cached-data`  
> **Executable Environment**: [`system-evolution/v3-cached-data`](../system-evolution/v3-cached-data)  
> **Preceding Architecture**: [`Day 05 Load Balanced`](./day-05-load-balanced-ingress.md)  
> **Succeeding Architecture**: [`Day 15 Async Processing`](./day-15-async-event-driven.md)  
> **Related Guides**:  
> - [`Day 07 — Read Replicas: The First Escape Route`](../days/phase-2-database-becomes-the-problem/day-07-read-replicas/README.md)  
> - [`Day 08 — Caching Is Easy Until It Isn't`](../days/phase-2-database-becomes-the-problem/day-08-caching-easy-until-not/README.md)  
> - [`Day 10 — Scaling Data Without Breaking Consistency`](../days/phase-2-database-becomes-the-problem/day-10-data-without-breaking-consistency/README.md)

---

## 🎯 Architecture Overview

At Day 10, database bottlenecks from Phase 2 are systematically mitigated by decoupling reads from writes and introducing high-throughput in-memory caching:
* **Read/Write Splitting**: Application writes route to the PostgreSQL Primary, while high-volume read queries are directed to PostgreSQL Read Replicas via asynchronous streaming replication.
* **Cache-Aside Tier**: Redis cluster absorbs up to 90% of catalog read traffic, backed by cache-stampede distributed locks and negative-lookup caching.
* **Connection Multiplexing**: PgBouncer pools connections across all compute nodes, keeping physical PostgreSQL connections capped within optimal concurrency ranges.

```text
                        [ Client Apps / Browsers ]
                                    │
                                    ▼
                        ┌───────────────────────┐
                        │   Load Balancer (L7)  │
                        └───────────┬───────────┘
                                    │
               ┌────────────────────┼────────────────────┐
               ▼                    ▼                    ▼
      ┌────────────────┐  ┌────────────────┐  ┌────────────────┐
      │ App Instance 01│  │ App Instance 02│  │ App Instance N │
      └───────┬────────┘  └───────┬────────┘  └───────┬────────┘
              │                   │                   │
    ┌─────────┴───────────────────┼───────────────────┴─────────┐
    │                             │                             │
    ▼ Reads (Cache-Aside)         ▼ Session/Locks               │
┌─────────────────────────────────────────────────────────┐     │
│                    Redis Cluster Tier                   │     │
│       [ Catalog Cache ]     [ Distributed Mutex ]       │     │
└─────────────────────────────────────────────────────────┘     │
                                                                │
              ┌─────────────────────────────────────────────────┘
              │ Writes / Critical Reads       │ Read-Only Queries
              ▼                               ▼
      ┌───────────────┐               ┌───────────────┐
      │ PgBouncer (W) │               │ PgBouncer (R) │
      └───────┬───────┘               └───────┬───────┘
              │                               │
              ▼                               ▼
      ┌───────────────┐   Replication ┌───────────────┐
      │ PostgreSQL    │──────────────►│ PostgreSQL    │
      │ Primary DB    │  (Async WAL)  │ Read Replicas │
      └───────────────┘               └───────────────┘
```

---

## 📋 System Characteristics Matrix

| Attribute | Specification |
|---|---|
| **Topology** | Load Balancer + N Stateless App Nodes + Redis Cache Tier + PgBouncer + Primary/Replica DB |
| **Max Tested Throughput** | ~15,000 - 25,000 RPS (85-90% Cache Hit Rate) |
| **P99 Read Latency SLA** | Cache hit < 5ms; Replica query < 35ms |
| **P99 Write Latency SLA** | Primary transaction < 55ms |
| **Data Consistency** | Eventual consistency on Read Replicas (replication lag ~10-150ms); Session write-pinning |
| **Cache Invalidation Strategy**| Cache-aside with atomic distributed locking (`SETNX`) and deterministic TTL jitter |
| **Target Availability** | 99.95% |

---

## 🏛️ Architectural Decision Log (ADR Index)

* **[ADR-07: Read/Write Splitting & Replica Lag Management](../days/phase-2-database-becomes-the-problem/day-07-read-replicas/README.md)**: Separated mutations from queries and pinned user sessions to the primary immediately following writes to prevent replication lag staleness.
* **[ADR-08: Cache Stampede & Penetration Protection](../days/phase-2-database-becomes-the-problem/day-08-caching-easy-until-not/README.md)**: Implemented distributed mutex locking for hot-key recalculation and Bloom filters / null sentinels for missing keys.
* **[ADR-09: Horizontal Partitioning & Sharding Strategy](../days/phase-2-database-becomes-the-problem/day-09-one-db-not-enough/README.md)**: Established tenant/merchant shard key distribution guidelines.
* **[ADR-10: Sagas over Two-Phase Commit (2PC)](../days/phase-2-database-becomes-the-problem/day-10-data-without-breaking-consistency/README.md)**: Selected asynchronous compensating sagas over blocking distributed transactions.

---

## 🚀 How to Launch This System Snapshot

```bash
cd system-evolution/v3-cached-data
docker compose up -d --build
```
