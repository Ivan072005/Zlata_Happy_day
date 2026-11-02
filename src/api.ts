import { checkPassword, clearSessionCookie, isAuthed, makeSessionCookie } from './auth';
import * as db from './db';
import { lessonStatus, notifyLessonOpen, wordsUsed } from './lessons';
import { tg } from './telegram';
import { LEVELS, type Env, type Lesson, type Student } from './types';

class HttpError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

const json = (data: unknown, init: ResponseInit = {}) => Response.json(data, init);
const DAY = 24 * 3600 * 1000;

// ───────── Проверка входных данных ─────────

function str(v: unknown, max: number, required = false): string | null {
  if (v === undefined || v === null || v === '') {
    if (required) throw new HttpError(400, 'Заполни обязательные поля');
    return null;
  }
  if (typeof v !== 'string') throw new HttpError(400, 'Неверный формат данных');
  const s = v.trim();
  if (required && !s) throw new HttpError(400, 'Заполни обязательные поля');
  return s.slice(0, max) || null;
}

function int(v: unknown, min: number, max: number): number {
  const n = Number(v);
  if (!Number.isFinite(n) || n < min || n > max) throw new HttpError(400, 'Неверное число');
  return Math.round(n);
}

function level(v: unknown): string {
  if (typeof v !== 'string' || !(LEVELS as readonly string[]).includes(v)) throw new HttpError(400, 'Неверный уровень');
  return v;
}

// ───────── Ссылки ─────────

async function botUsername(env: Env): Promise<string | null> {
  const s = await db.getSettings(env);
  if (s.bot_username) return s.bot_username;
  const me = await tg(env, 'getMe', {});
  if (me.ok && me.result?.username) {
    await db.setSetting(env, 'bot_username', me.result.username);
    return me.result.username;
  }
  return null;
}

async function inviteLink(env: Env, code: string | null): Promise<string | null> {
  if (!code) return null;
  const bot = await botUsername(env);
  return bot ? `https://t.me/${bot}?start=${code}` : null;
}

// ───────── Роутер ─────────

type Handler = (env: Env, req: Request, params: string[], body: any) => Promise<Response>;
const routes: [string, RegExp, Handler][] = [];
const route = (method: string, path: string, h: Handler) =>
  routes.push([method, new RegExp(`^${path.replace(/:id/g, '(\\d+)')}$`), h]);

export async function handleApi(req: Request, env: Env): Promise<Response> {
  const url = new URL(req.url);
  const path = url.pathname.replace(/^\/api/, '') || '/';

  try {
    if (req.method !== 'GET' && !(req.headers.get('content-type') ?? '').includes('application/json')) {
      throw new HttpError(415, 'Нужен JSON');
    }
    const body: any = req.method === 'GET' || req.method === 'DELETE' ? {} : await req.json().catch(() => ({}));

    if (req.method === 'POST' && path === '/login') {
      if (!env.ADMIN_PASSWORD) throw new HttpError(500, 'Пароль не задан: выполни `npx wrangler secret put ADMIN_PASSWORD`');
      if (!(await checkPassword(env, String(body.password ?? '')))) {
        await new Promise((r) => setTimeout(r, 1000));
        throw new HttpError(401, 'Неверный пароль');
      }
      return json({ ok: true }, { headers: { 'set-cookie': await makeSessionCookie(env) } });
    }
    if (req.method === 'POST' && path === '/logout') {
      return json({ ok: true }, { headers: { 'set-cookie': clearSessionCookie() } });
    }

    if (!(await isAuthed(env, req))) throw new HttpError(401, 'Нужно войти');

    for (const [method, re, handler] of routes) {
      const m = method === req.method && path.match(re);
      if (m) return await handler(env, req, m.slice(1), body);
    }
    throw new HttpError(404, 'Не найдено');
  } catch (e) {
    if (e instanceof HttpError) return json({ error: e.message }, { status: e.status });
    console.error('API error', e);
    return json({ error: 'Ошибка сервера' }, { status: 500 });
  }
}

route('GET', '/me', async () => json({ ok: true }));

// ───────── Главная ─────────

