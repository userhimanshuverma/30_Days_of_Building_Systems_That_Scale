# 🧪 Load Testing Lab

> **Related Guides**:  
> - [Day 02 — What Does Scale Actually Mean?](../../days/phase-1-one-server-enough/day-02-what-scale-means/README.md)  
> - [Day 24 — Load Testing in Practice](../../days/phase-5-cant-scale-what-you-cant-see/day-24-load-testing-in-practice/README.md)

---

## 🎯 Overview

This directory contains executable load testing suites utilizing [k6](https://k6.io/) to measure system latency, throughput, concurrency limits, and failure thresholds across our system evolution stages.

---

## 📂 Scripts

| Script | Purpose | Execution |
|---|---|---|
| [`baseline-test.js`](./baseline-test.js) | Rapid smoke test and baseline verification (50 concurrent VUs, 1m duration). | `k6 run baseline-test.js` |
| [`load-test-shopscale.js`](./load-test-shopscale.js) | Full multi-scenario production profile (Open workload model, 1,500 RPS arrival rate, catalog/cart/checkout journeys). | `k6 run load-test-shopscale.js` |

---

## 🚀 Usage

### 1. Prerequisites
Install `k6`:
```bash
# macOS
brew install k6

# Windows (winget / choco)
winget install k6 --source winget
# or: choco install k6

# Linux (Debian/Ubuntu)
sudo gpg -k
sudo gpg --no-default-keyring --keyring /usr/share/keyrings/k6-archive-keyring.gpg --keyserver hkp://keyserver.ubuntu.com:80 --recv-keys C5AD17C747E3415A3642D57D77C6C491D6AC1D69
echo "deb [signed-by=/usr/share/keyrings/k6-archive-keyring.gpg] https://dl.k6.io/deb stable main" | sudo tee /etc/apt/sources.list.d/k6.list
sudo apt-get update && sudo apt-get install k6
```

### 2. Running Against Local Environments
```bash
# Run against default localhost:8080
k6 run baseline-test.js

# Target a custom port or staging environment
TARGET_URL="http://localhost:80" k6 run load-test-shopscale.js
```
