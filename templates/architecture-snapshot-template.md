# Architecture Snapshot — Milestone Day [XX]

> **System Evolution Stage**: `vX-[version-name]`  
> **Preceding Architecture**: [`Day XX-1 Snapshot`](./day-XX-preceding.md)  
> **Succeeding Architecture**: [`Day XX+5 Snapshot`](./day-XX-succeeding.md)

---

## 🎯 Architecture Overview

High-level summary of the system topology at this stage of growth.

```text
[Insert High Level System Topology Diagram]
```

---

## 📋 System Characteristics Matrix

| Attribute | Value / Specification |
|---|---|
| **Max Tested Throughput** | [e.g., 10,000 RPS] |
| **P99 Latency SLA** | [e.g., < 150ms] |
| **Compute Tier** | [e.g., 5x App Replicas behind Nginx L7 Load Balancer] |
| **Data Tier** | [e.g., Primary Writes + 3x Read Replicas] |
| **Caching Tier** | [e.g., Redis Cluster (LRU Eviction)] |
| **Async Tier** | [e.g., RabbitMQ + 10x Worker Nodes] |
| **Target Availability** | [e.g., 99.9% ("Three Nines")] |

---

## 🏛️ Architectural Decision Log (ADR Index)

* **ADR-01**: [Link to Day XX ADR decision]
* **ADR-02**: [Link to Day YY ADR decision]

---

## 🚀 How to Launch This System Snapshot

```bash
cd system-evolution/vX-[version-name]
docker compose up -d
```
