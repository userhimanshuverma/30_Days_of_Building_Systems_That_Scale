# 📊 Infrastructure Benchmarks Lab

> **Related Guides**:  
> - [Day 06 — Your Application Scales. Your Database Doesn't.](../../days/phase-2-database-becomes-the-problem/day-06-app-scales-db-doesnt/README.md)  
> - [Day 08 — Caching Is Easy Until It Isn't](../../days/phase-2-database-becomes-the-problem/day-08-caching-easy-until-not/README.md)  
> - [Day 28 — How Much Does Scaling Actually Cost?](../../days/phase-6-designing-for-real-scale/day-28-scaling-cost-economics/README.md)

---

## 🎯 Overview

This lab contains automated benchmarking scripts to measure raw throughput, latency saturation points, and connection limits across key infrastructure components:
* **PostgreSQL Connection Pool Contention**: Quantifies the performance collapse when hundreds of client processes open direct database connections vs routing through PgBouncer transaction pooling.
* **Redis Caching Throughput**: Evaluates raw GET/SET operations, pipelining benefits, and eviction latencies under concurrent load.

---

## 📂 Scripts

| Script | Component | Metrics Captured |
|---|---|---|
| [`db-connection-benchmark.sh`](./db-connection-benchmark.sh) | PostgreSQL / PgBouncer | TPS (Transactions per second), connection acquisition latency, query p99. |
| [`redis-benchmark.sh`](./redis-benchmark.sh) | Redis Cluster | Requests/sec, sub-millisecond latency distribution across commands. |

---

## 🚀 Usage

### Benchmark Database Connection Pooling
```bash
cd labs/benchmarks
chmod +x *.sh

# Benchmark PostgreSQL primary
./db-connection-benchmark.sh
```

### Benchmark In-Memory Redis Cache
```bash
./redis-benchmark.sh
```
