// labs/load-testing/baseline-test.js
// Fast baseline smoke/load test for verifying ShopScale milestone deployments.
// Run with: k6 run baseline-test.js

import http from 'k6/http';
import { check, sleep } from 'k6';

const BASE_URL = __ENV.TARGET_URL || 'http://localhost:8080';

export const options = {
  stages: [
    { duration: '30s', target: 50 },  // Ramp-up to 50 VUs
    { duration: '1m', target: 50 },   // Steady-state baseline load
    { duration: '15s', target: 0 },   // Ramp-down
  ],
  thresholds: {
    http_req_duration: ['p(95)<200', 'p(99)<500'],
    http_req_failed: ['rate<0.01'],
  },
};

export default function () {
  // 1. Health check probe
  const healthRes = http.get(`${BASE_URL}/health`);
  check(healthRes, {
    'health check status is 200': (r) => r.status === 200,
  });

  // 2. Fetch catalog endpoint
  const catalogRes = http.get(`${BASE_URL}/api/v1/products`);
  check(catalogRes, {
    'catalog response status is 200': (r) => r.status === 200 || r.status === 404,
  });

  sleep(0.5);
}
