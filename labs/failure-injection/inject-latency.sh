#!/usr/bin/env bash
# labs/failure-injection/inject-latency.sh
# Injects simulated gray failure latency into downstream payment proxy via Toxiproxy.
# Related Guide: Day 25 — Break Your Own System

TOXIPROXY_HOST=${TOXIPROXY_HOST:-"localhost:8474"}
PROXY_NAME=${1:-"payment_gateway"}
LATENCY_MS=${2:-2500}
JITTER_MS=${3:-200}

echo "=========================================================="
echo "⚡ Injecting ${LATENCY_MS}ms latency (+/- ${JITTER_MS}ms jitter) into ${PROXY_NAME}..."
echo "=========================================================="

curl -s -X POST "http://${TOXIPROXY_HOST}/proxies/${PROXY_NAME}/toxics" \
  -H "Content-Type: application/json" \
  -d "{
    \"type\": \"latency\",
    \"name\": \"latency_injection\",
    \"attributes\": {
      \"latency\": ${LATENCY_MS},
      \"jitter\": ${JITTER_MS}
    }
  }" | jq .

echo ""
echo "✅ Latency injected. Monitor Prometheus circuit breaker metrics and OpenTelemetry trace waterfalls."
echo "To remove toxic, run: curl -X DELETE http://${TOXIPROXY_HOST}/proxies/${PROXY_NAME}/toxics/latency_injection"
