-- Migration number: 0001 	 2026-09-14T10:46:03.917Z

CREATE TABLE students (
  id INTEGER PRIMARY KEY,
  line_user_id TEXT NOT NULL,
  name TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('enrolled', 'completed')),
  created_at TEXT NOT NULL DEFAULT (CURRENT_TIMESTAMP)
);

CREATE UNIQUE INDEX idx_students_line_user_id ON students (line_user_id);

CREATE TABLE lessons (
  id INTEGER PRIMARY KEY,
  held_on TEXT NOT NULL,
  title TEXT NOT NULL
);

CREATE TABLE images (
  id TEXT PRIMARY KEY,
  student_id INTEGER NOT NULL REFERENCES students (id),
  lesson_id INTEGER REFERENCES lessons (id),
  line_message_id TEXT NOT NULL,
  r2_key TEXT NOT NULL,
  received_at TEXT NOT NULL DEFAULT (CURRENT_TIMESTAMP),
  memo_body TEXT,
  memo_updated_at TEXT
);

CREATE UNIQUE INDEX idx_images_line_message_id ON images (line_message_id);
CREATE INDEX idx_images_student_id ON images (student_id);
CREATE INDEX idx_images_lesson_id ON images (lesson_id);

CREATE TABLE attendances (
  id INTEGER PRIMARY KEY,
  lesson_id INTEGER NOT NULL REFERENCES lessons (id),
  student_id INTEGER NOT NULL REFERENCES students (id),
  status TEXT NOT NULL CHECK (status IN ('present', 'absent', 'late')),
  note TEXT
);

CREATE UNIQUE INDEX idx_attendances_lesson_student ON attendances (lesson_id, student_id);

CREATE TABLE notices (
  id INTEGER PRIMARY KEY,
  body TEXT NOT NULL,
  sent_at TEXT NOT NULL DEFAULT (CURRENT_TIMESTAMP)
);
