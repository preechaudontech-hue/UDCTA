CREATE TABLE IF NOT EXISTS students (
    id SERIAL PRIMARY KEY,
    student_code TEXT UNIQUE NOT NULL,
    full_name TEXT NOT NULL,
    class_room TEXT NOT NULL,
    major TEXT,
    active BOOLEAN NOT NULL DEFAULT TRUE
);

CREATE TABLE IF NOT EXISTS attendance (
    id SERIAL PRIMARY KEY,
    student_id INTEGER NOT NULL REFERENCES students(id),
    check_date DATE NOT NULL,
    status TEXT NOT NULL CHECK (status IN ('present','late','absent')),
    recorded_at TIMESTAMP NOT NULL DEFAULT now(),
    UNIQUE (student_id, check_date)
);

CREATE TABLE IF NOT EXISTS uniform_checks (
    id SERIAL PRIMARY KEY,
    student_id INTEGER NOT NULL REFERENCES students(id),
    check_date DATE NOT NULL,
    items_json TEXT NOT NULL,
    overall_pass BOOLEAN NOT NULL,
    note TEXT,
    recorded_at TIMESTAMP NOT NULL DEFAULT now(),
    UNIQUE (student_id, check_date)
);

CREATE INDEX IF NOT EXISTS idx_attendance_date ON attendance(check_date);
CREATE INDEX IF NOT EXISTS idx_uniform_date ON uniform_checks(check_date);