const LESSON_SELECT = `SELECT l.*, t.title AS topic_title, t.vocab AS topic_vocab, st.name AS student_name,
  (SELECT COUNT(*) FROM messages m JOIN sessions x ON x.id = m.session_id WHERE x.lesson_id = l.id AND m.role = 'user') AS messages,
  (SELECT score FROM sessions x WHERE x.lesson_id = l.id AND x.score IS NOT NULL ORDER BY x.id DESC LIMIT 1) AS score
  FROM lessons l LEFT JOIN topics t ON t.id = l.topic_id JOIN students st ON st.id = l.student_id`;

type LessonRow = Lesson & { topic_title: string | null; topic_vocab: string | null; student_name: string; messages: number; score: number | null };

const withStatus = (rows: LessonRow[], t = Date.now()) => rows.map((l) => ({ ...l, status: lessonStatus(l, l.messages, t) }));

route('GET', '/dashboard', async (env) => {
  const t = Date.now();
  const [open, upcoming, recent, recentLessons, counts, unpaid] = await Promise.all([
    env.DB.prepare(`${LESSON_SELECT} WHERE l.opens_at <= ?1 AND l.closes_at > ?1 AND st.archived = 0 ORDER BY l.closes_at`).bind(t).all<LessonRow>(),
    env.DB.prepare(`${LESSON_SELECT} WHERE l.opens_at > ?1 AND l.opens_at < ?2 AND st.archived = 0 ORDER BY l.opens_at LIMIT 30`)
      .bind(t, t + 2 * DAY)
      .all<LessonRow>(),
    env.DB.prepare(
      `SELECT x.id, x.student_id, x.finished_at, x.score, x.level, st.name AS student_name, t.title AS topic_title,
        (SELECT COUNT(*) FROM messages m WHERE m.session_id = x.id AND m.role = 'user') AS messages
       FROM sessions x JOIN students st ON st.id = x.student_id LEFT JOIN topics t ON t.id = x.topic_id
       WHERE x.feedback IS NOT NULL ORDER BY x.finished_at DESC LIMIT 10`,
    ).all(),
    env.DB.prepare(`${LESSON_SELECT} WHERE l.closes_at <= ?1 AND l.closes_at > ?2 ORDER BY l.closes_at DESC LIMIT 15`)
      .bind(t, t - 2 * DAY)
      .all<LessonRow>(),
    env.DB.prepare(
      `SELECT (SELECT COUNT(*) FROM students WHERE archived = 0) AS students,
              (SELECT COUNT(*) FROM students WHERE archived = 0 AND tg_id IS NOT NULL) AS linked,
              (SELECT COUNT(*) FROM messages WHERE role = 'user' AND created_at >= ?1) AS messages_7d,
              (SELECT COUNT(DISTINCT student_id) FROM messages WHERE role = 'user' AND created_at >= ?1) AS active_7d`,
    )
      .bind(t - 7 * DAY)
      .first(),
    env.DB.prepare(
      `SELECT st.id, st.name, COUNT(*) AS lessons, MIN(l.opens_at) AS since FROM lessons l JOIN students st ON st.id = l.student_id
       WHERE l.paid = 0 AND l.opens_at <= ? AND st.archived = 0 GROUP BY st.id ORDER BY lessons DESC, st.name`,
    )
      .bind(t)
      .all(),
  ]);
  return json({
    open: withStatus(open.results, t),
    upcoming: withStatus(upcoming.results, t),
    recent_lessons: withStatus(recentLessons.results, t),
    recent_feedback: recent.results,
    unpaid: unpaid.results,
    counts,
  });
});

// ───────── Ученики ─────────

