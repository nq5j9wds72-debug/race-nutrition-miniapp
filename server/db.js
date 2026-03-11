const { Pool } = require("pg");

let pool = null;

function getPool() {
  if (!process.env.DATABASE_URL) {
    throw new Error("DATABASE_URL is not set");
  }

  if (!pool) {
    const isRunningOnRender = process.env.RENDER === "true";

    pool = new Pool({
      connectionString: process.env.DATABASE_URL,
      ssl: isRunningOnRender ? false : { rejectUnauthorized: false }
    });
  }

  return pool;
}

async function testDbConnection() {
  const activePool = getPool();
  const result = await activePool.query("select now() as now");
  return result.rows[0];
}

module.exports = {
  getPool,
  testDbConnection
};