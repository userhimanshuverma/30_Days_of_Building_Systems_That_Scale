# Architecture Snapshot — Day 20: Resilient Distributed Architecture

> **System Evolution Stage**: `v5-resilient-services`  
> **Executable Environment**: [`system-evolution/v5-resilient-services`](../system-evolution/v5-resilient-services)  
> **Preceding Architecture**: [`Day 15 Async Processing`](./day-15-async-event-driven.md)  
> **Succeeding Architecture**: [`Day 25 Observable & Chaos`](./day-25-observable-chaos-ready.md)  
> **Related Guides**:  
> - [`Day 16 — The Network Is Not Reliable`](../days/phase-4-now-the-system-is-distributed/day-16-network-is-unreliable/README.md)  
> - [`Day 17 — Timeouts, Retries, and the Retry Storm`](../days/phase-4-now-the-system-is-distributed/day-17-timeouts-retries-retry-storm/README.md)  
> - [`Day 18 — The Cascading Failure`](../days/phase-4-now-the-system-is-distributed/day-18-cascading-failures/README.md)  
> - [`Day 19 — Distributed Systems Don't Agree on Everything`](../days/phase-4-now-the-system-is-distributed/day-19-distributed-disagreement/README.md)  
> - [`Day 20 — Consistency vs Availability: A Real Engineering Decision`](../days/phase-4-now-the-system-is-distributed/day-20-consistency-vs-availability/README.md)

---

## 🎯 Architecture Overview

At Day 20, the system confronts the harsh realities of distributed computing: network partitions, transient errors, clock skew, and cascading service outages.
* **Fault Isolation via Bulkheads & Circuit Breakers**: Downstream dependencies are wrapped in Resilience4j / Envoy circuit breakers. When an external payment or shipping partner slows down, the circuit trips within 2 seconds, failing fast with cached/degraded fallbacks rather than consuming all application threads.
* **Retry Storm Defense**: Clients and internal microservices apply Exponential Backoff with Full Random Jitter and strict retry budgets (maximum 3 attempts, max 10% retry quota).
* **Transactional Outbox & Choreographed Sagas**: Domain mutations and event emissions occur within the same local ACID transaction; Debezium / Kafka CDC pipelines propagate events downstream reliably without 2PC locking.
* **Tunable Consistency**: Critical inventory writes maintain strong consistency, while non-critical views and recommendations embrace eventual consistency in accordance with the PACELC theorem.

```text
                        [ Client Apps / Browsers ]
                                    │
                                    ▼
                        ┌───────────────────────┐
                        │   API Gateway (Envoy) │
                        │  (Rate & Conn Limits) │
                        └───────────┬───────────┘
                                    │
               ┌────────────────────┴────────────────────┐
               │                                         │
               ▼                                         ▼
      ┌────────────────┐  gRPC (Context Deadline)┌────────────────┐
      │ Order Service  │────────────────────────►│Inventory Service
      │ (Bulkhead Pool)│                         │ (Bulkhead Pool)│
      └───────┬────────┘                         └───────┬────────┘
              │                                          │
              │ Local ACID Commit                        │ Local ACID Commit
              ▼                                          ▼
      ┌────────────────┐                         ┌────────────────┐
      │ Order DB       │                         │ Inventory DB   │
      │ + Outbox Table │                         │ + Outbox Table │
      └───────┬────────┘                         └───────┬────────┘
              │ CDC Engine                               │ CDC Engine
              ▼ (Debezium)                               ▼ (Debezium)
 ┌─── Distributed Event Bus (Kafka) ────────────────────────────┐
 │                                                              │
 │   [ OrderEvents Topic ]             [ InventoryEvents Topic ]│
 └──────────────────────────────┬───────────────────────────────┘
                                │
                                ▼
                       ┌────────────────┐
                       │Payment Worker  │
                       │[Circuit Breaker│
                       │ & Full Jitter] │
                       └────────────────┘
```

---

## 📋 System Characteristics Matrix

| Attribute | Specification |
|---|---|
| **Topology** | Microservice Mesh + Envoy Gateway + Bulkheads + Outbox CDC + Partitioned DBs |
| **Inter-Service Protocol** | gRPC (HTTP/2 multiplexing) with contextual deadlines; Kafka for async event choreography |
| **Timeout Policy** | Connect <= 200ms; Read <= 1,500ms; Context deadlines strictly propagated across hops |
| **Retry Strategy** | Max 3 attempts, Exponential Backoff (100ms base, 2000ms max) with Full Random Jitter |
| **Cascading Failure Defense**| Thread pool bulkheads, circuit breakers tripping at 50% error rate over 10s rolling window |
| **Consistency Model** | Eventual consistency across domains via Sagas; strong consistency within domain aggregates |
| **Target Availability** | 99.95% |

---

## 🏛️ Architectural Decision Log (ADR Index)

* **[ADR-16: Context Deadlines & Network Fault Tolerance](../days/phase-4-now-the-system-is-distributed/day-16-network-is-unreliable/README.md)**: Enforced bounded execution deadlines across all synchronous internal RPCs.
* **[ADR-17: Jittered Retries & Retry Budgets](../days/phase-4-now-the-system-is-distributed/day-17-timeouts-retries-retry-storm/README.md)**: Implemented full jitter and capped retry traffic to 10% of nominal load to eliminate self-inflicted retry storms.
* **[ADR-18: Circuit Breakers & Graceful Degradation](../days/phase-4-now-the-system-is-distributed/day-18-cascading-failures/README.md)**: Wrapped high-risk calls with circuit breakers that fall back to asynchronous queues or cached estimates.
* **[ADR-19: Transactional Outbox Pattern](../days/phase-4-now-the-system-is-distributed/day-19-distributed-disagreement/README.md)**: Eliminated dual-write race conditions by co-locating business events inside local relational transactions.
* **[ADR-20: PACELC Trade-Off Alignment](../days/phase-4-now-the-system-is-distributed/day-20-consistency-vs-availability/README.md)**: Explicitly partitioned system consistency requirements into strong vs eventual tiers.

---

## 🚀 How to Launch This System Snapshot

```bash
cd system-evolution/v5-resilient-services
docker compose up -d --build
```