route('GET', '/students', async (env) => {
  const t = Date.now();
  const { results } = await env.DB.prepare(
    `SELECT s.id, s.name, s.level, s.note, s.archived, s.tg_id IS NOT NULL AS linked, s.tg_username,
       (SELECT MAX(created_at) FROM messages m WHERE m.student_id = s.id AND m.role = 'user') AS last_active,
       (SELECT COUNT(*) FROM messages m WHERE m.student_id = s.id AND m.role = 'user' AND m.created_at >= ?1) AS messages_7d,
       (SELECT ROUND(AVG(score), 1) FROM sessions x WHERE x.student_id = s.id AND x.score IS NOT NULL) AS avg_score,
       (SELECT COUNT(*) FROM lessons l WHERE l.student_id = s.id AND l.opens_at <= ?2 AND l.closes_at > ?2) AS open_lessons,
       (SELECT MIN(opens_at) FROM lessons l WHERE l.student_id = s.id AND l.opens_at > ?2) AS next_lesson_at,
       (SELECT COUNT(*) FROM lessons l WHERE l.student_id = s.id AND l.paid = 0 AND l.opens_at <= ?2) AS unpaid
     FROM students s ORDER BY s.archived, s.name COLLATE NOCASE`,
  )
    .bind(t - 7 * DAY, t)
    .all();
  return json({ students: results });
});

route('POST', '/students', async (env, _req, _p, body) => {
  const lvl = level(body.level ?? 'B1');
  const names: string[] = Array.isArray(body.names)
    ? body.names.map((n: unknown) => str(n, 80)).filter(Boolean)
    : [str(body.name, 80, true)!];
  if (!names.length) throw new HttpError(400, 'Добавь хотя бы одно имя');
  if (names.length > 100) throw new HttpError(400, 'Не больше 100 за раз');
  const note = str(body.note, 500);
  // Одного ученика создаём без ссылки (её генерируют кнопкой), списком — сразу со ссылками
  const bulk = Array.isArray(body.names);
  const created: { id: number; name: string; invite_link: string | null }[] = [];
  for (const name of names) {
    const code = bulk ? db.randomCode() : null;
    const res = await env.DB.prepare('INSERT INTO students (name, note, level, invite_code, created_at) VALUES (?, ?, ?, ?, ?)')
      .bind(name, bulk ? null : note, lvl, code, Date.now())
      .run();
    created.push({ id: Number(res.meta.last_row_id), name, invite_link: await inviteLink(env, code) });
  }
  return json({ ids: created.map((c) => c.id), students: created });
});

route('GET', '/students/:id', async (env, _req, [id]) => {
  const s = await db.getStudent(env, Number(id));
  if (!s) throw new HttpError(404, 'Ученик не найден');
  const t = Date.now();

  const [lessons, sessions, texts, agg] = await Promise.all([
    env.DB.prepare(`${LESSON_SELECT} WHERE l.student_id = ? ORDER BY l.opens_at DESC LIMIT 200`).bind(s.id).all<LessonRow>(),
    env.DB.prepare(
      `SELECT x.id, x.lesson_id, x.started_at, x.finished_at, x.score, x.level, x.feedback IS NOT NULL AS has_feedback, t.title AS topic_title,
         (SELECT COUNT(*) FROM messages m WHERE m.session_id = x.id AND m.role = 'user') AS messages
       FROM sessions x LEFT JOIN topics t ON t.id = x.topic_id WHERE x.student_id = ? ORDER BY x.id DESC LIMIT 100`,
    )
      .bind(s.id)
      .all<{ id: number; score: number | null; finished_at: number | null; started_at: number; messages: number }>(),
    env.DB.prepare(
      `SELECT x.lesson_id, m.content FROM messages m JOIN sessions x ON x.id = m.session_id
       WHERE x.student_id = ? AND m.role = 'user' AND x.lesson_id IS NOT NULL`,
    )
      .bind(s.id)
      .all<{ lesson_id: number; content: string }>(),
    env.DB.prepare(
      `SELECT COUNT(*) AS messages, MAX(created_at) AS last_active,
         (SELECT COUNT(*) FROM messages WHERE student_id = ?1 AND role = 'user' AND created_at >= ?2) AS messages_7d
       FROM messages WHERE student_id = ?1 AND role = 'user'`,
    )
      .bind(s.id, t - 7 * DAY)
      .first<{ messages: number; last_active: number | null; messages_7d: number }>(),
  ]);

  const byLesson = new Map<number, string[]>();
  for (const r of texts.results) {
    if (!byLesson.has(r.lesson_id)) byLesson.set(r.lesson_id, []);
    byLesson.get(r.lesson_id)!.push(r.content);
  }
  const ls = withStatus(lessons.results, t).map((l) => ({ ...l, words: wordsUsed(l.topic_vocab, byLesson.get(l.id) ?? []) }));

  const past = ls.filter((l) => l.status !== 'upcoming' && l.status !== 'open');
  const scored = sessions.results.filter((x) => x.score !== null);
  const allWords = ls.flatMap((l) => (l.status === 'upcoming' ? [] : l.words));

  return json({
    student: { ...s, invite_code: undefined, invite_link: await inviteLink(env, s.invite_code) },
    stats: {
      lessons_done: past.filter((l) => l.status === 'done').length,
      lessons_partial: past.filter((l) => l.status === 'partial').length,
      lessons_missed: past.filter((l) => l.status === 'missed').length,
      lessons_total: past.length,
      unpaid: ls.filter((l) => !l.paid && l.opens_at <= t).length,
      messages: agg?.messages ?? 0,
      messages_7d: agg?.messages_7d ?? 0,
      last_active: agg?.last_active ?? null,
      conversations: sessions.results.length,
      avg_score: scored.length ? Math.round((scored.reduce((a, x) => a + x.score!, 0) / scored.length) * 10) / 10 : null,
      scores: scored
        .slice(0, 15)
        .reverse()
        .map((x) => ({ at: x.finished_at ?? x.started_at, score: x.score })),
      words_used: allWords.filter((w) => w.used).length,
      words_total: allWords.length,
    },
    lessons: ls,
    sessions: sessions.results,
  });
});

