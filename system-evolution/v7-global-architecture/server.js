const http = require('http');

const PORT = process.env.PORT || 8080;
const REGION = process.env.REGION || 'us-east-1';
const RATE_LIMIT_CAPACITY = 10;
let requestWindow = [];

const server = http.createServer((req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`);

  if (url.pathname === '/health') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({
      status: 'UP',
      stage: 'v7-global-architecture',
      region: REGION,
      active_active: true
    }));
  }

  if (url.pathname === '/api/v1/checkout') {
    const now = Date.now();
    // Sliding window: filter requests from last 5 seconds
    requestWindow = requestWindow.filter(timestamp => now - timestamp < 5000);

    if (requestWindow.length >= RATE_LIMIT_CAPACITY) {
      res.writeHead(429, {
        'Content-Type': 'application/json',
        'Retry-After': '5'
      });
      return res.end(JSON.stringify({
        error: 'Too Many Requests',
        message: 'Rate limit exceeded by perimeter rate limiter',
        region: REGION
      }));
    }

    requestWindow.push(now);
    res.writeHead(200, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({
      status: 'PROCESSED',
      region: REGION,
      order_id: 'ord-global-' + Math.floor(Math.random() * 100000)
    }));
  }

  if (url.pathname === '/api/v1/catalog') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({
      region: REGION,
      latency: 'local_cached_sub_5ms',
      products: [{ id: 1, title: 'Global 4K Camera', price: 899.00 }]
    }));
  }

  res.writeHead(404, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({ error: 'Endpoint not found' }));
});

server.listen(PORT, () => {
  console.log(`🚀 [${REGION}] server listening on port ${PORT}`);
});
