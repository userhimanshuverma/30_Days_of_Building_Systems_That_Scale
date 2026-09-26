# 📊 System Architecture Diagrams

This directory contains the editable source diagrams and rendered visual assets illustrating the architectural evolution of **ShopScale** across all 30 days.

---

## 📁 Directory Structure

* [`src/`](./src/): Raw, editable diagram source files in **Mermaid** (`.mmd`) format.
* [`render/`](./render/): Exported high-resolution visual diagrams (PNG / SVG).

---

## 🗺️ Milestone Diagrams Index

| Milestone | Architecture Stage | Source File | Description |
|---|---|---|---|
| **v1** | Monolithic Baseline | [`v1-monolith.mmd`](./src/v1-monolith.mmd) | Single process modular monolith with in-memory calls and single PostgreSQL DB. |
| **v2** | Scaled Compute | [`v2-scaled-compute.mmd`](./src/v2-scaled-compute.mmd) | NGINX load balancer, stateless compute replicas, externalized Redis sessions. |
| **v3** | Cached Data Tier | [`v3-cached-data.mmd`](./src/v3-cached-data.mmd) | Read/write splitting with PostgreSQL streaming replicas, Redis cache-aside, PgBouncer. |
| **v4** | Asynchronous Workers | [`v4-async-workers.mmd`](./src/v4-async-workers.mmd) | Decoupled message queues (RabbitMQ/Kafka), 202 Accepted, background worker fleet. |
| **v5** | Resilient Services | [`v5-resilient-services.mmd`](./src/v5-resilient-services.mmd) | Envoy gateway, circuit breakers, transactional outbox CDC, domain-partitioned databases. |
| **v6** | Observable Stack | [`v6-observable-stack.mmd`](./src/v6-observable-stack.mmd) | OpenTelemetry collector, Prometheus metrics, Tempo traces, Loki logs, Toxiproxy chaos. |
| **v7** | Global Multi-Region | [`v7-global-architecture.mmd`](./src/v7-global-architecture.mmd) | Geo-DNS, perimeter distributed rate limiting, active-active multi-region Aurora clusters. |

---

## 🛠️ How to Edit or Render Diagrams

You can preview and edit `.mmd` files in:
* Any Mermaid-compatible editor (VS Code Mermaid Preview plugin, [Mermaid Live Editor](https://mermaid.live))
* Using the Mermaid CLI (`mmdc`):
  ```bash
  npm install -g @mermaid-js/mermaid-cli
  mmdc -i src/v1-monolith.mmd -o render/v1-monolith.png
  ```
