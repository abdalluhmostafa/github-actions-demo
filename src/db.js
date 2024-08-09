const { Pool } = require('pg');

const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: process.env.DB_PORT || 5432,
  database: process.env.DB_NAME || 'todoapp',
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || 'password'
});

pool.connect((err) => {
  if (err) {
    console.error('Connection to the database failed', err.stack);
  } else {
    console.log('Connected to the database');
  }
});

module.exports = pool;
