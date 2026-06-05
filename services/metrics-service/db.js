const { Pool } = require("pg");

const pool = new Pool({
  host: process.env.DB_HOST || process.env.POSTGRES_HOST || "postgres",
  port: Number(process.env.DB_PORT || process.env.POSTGRES_PORT || 5432),
  database: process.env.DB_NAME || process.env.POSTGRES_DB,
  user: process.env.DB_USER || process.env.POSTGRES_USER,
  password: process.env.DB_PASSWORD || process.env.POSTGRES_PASSWORD,
});

module.exports = pool;
