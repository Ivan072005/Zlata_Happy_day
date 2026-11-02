import type { ChatMessage, Env, Lesson, Session, Settings, Student, Topic } from './types';

const now = () => Date.now();

// ───────── Настройки ─────────

export async function getSettings(env: Env): Promise<Settings> {
  const { results } = await env.DB.prepare('SELECT key, value FROM settings').all<{ key: string; value: string | null }>();
  const m = new Map(results.map((r) => [r.key, r.value]));
  const num = (k: string, d: number) => {
    const n = parseInt(m.get(k) ?? '', 10);
    return Number.isFinite(n) ? n : d;
  };
  return {
    daily_limit: num('daily_limit', 60),
    feedback_language: m.get('feedback_language') || 'Russian',
    default_min_messages: num('default_min_messages', 10),
    notify_feedback: m.get('notify_feedback') !== '0',
    notify_lesson_open: m.get('notify_lesson_open') !== '0',
    teacher_tg_id: m.get('teacher_tg_id') ? Number(m.get('teacher_tg_id')) : null,
    teacher_link_code: m.get('teacher_link_code') || null,
    bot_username: m.get('bot_username') || null,
  };
}

export async function setSetting(env: Env, key: string, value: string | null) {
  await env.DB.prepare('INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value')
    .bind(key, value)
    .run();
}

// ───────── Ученики ─────────

export function getStudent(env: Env, id: number) {
  return env.DB.prepare('SELECT * FROM students WHERE id = ?').bind(id).first<Student>();
}

export function getStudentByTg(env: Env, tgId: number) {
  return env.DB.prepare('SELECT * FROM students WHERE tg_id = ?').bind(tgId).first<Student>();
}

export function getStudentByInvite(env: Env, code: string) {
  return env.DB.prepare('SELECT * FROM students WHERE invite_code = ?').bind(code).first<Student>();
}

export async function setCurrentSession(env: Env, studentId: number, sessionId: number | null) {
  await env.DB.prepare('UPDATE students SET current_session = ? WHERE id = ?').bind(sessionId, studentId).run();
}

/** Случайный код для ссылок-приглашений (без похожих символов). */
export function randomCode(len = 10): string {
  const alphabet = 'abcdefghjkmnpqrstuvwxyz23456789';
  const bytes = crypto.getRandomValues(new Uint8Array(len));
  return Array.from(bytes, (b) => alphabet[b % alphabet.length]).join('');
}

// ───────── Темы ─────────

export function getTopic(env: Env, id: number | null) {
  if (!id) return Promise.resolve(null);
  return env.DB.prepare('SELECT * FROM topics WHERE id = ?').bind(id).first<Topic>();
}

// ───────── Занятия ─────────

export function getLesson(env: Env, id: number | null) {
  if (!id) return Promise.resolve(null);
  return env.DB.prepare('SELECT * FROM lessons WHERE id = ?').bind(id).first<Lesson>();
}

/** Открытое прямо сейчас занятие ученика (если их несколько — то, что закрывается раньше). */
export function activeLesson(env: Env, studentId: number) {
  const t = now();
  return env.DB.prepare('SELECT * FROM lessons WHERE student_id = ? AND opens_at <= ? AND closes_at > ? ORDER BY closes_at LIMIT 1')
    .bind(studentId, t, t)
    .first<Lesson>();
}

export function nextLesson(env: Env, studentId: number) {
  return env.DB.prepare('SELECT * FROM lessons WHERE student_id = ? AND opens_at > ? ORDER BY opens_at LIMIT 1')
    .bind(studentId, now())
    .first<Lesson>();
}

// ───────── Разговоры и сообщения ─────────

export function getSession(env: Env, id: number | null) {
  if (!id) return Promise.resolve(null);
  return env.DB.prepare('SELECT * FROM sessions WHERE id = ?').bind(id).first<Session>();
}

export async function createSession(env: Env, student: Student, lesson: Lesson | null): Promise<Session> {
  const level = lesson?.level || student.level;
  const res = await env.DB.prepare('INSERT INTO sessions (student_id, lesson_id, topic_id, level, started_at) VALUES (?, ?, ?, ?, ?)')
    .bind(student.id, lesson?.id ?? null, lesson?.topic_id ?? null, level, now())
    .run();
  const id = Number(res.meta.last_row_id);
  await setCurrentSession(env, student.id, id);
  return (await getSession(env, id))!;
}

export async function addMessage(env: Env, session: Session, role: ChatMessage['role'], content: string) {
  await env.DB.prepare('INSERT INTO messages (session_id, student_id, role, content, created_at) VALUES (?, ?, ?, ?, ?)')
    .bind(session.id, session.student_id, role, content, now())
    .run();
}

export async function getHistory(env: Env, sessionId: number, limit = 40): Promise<ChatMessage[]> {
  const { results } = await env.DB.prepare(
    'SELECT role, content FROM (SELECT id, role, content FROM messages WHERE session_id = ? ORDER BY id DESC LIMIT ?) ORDER BY id',
  )
    .bind(sessionId, limit)
    .all<ChatMessage>();
  return results;
}

export async function count(env: Env, sql: string, ...args: (string | number)[]): Promise<number> {
  const row = await env.DB.prepare(sql).bind(...args).first<{ n: number }>();
  return row?.n ?? 0;
}

export const countSessionMessages = (env: Env, sessionId: number) =>
  count(env, "SELECT COUNT(*) AS n FROM messages WHERE session_id = ? AND role = 'user'", sessionId);

export const countLessonMessages = (env: Env, lessonId: number) =>
  count(
    env,
    "SELECT COUNT(*) AS n FROM messages m JOIN sessions s ON s.id = m.session_id WHERE s.lesson_id = ? AND m.role = 'user'",
    lessonId,
  );

export const countStudentMessagesSince = (env: Env, studentId: number, since: number) =>
  count(env, "SELECT COUNT(*) AS n FROM messages WHERE student_id = ? AND role = 'user' AND created_at >= ?", studentId, since);

/** Атомарно помечает разговор завершённым. false — если его уже кто-то завершил. */
export async function claimFinish(env: Env, sessionId: number): Promise<boolean> {
  const res = await env.DB.prepare('UPDATE sessions SET finished_at = ? WHERE id = ? AND finished_at IS NULL').bind(now(), sessionId).run();
  return (res.meta.changes ?? 0) > 0;
}

export async function unclaimFinish(env: Env, sessionId: number) {
  await env.DB.prepare('UPDATE sessions SET finished_at = NULL WHERE id = ?').bind(sessionId).run();
}

export async function saveFeedback(env: Env, sessionId: number, feedback: string, score: number | null) {
  await env.DB.prepare('UPDATE sessions SET feedback = ?, score = ? WHERE id = ?').bind(feedback, score, sessionId).run();
}
