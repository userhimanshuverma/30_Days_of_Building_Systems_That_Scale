# Milestone v7-global-architecture — Globally Distributed, Multi-Region Architecture

> **System Evolution Stage**: `v7-global-architecture`  
> **Previous Milestone**: [`v6-observable-stack`](../v6-observable-stack/README.md)  
> **Related Guides**:  
> - [Day 26 — Rate Limiting at Scale](../../days/phase-6-designing-for-real-scale/day-26-rate-limiting-at-scale/README.md)  
> - [Day 27 — Multi-Region Systems](../../days/phase-6-designing-for-real-scale/day-27-multi-region-architecture/README.md) *(Phase 6)*  
> - [Day 28 — How Much Does Scaling Actually Cost?](../../days/phase-6-designing-for-real-scale/day-28-scaling-cost-economics/README.md) *(Phase 6)*  
> - [Day 29 — Designing for 10× Growth](../../days/phase-6-designing-for-real-scale/day-29-designing-for-10x-growth/README.md) *(Phase 6)*  
> - [Day 30 — The System That Grew With Us](../../days/phase-6-designing-for-real-scale/day-30-the-system-that-grew-with-us/README.md) *(Phase 6)*  

---

## 🎯 Architecture Overview

`v7-global-architecture` represents the culmination of the **ShopScale** 30-day architectural journey: transforming our application from an observable regional microservice cluster into a **resilient, globally distributed, multi-region platform designed for 10× scale**.

Key architectural pillars in this stage:
1. **Perimeter Defense & Distributed Rate Limiting**: Multi-tiered protection spanning Anycast CDN edges, ingress reverse proxies, and distributed Redis clusters with atomic sliding window algorithms.
2. **Multi-Region Data Topologies**: Active-Active and Active-Passive routing with Geo-DNS, conflict-free replicated data types (CRDTs), cross-region replication lag management, and disaster recovery runbooks.
3. **Cloud Unit Economics & Cost Efficiency**: Right-sizing compute fleets, controlling cross-AZ/cross-region egress bandwidth costs, and tuning autoscaler reaction times.
4. **10× Growth Architecture**: Decoupling bottlenecks before they manifest at 100,000+ requests per second.

```text
                                  [ Global Users ]
                                         │
                                         ▼
                            [ Anycast Geo-DNS / CDN ]
                            (L3/L4 DDoS & IP Limits)
                                         │
             ┌───────────────────────────┴───────────────────────────┐
             ▼                                                       ▼
   [ Region 1: us-east-1 ]                                 [ Region 2: eu-west-1 ]
   ┌────────────────────────────────┐                      ┌────────────────────────────────┐
   │ Ingress Envoy + Rate Limiter   │                      │ Ingress Envoy + Rate Limiter   │
   │ 250 App Instances (Kubernetes) │                      │ 250 App Instances (Kubernetes) │
   │ Local Redis Cluster Cache      │                      │ Local Redis Cluster Cache      │
   │ Primary Aurora Postgres        │◄──── Asynchronous ──►│ Read Replica / Secondary       │
   └────────────────────────────────┘      Cross-Region    └────────────────────────────────┘
                                           Replication
```

---

## 📋 System Characteristics Matrix

| Attribute | Specification |
|---|---|
| **Max Tested Throughput** | 100,000+ RPS sustained global load |
| **p99 Latency Target** | < 120ms global checkout; < 25ms local cache hit |
| **Compute Tier** | 500 stateless Kubernetes pods across multiple AZs & Regions |
| **Perimeter Rate Limiting** | Edge Anycast + Envoy gRPC Rate Limit Service + Redis Cluster Lua |
| **Data Tier** | Multi-Region Aurora PostgreSQL with cross-region read replicas |
| **Caching Tier** | Distributed Redis Cluster with sub-key salting & localized caching |
| **Target Availability** | 99.99% ("Four Nines") |
