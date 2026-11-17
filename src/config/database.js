
const { Pool } = require("pg");

if (!process.env.DATABASE_URL) {
  throw new Error("La variable DATABASE_URL est manquante.");
}

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: true
  },
  max: 10,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 10000
});

pool.on("error", (error) => {
  console.error("Erreur inattendue de connexion à PostgreSQL :", error.message);
});

async function query(text, params = []) {
  return pool.query(text, params);
}

async function testConnection() {
  const result = await query("SELECT NOW() AS current_time");
  return result.rows[0];
}

module.exports = {
  pool,
  query,
  testConnection
};

