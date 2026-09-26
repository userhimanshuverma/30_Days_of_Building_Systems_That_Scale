# 💥 Failure Injection & Chaos Engineering Lab

> **Related Guides**:  
> - [Day 16 — The Network Is Not Reliable](../../days/phase-4-now-the-system-is-distributed/day-16-network-is-unreliable/README.md)  
> - [Day 18 — The Cascading Failure](../../days/phase-4-now-the-system-is-distributed/day-18-cascading-failures/README.md)  
> - [Day 25 — Break Your Own System](../../days/phase-5-cant-scale-what-you-cant-see/day-25-breaking-your-own-system/README.md)

---

## 🎯 Overview

Clean process crashes are easy to handle. Real production outages are caused by **gray failures**: 2% packet drops, 2,500ms downstream latency, starved connection pools, and thread exhaustion.

This lab provides tools and scripts to inject synthetic gray failures and verify circuit breaker, bulkhead, and timeout defenses in local Docker Compose environments.

---

## 📂 Contents

| File | Purpose |
|---|---|
| [`toxiproxy-config.json`](./toxiproxy-config.json) | Toxiproxy upstream definitions for payment gateway, database, and Redis. |
| [`inject-latency.sh`](./inject-latency.sh) | Shell script to inject configurable latency and jitter into any active Toxiproxy socket. |

---

## 🚀 Usage

### 1. Start Toxiproxy
Toxiproxy runs as part of the `v6-observable-stack` Docker Compose environment:
```bash
cd ../../system-evolution/v6-observable-stack
docker compose up -d
```

### 2. Inject Latency
```bash
cd ../../labs/failure-injection
chmod +x inject-latency.sh

# Inject 2,500ms latency into payment gateway
./inject-latency.sh payment_gateway 2500 200
```

### 3. Observe the System Under Test
While running synthetic load (`k6 run ../load-testing/load-test-shopscale.js`):
1. Open Grafana (`http://localhost:3000`)
2. Observe circuit breaker state transitions (`CLOSED` → `OPEN`)
3. Inspect trace waterfalls in Grafana Tempo to confirm fallback executions

### 4. Heal the Failure (Remove Toxic)
```bash
curl -X DELETE http://localhost:8474/proxies/payment_gateway/toxics/latency_injection
```
