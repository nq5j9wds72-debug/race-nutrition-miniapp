const fs = require("fs/promises");
const path = require("path");
const { getPool } = require("./db");

async function applyRebuildCalculations() {
  const pool = getPool();
  const client = await pool.connect();

  try {
    const sqlPath = path.join(__dirname, "..", "rebuild-calculations.sql");
    const sql = await fs.readFile(sqlPath, "utf8");

    const statements = sql
      .split(";")
      .map((s) => s.trim())
      .filter(Boolean);

    await client.query("BEGIN");

    for (const statement of statements) {
      await client.query(statement);
    }

    await client.query("COMMIT");
    console.log(`Rebuild calculations applied successfully. Statements: ${statements.length}`);
  } catch (error) {
    try {
      await client.query("ROLLBACK");
    } catch (_) {}

    console.error("Failed to rebuild calculations:");
    console.error(error);
    process.exitCode = 1;
  } finally {
    client.release();
    await pool.end();
  }
}

applyRebuildCalculations();