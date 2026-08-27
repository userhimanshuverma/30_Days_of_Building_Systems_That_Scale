# Architecture Snapshot — Day 01: Monolithic Baseline

> **System Evolution Stage**: `v1-monolith`  
> **Executable Environment**: [`system-evolution/v1-monolith`](../system-evolution/v1-monolith)  
> **Related Guide**: [`Day 01 — You Don't Need Microservices Yet`](../days/phase-1-one-server-enough/day-01-no-microservices-yet/README.md)

---

## 🎯 Architecture Overview

High-level topology of the application at Day 01.

```text
+-------------------------------------------------------------------+
|                        Single Host Server                         |
|                                                                   |
|   +-----------------------------------------------------------+   |
|   |                  Application Monolith Process              |   |
|   |                                                           |   |
|   |  [Auth Mod]   [Catalog Mod]   [Order Mod]  [Inventory]    |   |
|   +-----------------------------------------------------------+   |
|                                 |                                 |
|                                 v                                 |
|   +-----------------------------------------------------------+   |
|   |                 PostgreSQL Primary Database               |   |
|   +-----------------------------------------------------------+   |
+-------------------------------------------------------------------+
```

---

## 📋 System Characteristics Matrix

| Attribute | Specification |
|---|---|
| **Deployment Model** | Single Server Monolith |
| **Data Consistency** | Strong Consistency (ACID) |
| **Scaling Mechanism** | Vertical Scaling Only |
| **Network Overhead** | 0 ms (In-Memory Inter-Module Calls) |
| **Single Point of Failure** | Host Server & Database Instance |

---

## 🏛️ Architectural Decision Log (ADR Index)

* **ADR-01**: Start with a single-process Modular Monolith to avoid premature distributed system overhead.
