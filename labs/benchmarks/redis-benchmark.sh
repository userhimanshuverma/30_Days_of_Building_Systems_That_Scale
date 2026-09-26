#!/usr/bin/env bash
# labs/benchmarks/redis-benchmark.sh
# Benchmarks Redis caching operations (GET, SET, Pipelining) under concurrent load.
# Related Guide: Day 08 — Caching Is Easy Until It Isn't

REDIS_HOST=${REDIS_HOST:-"localhost"}
REDIS_PORT=${REDIS_PORT:-"6379"}
REQUESTS=${REQUESTS:-100000}
CLIENTS=${CLIENTS:-50}

echo "=========================================================="
echo "🚀 Benchmarking Redis Cache (${REDIS_HOST}:${REDIS_PORT})..."
echo "Requests: ${REQUESTS}, Concurrency: ${CLIENTS}"
echo "=========================================================="

# Test SET and GET performance with 50 parallel clients and 100-byte payloads
docker run --rm --network host redis:7-alpine redis-benchmark \
  -h "${REDIS_HOST}" \
  -p "${REDIS_PORT}" \
  -c "${CLIENTS}" \
  -n "${REQUESTS}" \
  -d 100 \
  -t set,get \
  -q
