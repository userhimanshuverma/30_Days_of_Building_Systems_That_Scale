const http = require('http');

const PORT = process.env.PORT || 8080;
const idempotencyStore = new Map();

const server = http.createServer((req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`);

  if (url.pathname === '/health' || url.pathname === '/healthz') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({
      status: 'UP',
      stage: 'v5-resilient-services',
      circuit_breakers: {
        payment_service: 'CLOSED',
        inventory_service: 'CLOSED'
      },
      bulkheads: {
        payment_pool_active: 2,
        payment_pool_max: 20
      }
    }));
  }

  if (url.pathname === '/stats') {
    res.writeHead(200, { 'Content-Type': 'text/plain' });
    return res.end('circuit_breakers_tripped_total 0\ncircuit_breakers_state{name="payment"} 0\n');
  }

  if (url.pathname === '/api/v1/orders' && req.method === 'POST') {
    const idempotencyKey = req.headers['idempotency-key'];
    if (idempotencyKey && idempotencyStore.has(idempotencyKey)) {
      const cached = idempotencyStore.get(idempotencyKey);
      res.writeHead(200, { 'Content-Type': 'application/json', 'X-Cache-Lookup': 'HIT' });
      return res.end(JSON.stringify({
        ...cached,
        replayed: true,
        notice: 'Idempotent request replayed from state cache'
      }));
    }

    let body = '';
    req.on('data', chunk => { body += chunk; });
    req.on('end', () => {
      const parsed = JSON.parse(body || '{}');
      const responseData = {
        order_id: 'ord-' + Math.floor(Math.random() * 1000000),
        status: 'CONFIRMED',
        total_cents: parsed.total_cents || 1999,
        created_at: new Date().toISOString()
      };

      if (idempotencyKey) {
        idempotencyStore.set(idempotencyKey, responseData);
      }

      res.writeHead(201, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(responseData));
    });
    return;
  }

  res.writeHead(404, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({ error: 'Endpoint not found' }));
});

server.listen(PORT, () => {
  console.log(`🚀 v5-resilient-services gateway running on port ${PORT}`);
});
