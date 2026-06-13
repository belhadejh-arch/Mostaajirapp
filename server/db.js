const { Pool } = require('pg');

const connectionString = process.env.NEON_DB_URL || process.env.DATABASE_URL;

if (!connectionString) {
  console.error('FATAL: No database connection string found (NEON_DB_URL or DATABASE_URL)');
  process.exit(1);
}

const pool = new Pool({
  connectionString,
  ssl: { rejectUnauthorized: false },
  max: 10,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 10000,
});

pool.on('error', (err) => {
  console.error('PostgreSQL pool error:', err.message);
});

module.exports = { pool };
