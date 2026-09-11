# Milestone v5-resilient-services — Fault-Tolerant Distributed Microservices

> **System Evolution Stage**: `v5-resilient-services`  
> **Previous Milestone**: [`v4-async-workers`](../v4-async-workers/README.md)  
> **Related Guides**:  
> - [Day 16 — The Network Is Not Reliable](../../days/phase-4-now-the-system-is-distributed/day-16-network-is-unreliable/README.md)  
> - Day 17 — Timeouts, Retries, and the Retry Storm *(Phase 4)*  
> - Day 18 — The Cascading Failure *(Phase 4)*  
> - Day 19 — Distributed Systems Don't Agree on Everything *(Phase 4)*  
> - Day 20 — Consistency vs Availability: A Real Engineering Decision *(Phase 4)*  
> **Next Milestone**: `v6-observable-stack` (Phase 5)

---

## 🎯 Architecture Overview

`v5-resilient-services` marks the fifth major milestone in the evolution of **ShopScale**: transforming an asynchronous application into a **partition-tolerant, resilient distributed microservice ecosystem**.

In `v4-async-workers`, we introduced temporal decoupling with message brokers and background workers. However, as business domains expanded, the monolithic codebase was divided into independent services: `Order Service`, `Payment Service`, `Inventory Service`, and `Shipping Service`.

With service decomposition came the reality of **distributed systems physics**:
1. **Network RPC Uncertainty**: Function calls cross physical network switches and fiber. Calls now exhibit the fundamental tri-state: `SUCCESS`, `FAILURE`, or `UNKNOWN`.
2. **Defensive Ingress & Egress**: Every inter-service network client enforces dual-level timeouts (Connect vs. Read), client-side circuit breakers, and exponential backoff with full jitter.
3. **End-to-End Idempotency**: All mutating RPC endpoints enforce deduplication keys stored in distributed caches, making automated retries mathematically safe.
4. **Asynchronous Sagas & Compensations**: Multi-service transactions abandon brittle Two-Phase Commit (2PC) in favor of event-driven Sagas with explicit intermediate (`PENDING`) states and compensating rollbacks.

```text
                                [ Client Ingress ]
                                        │
                                        ▼
                         ┌─────────────────────────────┐
                         │   API Gateway & Ingress     │
                         │   • Rate Limiting & Auth    │
                         │   • Deadline Propagation    │
                         └──────────────┬──────────────┘
                                        │
                 ┌──────────────────────┼──────────────────────┐
                 │                      │                      │
                 ▼                      ▼                      ▼
        ┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
        │  Order Service  │    │ Payment Service │    │ Inventory Serv. │
        │  (Saga Manager) │    │ (Idempotent API)│    │ (Reservations)  │
        └────────┬────────┘    └────────┬────────┘    └────────┬────────┘
                 │                      │                      │
                 └──────────────────────┼──────────────────────┘
                                        │ Event Stream / RPC
                                        ▼
        ┌─────────────────────────────────────────────────────────────┐
        │              Distributed Resilience & State Mesh            │
        ├──────────────────────────────┬──────────────────────────────┤
        │  • Outbox Tables & Debezium  │  • Circuit Breakers & Mesh   │
        │  • Redis Idempotency Store   │  • Dead-Letter Sagas (DLQ)   │
        └──────────────────────────────┴──────────────────────────────┘
                                        │
                                        ▼
        ┌─── Polyglot Distributed Data Tier ──────────────────────────┐
        │                                                             │
        │  ┌─────────────────────────┐   ┌─────────────────────────┐  │
        │  │ Order PostgreSQL DB     │   │ Payment PostgreSQL DB   │  │
        │  │ (Isolated Primary/Repl) │   │ (PCI-DSS Scoped DB)     │  │
        │  └─────────────────────────┘   └─────────────────────────┘  │
        │                                                             │
        └─────────────────────────────────────────────────────────────┘
```

---

## 📋 System Characteristics Matrix

| Attribute | Specification |
|---|---|
| **Topology** | Polyglot Microservices + Gateway Ingress + Idempotency Mesh + Outbox CDC + Partition-Isolated Databases |
| **Inter-Service Protocol** | gRPC (HTTP/2 multiplexed) for internal low-latency RPCs; Kafka for asynchronous Saga choreography |
| **Timeout Policy** | Dual-level timeouts: Connect Timeout <= 200ms, Read Timeout <= 2,000ms with strict Context Deadlines |
| **Retry Strategy** | Max 3 attempts, Exponential Backoff (base 100ms, max 2000ms) with Full Random Jitter; idempotency key required |
| **Fault Isolation** | Bulkheads & Circuit Breakers (Envoy / Resilience4j); partial failures never crash upstream callers |
| **Consistency Model** | Eventual Consistency via Sagas & Transactional Outbox; strict read-your-own-writes per aggregate |
| **Data Partitioning** | Separate databases per microservice domain; zero cross-service foreign keys or distributed locks |
