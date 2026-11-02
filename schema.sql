-- Ученики (только индивидуальные)
CREATE TABLE IF NOT EXISTS students (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  note TEXT,
  level TEXT NOT NULL DEFAULT 'B1',            -- A1..C1, ставит преподаватель
  corrections TEXT NOT NULL DEFAULT 'end',     -- end | inline
  free_practice INTEGER NOT NULL DEFAULT 0,    -- можно ли болтать вне занятий
  tg_id INTEGER UNIQUE,                        -- Telegram, привязывается по ссылке
  tg_username TEXT,
  tg_name TEXT,
  invite_code TEXT UNIQUE,                     -- одноразовый код из ссылки
  linked_at INTEGER,
  archived INTEGER NOT NULL DEFAULT 0,
  current_session INTEGER,
  created_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS topics (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  title TEXT NOT NULL,
  scenario TEXT NOT NULL,
  vocab TEXT,
  active INTEGER NOT NULL DEFAULT 1,
  created_at INTEGER NOT NULL
);

-- Занятие = тема + уровень + окно времени, когда ученик может общаться с ИИ
CREATE TABLE IF NOT EXISTS lessons (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  student_id INTEGER NOT NULL,
  topic_id INTEGER,                            -- NULL = свободная тема
  level TEXT,                                  -- NULL = уровень ученика
  instructions TEXT,                           -- доп. указания для ИИ
  opens_at INTEGER NOT NULL,
  closes_at INTEGER NOT NULL,
  min_messages INTEGER NOT NULL DEFAULT 10,    -- минимум сообщений для зачёта
  notified INTEGER NOT NULL DEFAULT 0,
  paid INTEGER NOT NULL DEFAULT 0,             -- отметка преподавателя: оплачено
  created_at INTEGER NOT NULL
);

-- Разговор (внутри занятия их может быть несколько; без занятия = свободная практика)
CREATE TABLE IF NOT EXISTS sessions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  student_id INTEGER NOT NULL,
  lesson_id INTEGER,
  topic_id INTEGER,
  level TEXT,
  started_at INTEGER NOT NULL,
  finished_at INTEGER,
  feedback TEXT,
  score INTEGER
);

CREATE TABLE IF NOT EXISTS messages (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  session_id INTEGER NOT NULL,
  student_id INTEGER NOT NULL,
  role TEXT NOT NULL,                          -- user | model
  content TEXT NOT NULL,
  created_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS settings (
  key TEXT PRIMARY KEY,
  value TEXT
);

CREATE INDEX IF NOT EXISTS idx_lessons_student ON lessons(student_id, opens_at);
CREATE INDEX IF NOT EXISTS idx_lessons_time ON lessons(opens_at, closes_at);
CREATE INDEX IF NOT EXISTS idx_sessions_student ON sessions(student_id, started_at);
CREATE INDEX IF NOT EXISTS idx_sessions_lesson ON sessions(lesson_id);
CREATE INDEX IF NOT EXISTS idx_messages_session ON messages(session_id, id);
CREATE INDEX IF NOT EXISTS idx_messages_student_time ON messages(student_id, created_at);

INSERT OR IGNORE INTO settings (key, value) VALUES
  ('daily_limit', '60'),
  ('feedback_language', 'Russian'),
  ('default_min_messages', '10'),
  ('notify_feedback', '1'),
  ('notify_lesson_open', '1');

-- Стартовые темы
INSERT INTO topics (title, scenario, vocab, created_at)
SELECT * FROM (VALUES
  ('Small talk', 'Casual conversation between two people who just met: hobbies, weekend plans, weather, work or studies.', NULL, 0),
  ('At the restaurant', 'You are a waiter in a cafe in London. The student is a customer who wants to order a meal. Recommend dishes, answer questions about the menu, handle a small problem with the order.', 'menu, order, recommend, bill, tip, allergic to', 0),
  ('Airport & travel', 'You are a check-in agent at an airport, later a passport control officer. The student is a traveller. Ask about luggage, seat preference, purpose of the trip.', 'boarding pass, luggage, aisle seat, delay, gate', 0),
  ('Job interview', 'You are an HR manager interviewing the student for a job they want. Ask typical interview questions one at a time and react to the answers.', 'experience, strengths, weaknesses, responsible for, team player', 0),
  ('Shopping', 'You are a shop assistant in a clothes store. The student wants to buy something, try it on, ask about sizes, prices and returns.', 'size, fitting room, discount, receipt, refund', 0),
  ('At the doctor', 'You are a family doctor. The student is a patient who does not feel well. Ask about symptoms and give simple advice.', 'symptoms, headache, sore throat, prescription, appointment', 0)
) WHERE NOT EXISTS (SELECT 1 FROM topics);
