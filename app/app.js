const express = require('express');
const { Pool } = require('pg');

const app = express();
const port = 3000;

// Setup the PostgreSQL client
const pool = new Pool({
  user: process.env.DB_USER || 'postgres',
  host: process.env.DB_HOST || 'localhost',
  database: process.env.DB_NAME || 'postgres',
  password: process.env.DB_PASSWORD || 'password',
  port: process.env.DB_PORT || 5432,
});

// Simple query to verify the connection
app.get('/', async (req, res) => {
  try {
    const client = await pool.connect();
    const result = await client.query('SELECT NOW()');
    client.release();
    res.send(`<h1>Connected to PostgreSQL!</h1><p>Server Time: ${result.rows[0].now}</p>`);
  } catch (err) {
    console.error(err);
    res.status(500).send('Failed to connect to the database.');
  }
});

// Start the server
app.listen(port, () => {
  console.log(`App running on http://localhost:${port}`);
});
