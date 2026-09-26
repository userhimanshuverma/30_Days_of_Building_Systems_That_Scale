#!/usr/bin/env bash
# labs/benchmarks/db-connection-benchmark.sh
# Benchmarks PostgreSQL throughput with direct connections vs PgBouncer connection pooling.
# Related Guide: Day 06 — Your Application Scales. Your Database Doesn't.

DB_HOST=${DB_HOST:-"localhost"}
DB_PORT=${DB_PORT:-"5432"}
DB_USER=${DB_USER:-"postgres"}
DB_NAME=${DB_NAME:-"shopscale"}
CLIENTS=${CLIENTS:-100}
TIME_SEC=${TIME_SEC:-30}

echo "=========================================================="
echo "📊 Benchmarking PostgreSQL Connections via pgbench..."
echo "Host: ${DB_HOST}:${DB_PORT}, Clients: ${CLIENTS}, Duration: ${TIME_SEC}s"
echo "=========================================================="

# Run pgbench select-only benchmark
docker run --rm --network host postgres:15-alpine pgbench \
  -h "${DB_HOST}" \
  -p "${DB_PORT}" \
  -U "${DB_USER}" \
  -c "${CLIENTS}" \
  -j 4 \
  -T "${TIME_SEC}" \
  -S \
  "${DB_NAME}"