route('PATCH', '/students/:id', async (env, _req, [id], body) => {
  const s = await db.getStudent(env, Number(id));
  if (!s) throw new HttpError(404, 'Ученик не найден');
  const upd: Partial<Student> = {};
  if ('name' in body) upd.name = str(body.name, 80, true)!;
  if ('note' in body) upd.note = str(body.note, 500);
  if ('level' in body) upd.level = level(body.level);
  if ('corrections' in body) upd.corrections = body.corrections === 'inline' ? 'inline' : 'end';
  if ('free_practice' in body) upd.free_practice = body.free_practice ? 1 : 0;
  if ('archived' in body) upd.archived = body.archived ? 1 : 0;
  const keys = Object.keys(upd);
  if (keys.length) {
    await env.DB.prepare(`UPDATE students SET ${keys.map((k) => `${k} = ?`).join(', ')} WHERE id = ?`)
      .bind(...keys.map((k) => (upd as any)[k]), s.id)
      .run();
  }
  return json({ ok: true });
});

route('DELETE', '/students/:id', async (env, _req, [id]) => {
  const sid = Number(id);
  await env.DB.batch([
    env.DB.prepare('DELETE FROM messages WHERE student_id = ?').bind(sid),
    env.DB.prepare('DELETE FROM sessions WHERE student_id = ?').bind(sid),
    env.DB.prepare('DELETE FROM lessons WHERE student_id = ?').bind(sid),
    env.DB.prepare('DELETE FROM students WHERE id = ?').bind(sid),
  ]);
  return json({ ok: true });
});

/** Сгенерировать новую ссылку-приглашение. Если Telegram уже привязан — отвязывает его. */
route('POST', '/students/:id/invite', async (env, _req, [id]) => {
  const s = await db.getStudent(env, Number(id));
  if (!s) throw new HttpError(404, 'Ученик не найден');
  const code = db.randomCode();
  await env.DB.prepare(
    'UPDATE students SET invite_code = ?, tg_id = NULL, tg_username = NULL, tg_name = NULL, linked_at = NULL, current_session = NULL WHERE id = ?',
  )
    .bind(code, s.id)
    .run();
  const link = await inviteLink(env, code);
  if (!link) throw new HttpError(500, 'Не удалось узнать имя бота. Проверь BOT_TOKEN и открой /setup');
  return json({ invite_link: link });
});

// ───────── Темы ─────────

route('GET', '/topics', async (env) => {
  const { results } = await env.DB.prepare(
    `SELECT t.*, (SELECT COUNT(*) FROM lessons l WHERE l.topic_id = t.id) AS lessons FROM topics t ORDER BY t.active DESC, t.title COLLATE NOCASE`,
  ).all();
  return json({ topics: results });
});

