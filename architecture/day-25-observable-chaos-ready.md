# Architecture Snapshot — Day 25: Observable & Chaos-Tested Stack

> **System Evolution Stage**: `v6-observable-stack`  
> **Executable Environment**: [`system-evolution/v6-observable-stack`](../system-evolution/v6-observable-stack)  
> **Preceding Architecture**: [`Day 20 Resilient Distributed`](./day-20-resilient-distributed.md)  
> **Succeeding Architecture**: [`Day 30 Global Multi-Region`](./day-30-multi-region-scale.md)  
> **Related Guides**:  
> - [`Day 21 — Your Users Know There's a Problem Before You Do`](../days/phase-5-cant-scale-what-you-cant-see/day-21-users-know-before-you/README.md)  
> - [`Day 22 — The Dashboard That Doesn't Help During an Incident`](../days/phase-5-cant-scale-what-you-cant-see/day-22-unhelpful-dashboards/README.md)  
> - [`Day 23 — What Actually Happens During a Production Incident?`](../days/phase-5-cant-scale-what-you-cant-see/day-23-production-incident-walkthrough/README.md)  
> - [`Day 24 — Load Testing Before Your Users Do It for You`](../days/phase-5-cant-scale-what-you-cant-see/day-24-load-testing-in-practice/README.md)  
> - [`Day 25 — Break Your Own System`](../days/phase-5-cant-scale-what-you-cant-see/day-25-breaking-your-own-system/README.md)

---

## 🎯 Architecture Overview

At Day 25, the system reaches full operational observability and resilience through continuous chaos experimentation:
* **The Telemetry Triad**: All services are instrumented with the vendor-neutral OpenTelemetry SDK, continuously emitting RED metrics to Prometheus, structured JSON logs to Grafana Loki, and W3C distributed trace spans to Grafana Tempo.
* **Correlated Incident Pane**: An anomalous Prometheus metric alert automatically links to exemplar trace IDs in Grafana; clicking a trace span instantly surfaces the filtered container logs for that exact transaction.
* **Continuous Chaos Injection**: Integrated Toxiproxy sidecars inject 2,500ms network jitter, simulated packet loss, and process termination during automated k6 load tests to prove that circuit breakers and bulkheads work under peak load.

```text
                        [ Client Traffic + k6 Load Tests ]
                                        │
                                        ▼
                        ┌───────────────────────────────┐
                        │       API Gateway (Envoy)     │
                        └───────────────┬───────────────┘
                                        │
                 ┌──────────────────────┴──────────────────────┐
                 ▼                                             ▼
        ┌──────────────────┐  Toxiproxy Chaos Sidecar ┌──────────────────┐
        │  Order Service   │◄────── [ 2500ms Latency ]─│ Payment Gateway  │
        │ (OTel Collector) │                           │ (OTel Collector) │
        └────────┬─────────┘                           └────────┬─────────┘
                 │                                              │
                 │ OTLP Traces / Prometheus Metrics / JSON Logs │
                 └──────────────────────┬───────────────────────┘
                                        │
                                        ▼
        ┌─────────────────────────────────────────────────────────────┐
        │            OpenTelemetry Collector Daemon Tier              │
        │        (Tail Sampling, PII Masking, Batch Forwarding)       │
        └───────┬───────────────────────┼─────────────────────┬───────┘
                │ Metrics               │ Traces              │ Logs
                ▼                       ▼                     ▼
        ┌──────────────┐        ┌──────────────┐      ┌──────────────┐
        │  Prometheus  │        │ Grafana Tempo│      │ Grafana Loki │
        └───────┬──────┘        └───────┬──────┘      └───────┬──────┘
                │                       │                     │
                └───────────────────────┼─────────────────────┘
                                        │
                                        ▼
                        ┌───────────────────────────────┐
                        │   Unified Grafana Incident    │
                        │   Dashboard (Metric->Trace->) │
                        └───────────────────────────────┘
```

---

## 📋 System Characteristics Matrix

| Attribute | Specification |
|---|---|
| **Topology** | Distributed Microservices + OpenTelemetry Collector + Prometheus + Tempo + Loki + Toxiproxy |
| **Telemetry Standard** | W3C Distributed Tracing (`traceparent`) propagated across HTTP, gRPC, and Kafka headers |
| **Sampling Strategy** | Tail-based: 100% of HTTP 5xx errors & slow spans (> 2,000ms); 2% of nominal 200 OK spans |
| **Alerting Methodology**| Multi-Window Multi-Burn-Rate SLO alerts against real error budget depletion |
| **Chaos Injection** | Toxiproxy network latency, bandwidth throttling, connection slicing, process terminations |
| **Load Testing Gate** | Automated k6 pipelines executing baseline, stress, spike, and soak profiles before deployments |
| **Mean Time to Detect (MTTD)**| Reduced from 45 minutes to < 60 seconds |

---

## 🏛️ Architectural Decision Log (ADR Index)

* **[ADR-21: Standardize on RED Metrics & Structured JSON Logging](../days/phase-5-cant-scale-what-you-cant-see/day-21-users-know-before-you/README.md)**: Replaced disparate log formats with strict JSON schemas and indexed labels.
* **[ADR-22: Error-Budget SLO Alerting](../days/phase-5-cant-scale-what-you-cant-see/day-22-unhelpful-dashboards/README.md)**: Eliminated noisy CPU thresholds in favor of user-facing availability and latency SLO burn rates.
* **[ADR-23: End-to-End Distributed Tracing via OpenTelemetry](../days/phase-5-cant-scale-what-you-cant-see/day-23-production-incident-walkthrough/README.md)**: Standardized distributed trace propagation across all client, microservice, and queue hops.
* **[ADR-24: Continuous Performance Validation with k6](../days/phase-5-cant-scale-what-you-cant-see/day-24-load-testing-in-practice/README.md)**: Defined automated performance regression tests with strict SLO-based error and latency thresholds.
* **[ADR-25: Shift-Left Chaos Engineering & Toxiproxy Validation](../days/phase-5-cant-scale-what-you-cant-see/day-25-breaking-your-own-system/README.md)**: Mandated automated resilience verification against gray failures and partial network partitions.

---

## 🚀 How to Launch This System Snapshot

```bash
cd system-evolution/v6-observable-stack
docker compose up -d --build
```
