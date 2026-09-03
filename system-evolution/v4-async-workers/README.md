# Milestone v4-async-workers — Asynchronous Background Processing & Worker Fleet

> **System Evolution Stage**: `v4-async-workers`  
> **Previous Milestone**: [`v3-cached-data`](../v3-cached-data/README.md)  
> **Related Guides**:  
> - [Day 11 — The Request That Should Never Have Been Synchronous](../../days/phase-3-stop-making-everything-synchronous/day-11-never-synchronous-request/README.md)  
> - [Day 12 — Introducing the Queue: Decoupling Producers from Consumers](../../days/phase-3-stop-making-everything-synchronous/day-12-introducing-the-queue/README.md)  
> - Day 13 — The Exactly-Once Myth: Dealing with Duplicates *(Phase 3)*  
> - Day 14 — Backpressure: What Happens When Workers Fall Behind *(Phase 3)*  
> - Day 15 — Surviving Traffic Spikes *(Phase 3)*  
> **Next Milestone**: `v5-resilient-services` (Phase 4)

---

## 🎯 Architecture Overview

`v4-async-workers` represents the fourth major architectural milestone of **ShopScale**: fundamentally decoupling the customer-facing HTTP request lifecycle from long-running, CPU-intensive, or unreliable background tasks.

In `v3-cached-data`, our data tier scaled with read replicas, sharding, and Redis caching. However, our application servers remained vulnerable to **thread starvation and cascading failure**. Whenever users uploaded large product CSVs, requested PDF invoices, or triggered external email notifications, synchronous execution blocked web worker threads for seconds at a time. A temporary slowdown on an external third-party API could freeze every web worker across the cluster, taking down our entire e-commerce storefront.

In `v4-async-workers`, we introduce **Temporal Decoupling** and a dedicated asynchronous execution tier:

1. **Non-Blocking API Ingestion (Producers)**:
   * Web servers act strictly as lightweight gatekeepers.
   * Operations taking longer than 500ms return immediately with `HTTP 202 Accepted` and a job tracking identifier.
   * Tasks are enqueued into a durable, persistent Message Broker (RabbitMQ / Redis Streams).
   * Large file uploads bypass application memory entirely, streaming directly to S3-compatible object storage via time-limited Pre-Signed URLs.

2. **Autonomous Background Worker Fleet (Consumers)**:
   * A completely isolated fleet of worker processes pulls tasks from the message queue.
   * Workers execute batch CSV parsing, high-resolution image resizing, PDF invoice generation, and third-party webhook integrations (Stripe, SendGrid, ShipStation).
   * Workers scale independently based on **Queue Backlog (Lag)** rather than web server CPU or HTTP request rates.

3. **Resilience & Fault Isolation**:
   * **Dead Letter Queues (DLQ)**: Poison pill payloads that trigger unhandled exceptions are routed to a quarantine queue after 3 retries, protecting worker fleets from infinite crash loops.
   * **Exponential Backoff & Jitter**: Third-party API rate limits and network glitches retry safely in the background without affecting customer-facing response times.
   * **Strict Idempotency**: Every background task incorporates an idempotency token to prevent duplicate charges, shipments, or emails during network retries.

```text
                        [ Client Browsers / Mobile Apps ]
                                        │
                         ┌──────────────┴──────────────┐
                         │ HTTP / HTTPS (Fast REST)    │ Direct S3 Upload
                         ▼                             ▼
              ┌─────────────────────┐       ┌─────────────────────┐
              │   Load Balancer /   │       │  S3 Object Storage  │
              │   Public Ingress    │       │  (Direct File Drops)│
              └──────────┬──────────┘       └──────────┬──────────┘
                         │                             │
          ┌──────────────┼──────────────┐              │ Pre-Signed
          ▼              ▼              ▼              │ Upload Notification
   ┌─────────────┐┌─────────────┐┌─────────────┐       │
   │ API Node 01 ││ API Node 02 ││ API Node 10 │       │
   │ (Fast Sync) ││ (Fast Sync) ││ (Fast Sync) │       │
   └──────┬──────┘└──────┬──────┘└──────┬──────┘       │
          │              │              │              │
          └──────────────┼──────────────┘              │
                         │ Enqueue Tasks (< 5ms)       │
                         ▼                             ▼
   ┌─────────────────────────────────────────────────────────────┐
   │             Durable Message Broker Tier                     │
   │             (RabbitMQ / Redis Streams)                      │
   ├──────────────────────────────┬──────────────────────────────┤
   │  • High-Priority Task Queue  │  • Batch Import Task Queue   │
   │  • Webhook Notification Queue│  • Dead Letter Queue (DLQ)   │
   └──────────────────────────────┴──────────────────────────────┘
                                  │
          ┌───────────────────────┼───────────────────────┐
          │ Pull Tasks            │ Pull Tasks            │ Pull Tasks
          ▼                       ▼                       ▼
   ┌─────────────┐         ┌─────────────┐         ┌─────────────┐
   │ Worker 01   │         │ Worker 02   │         │ Worker N    │
   │ (Catalog/CSV│         │ (PDF/Images)│         │ (Webhooks)  │
   └──────┬──────┘         └──────┬──────┘         └──────┬──────┘
          │                       │                       │
          └───────────────────────┼───────────────────────┘
                                  │
                                  ▼
   ┌─── Persistent Storage & Distributed State Tier ─────────────┐
   │                                                             │
   │  ┌─────────────────────────┐   ┌─────────────────────────┐  │
   │  │ Redis Cache & Mutex     │   │ PostgreSQL Database     │  │
   │  │ (Job Status & Locks)    │   │ (Sharded Primary/Replica│  │
   │  └─────────────────────────┘   └─────────────────────────┘  │
   │                                                             │
   └─────────────────────────────────────────────────────────────┘
```

