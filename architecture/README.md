# 🏛️ System Evolution Architecture Index

This directory maintains the **Architectural Snapshots** of our system as it evolves across the 30-day series.

Unlike disconnected code examples, our application transforms through 7 major evolutionary milestones:

---

## 🗺️ Evolution Milestone Map

```text
Day 01 Baseline                Day 05 Load Balanced            Day 10 Cached Data Tier
+------------------+           +-------------------+           +---------------------+
| Single Server    |  ======>  | Nginx + 3x App    |  ======>  | App + Postgres      |
| App + Postgres   |           | Replicas + DB     |           | Replicas + Redis    |
+------------------+           +-------------------+           +---------------------+
                                                                          ||
                                                                          ||
Day 25 Observable & Chaos      Day 20 Resilient Dist.          Day 15 Async Processing
+------------------+           +-------------------+           +---------------------+
| App + Prometheus |  <======  | Circuit Breakers  |  <======  | Message Queues      |
| Grafana + Jaeger |           | Retries + Raft    |           | Worker Services     |
+------------------+           +-------------------+           +---------------------+
         ||
         v
Day 30 Global Multi-Region System
+----------------------------------------------------+
| Geo-DNS + Global Edge + Multi-Region Active/Active |
+----------------------------------------------------+
```

---

## 📸 Snapshot Directory

1. 🟢 [**Day 01 — Monolithic Baseline**](./day-01-monolithic-baseline.md) (`system-evolution/v1-monolith`)
2. 🔵 [**Day 05 — Load Balanced Compute**](./day-05-load-balanced-ingress.md) (`system-evolution/v2-scaled-compute`)
3. 🟣 [**Day 10 — Decoupled & Cached Data Layer**](./day-10-replicated-cached-data.md) (`system-evolution/v3-cached-data`)
4. 🟡 [**Day 15 — Asynchronous & Event-Driven Tier**](./day-15-async-event-driven.md) (`system-evolution/v4-async-workers`)
5. 🟠 [**Day 20 — Resilient Distributed Architecture**](./day-20-resilient-distributed.md) (`system-evolution/v5-resilient-services`)
6. 🔴 [**Day 25 — Fully Observable & Chaos-Tested System**](./day-25-observable-chaos-ready.md) (`system-evolution/v6-observable-stack`)
7. 🚀 [**Day 30 — Final Global Multi-Region System**](./day-30-multi-region-scale.md) (`system-evolution/v7-global-architecture`)
