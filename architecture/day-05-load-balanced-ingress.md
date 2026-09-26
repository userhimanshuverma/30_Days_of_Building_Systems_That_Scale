# Architecture Snapshot — Day 05: Load Balanced Ingress & Scaled Compute

> **System Evolution Stage**: `v2-scaled-compute`  
> **Executable Environment**: [`system-evolution/v2-scaled-compute`](../system-evolution/v2-scaled-compute)  
> **Preceding Architecture**: [`Day 01 Baseline`](./day-01-monolithic-baseline.md)  
> **Succeeding Architecture**: [`Day 10 Cached Data Tier`](./day-10-replicated-cached-data.md)  
> **Related Guide**: [`Day 05 — The Load Balancer Changes Everything`](../days/phase-1-one-server-enough/day-05-load-balancer-changes-everything/README.md)

---

## 🎯 Architecture Overview

At Day 05, the single server bottleneck is eliminated by horizontally scaling the compute tier. The application runtime has been made completely stateless:
* Local server sessions are externalized to an in-memory Redis cluster.
* File uploads and static media are decoupled to S3-compatible Object Storage.
* An NGINX / Cloud L7 Load Balancer sits at the network ingress, terminating TLS, running health probes, and distributing client traffic across an autoscaling pool of identical application replicas.

```text
                        [ Client Browsers / Apps ]
                                    │
                                HTTP / HTTPS
                                    │
                                    ▼
                        ┌───────────────────────┐
                        │  Load Balancer /      │
                        │  Ingress (NGINX/ALB)  │
                        └───────────┬───────────┘
                                    │
               ┌────────────────────┼────────────────────┐
               ▼                    ▼                    ▼
      ┌────────────────┐  ┌────────────────┐  ┌────────────────┐
      │ App Instance 01│  │ App Instance 02│  │ App Instance 10│
      └──┬──────────┬──┘  └──┬──────────┬──┘  └──┬──────────┬──┘
         │          │         │          │         │          │
   ┌─────┘     ┌────┘   ┌────┘     ┌────┘   ┌────┘     ┌────┘
   │           │        │          │        │          │
   ▼           ▼        ▼          ▼        ▼          ▼
 ┌─── Externalized State Tier ──────────────────────────────────┐
 │   [ Redis Session Cluster ]      [ S3 Object Storage ]       │
 └──────────────────────────────────────────────────────────────┘
         │                    │                    │
         │ Connection Pool    │ Connection Pool    │ Connection Pool
         ▼                    ▼                    ▼
 ┌─── Central Data Tier (Primary Bottleneck) ───────────────────┐
 │   [ PostgreSQL Primary DB ] (Single Point of Failure)        │
 └──────────────────────────────────────────────────────────────┘
```

---

## 📋 System Characteristics Matrix

| Attribute | Specification |
|---|---|
| **Topology** | L7 Load Balancer + N Stateless App Nodes + Redis Session Tier + Single PostgreSQL DB |
| **Max Tested Throughput** | ~3,500 - 5,000 RPS (Compute Layer), Bottlenecked by DB connection limits |
| **P99 Latency SLA** | Compute < 25ms; Spikes to > 8,000ms under heavy DB lock contention |
| **Compute Tier** | Horizontally Scalable (1 to 10+ Stateless Nodes) |
| **Data Tier** | 1x PostgreSQL Primary DB (Single Point of Failure and Bottleneck) |
| **Scaling Mechanism** | Horizontal Compute (Stateless) + Vertical Database |
| **Target Availability** | 99.9% Compute Availability (DB remains Single Point of Failure) |

---

## 🏛️ Architectural Decision Log (ADR Index)

* **[ADR-04: Externalize Session State to Redis](../days/phase-1-one-server-enough/day-04-vertical-vs-horizontal/README.md)**: Extracted user sessions from process memory to shared cache to enable stateless horizontal scaling.
* **[ADR-05: Reverse Proxy & Load Balancer Ingress](../days/phase-1-one-server-enough/day-05-load-balancer-changes-everything/README.md)**: Implemented NGINX reverse proxy with active health probes and round-robin / least-connections balancing.
* **[ADR-06: Database Connection Pooling with PgBouncer](../days/phase-2-database-becomes-the-problem/day-06-app-scales-db-doesnt/README.md)**: Added connection multiplexing to shield PostgreSQL from backend process exhaustion.

---

## 🚀 How to Launch This System Snapshot

```bash
cd system-evolution/v2-scaled-compute
docker compose up -d --build
```