---

## 📋 System Characteristics Matrix

| Attribute | Specification |
|---|---|
| **Topology** | Load Balancer + N Stateless API Nodes + S3 Storage + RabbitMQ/Redis Broker + M Scalable Workers + Redis Cache + PostgreSQL Shards |
| **Max API Throughput** | 50,000+ RPS (Web tier latency P99 < 35ms across all endpoints) |
| **Background Processing Throughput** | 15,000+ jobs/min (Horizontally scalable by adding worker processes) |
| **P99 Sync API Latency** | < 25ms (All long-running tasks return HTTP 202 Accepted immediately) |
| **Compute Separation** | Web nodes (I/O multiplexed, low memory) strictly isolated from Worker nodes (CPU & batch memory optimized) |
| **Queue Resilience** | Durable disk-backed persistence; messages survive broker restarts |
| **Retry Policy** | Jittered exponential backoff with Dead Letter Queue (DLQ) after 3 failed attempts |
| **Target Availability** | 99.99% for API Ingress (Third-party vendor outages have zero impact on customer browsing or checkout) |

---

## 🧩 Component Breakdown

1. **Stateless API Ingestion Nodes (`api-01` to `api-10`)**:
   * Validates request payloads and permissions.
   * Generates unique correlation `job_id` tokens.
   * Dispatches task messages to the broker and returns HTTP 202 Accepted in under 40ms.
2. **Object Storage Tier (AWS S3 / MinIO)**:
   * Direct recipient of bulk catalog CSVs, product media, and exported reports via Pre-Signed URLs.
   * Eliminates multipart file buffering in web server memory.
3. **Durable Message Broker (RabbitMQ / Redis Streams)**:
   * Buffer layer between producers and consumers.
   * Provides message persistence, acknowledgments (`ACK`/`NACK`), consumer group offsets, and dead-letter routing.
4. **Autonomous Worker Fleet (`worker-01` to `worker-M`)**:
   * Long-running background processes dedicated to specific task queues:
     * **Catalog Import Workers**: Parses multi-megabyte CSVs and executes batch database upserts.
     * **Media Workers**: Resizes product images and generates invoice PDFs.
     * **Notification Workers**: Dispatches transactional emails (SendGrid) and webhooks with retry backoff.
5. **Redis Job State Store**:
   * Tracks transient lifecycle states (`PENDING` → `PROCESSING` → `COMPLETED` / `FAILED`) and percentage progress for client polling.
6. **PostgreSQL Storage Tier**:
   * Authoritative system of record updated asynchronously by background workers upon task completion.

---

## 🚀 How to Launch This Milestone

You can launch the complete decoupled architecture (API nodes, RabbitMQ broker, background worker fleet, Redis, and PostgreSQL) locally using Docker Compose:

```bash
cd system-evolution/v4-async-workers
docker compose up -d --build
```

### Verification & Health Check

1. **Verify RabbitMQ Broker Connectivity**:
   ```bash
   # Check queue health and active channels
   docker compose exec rabbitmq rabbitmq-diagnostics check_running
   ```

2. **Trigger an Asynchronous Bulk Catalog Upload**:
   ```bash
   # 1. Submit an import job (Returns HTTP 202 immediately with job_id)
   curl -i -X POST http://localhost:80/api/v1/merchant/catalog/upload \
     -H "Content-Type: multipart/form-data" \
     -F "file=@sample_catalog_5000.csv"
   ```

   *Expected output*:
   ```json
   HTTP/1.1 202 Accepted
   Content-Type: application/json

   {
     "job_id": "8f3b610c-39b1-4c78-9e56-bc9b0e12d1a4",
     "status": "ACCEPTED",
     "poll_url": "/api/v1/merchant/catalog/jobs/8f3b610c-39b1-4c78-9e56-bc9b0e12d1a4"
   }
   ```

3. **Inspect Asynchronous Progress**:
   ```bash
   # Poll status while worker processes in the background
   curl -s http://localhost:80/api/v1/merchant/catalog/jobs/8f3b610c-39b1-4c78-9e56-bc9b0e12d1a4 | jq .
   ```

4. **Verify Worker Isolation Under Artificial Downstream Delay**:
   ```bash
   # Simulate SendGrid latency: Web endpoints remain responsive under 20ms
   curl -s -w "Total Time: %{time_total}s\n" -o /dev/null http://localhost:80/health
   ```

---

## 🏛️ Associated Architectural Decisions (ADRs)

* **[ADR-11: Enforce Asynchronous Decoupling for Long-Running Operations](../../days/phase-3-stop-making-everything-synchronous/day-11-never-synchronous-request/README.md)**: Mandated the 500ms rule: any task exceeding 500ms or interacting with third-party external APIs must return HTTP 202 Accepted and execute asynchronously.
* **[ADR-12: Adopt Durable Message Queues with Producer-Consumer Topology](../../days/phase-3-stop-making-everything-synchronous/day-12-introducing-the-queue/README.md)**: Replaced in-process threading with durable, persistent message brokers to eliminate deployment data loss.
* **ADR-13: Guarantee Idempotency and Dead Letter Quarantine**: Standardized deduplication keys on message consumers and quarantined poison pill messages into Dead Letter Queues after 3 failed retries *(Detailed in Day 13)*.
