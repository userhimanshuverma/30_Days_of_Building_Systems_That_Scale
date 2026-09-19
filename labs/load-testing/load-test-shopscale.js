// labs/load-testing/load-test-shopscale.js
// Production-grade k6 load test script for ShopScale v6-observable-stack
// Demonstrates Open Workload Modeling, Threshold assertions, and multi-scenario profiles.

import http from 'k6/http';
import { check, sleep } from 'k6';
import { Counter, Rate, Trend } from 'k6/metrics';

// Custom Application Metrics
const checkoutLatency = new Trend('shopscale_checkout_duration');
const inventoryContentionRate = new Rate('shopscale_inventory_conflict_rate');
const successfulOrders = new Counter('shopscale_successful_orders');

// Target Configuration
const BASE_URL = __ENV.TARGET_URL || 'http://localhost:8080';
const TOTAL_PRODUCTS = 50000;

export const options = {
  thresholds: {
    'http_req_duration{type:catalog}': ['p(95)<150', 'p(99)<400'],
    'shopscale_checkout_duration': ['p(95)<500', 'p(99)<1500'],
    'http_req_failed': ['rate<0.005'],
    'shopscale_inventory_conflict_rate': ['rate<0.02'],
  },

  scenarios: {
    // Default Scenario: Baseline Peak Traffic Test (Open Workload Model)
    baseline_load: {
      executor: 'constant-arrival-rate',
      rate: 1500,
      timeUnit: '1s',
      duration: '10m',
      preAllocatedVUs: 200,
      maxVUs: 1000,
      tags: { test_type: 'baseline' },
      exec: 'userJourney',
    },
  },
};

export function userJourney() {
  const roll = Math.random();
  const randomProductId = Math.floor(Math.random() * TOTAL_PRODUCTS) + 1;

  if (roll < 0.70) {
    // PATH A: Browse Catalog (70%)
    const res = http.get(`${BASE_URL}/api/v1/products/${randomProductId}`, {
      tags: { type: 'catalog' },
    });

    check(res, {
      'catalog status is 200': (r) => r.status === 200,
    });
  } else if (roll < 0.90) {
    // PATH B: Add to Cart (20%)
    const payload = JSON.stringify({
      productId: randomProductId,
      quantity: 1,
    });

    const res = http.post(`${BASE_URL}/api/v1/cart/items`, payload, {
      headers: { 'Content-Type': 'application/json' },
      tags: { type: 'cart' },
    });

    check(res, {
      'cart status is 200 or 201': (r) => r.status === 200 || r.status === 201,
    });
  } else {
    // PATH C: Complete Checkout (10%)
    const idempotencyKey = `user-${__VU}-iter-${__ITER}-${Date.now()}`;
    const payload = JSON.stringify({
      productId: randomProductId,
      quantity: 1,
      paymentMethodToken: 'tok_mock_visa_4242',
    });

    const startTime = Date.now();
    const res = http.post(`${BASE_URL}/api/v1/checkout`, payload, {
      headers: {
        'Content-Type': 'application/json',
        'Idempotency-Key': idempotencyKey,
        'X-ShopScale-Synthetic-Test': 'true',
      },
      tags: { type: 'checkout' },
    });
    const duration = Date.now() - startTime;

    checkoutLatency.add(duration);

    if (res.status === 409) {
      inventoryContentionRate.add(1);
    } else {
      inventoryContentionRate.add(0);
    }

    const isSuccess = check(res, {
      'checkout status is 201': (r) => r.status === 201,
    });

    if (isSuccess) {
      successfulOrders.add(1);
    }
  }

  // Realistic human think time
  sleep(Math.random() * 2 + 1);
}
