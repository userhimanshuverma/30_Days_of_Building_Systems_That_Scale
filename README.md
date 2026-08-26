# 🚀 30 Days of Building Systems That Scale

> **From a simple application running on a single server to a system built for growth, high availability, fault tolerance, and scale.**

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Series Status](https://img.shields.io/badge/Series-30%20Days%20Active-brightgreen.svg)](#the-30-day-roadmap)
[![LinkedIn](https://img.shields.io/badge/Follow-LinkedIn-0A66C2.svg)](#context--linkedin-entry-point)

---

## 📌 Context & Philosophy

This repository is **not** a traditional tutorial series, nor is it a collection of disconnected technical notes.

Instead, this series documents the **step-by-step evolution of a single real-world system**. 

We begin on **Day 01** with a simple application running on a single server. As user traffic grows, real engineering bottlenecks emerge—CPU saturation, database connection limits, lock contention, network latency, network partitions, and cascading failures. Day by day, we solve these problems using real-world architectural patterns, trade-offs, and failure-mode analysis.

```text
Simple Application (Day 01)
        ↓
More Users & CPU Saturation (Day 03)
        ↓
Horizontal Scaling & Load Balancing (Day 05)
        ↓
Database Bottlenecks & Read Replicas (Day 07)
        ↓
Caching Strategies & Cache Stampedes (Day 08)
        ↓
Database Sharding & Data Partitioning (Day 09)
        ↓
Asynchronous Processing & Message Queues (Day 12)
        ↓
Distributed Systems & Consensus (Day 19)
        ↓
Cascading Failures & Circuit Breakers (Day 18)
        ↓
Observability, Telemetry & Distributed Tracing (Day 21)
        ↓
Chaos Engineering & Failure Injection (Day 25)
        ↓
Rate Limiting & Global Multi-Region Architecture (Day 27)
        ↓
System Designed for 10x Scale (Day 30)
```

---

## 🎯 How to Use This Repository

Depending on your learning goals, navigate the repository through one of three lenses:

| Learning Persona | Recommended Path | What You Will Gain |
|---|---|---|
| **Daily Learner** | [`days/`](./days/) | 30 structured, daily technical guides focusing on specific engineering problems and trade-offs. |
| **System Architect** | [`architecture/`](./architecture/) | High-level architectural snapshots (ADRs) showing key milestone transitions (`v1` to `v7`). |
| **Hands-On Engineer** | [`system-evolution/`](./system-evolution/) & [`labs/`](./labs/) | Executable Docker Compose environments, k6 load testing scripts, and chaos injection experiments. |

---

## 🗺️ The 30-Day Master Roadmap

### Phase 1 — When One Server Is Enough
> *Focus: Baselines, bottleneck identification, vertical vs horizontal scaling, load balancing.*

| Day | Engineering Problem & Guide | Key Concepts & Trade-Offs | Architecture Snapshot |
|---|---|---|---|
| **01** | [You Don't Need Microservices Yet](./days/phase-1-one-server-enough/day-01-no-microservices-yet/README.md) | Monolithic simplicity, deployment velocity, early-stage trade-offs | `v1-monolith` |
| **02** | [What Does Scale Actually Mean?](./days/phase-1-one-server-enough/day-02-what-scale-means/README.md) | Latency, throughput, SLA/SLO/SLI, saturation, availability math | `v1-monolith` |
| **03** | [The First 1,000 Users](./days/phase-1-one-server-enough/day-03-first-1000-users/README.md) | Resource utilization, single-point-of-failure analysis | `v1-monolith` |
| **04** | [Vertical vs Horizontal Scaling](./days/phase-1-one-server-enough/day-04-vertical-vs-horizontal/README.md) | Scale-up limits, cost curves, stateless application design | `v1-monolith` |
| **05** | [The Load Balancer Changes Everything](./days/phase-1-one-server-enough/day-05-load-balancer-changes-everything/README.md) | L4 vs L7 balancing, health checks, sticky sessions vs stateless | `v2-scaled-compute` |

---

### Phase 2 — The Database Becomes the Problem
> *Focus: Data tier scaling, read replication, caching invalidation, sharding, consistency.*

| Day | Engineering Problem & Guide | Key Concepts & Trade-Offs | Architecture Snapshot |
|---|---|---|---|
| **06** | [Your Application Scales. Your Database Doesn't.](./days/phase-2-database-becomes-the-problem/day-06-app-scales-db-doesnt/README.md) | Connection pooling, lock contention, IOPS limits | `v2-scaled-compute` |
| **07** | [Read Replicas: The First Escape Route](./days/phase-2-database-becomes-the-problem/day-07-read-replicas/README.md) | Replication lag, read/write splitting, eventual read consistency | `v3-cached-data` |
| **08** | [Caching Is Easy Until It Isn't](./days/phase-2-database-becomes-the-problem/day-08-caching-easy-until-not/README.md) | Cache stampedes, cache penetration, eviction policies, invalidation | `v3-cached-data` |
| **09** | [When One Database Is No Longer Enough](./days/phase-2-database-becomes-the-problem/day-09-one-db-not-enough/README.md) | Vertical vs horizontal partitioning, sharding keys, rebalancing | `v3-cached-data` |
| **10** | [Scaling Data Without Breaking Consistency](./days/phase-2-database-becomes-the-problem/day-10-data-without-breaking-consistency/README.md) | Two-phase commit (2PC), Saga pattern, distributed transactions | `v3-cached-data` |

---

### Phase 3 — Stop Making Everything Synchronous
> *Focus: Async processing, message queues, idempotency, backpressure, spike dampening.*

| Day | Engineering Problem & Guide | Key Concepts & Trade-Offs | Architecture Snapshot |
|---|---|---|---|
| **11** | [The Request That Should Never Have Been Synchronous](./days/phase-3-stop-making-everything-synchronous/day-11-never-synchronous-request/README.md) | Request-response coupling, user-facing latency, blocking operations | `v4-async-workers` |
| **12** | [Introducing the Queue](./days/phase-3-stop-making-everything-synchronous/day-12-introducing-the-queue/README.md) | Message brokers (RabbitMQ/Kafka), point-to-point vs pub-sub | `v4-async-workers` |
| **13** | [Exactly Once Is Not What You Think](./days/phase-3-stop-making-everything-synchronous/day-13-exactly-once-myth/README.md) | At-least-once delivery, idempotent consumers, deduplication keys | `v4-async-workers` |
| **14** | [Back Pressure: When Your System Can't Keep Up](./days/phase-3-stop-making-everything-synchronous/day-14-back-pressure/README.md) | Queue capacity limits, drop policies, rate shedding, consumer scaling | `v4-async-workers` |
| **15** | [Designing a System That Can Survive Spikes](./days/phase-3-stop-making-everything-synchronous/day-15-surviving-traffic-spikes/README.md) | Buffering, peak shaving, dead-letter queues (DLQ), priority queues | `v4-async-workers` |

---

### Phase 4 — Now the System Is Distributed
> *Focus: Network reliability, retries/circuit breakers, cascading failures, CAP theorem.*

| Day | Engineering Problem & Guide | Key Concepts & Trade-Offs | Architecture Snapshot |
|---|---|---|---|
| **16** | [The Network Is Not Reliable](./days/phase-4-now-the-system-is-distributed/day-16-network-is-unreliable/README.md) | Fallacies of distributed computing, packet drops, tail latency | `v5-resilient-services` |
| **17** | [Timeouts, Retries, and the Retry Storm](./days/phase-4-now-the-system-is-distributed/day-17-timeouts-retries-retry-storm/README.md) | Exponential backoff, jitter, circuit breakers, request hedging | `v5-resilient-services` |
| **18** | [The Cascading Failure](./days/phase-4-now-the-system-is-distributed/day-18-cascading-failures/README.md) | Bulkheads, load shedding, graceful degradation, fallback mechanisms | `v5-resilient-services` |
| **19** | [Distributed Systems Don't Agree on Everything](./days/phase-4-now-the-system-is-distributed/day-19-distributed-disagreement/README.md) | Clock skew, vector clocks, consensus algorithms (Raft/Paxos) | `v5-resilient-services` |
| **20** | [Consistency vs Availability: A Real Engineering Decision](./days/phase-4-now-the-system-is-distributed/day-20-consistency-vs-availability/README.md) | CAP theorem in practice, PACELC theorem, tunable consistency | `v5-resilient-services` |

---

### Phase 5 — You Can't Scale What You Can't See
> *Focus: Telemetry (Metrics, Logs, Traces), incident response, load testing, chaos engineering.*

| Day | Engineering Problem & Guide | Key Concepts & Trade-Offs | Architecture Snapshot |
|---|---|---|---|
| **21** | [Your Users Know There's a Problem Before You Do](./days/phase-5-cant-scale-what-you-cant-see/day-21-users-know-before-you/README.md) | The 4 Golden Signals, RED vs USE metrics, structured logging | `v6-observable-stack` |
| **22** | [The Dashboard That Doesn't Help During an Incident](./days/phase-5-cant-scale-what-you-cant-see/day-22-unhelpful-dashboards/README.md) | Alert fatigue, actionable alerts vs noise, SLO-based alerting | `v6-observable-stack` |
| **23** | [What Actually Happens During a Production Incident?](./days/phase-5-cant-scale-what-you-cant-see/day-23-production-incident-walkthrough/README.md) | Triage, distributed tracing (OpenTelemetry), blameless post-mortems | `v6-observable-stack` |
| **24** | [Load Testing Before Your Users Do It for You](./days/phase-5-cant-scale-what-you-cant-see/day-24-load-testing-in-practice/README.md) | Stress vs load vs soak testing, scenario modeling with k6 | `v6-observable-stack` |
| **25** | [Break Your Own System](./days/phase-5-cant-scale-what-you-cant-see/day-25-breaking-your-own-system/README.md) | Chaos engineering, failure injection (latency, process kill), game days | `v6-observable-stack` |

---

### Phase 6 — Designing for Real Scale
> *Focus: Rate limiting, multi-region architecture, cloud cost economics, 10x scalability planning.*

| Day | Engineering Problem & Guide | Key Concepts & Trade-Offs | Architecture Snapshot |
|---|---|---|---|
| **26** | [Rate Limiting at Scale](./days/phase-6-designing-for-real-scale/day-26-rate-limiting-at-scale/README.md) | Token bucket, leaky bucket, sliding window counter, distributed Redis limiters | `v7-global-architecture` |
| **27** | [Multi-Region Systems](./days/phase-6-designing-for-real-scale/day-27-multi-region-architecture/README.md) | Active-Passive vs Active-Active, Geo-DNS, global data replication | `v7-global-architecture` |
| **28** | [How Much Does Scaling Actually Cost?](./days/phase-6-designing-for-real-scale/day-28-scaling-cost-economics/README.md) | Cloud unit economics, egress bandwidth costs, over-provisioning vs auto-scaling | `v7-global-architecture` |
| **29** | [Designing for 10× Growth](./days/phase-6-designing-for-real-scale/day-29-designing-for-10x-growth/README.md) | Capacity planning, bottleneck forecasting, architectural refactoring triggers | `v7-global-architecture` |
| **30** | [The System That Grew With Us](./days/phase-6-designing-for-real-scale/day-30-the-system-that-grew-with-us/README.md) | Retrospective: Day 01 vs Day 30 architecture comparison, final takeaways | `v7-global-architecture` |

---

## 📐 Repository Structure & Navigation

```text
30-days-of-building-systems-that-scale/
├── README.md                           # Main entry point & series roadmap
├── architecture/                       # System evolution snapshots & ADR index
│   ├── day-01-monolithic-baseline.md
│   ├── day-05-load-balanced-ingress.md
│   ├── day-10-replicated-cached-data.md
│   ├── day-15-async-event-driven.md
│   ├── day-20-resilient-distributed.md
│   ├── day-25-observable-chaos-ready.md
│   └── day-30-multi-region-scale.md
├── days/                               # 30 Daily guides organized by 6 phases
│   ├── phase-1-one-server-enough/
│   ├── phase-2-database-becomes-the-problem/
│   ├── phase-3-stop-making-everything-synchronous/
│   ├── phase-4-now-the-system-is-distributed/
│   ├── phase-5-cant-scale-what-you-cant-see/
│   └── phase-6-designing-for-real-scale/
├── system-evolution/                   # Runnable Docker Compose environments (v1 to v7)
│   ├── v1-monolith/
│   ├── v2-scaled-compute/
│   ├── v3-cached-data/
│   ├── v4-async-workers/
│   ├── v5-resilient-services/
│   ├── v6-observable-stack/
│   └── v7-global-architecture/
├── labs/                               # Executable test scripts & experiments
│   ├── load-testing/
│   ├── failure-injection/
│   └── benchmarks/
├── diagrams/                           # Editable source diagrams (.mermaid/.excalidraw) & renders
│   ├── src/
│   └── render/
└── templates/                          # Contribution & author templates
    ├── daily-readme-template.md
    └── architecture-snapshot-template.md
```

---

## ⚡ Quick Start: Running the Evolving System

To spin up any version of the evolving system locally, ensure you have **Docker** and **Docker Compose** installed:

```bash
# 1. Clone the repository
git clone https://github.com/your-username/30-days-of-building-systems-that-scale.git
cd 30-days-of-building-systems-that-scale

# 2. Navigate to the desired architecture version (e.g., v3 Cached Data Tier)
cd system-evolution/v3-cached-data

# 3. Spin up the environment
docker compose up -d

# 4. Run a load test against the milestone system
cd ../../labs/load-testing
k6 run baseline-test.js
```

---

## 📝 License & Contributing

Contributions, feedback, and issue discussions are welcome! Please read [`CONTRIBUTING.md`](./CONTRIBUTING.md) before submitting pull requests.

This project is licensed under the MIT License - see the [`LICENSE`](./LICENSE) file for details.
