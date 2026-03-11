const fs = require("fs/promises");
const path = require("path");
const { getPool } = require("./db");

async function applySchema() {
  const pool = getPool();
  const client = await pool.connect();

  try {
    const schemaPath = path.join(__dirname, "..", "schema.sql");
    const schemaSql = await fs.readFile(schemaPath, "utf8");

    const statements = schemaSql
      .split(";")
      .map((s) => s.trim())
      .filter(Boolean);

    await client.query("BEGIN");

    for (const statement of statements) {
      await client.query(statement);
    }

    await client.query("COMMIT");

    console.log(`Schema applied successfully. Statements: ${statements.length}`);
  } catch (error) {
    try {
      await client.query("ROLLBACK");
    } catch (_) {}

    console.error("Failed to apply schema:");
    console.error(error);
    process.exitCode = 1;
  } finally {
    client.release();
    await pool.end();
  }
}

applySchema();