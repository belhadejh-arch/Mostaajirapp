const { Pool } = require('pg');

const connectionString = process.env.DATABASE_URL || process.env.NEON_DB_URL;

if (!connectionString) {
  console.error('FATAL: No database connection string found (DATABASE_URL)');
  process.exit(1);
}

const isLocalDb = connectionString.includes('localhost') || connectionString.includes('127.0.0.1');

const pool = new Pool({
  connectionString,
  ssl: isLocalDb ? false : { rejectUnauthorized: false },
  max: 10,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 10000,
});

pool.on('error', (err) => {
  console.error('PostgreSQL pool error:', err.message);
});

module.exports = { pool };
