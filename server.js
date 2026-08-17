require("dotenv").config();
const path = require("path");
const express = require("express");
const multer = require("multer");
const XLSX = require("xlsx");
const { pool, initDb } = require("./db");

const UNIFORM_ITEMS = [
  "เสื้อ",
  "กางเกง/กระโปรง",
  "เข็มขัด",
  "รองเท้า",
  "ทรงผม",
  "เข็มขัด/ป้ายชื่อนักศึกษา",
];

const STATUS_LABELS = { present: "มา", late: "สาย", absent: "ขาด" };

const app = express();
const upload = multer({ storage: multer.memoryStorage() });

app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "views"));
app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));

// On serverless platforms (Vercel) there is no explicit startup step, so make
// sure the schema exists before the first request is handled on a cold start.
// initDb() is idempotent (CREATE TABLE IF NOT EXISTS), so re-running it in the
// local `app.listen` path below is harmless.
const dbReady = initDb();
app.use((req, res, next) => {
  dbReady.then(() => next()).catch(next);
});

function todayStr() {
  return new Date().toISOString().slice(0, 10);
}

async function getRooms() {
  const { rows } = await pool.query(
    "SELECT DISTINCT class_room FROM students WHERE active = TRUE ORDER BY class_room"
  );
  return rows.map((r) => r.class_room);
}

app.get("/", async (req, res, next) => {
  try {
    const rooms = await getRooms();
    res.render("index", { rooms, today: todayStr() });
  } catch (err) {
    next(err);
  }
});

app.get("/checkin", async (req, res, next) => {
  try {
    const rooms = await getRooms();
    const checkDate = req.query.date || todayStr();
    const room = req.query.room || "";

    let rows = [];
    if (room) {
      const { rows: students } = await pool.query(
        "SELECT * FROM students WHERE active = TRUE AND class_room = $1 ORDER BY full_name",
        [room]
      );
      const studentIds = students.map((s) => s.id);

      let attendanceByStudent = {};
      let uniformByStudent = {};
      if (studentIds.length) {
        const { rows: attRows } = await pool.query(
          "SELECT * FROM attendance WHERE check_date = $1 AND student_id = ANY($2::int[])",
          [checkDate, studentIds]
        );
        attRows.forEach((r) => {
          attendanceByStudent[r.student_id] = r.status;
        });

        const { rows: uniRows } = await pool.query(
          "SELECT * FROM uniform_checks WHERE check_date = $1 AND student_id = ANY($2::int[])",
          [checkDate, studentIds]
        );
        uniRows.forEach((r) => {
          uniformByStudent[r.student_id] = {
            items: JSON.parse(r.items_json),
            note: r.note || "",
          };
        });
      }

      rows = students.map((s) => ({
        student: s,
        status: attendanceByStudent[s.id] || "present",
        items: (uniformByStudent[s.id] && uniformByStudent[s.id].items) || {},
        note: (uniformByStudent[s.id] && uniformByStudent[s.id].note) || "",
      }));
    }

    res.render("checkin", {
      rooms,
      room,
      checkDate,
      rows,
      uniformItems: UNIFORM_ITEMS,
      statuses: STATUS_LABELS,
    });
  } catch (err) {
    next(err);
  }
});

app.post("/api/checkin", async (req, res, next) => {
  const client = await pool.connect();
  try {
    const { date, entries } = req.body;
    if (!date || !Array.isArray(entries) || !entries.length) {
      return res.status(400).json({ ok: false, error: "missing date or entries" });
    }

    await client.query("BEGIN");
    for (const entry of entries) {
      const { student_id, status, items = {}, note = "" } = entry;
      const overallPass = Object.values(items).every((v) => v === "pass");

      await client.query(
        `INSERT INTO attendance (student_id, check_date, status)
         VALUES ($1, $2, $3)
         ON CONFLICT (student_id, check_date)
         DO UPDATE SET status = EXCLUDED.status, recorded_at = now()`,
        [student_id, date, status]
      );

      await client.query(
        `INSERT INTO uniform_checks (student_id, check_date, items_json, overall_pass, note)
         VALUES ($1, $2, $3, $4, $5)
         ON CONFLICT (student_id, check_date)
         DO UPDATE SET items_json = EXCLUDED.items_json,
                       overall_pass = EXCLUDED.overall_pass,
                       note = EXCLUDED.note,
                       recorded_at = now()`,
        [student_id, date, JSON.stringify(items), overallPass, note]
      );
    }
    await client.query("COMMIT");
    res.json({ ok: true });
  } catch (err) {
    await client.query("ROLLBACK");
    next(err);
  } finally {
    client.release();
  }
});

app.get("/import", (req, res) => {
  res.render("import");
});

const COLUMN_MAP = {
  "รหัสนักศึกษา": "student_code",
  "รหัสประจำตัว": "student_code",
  "ชื่อ-สกุล": "full_name",
  "ชื่อ - สกุล": "full_name",
  "ชื่อสกุล": "full_name",
  "ระดับชั้น/ห้อง": "class_room",
  "ห้อง": "class_room",
  "ระดับชั้น": "class_room",
  "สาขาวิชา": "major",
};

