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
