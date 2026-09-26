const http = require('http');
const os = require('os');
const { Client } = require('pg');

const PORT = process.env.PORT || 8080;
const INSTANCE_NAME = process.env.INSTANCE_NAME || os.hostname();
const DB_URL = process.env.DATABASE_URL || 'postgresql://postgres:postgres@postgres:5432/shopscale';

const client = new Client({ connectionString: DB_URL });
let dbConnected = false;

async function initDB() {
  try {
    await client.connect();
    dbConnected = true;
    console.log(`[${INSTANCE_NAME}] ✅ Connected to PostgreSQL database`);
  } catch (err) {
    console.warn(`[${INSTANCE_NAME}] ⚠️ DB pending:`, err.message);
    setTimeout(initDB, 3000);
  }
}
initDB();

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`);

  if (url.pathname === '/health') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({
      status: 'UP',
      stage: 'v2-scaled-compute',
      hostname: INSTANCE_NAME,
      database: dbConnected ? 'connected' : 'connecting'
    }));
  }

  if (url.pathname === '/api/v1/products') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({
      instance: INSTANCE_NAME,
      items: [
        { id: 1, title: 'Wireless Headphones', price: 99.99 },
        { id: 2, title: 'Mechanical Keyboard', price: 129.99 }
      ]
    }));
  }

  res.writeHead(404, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({ error: 'Endpoint not found', handled_by: INSTANCE_NAME }));
});

server.listen(PORT, () => {
  console.log(`🚀 [${INSTANCE_NAME}] running on port ${PORT}`);
});
