# Architecture Snapshot — Day 15: Asynchronous & Event-Driven Processing

> **System Evolution Stage**: `v4-async-workers`  
> **Executable Environment**: [`system-evolution/v4-async-workers`](../system-evolution/v4-async-workers)  
> **Preceding Architecture**: [`Day 10 Cached Data Tier`](./day-10-replicated-cached-data.md)  
> **Succeeding Architecture**: [`Day 20 Resilient Distributed`](./day-20-resilient-distributed.md)  
> **Related Guides**:  
> - [`Day 11 — The Request That Should Never Have Been Synchronous`](../days/phase-3-stop-making-everything-synchronous/day-11-never-synchronous-request/README.md)  
> - [`Day 12 — Introducing the Queue`](../days/phase-3-stop-making-everything-synchronous/day-12-introducing-the-queue/README.md)  
> - [`Day 13 — Exactly Once Is Not What You Think`](../days/phase-3-stop-making-everything-synchronous/day-13-exactly-once-myth/README.md)  
> - [`Day 14 — Back Pressure: When Your System Can't Keep Up`](../days/phase-3-stop-making-everything-synchronous/day-14-back-pressure/README.md)  
> - [`Day 15 — Designing a System That Can Survive Spikes`](../days/phase-3-stop-making-everything-synchronous/day-15-surviving-traffic-spikes/README.md)

---

## 🎯 Architecture Overview

At Day 15, all long-running, CPU-intensive, or I/O-bound operations have been completely decoupled from synchronous HTTP request/response loops.
* **HTTP 202 Accepted Workflow**: Bulk imports, report generations, payment captures, email notifications, and image transformations return an immediate `202 Accepted` along with a `job_id` polling endpoint.
* **Message Broker Tier**: Durable RabbitMQ / Redis Streams brokers buffer incoming spikes, dampening pressure on backend databases and external third-party APIs.
* **Autonomous Worker Fleet**: Horizontally autoscaled background workers consume tasks from dedicated queues, employing bounded prefetch counts, at-least-once delivery with idempotent consumer guards, and Dead-Letter Queues (DLQ).

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
      │ API Server 01  │  │ API Server 02  │  │ API Server N   │
      └───────┬────────┘  └───────┬────────┘  └───────┬────────┘
              │                   │                   │
              │  Enqueue Job      │  Enqueue Job      │  Enqueue Job
              ▼ (Async Message)   ▼ (Async Message)   ▼ (Async Message)
 ┌─── Durable Message Broker Tier (RabbitMQ / Kafka) ───────────┐
 │                                                              │
 │   [ Orders Queue ]   [ Media Queue ]   [ Notifications Queue ]│
 │   [ Dead Letter Queue (DLQ) for Unprocessable Retries ]       │
 └──────────────────────────────┬───────────────────────────────┘
                                │
          ┌─────────────────────┼─────────────────────┐
          ▼                     ▼                     ▼
 ┌─── Autonomous Worker Tier ───────────────────────────────────┐
 │                                                              │
 │   ┌─────────────────┐   ┌─────────────────┐   ┌────────────┐ │
 │   │ Order Worker    │   │ Image/PDF Worker│   │ Email/SMS  │ │
 │   │ (Inventory/Pay) │   │ (Media Process) │   │ (Webhooks) │ │
 │   └────────┬────────┘   └────────┬────────┘   └──────┬─────┘ │
 │            │                     │                   │       │
 └────────────┼─────────────────────┼───────────────────┼───────┘
              ▼                     ▼                   ▼
 ┌─── Backend Systems & Data Stores ────────────────────────────┐
 │   [ PostgreSQL Primary DB ]   [ S3 Media Store ]  [ SendGrid]│
 └──────────────────────────────────────────────────────────────┘
```

---

## 📋 System Characteristics Matrix

| Attribute | Specification |
|---|---|
| **Topology** | Stateless API Servers + Durable Message Broker + Autoscaling Background Worker Fleet |
| **Max Ingress Spike Capacity** | 50,000+ RPS absorbed without dropping user connections |
| **API p99 Response Latency** | < 40ms (Immediate 202 Accepted acknowledging receipt) |
| **Delivery Guarantee** | At-least-once delivery with mandatory consumer idempotency deduplication |
| **Back Pressure Mechanisms** | Bounded channel buffers, consumer prefetch tuning, client rate shedding (429) |
| **Spike Dampening** | Queue peak shaving; background workers drain queues at a sustainable steady state |
| **Dead-Letter Handling** | Automatic diversion to DLQ after 3 failed retry attempts with exponential backoff |

---

## 🏛️ Architectural Decision Log (ADR Index)

* **[ADR-11: Asynchronous Request-Response Decoupling](../days/phase-3-stop-making-everything-synchronous/day-11-never-synchronous-request/README.md)**: Transitioned non-critical path operations from synchronous blocking calls to asynchronous 202 Accepted patterns.
* **[ADR-12: Durable Message Broker Selection](../days/phase-3-stop-making-everything-synchronous/day-12-introducing-the-queue/README.md)**: Standardized on durable AMQP/Kafka message queues with persistent delivery mode.
* **[ADR-13: Idempotent Consumer Design](../days/phase-3-stop-making-everything-synchronous/day-13-exactly-once-myth/README.md)**: Mandated unique deduplication tokens (`idempotency_key`) and atomic check-and-set database transactions.
* **[ADR-14: Consumer Back Pressure & Prefetch Limits](../days/phase-3-stop-making-everything-synchronous/day-14-back-pressure/README.md)**: Capped worker prefetch (`qos_prefetch_count = 10`) to prevent node out-of-memory crashes.
* **[ADR-15: Dead-Letter Queuing & Traffic Peak Shaving](../days/phase-3-stop-making-everything-synchronous/day-15-surviving-traffic-spikes/README.md)**: Isolated toxic payloads to dead-letter queues while preserving background drain capacity.

---

## 🚀 How to Launch This System Snapshot

```bash
cd system-evolution/v4-async-workers
docker compose up -d --build
```
