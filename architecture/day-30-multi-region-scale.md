# Architecture Snapshot — Day 30: Final Global Multi-Region System

> **System Evolution Stage**: `v7-global-architecture`  
> **Executable Environment**: [`system-evolution/v7-global-architecture`](../system-evolution/v7-global-architecture)  
> **Preceding Architecture**: [`Day 25 Observable & Chaos`](./day-25-observable-chaos-ready.md)  
> **Related Guides**:  
> - [`Day 26 — Rate Limiting at Scale`](../days/phase-6-designing-for-real-scale/day-26-rate-limiting-at-scale/README.md)  
> - [`Day 27 — Multi-Region Systems`](../days/phase-6-designing-for-real-scale/day-27-multi-region-architecture/README.md)  
> - [`Day 28 — How Much Does Scaling Actually Cost?`](../days/phase-6-designing-for-real-scale/day-28-scaling-cost-economics/README.md)  
> - [`Day 29 — Designing for 10× Growth`](../days/phase-6-designing-for-real-scale/day-29-designing-for-10x-growth/README.md)  
> - [`Day 30 — The System That Grew With Us`](../days/phase-6-designing-for-real-scale/day-30-the-system-that-grew-with-us/README.md)

---

## 🎯 Architecture Overview

At Day 30, the 30-day architectural journey reaches its final milestone: transforming ShopScale from an individual regional deployment into a **globally distributed, multi-region platform capable of handling 100,000+ requests per second at 99.99% availability**:
* **Perimeter Defense & Distributed Rate Limiting**: Global Anycast Geo-DNS and Edge CDNs route users to the nearest regional PoP within < 30ms RTT. Envoy reverse proxies enforce atomic sliding-window rate limits via Redis clusters to shield application backends from DDoS and abusive scraping.
* **Multi-Region Data Topology**: Active-Active compute fleets operate in `us-east-1` (US-East) and `eu-central-1` (EU-Central). Database writes are partitioned by regional tenancy, with low-latency asynchronous cross-region replication for read traffic and sub-minute disaster recovery failover.
* **FinOps & Unit Economics Optimization**: Dynamic Karpenter autoscaling, Graviton/ARM compute profiles, and strict cross-AZ egress bandwidth routing reduce cloud operational costs by 42% while scaling capacity 10×.

```text
                                   [ Global Users ]
                                          │
                                          ▼
                             [ Anycast Geo-DNS / CDN ]
                             (L3/L4 DDoS & IP Limits)
                                          │
              ┌───────────────────────────┴───────────────────────────┐
              ▼                                                       ▼
    [ Region 1: us-east-1 ]                                 [ Region 2: eu-central-1 ]
    ┌────────────────────────────────┐                      ┌────────────────────────────────┐
    │ Ingress Envoy + Rate Limiter   │                      │ Ingress Envoy + Rate Limiter   │
    │ 250 App Instances (Kubernetes) │                      │ 250 App Instances (Kubernetes) │
    │ Regional Redis Cluster Cache   │                      │ Regional Redis Cluster Cache   │
    │ Primary Aurora Postgres DB     │◄──── Asynchronous ──►│ Read Replica / Regional DB     │
    └────────────────────────────────┘      Cross-Region    └────────────────────────────────┘
                                            Replication
```

---

## 📋 System Characteristics Matrix

| Attribute | Specification |
|---|---|
| **Topology** | Global Anycast Geo-DNS + Multi-Region Kubernetes Fleets + Distributed Redis Rate Limiting + Aurora Multi-Region |
| **Max Sustained Throughput** | 100,000+ Requests Per Second |
| **P99 Latency SLA** | Global p99 < 120ms; Regional cached p99 < 20ms |
| **Compute Scale** | 500+ Horizontally Autoscaling Microservice Pods across multi-region AZs |
| **Data Replication Model** | Regional tenancy write-partitioning; asynchronous multi-region read replicas (< 1s replication lag) |
| **High Availability SLA** | 99.99% ("Four Nines" — < 52 minutes downtime per year) |
| **Cloud Unit Economics** | Tiered compute savings, cross-AZ traffic minimization, spot-backed background worker fleets |

---

## 🏛️ Architectural Decision Log (ADR Index)

* **[ADR-26: Distributed Sliding Window Rate Limiting](../days/phase-6-designing-for-real-scale/day-26-rate-limiting-at-scale/README.md)**: Implemented atomic Redis Lua sliding-window counters at the Envoy perimeter to protect internal resources.
* **[ADR-27: Multi-Region Active-Active Data Topology](../days/phase-6-designing-for-real-scale/day-27-multi-region-architecture/README.md)**: Partitioned authoritative writes by primary region while keeping local read replicas in secondary regions to conquer the speed of light.
* **[ADR-28: Egress Cost Optimization & FinOps Governance](../days/phase-6-designing-for-real-scale/day-28-scaling-cost-economics/README.md)**: Co-located chatty microservice topologies within shared availability zones to eliminate cross-AZ data transfer fees.
* **[ADR-29: 10× Scalability Triggers & Capacity Guardrails](../days/phase-6-designing-for-real-scale/day-29-designing-for-10x-growth/README.md)**: Established leading-indicator SLO metrics and refactoring thresholds before reaching architectural breaking points.
* **[ADR-30: Complete System Retrospective](../days/phase-6-designing-for-real-scale/day-30-the-system-that-grew-with-us/README.md)**: Codified the end-to-end design principles governing the evolution from single server to planetary scale.

---

## 🚀 How to Launch This System Snapshot

```bash
cd system-evolution/v7-global-architecture
docker compose up -d --build
```
