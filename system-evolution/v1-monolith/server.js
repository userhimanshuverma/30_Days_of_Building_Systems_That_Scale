const http = require('http');
const { Client } = require('pg');

const PORT = process.env.PORT || 8080;
const DB_URL = process.env.DATABASE_URL || 'postgresql://postgres:postgres@postgres:5432/shopscale';

const client = new Client({ connectionString: DB_URL });
let dbConnected = false;

async function initDB() {
  try {
    await client.connect();
    dbConnected = true;
    console.log('✅ Connected to PostgreSQL database');
    await client.query(`
      CREATE TABLE IF NOT EXISTS products (
        id SERIAL PRIMARY KEY,
        title VARCHAR(255) NOT NULL,
        price NUMERIC(10, 2) NOT NULL,
        stock INT NOT NULL DEFAULT 100
      );
      CREATE TABLE IF NOT EXISTS orders (
        id SERIAL PRIMARY KEY,
        product_id INT REFERENCES products(id),
        quantity INT NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
      INSERT INTO products (title, price, stock)
      SELECT 'Wireless Headphones', 99.99, 150
      WHERE NOT EXISTS (SELECT 1 FROM products WHERE title = 'Wireless Headphones');
    `);
    console.log('✅ Database schema initialized');
  } catch (err) {
    console.warn('⚠️ Database connection pending:', err.message);
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
      stage: 'v1-monolith',
      database: dbConnected ? 'connected' : 'connecting',
      timestamp: new Date().toISOString()
    }));
  }

  if (url.pathname === '/api/v1/products' && req.method === 'GET') {
    try {
      if (!dbConnected) throw new Error('DB connecting');
      const { rows } = await client.query('SELECT * FROM products LIMIT 50');
      res.writeHead(200, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify(rows));
    } catch (err) {
      res.writeHead(503, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({ error: err.message }));
    }
  }

  if (url.pathname === '/api/v1/orders' && req.method === 'POST') {
    let body = '';
    req.on('data', chunk => { body += chunk; });
    req.on('end', async () => {
      try {
        const { product_id = 1, quantity = 1 } = JSON.parse(body || '{}');
        // Monolithic in-memory call & single local ACID transaction
        await client.query('BEGIN');
        const updateRes = await client.query(
          'UPDATE products SET stock = stock - $1 WHERE id = $2 AND stock >= $1 RETURNING id, stock',
          [quantity, product_id]
        );
        if (updateRes.rows.length === 0) {
          await client.query('ROLLBACK');
          res.writeHead(409, { 'Content-Type': 'application/json' });
          return res.end(JSON.stringify({ error: 'Insufficient inventory' }));
        }
        const orderRes = await client.query(
          'INSERT INTO orders (product_id, quantity) VALUES ($1, $2) RETURNING id',
          [product_id, quantity]
        );
        await client.query('COMMIT');
        res.writeHead(201, { 'Content-Type': 'application/json' });
        return res.end(JSON.stringify({
          order_id: orderRes.rows[0].id,
          product_id,
          remaining_stock: updateRes.rows[0].stock,
          status: 'CONFIRMED'
        }));
      } catch (err) {
        await client.query('ROLLBACK').catch(() => {});
        res.writeHead(500, { 'Content-Type': 'application/json' });
        return res.end(JSON.stringify({ error: err.message }));
      }
    });
    return;
  }

  res.writeHead(404, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({ error: 'Endpoint not found' }));
});

server.listen(PORT, () => {
  console.log(`🚀 v1-monolith running on port ${PORT}`);
});
