const fs = require("fs");
const path = require("path");
const { Pool, types } = require("pg");

// Return DATE columns as plain "YYYY-MM-DD" strings instead of JS Date
// objects, which pg would otherwise construct at UTC midnight and shift
// to the wrong calendar day once formatted in a non-UTC timezone.
types.setTypeParser(1082, (val) => val);

if (!process.env.DATABASE_URL) {
  console.error(
    "ไม่พบ DATABASE_URL — กรุณาตั้งค่าไฟล์ .env ด้วย connection string ของ Postgres (เช่น จาก Neon)"
  );
}

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.PGSSL === "false" ? false : { rejectUnauthorized: false },
});

async function initDb() {
  const schema = fs.readFileSync(path.join(__dirname, "schema.sql"), "utf8");
  await pool.query(schema);
}

module.exports = { pool, initDb };
