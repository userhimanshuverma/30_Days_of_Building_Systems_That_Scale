const http = require('http');

const PORT = process.env.PORT || 8080;
let requestCount = 0;

const server = http.createServer((req, res) => {
  requestCount++;
  const url = new URL(req.url, `http://${req.headers.host}`);

  if (url.pathname === '/metrics') {
    res.writeHead(200, { 'Content-Type': 'text/plain; version=0.0.4' });
    return res.end(
      `# HELP http_requests_total Total HTTP Requests\n` +
      `# TYPE http_requests_total counter\n` +
      `http_requests_total{status="200"} ${requestCount}\n` +
      `otelcol_exporter_sent_spans 142\n`
    );
  }

  if (url.pathname === '/health') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({ status: 'UP', stage: 'v6-observable-stack', telemetry: 'otel-active' }));
  }

  if (url.pathname === '/api/v1/catalog') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({
      trace_id: '4bf92f3577b34da6a3ce929d0e0e4736',
      span_id: '00f067aa0ba902b7',
      items: [{ id: 1, name: 'Pro Monitor 27"', price: 499.00 }]
    }));
  }

  res.writeHead(404, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({ error: 'Endpoint not found' }));
});

server.listen(PORT, () => {
  console.log(`🚀 v6-observable-stack app running on port ${PORT}`);
});
