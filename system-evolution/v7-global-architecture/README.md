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

---

## 🧩 Component Breakdown

1. **Global Anycast Edge & Geo-DNS**:
   * Directs user DNS queries to the nearest geographic region with lowest RTT latency.
   * Performs automatic health checking and failover switching within 30 seconds of regional failure.
2. **Envoy Perimeter Rate Limiter**:
   * Edge reverse proxy enforcing distributed token-bucket and sliding window rate limits.
   * Coordinates with regional Redis clusters via high-performance gRPC check calls.
3. **Regional Compute Clusters (Kubernetes EKS/GKE)**:
   * Autoscaling microservice fleets in `us-east-1` and `eu-west-1`.
   * Completely stateless, with regional session caches and decoupled event publishers.
4. **Multi-Region Aurora PostgreSQL Data Tier**:
   * Active-Active writes partitioned by geographic region / customer shard.
   * Asynchronous cross-region replication for read traffic and disaster recovery failover.
5. **Cross-Region Redis Clusters**:
   * Localized in-region read caching with write-through invalidation and cache warmup.
6. **FinOps Cost & Telemetry Governance**:
   * Automated cost attribution per tenant, ingress/egress bandwidth optimization, and right-sized spot instance fleets.

---

## 🚀 How to Launch This Milestone

You can spin up a simulated multi-region active/passive topology locally using Docker Compose:

```bash
cd system-evolution/v7-global-architecture
docker compose up -d --build
```

### Verification & Health Check

1. **Verify Primary & Secondary Regional Ingress**:
   ```bash
   # Check Region 1 (Primary: port 8080)
   curl -i http://localhost:8080/health
   # Check Region 2 (Secondary: port 8081)
   curl -i http://localhost:8081/health
   ```

2. **Verify Distributed Rate Limiting**:
   ```bash
   # Send burst traffic to test rate limit triggers (429 Too Many Requests)
   for i in {1..20}; do curl -s -o /dev/null -w "%{http_code}\n" http://localhost:8080/api/v1/checkout; done
   ```

3. **Simulate Regional Failover**:
   ```bash
   # Pause primary region compute to verify automatic failover routing
   docker compose pause app-region-1
   curl -i http://localhost:8080/api/v1/catalog
   ```

---

## 🏛️ Associated Architectural Decisions (ADRs)

* **[ADR-26: Distributed Sliding Window Rate Limiting](../../days/phase-6-designing-for-real-scale/day-26-rate-limiting-at-scale/README.md)**: Protected downstream infrastructure from abusive burst spikes using Redis Lua scripts.
* **[ADR-27: Multi-Region Active-Active with Asynchronous Replication](../../days/phase-6-designing-for-real-scale/day-27-multi-region-architecture/README.md)**: Partitioned authoritative writes by primary region while keeping local read replicas in secondary regions.
* **[ADR-28: Cloud Unit Economics & Egress Traffic Optimization](../../days/phase-6-designing-for-real-scale/day-28-scaling-cost-economics/README.md)**: Minimized inter-AZ data transfer fees and right-sized compute nodes to achieve predictable unit costs.
* **[ADR-29: 10× Growth Architecture & Decoupling Triggers](../../days/phase-6-designing-for-real-scale/day-29-designing-for-10x-growth/README.md)**: Defined explicit metrics thresholds for database sharding, CQRS separation, and asynchronous migrations.
* **[ADR-30: The Complete Architecture Retrospective](../../days/phase-6-designing-for-real-scale/day-30-the-system-that-grew-with-us/README.md)**: Documented the journey from single-server monolith to globally distributed, fault-tolerant platform.
