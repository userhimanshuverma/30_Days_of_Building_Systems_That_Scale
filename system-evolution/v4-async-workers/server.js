const http = require('http');
const { randomUUID } = require('crypto');

const PORT = process.env.PORT || 8080;

const server = http.createServer((req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`);

  if (url.pathname === '/health') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({
      status: 'UP',
      stage: 'v4-async-workers',
      broker: 'rabbitmq-active',
      workers: 'consuming'
    }));
  }

  if (url.pathname === '/api/v1/merchant/catalog/upload' && req.method === 'POST') {
    const jobId = randomUUID();
    res.writeHead(202, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({
      job_id: jobId,
      status: 'PENDING',
      message: 'File accepted for asynchronous processing',
      poll_url: `/api/v1/jobs/${jobId}`
    }));
  }

  res.writeHead(404, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({ error: 'Endpoint not found' }));
});

server.listen(PORT, () => {
  console.log(`🚀 v4-async-workers API running on port ${PORT}`);
});
