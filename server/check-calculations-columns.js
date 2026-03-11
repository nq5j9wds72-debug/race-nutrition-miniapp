const { getPool } = require("./db");

async function checkCalculationsColumns() {
  const pool = getPool();

  try {
    const result = await pool.query(`
      SELECT column_name, is_nullable, data_type
      FROM information_schema.columns
      WHERE table_name = 'calculations'
      ORDER BY ordinal_position
    `);

    console.table(result.rows);
  } catch (error) {
    console.error(error);
    process.exitCode = 1;
  } finally {
    await pool.end();
  }
}

checkCalculationsColumns();