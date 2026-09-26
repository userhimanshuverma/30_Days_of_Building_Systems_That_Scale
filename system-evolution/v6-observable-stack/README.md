# Milestone v6-observable-stack — Unified Observability & Telemetry Infrastructure

> **System Evolution Stage**: `v6-observable-stack`  
> **Previous Milestone**: [`v5-resilient-services`](../v5-resilient-services/README.md)  
> **Related Guides**:  
> - [Day 21 — Your Users Know There's a Problem Before You Do](../../days/phase-5-cant-scale-what-you-cant-see/day-21-users-know-before-you/README.md)  
> - [Day 22 — The Dashboard That Doesn't Help During an Incident](../../days/phase-5-cant-scale-what-you-cant-see/day-22-unhelpful-dashboards/README.md) *(Phase 5)*  
> - Day 23 — What Actually Happens During a Production Incident? *(Phase 5)*  
> - Day 24 — Load Testing Before Your Users Do It for You *(Phase 5)*  
> - Day 25 — Break Your Own System *(Phase 5)*  
> **Next Milestone**: `v7-global-architecture` (Phase 6)

---

## 🎯 Architecture Overview

`v6-observable-stack` marks the sixth major milestone in the evolution of **ShopScale**: upgrading our distributed microservice architecture with a **first-class, correlated telemetry plane**.

In `v5-resilient-services`, we decomposed the application into isolated microservices with circuit breakers, bulkheads, retries, and transactional sagas. However, with dozens of decoupled services running across multiple compute nodes, diagnosing production failures became nearly impossible using traditional host metrics and isolated logs.

In `v6-observable-stack`, telemetry is elevated to a unified architectural pillar:
1. **Pervasive Context Propagation**: Every ingress request at the API Gateway receives a W3C `traceparent` header (`TraceID` + `SpanID`), which is propagated across all synchronous HTTP/gRPC calls, thread pools, and asynchronous Kafka events.
2. **The Telemetry Triad Interlock**:
   - **Metrics (Prometheus)**: Aggregated time-series tracking the **RED Method** (Rate, Errors, Duration percentiles: p50, p95, p99) on all service boundaries for real-time alerting.
   - **Distributed Traces (OpenTelemetry + Tempo/Jaeger)**: End-to-end waterfall spans isolating exactly which microservice or database query added latency or threw an error.
   - **Structured Logs (Vector + Grafana Loki / OpenSearch)**: Asynchronous, structured JSON log events embedding the active `trace_id` and `span_id` for instant forensic drilldown.
3. **Tail-Based Sampling**: The OpenTelemetry Collector cluster analyzes incoming spans in memory, retaining 100% of errors and high-latency anomalies while sampling down nominal traffic to control storage costs.

```text
                                 [ Client Ingress ]
                                         │
                                         ▼
                          ┌─────────────────────────────┐
                          │   API Gateway & Ingress     │
                          │   • W3C Trace Injection     │
                          │   • RED Metric Emission     │
                          └──────────────┬──────────────┘
                                         │
                 ┌───────────────────────┼───────────────────────┐
                 │ (traceparent)         │ (traceparent)         │ (traceparent)
                 ▼                       ▼                       ▼
        ┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
        │  Order Service  │     │ Payment Service │     │ Inventory Serv. │
        │ (OTel Traced)   │     │ (OTel Traced)   │     │ (OTel Traced)   │
        └────────┬────────┘     └────────┬────────┘     └────────┬────────┘
                 │                       │                       │
                 └───────────────────────┼───────────────────────┘
                                         │
                                         ▼
         ┌─────────────────────────────────────────────────────────────┐
         │             Telemetry Collection & Pipeline Mesh            │
         ├──────────────────────────────┬──────────────────────────────┤
         │  • OpenTelemetry Collector   │  • Vector / FluentBit Daemon │
         │  • Tail-Based Trace Sampler  │  • Async Bounded Ring Buffer │
         └──────────────┬───────────────┴──────────────┬───────────────┘
                        │                              │
         ┌──────────────┴───────────────┐              │
         │                              │              │
         ▼                              ▼              ▼
  ┌──────────────┐              ┌──────────────┐ ┌──────────────┐
  │  Prometheus  │              │ Grafana Tempo│ │ Grafana Loki │
  │  (Metrics)   │              │  (Traces)    │ │   (Logs)     │
  └──────┬───────┘              └──────┬───────┘ └──────┬───────┘
         │                             │                │
         └──────────────────────┬──────┴────────────────┘
                                │
                                ▼
                 ┌─────────────────────────────┐
                 │      Unified Grafana        │
                 │   Correlated Incident Pane  │
                 │   Metric -> Trace -> Log    │
                 └─────────────────────────────┘
```

---

## 📋 System Characteristics Matrix

| Attribute | Specification |
|---|---|
| **Trace Context Standard** | W3C Trace Context (`traceparent`, `tracestate`) propagated via HTTP, gRPC, and Kafka record headers |
| **Telemetry SDK** | OpenTelemetry (OTel) language SDKs with vendor-neutral collector pipelines |
| **Service Ingress Metrics** | RED Method (Rate, Errors, Duration p50/p90/p99) with bounded label cardinality (no dynamic IDs) |
| **Resource Metrics** | USE Method (Utilization, Saturation, Errors) tracked across host CPU, memory, socket backlogs, and disk IOPS |
| **Trace Sampling Policy** | Tail-Based Sampling: 100% of HTTP 5xx errors & requests > 2,000ms latency; 2% of nominal 200 OK requests |
| **Log Format & Delivery** | Structured JSON with mandatory `trace_id`, `span_id`, `service`, `event`; non-blocking async shipping |
| **Correlation Mechanism** | Grafana unified data links: Metric anomaly links directly to exemplar Traces; Trace spans link directly to filtered Logs |

---

## 🧩 Component Breakdown

1. **OpenTelemetry Collector (`otel-collector`)**:
   * Unified telemetry ingestion gateway receiving traces (OTLP gRPC/HTTP 4317/4318) and metrics.
   * Performs tail-based sampling, attribute scrubbing (PII redaction), and batch forwarding.
2. **Prometheus Metrics Storage (`prometheus`)**:
   * Scrapes RED method endpoints and USE resource counters every 15 seconds.
   * Evaluates SLO burn rate rules and triggers Alertmanager notifications.
3. **Grafana Tempo (Distributed Tracing)**:
   * Highly scalable, cost-efficient object-storage backed trace repository.
   * Indexes `trace_id` and search tags for instantaneous span waterfall inspection.
4. **Grafana Loki (Structured Log Aggregator)**:
   * Horizontally scalable log aggregator that indexes labels (`service`, `env`, `level`) rather than full-text payloads.
   * Correlates logs with Tempo traces using embedded `trace_id`.
5. **Unified Grafana Dashboards**:
   * Single-pane visualization connecting Prometheus alerts to Tempo trace waterfalls and Loki log context.
6. **Toxiproxy Chaos Engine (`toxiproxy`)**:
   * Programmable TCP latency and packet injection proxy used during chaos drills and load testing.

---

## 🚀 How to Launch This Milestone

You can spin up the full observability and chaos testing stack locally using Docker Compose:

```bash
cd system-evolution/v6-observable-stack
docker compose up -d --build
```

### Verification & Health Check

1. **Access Observability Portals**:
   * **Grafana**: [http://localhost:3000](http://localhost:3000) (Default user/pass: `admin`/`admin`)
   * **Prometheus**: [http://localhost:9090](http://localhost:9090)
   * **Toxiproxy API**: [http://localhost:8474](http://localhost:8474)

2. **Trigger Synthetic Traces & Metrics**:
   ```bash
   # Generate test traffic through instrumented services
   curl -i http://localhost:8080/api/v1/catalog
   ```

3. **Verify Distributed Trace Flow**:
   ```bash
   # Query OTel collector health and exported span count
   curl -s http://localhost:8889/metrics | grep "otelcol_exporter_sent_spans"
   ```

---

## 🏛️ Associated Architectural Decisions (ADRs)

* **[ADR-21: Adopt the 4 Golden Signals & Structured JSON Logging](../../days/phase-5-cant-scale-what-you-cant-see/day-21-users-know-before-you/README.md)**: Replaced unformatted log files with structured JSON and standardized on Latency, Traffic, Errors, and Saturation.
* **[ADR-22: Multi-Window Multi-Burn-Rate SLO Alerting](../../days/phase-5-cant-scale-what-you-cant-see/day-22-unhelpful-dashboards/README.md)**: Eliminated alert fatigue by tying high-urgency pages exclusively to error-budget consumption rate.
* **[ADR-23: Vendor-Neutral OpenTelemetry Distributed Tracing](../../days/phase-5-cant-scale-what-you-cant-see/day-23-production-incident-walkthrough/README.md)**: Instrument services with W3C context headers to achieve sub-second root-cause diagnosis.
* **[ADR-24: Four-Stage Automated Load Testing with k6](../../days/phase-5-cant-scale-what-you-cant-see/day-24-load-testing-in-practice/README.md)**: Established baseline, stress, spike, and soak test profiles integrated directly into deployment gates.
* **[ADR-25: Continuous Chaos Testing & Toxiproxy Sidecars](../../days/phase-5-cant-scale-what-you-cant-see/day-25-breaking-your-own-system/README.md)**: Mandated automated failure injection for network latency and worker process crashes.
