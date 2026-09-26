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

---

## 🧩 Component Breakdown

1. **API Gateway (Envoy Proxy)**:
   * Terminates external client TLS and enforces ingress rate limiting and routing.
   * Manages ingress circuit breakers, connection limits, and outbound timeout policies.
2. **Order Service (`order-service`)**:
   * Coordinates order creation sagas using the Transactional Outbox pattern.
   * Emits `OrderCreated` domain events to local database outbox tables before committing.
3. **Payment Service (`payment-service`)**:
   * Isolated PCI-DSS compliant service handling payment capture.
   * Integrates circuit breaker fallbacks, idempotency deduplication keys (`Idempotency-Key` header), and tokenized payment storage.
4. **Kafka Event Backbone**:
   * Distributed, partitioned log delivering domain events with at-least-once delivery guarantees.
   * Consumer groups maintain independent checkpoint offsets with dead-letter queue (DLQ) diversion.
5. **Redis Idempotency & Circuit State Store**:
   * Fast atomic lookup store for consumer idempotency verification (`SETNX` locks).
   * Shared circuit breaker state and rate limiter counters.
6. **Domain-Isolated Databases**:
   * Dedicated PostgreSQL databases for Order and Payment domains, preventing cross-service schema lock contention.

---

## 🚀 How to Launch This Milestone

You can spin up the full resilient distributed topology locally using Docker Compose:

```bash
cd system-evolution/v5-resilient-services
docker compose up -d --build
```

### Verification & Health Check

1. **Verify Circuit Breaker Metrics**:
   ```bash
   # Check Envoy / service circuit breaker status
   curl -s http://localhost:8080/stats | grep "circuit_breakers"
   ```

2. **Test Idempotent Order Submission**:
   ```bash
   # Submit order with idempotency key
   curl -i -X POST http://localhost:8080/api/v1/orders \
     -H "Content-Type: application/json" \
     -H "Idempotency-Key: ord-unique-uuid-9921" \
     -d '{"item_id": 402, "quantity": 1, "total_cents": 1999}'

   # Re-submit identical request (Must return cached response without duplicate billing)
   curl -i -X POST http://localhost:8080/api/v1/orders \
     -H "Content-Type: application/json" \
     -H "Idempotency-Key: ord-unique-uuid-9921" \
     -d '{"item_id": 402, "quantity": 1, "total_cents": 1999}'
   ```

---

## 🏛️ Associated Architectural Decisions (ADRs)

* **[ADR-16: Assume Network Unreliability & Enforce Deadlines](../../days/phase-4-now-the-system-is-distributed/day-16-network-is-unreliable/README.md)**: Standardized dual-tier timeouts and context propagation across all network RPC boundaries.
* **[ADR-17: Exponential Backoff with Full Random Jitter](../../days/phase-4-now-the-system-is-distributed/day-17-timeouts-retries-retry-storm/README.md)**: Mitigated catastrophic thundering herds by introducing randomized backoff intervals and retry quotas.
* **[ADR-18: Circuit Breaker and Bulkhead Isolation](../../days/phase-4-now-the-system-is-distributed/day-18-cascading-failures/README.md)**: Isolated failures to failing dependencies, preventing system-wide thread starvation.
* **[ADR-19: Eventual Consistency via Sagas & Transactional Outbox](../../days/phase-4-now-the-system-is-distributed/day-19-distributed-disagreement/README.md)**: Abandoned distributed 2PC locks in favor of choreographed sagas and compensations.
* **[ADR-20: Tunable Consistency and PACELC Alignment](../../days/phase-4-now-the-system-is-distributed/day-20-consistency-vs-availability/README.md)**: Explicitly prioritized availability and latency over global consistency during network partitions.
