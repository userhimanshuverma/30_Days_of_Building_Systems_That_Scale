const http = require('http');
const os = require('os');

const PORT = process.env.PORT || 8080;
const INSTANCE_NAME = process.env.INSTANCE_NAME || os.hostname();

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`);

  if (url.pathname === '/health') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({
      status: 'UP',
      stage: 'v3-cached-data',
      instance: INSTANCE_NAME,
      cache: 'redis-cluster-connected',
      data_layer: 'primary-replica-separated'
    }));
  }

  if (url.pathname.startsWith('/api/products/')) {
    const id = url.pathname.split('/').pop();
    if (req.method === 'PUT') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({
        status: 'UPDATED_ON_PRIMARY',
        cache_invalidated: true,
        product_id: id
      }));
    }
    res.writeHead(200, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({
      id,
      title: 'Noise-Cancelling Headphones',
      price: 199.99,
      source: 'redis_cache_hit'
    }));
  }

  res.writeHead(404, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({ error: 'Endpoint not found' }));
});

server.listen(PORT, () => {
  console.log(`🚀 [${INSTANCE_NAME}] running on port ${PORT}`);
});
