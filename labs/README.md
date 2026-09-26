# 🔬 Systems That Scale — Engineering Labs

Welcome to the hands-on engineering lab repository for **30 Days of Building Systems That Scale**.

While the [`days/`](../days/) guides provide deep theoretical foundations and architectural patterns, the **Labs** provide executable, repeatable experiments to reproduce bottlenecks and measure system performance under pressure.

---

## 🗂️ Lab Modules

| Lab Module | Directory | Focus Area | Key Tools |
|---|---|---|---|
| **Load Testing** | [`labs/load-testing/`](./load-testing/) | Synthetic user journey modeling, open workload arrival rates, p95/p99 latency assertions, SLO error budget validation. | [k6](https://k6.io/) |
| **Failure Injection** | [`labs/failure-injection/`](./failure-injection/) | Chaos engineering, gray failure simulation (network latency, jitter, packet loss), cascading failure reproduction, circuit breaker verification. | [Toxiproxy](https://github.com/Shopify/toxiproxy), cURL |
| **Benchmarks** | [`labs/benchmarks/`](./benchmarks/) | Component-level performance isolation: PgBouncer vs direct PostgreSQL connections, Redis GET/SET operations and pipeline throughput. | `pgbench`, `redis-benchmark` |

---

## ⚡ Quick Start

### 1. Run a Baseline Load Test
Verify that your local system environment is running and can sustain baseline traffic:

```bash
cd labs/load-testing
k6 run baseline-test.js
```

### 2. Simulate Downstream Network Latency
Inject 2,500ms latency into an upstream payment service to test circuit breaker tripping:

```bash
cd labs/failure-injection
./inject-latency.sh payment_gateway 2500 200
```

### 3. Benchmark PostgreSQL Connection Pooling
Observe connection queue saturation:

```bash
cd labs/benchmarks
./db-connection-benchmark.sh
```
