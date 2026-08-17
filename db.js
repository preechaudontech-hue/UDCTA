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
  // Serverless functions (Vercel) get one request per invocation, and Neon's
  // pooled connection proxy silently drops idle connections — a plain `pg`
  // Pool then hands out a dead client on the next query and throws
  // ECONNRESET. Keeping the pool to a single short-lived connection avoids
  // handing out stale clients.
  max: 1,
  idleTimeoutMillis: 10000,
  connectionTimeoutMillis: 10000,
});

// Without this listener, an idle connection Neon has already closed emits an
// 'error' event with no handler, which crashes the whole Node process.
pool.on("error", (err) => {
  console.error("Unexpected PG pool error:", err.message);
});

async function initDb() {
  const schema = fs.readFileSync(path.join(__dirname, "schema.sql"), "utf8");
  await pool.query(schema);
}

module.exports = { pool, initDb };