route('POST', '/topics', async (env, _req, _p, body) => {
  const res = await env.DB.prepare('INSERT INTO topics (title, scenario, vocab, created_at) VALUES (?, ?, ?, ?)')
    .bind(str(body.title, 80, true), str(body.scenario, 2000, true), str(body.vocab, 500), Date.now())
    .run();
  return json({ id: Number(res.meta.last_row_id) });
});

route('PATCH', '/topics/:id', async (env, _req, [id], body) => {
  await env.DB.prepare('UPDATE topics SET title = ?, scenario = ?, vocab = ?, active = ? WHERE id = ?')
    .bind(str(body.title, 80, true), str(body.scenario, 2000, true), str(body.vocab, 500), body.active === false ? 0 : 1, Number(id))
    .run();
  return json({ ok: true });
});

route('DELETE', '/topics/:id', async (env, _req, [id]) => {
  const used = await db.count(env, 'SELECT COUNT(*) AS n FROM lessons WHERE topic_id = ?', Number(id));
  if (used) {
    await env.DB.prepare('UPDATE topics SET active = 0 WHERE id = ?').bind(Number(id)).run();
    return json({ hidden: true });
  }
  await env.DB.prepare('DELETE FROM topics WHERE id = ?').bind(Number(id)).run();
  return json({ deleted: true });
});

// ───────── Занятия ─────────

function lessonFields(body: any) {
  const opens = int(body.opens_at, 0, 1e14);
  const closes = int(body.closes_at, 0, 1e14);
  if (closes <= opens) throw new HttpError(400, 'Время окончания должно быть позже начала');
  if (closes - opens > 31 * DAY) throw new HttpError(400, 'Занятие не может длиться больше месяца');
  return {
    topic_id: body.topic_id ? int(body.topic_id, 1, 1e9) : null,
    level: body.level ? level(body.level) : null,
    instructions: str(body.instructions, 1000),
    opens_at: opens,
    closes_at: closes,
    min_messages: int(body.min_messages ?? 10, 1, 200),
  };
}