app.post("/api/students/import", upload.single("file"), async (req, res, next) => {
  try {
    if (!req.file) {
      return res.status(400).json({ ok: false, error: "no file" });
    }

    const isCsv = req.file.originalname.toLowerCase().endsWith(".csv");
    const workbook = isCsv
      ? XLSX.read(req.file.buffer.toString("utf8"), { type: "string" })
      : XLSX.read(req.file.buffer, { type: "buffer" });
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    const raw = XLSX.utils.sheet_to_json(sheet, { defval: "" });

    const required = ["student_code", "full_name", "class_room"];
    let imported = 0;

    for (const rawRow of raw) {
      const row = {};
      for (const [key, value] of Object.entries(rawRow)) {
        const mapped = COLUMN_MAP[key.trim()] || key.trim();
        row[mapped] = value;
      }

      const missing = required.filter((k) => !(k in row));
      if (missing.length) {
        return res.status(400).json({
          ok: false,
          error: `ไม่พบคอลัมน์ที่จำเป็น: ${missing.join(", ")}`,
        });
      }

      const studentCode = String(row.student_code).trim();
      const fullName = String(row.full_name).trim();
      const classRoom = String(row.class_room).trim();
      const major = row.major ? String(row.major).trim() : null;

      if (!studentCode || !fullName) continue;

      await pool.query(
        `INSERT INTO students (student_code, full_name, class_room, major, active)
         VALUES ($1, $2, $3, $4, TRUE)
         ON CONFLICT (student_code)
         DO UPDATE SET full_name = EXCLUDED.full_name,
                       class_room = EXCLUDED.class_room,
                       major = EXCLUDED.major,
                       active = TRUE`,
        [studentCode, fullName, classRoom, major]
      );
      imported += 1;
    }

    res.json({ ok: true, imported });
  } catch (err) {
    next(err);
  }
});

app.get("/reports", async (req, res, next) => {
  try {
    const rooms = await getRooms();
    const today = todayStr();
    const start = req.query.start || today;
    const end = req.query.end || today;
    const room = req.query.room || "";

    const params = [start, end];
    let roomFilter = "";
    if (room) {
      params.push(room);
      roomFilter = `AND s.class_room = $${params.length}`;
    }

    const { rows: summary } = await pool.query(
      `SELECT s.id, s.student_code, s.full_name, s.class_room,
              SUM(CASE WHEN a.status = 'present' THEN 1 ELSE 0 END) AS present_count,
              SUM(CASE WHEN a.status = 'late' THEN 1 ELSE 0 END) AS late_count,
              SUM(CASE WHEN a.status = 'absent' THEN 1 ELSE 0 END) AS absent_count,
              SUM(CASE WHEN u.overall_pass = FALSE THEN 1 ELSE 0 END) AS uniform_fail_count
       FROM students s
       LEFT JOIN attendance a ON a.student_id = s.id AND a.check_date BETWEEN $1 AND $2
       LEFT JOIN uniform_checks u ON u.student_id = s.id AND u.check_date = a.check_date
       WHERE s.active = TRUE ${roomFilter}
       GROUP BY s.id
       ORDER BY s.class_room, s.full_name`,
      params
    );

    res.render("reports", { rooms, room, start, end, summary });
  } catch (err) {
    next(err);
  }
});

app.get("/api/reports/export", async (req, res, next) => {
  try {
    const today = todayStr();
    const start = req.query.start || today;
    const end = req.query.end || today;
    const room = req.query.room || "";

    const params = [start, end];
    let roomFilter = "";
    if (room) {
      params.push(room);
      roomFilter = `AND s.class_room = $${params.length}`;
    }

    const { rows } = await pool.query(
      `SELECT s.student_code, s.full_name, s.class_room, a.check_date,
              a.status, u.items_json, u.overall_pass, u.note
       FROM students s
       JOIN attendance a ON a.student_id = s.id AND a.check_date BETWEEN $1 AND $2
       LEFT JOIN uniform_checks u ON u.student_id = s.id AND u.check_date = a.check_date
       WHERE s.active = TRUE ${roomFilter}
       ORDER BY a.check_date, s.class_room, s.full_name`,
      params
    );

    const header = [
      "รหัสนักศึกษา",
      "ชื่อ-สกุล",
      "ห้อง",
      "วันที่",
      "สถานะเข้าแถว",
      "แต่งกายผ่าน",
      "รายละเอียดตรวจ",
      "หมายเหตุ",
    ];
    const lines = [header.join(",")];

    for (const row of rows) {
      const items = row.items_json ? JSON.parse(row.items_json) : {};
      const itemsText = Object.entries(items)
        .map(([k, v]) => `${k}:${v}`)
        .join("; ");
      const checkDate =
        row.check_date instanceof Date
          ? row.check_date.toISOString().slice(0, 10)
          : row.check_date;
      const fields = [
        row.student_code,
        row.full_name,
        row.class_room,
        checkDate,
        STATUS_LABELS[row.status] || row.status,
        row.overall_pass === null ? "" : row.overall_pass ? "ผ่าน" : "ไม่ผ่าน",
        itemsText,
        row.note || "",
      ];
      lines.push(
        fields
          .map((f) => `"${String(f).replace(/"/g, '""')}"`)
          .join(",")
      );
    }

    const csvData = "﻿" + lines.join("\r\n");
    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename=report_${start}_to_${end}.csv`
    );
    res.send(csvData);
  } catch (err) {
    next(err);
  }
});

app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).send("เกิดข้อผิดพลาดภายในระบบ: " + err.message);
});

if (require.main === module) {
  const PORT = process.env.PORT || 3000;
  dbReady
    .then(() => {
      app.listen(PORT, () => {
        console.log(`Server running at http://localhost:${PORT}`);
      });
    })
    .catch((err) => {
      console.error("ไม่สามารถเชื่อมต่อฐานข้อมูลได้:", err.message);
      process.exit(1);
    });
}

module.exports = app;
