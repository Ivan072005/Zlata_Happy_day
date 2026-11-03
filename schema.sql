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

-- ───────── Реальные уроки и оплата ─────────

-- Постоянный график в виде текста (каждое сохранение — новая версия)
CREATE TABLE IF NOT EXISTS templates (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  text TEXT NOT NULL,
  created_at INTEGER NOT NULL
);

-- Конкретные уроки по датам (создаются из графика по неделям, или вручную)
CREATE TABLE IF NOT EXISTS classes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  student_id INTEGER NOT NULL,
  week TEXT NOT NULL,                          -- понедельник недели, YYYY-MM-DD
  starts_at INTEGER NOT NULL,
  ends_at INTEGER NOT NULL,
  price INTEGER NOT NULL,
  status TEXT NOT NULL DEFAULT 'planned',      -- planned | cancelled
  manual INTEGER NOT NULL DEFAULT 0,           -- добавлен вручную (разовый)
  edited INTEGER NOT NULL DEFAULT 0,           -- изменён вручную (не трогать при смене графика)
  note TEXT,
  created_at INTEGER NOT NULL
);

-- График конкретной недели (копия постоянного, которую можно менять только для этой недели)
CREATE TABLE IF NOT EXISTS week_texts (
  week TEXT PRIMARY KEY,                       -- понедельник недели, YYYY-MM-DD
  text TEXT NOT NULL,
  edited INTEGER NOT NULL DEFAULT 0,           -- 1 = неделю меняли вручную
  updated_at INTEGER NOT NULL
);

-- (устарело) Недели, для которых уроки уже созданы из графика
CREATE TABLE IF NOT EXISTS class_weeks (
  week TEXT PRIMARY KEY
);

-- Оплаты (любая сумма: урок, пакет, частично)
CREATE TABLE IF NOT EXISTS payments (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  student_id INTEGER NOT NULL,
  amount INTEGER NOT NULL,
  lessons INTEGER,                             -- сколько уроков оплачено (кружков)
  lesson_price INTEGER,                        -- цена урока
  note TEXT,
  paid_at INTEGER NOT NULL,
  created_at INTEGER NOT NULL
);

-- Отметки уроков в оплатах (закрашенный кружок с датой). payment_id NULL = урок не оплачен (долг)
CREATE TABLE IF NOT EXISTS lesson_marks (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  student_id INTEGER NOT NULL,
  payment_id INTEGER,
  date TEXT NOT NULL,                          -- YYYY-MM-DD
  price INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_marks_student ON lesson_marks(student_id, date);

CREATE INDEX IF NOT EXISTS idx_classes_student ON classes(student_id, starts_at);
CREATE INDEX IF NOT EXISTS idx_classes_week ON classes(week, starts_at);
CREATE INDEX IF NOT EXISTS idx_payments_student ON payments(student_id, paid_at);

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