route('POST', '/lessons', async (env, _req, _p, body) => {
  const student = await db.getStudent(env, int(body.student_id, 1, 1e9));
  if (!student) throw new HttpError(404, 'Ученик не найден');
  const f = lessonFields(body);
  const repeat = int(body.repeat_weeks ?? 0, 0, 20);
  const t = Date.now();
  const settings = await db.getSettings(env);

  const ids: number[] = [];
  for (let i = 0; i <= repeat; i++) {
    const opens = f.opens_at + i * 7 * DAY;
    const closes = f.closes_at + i * 7 * DAY;
    const res = await env.DB.prepare(
      `INSERT INTO lessons (student_id, topic_id, level, instructions, opens_at, closes_at, min_messages, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    )
      .bind(student.id, f.topic_id, f.level, f.instructions, opens, closes, f.min_messages, t)
      .run();
    ids.push(Number(res.meta.last_row_id));
  }

  // Если занятие уже открыто — сразу уведомляем ученика
  if (f.opens_at <= t && f.closes_at > t) {
    await env.DB.prepare('UPDATE lessons SET notified = 1 WHERE id = ?').bind(ids[0]).run();
    const lesson = await db.getLesson(env, ids[0]);
    if (lesson && settings.notify_lesson_open) await notifyLessonOpen(env, student, lesson);
  }
  return json({ ids });
});

route('PATCH', '/lessons/:id', async (env, _req, [id], body) => {
  const lesson = await db.getLesson(env, Number(id));
  if (!lesson) throw new HttpError(404, 'Занятие не найдено');
  const f = lessonFields(body);
  const notified = f.opens_at > Date.now() ? 0 : lesson.notified;
  await env.DB.prepare(
    'UPDATE lessons SET topic_id = ?, level = ?, instructions = ?, opens_at = ?, closes_at = ?, min_messages = ?, notified = ? WHERE id = ?',
  )
    .bind(f.topic_id, f.level, f.instructions, f.opens_at, f.closes_at, f.min_messages, notified, lesson.id)
    .run();
  return json({ ok: true });
});

route('PATCH', '/lessons/:id/paid', async (env, _req, [id], body) => {
  const res = await env.DB.prepare('UPDATE lessons SET paid = ? WHERE id = ?').bind(body.paid ? 1 : 0, Number(id)).run();
  if (!res.meta.changes) throw new HttpError(404, 'Занятие не найдено');
  return json({ ok: true });
});

/** Расписание: все занятия, пересекающиеся с периодом [from, to). */
route('GET', '/schedule', async (env, req) => {
  const url = new URL(req.url);
  const from = int(url.searchParams.get('from'), 0, 1e14);
  const to = int(url.searchParams.get('to'), 0, 1e14);
  if (to <= from || to - from > 62 * DAY) throw new HttpError(400, 'Неверный период');
  const { results } = await env.DB.prepare(`${LESSON_SELECT} WHERE l.opens_at < ? AND l.closes_at > ? ORDER BY l.opens_at`)
    .bind(to, from)
    .all<LessonRow>();
  return json({ lessons: withStatus(results) });
});

route('DELETE', '/lessons/:id', async (env, _req, [id]) => {
  await env.DB.prepare('DELETE FROM lessons WHERE id = ?').bind(Number(id)).run();
  return json({ ok: true });
});

// ───────── Разговоры ─────────

route('GET', '/sessions/:id', async (env, _req, [id]) => {
  const session = await env.DB.prepare(
    `SELECT x.*, st.name AS student_name, t.title AS topic_title FROM sessions x
     JOIN students st ON st.id = x.student_id LEFT JOIN topics t ON t.id = x.topic_id WHERE x.id = ?`,
  )
    .bind(Number(id))
    .first();
  if (!session) throw new HttpError(404, 'Разговор не найден');
  const { results } = await env.DB.prepare('SELECT role, content, created_at FROM messages WHERE session_id = ? ORDER BY id')
    .bind(Number(id))
    .all();
  return json({ session, messages: results });
});

// ───────── Настройки ─────────

route('GET', '/settings', async (env) => {
  const s = await db.getSettings(env);
  let teacher: string | null = null;
  if (s.teacher_tg_id) teacher = `ID ${s.teacher_tg_id}`;
  return json({
    daily_limit: s.daily_limit,
    feedback_language: s.feedback_language,
    default_min_messages: s.default_min_messages,
    notify_feedback: s.notify_feedback,
    notify_lesson_open: s.notify_lesson_open,
    teacher_connected: !!s.teacher_tg_id,
    teacher,
    bot_username: await botUsername(env),
  });
});

route('PATCH', '/settings', async (env, _req, _p, body) => {
  if ('daily_limit' in body) await db.setSetting(env, 'daily_limit', String(int(body.daily_limit, 1, 1000)));
  if ('default_min_messages' in body) await db.setSetting(env, 'default_min_messages', String(int(body.default_min_messages, 1, 200)));
  if ('feedback_language' in body) {
    const lang = str(body.feedback_language, 30, true)!;
    if (!['Russian', 'Ukrainian', 'English'].includes(lang)) throw new HttpError(400, 'Неизвестный язык');
    await db.setSetting(env, 'feedback_language', lang);
  }
  if ('notify_feedback' in body) await db.setSetting(env, 'notify_feedback', body.notify_feedback ? '1' : '0');
  if ('notify_lesson_open' in body) await db.setSetting(env, 'notify_lesson_open', body.notify_lesson_open ? '1' : '0');
  return json({ ok: true });
});

route('POST', '/settings/teacher-link', async (env) => {
  const code = db.randomCode(16);
  await db.setSetting(env, 'teacher_link_code', code);
  const bot = await botUsername(env);
  if (!bot) throw new HttpError(500, 'Не удалось узнать имя бота. Проверь BOT_TOKEN');
  return json({ link: `https://t.me/${bot}?start=teacher_${code}` });
});

route('DELETE', '/settings/teacher', async (env) => {
  await db.setSetting(env, 'teacher_tg_id', null);
  return json({ ok: true });
});
