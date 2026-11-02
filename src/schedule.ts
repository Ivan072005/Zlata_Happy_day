// Постоянный график → график каждой недели (текст) → конкретные уроки; оплаты и баланс.
//
// У каждой недели свой текст в том же формате, что и постоянный график.
// Новая неделя начинается с копии постоянного графика; правки недели действуют только на неё.
// Уроки (таблица classes) всегда пересобираются из текста недели.
import { parseSchedule } from '../public/parser.js';
import type { Env } from './types';
import { addWeeks, slotMs, weekKeyOf, weekRange } from './time';

export interface Slot {
  day: number;
  start: string;
  end: string;
  kind: 'lesson' | 'free' | 'busy';
  name?: string;
  price?: number;
  cancelled?: boolean;
  line: number;
}

export interface ClassRow {
  id: number;
  student_id: number;
  week: string;
  starts_at: number;
  ends_at: number;
  price: number;
  status: 'planned' | 'cancelled';
  manual: number;
  edited: number;
  note: string | null;
}

export interface WeekText {
  week: string;
  text: string;
  edited: number;
  updated_at: number;
}

export function parse(text: string): { items: Slot[]; errors: { line: number; text: string; message: string }[] } {
  return parseSchedule(text) as any;
}

export async function getTemplate(env: Env) {
  return env.DB.prepare('SELECT * FROM templates ORDER BY id DESC LIMIT 1').first<{ id: number; text: string; created_at: number }>();
}

export const norm = (s: string) => s.trim().toLowerCase().replace(/\s+/g, ' ').replace(/ё/g, 'е');

/** Имя → ученик (только активные). */
async function studentMap(env: Env): Promise<Map<string, number>> {
  const { results } = await env.DB.prepare('SELECT id, name FROM students WHERE archived = 0').all<{ id: number; name: string }>();
  const m = new Map<string, number>();
  for (const r of results) if (!m.has(norm(r.name))) m.set(norm(r.name), r.id);
  return m;
}

/** Создаёт учеников для новых имён. Возвращает карту имён и список созданных. */
async function withStudents(env: Env, items: Slot[]) {
  const students = await studentMap(env);
  const created: string[] = [];
  for (const s of items) {
    if (s.kind !== 'lesson' || !s.name || students.has(norm(s.name))) continue;
    const res = await env.DB.prepare("INSERT INTO students (name, level, created_at) VALUES (?, 'B1', ?)").bind(s.name, Date.now()).run();
    students.set(norm(s.name), Number(res.meta.last_row_id));
    created.push(s.name);
  }
  return { students, created };
}

/** Пересобрать уроки недели из её текста. */
async function rebuildWeek(env: Env, week: string, text: string, students: Map<string, number>) {
  const stmts: D1PreparedStatement[] = [env.DB.prepare('DELETE FROM classes WHERE week = ?').bind(week)];
  for (const s of parse(text).items) {
    if (s.kind !== 'lesson' || !s.name) continue;
    const sid = students.get(norm(s.name));
    if (!sid) continue;
    stmts.push(
      env.DB.prepare('INSERT INTO classes (student_id, week, starts_at, ends_at, price, status, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)').bind(
        sid,
        week,
        slotMs(week, s.day, s.start),
        slotMs(week, s.day, s.end),
        s.price ?? 0,
        s.cancelled ? 'cancelled' : 'planned',
        Date.now(),
      ),
    );
  }
  await env.DB.batch(stmts);
}

/** Первая неделя, с которой ведётся график (раньше уроки не выдумываем). */
async function firstWeek(env: Env): Promise<string | null> {
  const first = await env.DB.prepare('SELECT MIN(created_at) AS t FROM templates').first<{ t: number | null }>();
  return first?.t ? weekKeyOf(first.t) : null;
}

/** График недели: существующий или копия постоянного графика (тогда же создаются уроки). */
export async function getWeek(env: Env, week: string): Promise<WeekText | null> {
  const row = await env.DB.prepare('SELECT * FROM week_texts WHERE week = ?').bind(week).first<WeekText>();
  if (row) return row;
  const [tpl, fw] = await Promise.all([getTemplate(env), firstWeek(env)]);
  if (!tpl || !fw || week < fw) return null;
  const { students } = await withStudents(env, parse(tpl.text).items);
  const ins = await env.DB.prepare('INSERT OR IGNORE INTO week_texts (week, text, edited, updated_at) VALUES (?, ?, 0, ?)')
    .bind(week, tpl.text, Date.now())
    .run();
  if (ins.meta.changes) await rebuildWeek(env, week, tpl.text, students);
  return env.DB.prepare('SELECT * FROM week_texts WHERE week = ?').bind(week).first<WeekText>();
}

/** Для совместимости: убедиться, что уроки недели существуют. */
export async function ensureWeek(env: Env, week: string): Promise<void> {
  await getWeek(env, week);
}

/** Сохранить график конкретной недели (только для неё). */
export async function saveWeek(env: Env, week: string, text: string) {
  const { students, created } = await withStudents(env, parse(text).items);
  await env.DB.prepare(
    'INSERT INTO week_texts (week, text, edited, updated_at) VALUES (?, ?, 1, ?) ON CONFLICT(week) DO UPDATE SET text = excluded.text, edited = 1, updated_at = excluded.updated_at',
  )
    .bind(week, text, Date.now())
    .run();
  await rebuildWeek(env, week, text, students);
  return { created };
}

/** Вернуть неделю к постоянному графику. */
export async function resetWeek(env: Env, week: string) {
  const tpl = await getTemplate(env);
  if (!tpl) return;
  const { students } = await withStudents(env, parse(tpl.text).items);
  await env.DB.prepare(
    'INSERT INTO week_texts (week, text, edited, updated_at) VALUES (?, ?, 0, ?) ON CONFLICT(week) DO UPDATE SET text = excluded.text, edited = 0, updated_at = excluded.updated_at',
  )
    .bind(week, tpl.text, Date.now())
    .run();
  await rebuildWeek(env, week, tpl.text, students);
}

/**
 * Сохранить постоянный график. Недели с этой (или со следующей) и дальше, которые не меняли вручную,
 * обновляются. Изменённые вручную недели не трогаются — их список возвращается.
 */
export async function saveTemplate(env: Env, text: string, applyFrom: 'this' | 'next' = 'this') {
  const { items } = parse(text);
  const { students, created } = await withStudents(env, items);
  const thisWeek = weekKeyOf(Date.now());
  if (applyFrom === 'next') await getWeek(env, thisWeek); // зафиксировать текущую неделю по старому графику
  await env.DB.prepare('INSERT INTO templates (text, created_at) VALUES (?, ?)').bind(text, Date.now()).run();

  const startWeek = applyFrom === 'next' ? addWeeks(thisWeek, 1) : thisWeek;
  const { results } = await env.DB.prepare('SELECT week, edited FROM week_texts WHERE week >= ?').bind(startWeek).all<{ week: string; edited: number }>();
  const kept: string[] = [];
  for (const w of results) {
    if (w.edited) {
      kept.push(w.week);
      continue;
    }
    await env.DB.prepare('UPDATE week_texts SET text = ?, updated_at = ? WHERE week = ?').bind(text, Date.now(), w.week).run();
    await rebuildWeek(env, w.week, text, students);
  }
  await getWeek(env, startWeek);
  return { created, kept, lessons: items.filter((i) => i.kind === 'lesson').length };
}

export { addWeeks, weekKeyOf, weekRange };

// ───────── Оплата: распределение денег по урокам ─────────

export type PayState = 'paid' | 'partial' | 'unpaid';

/**
 * Деньги ученика распределяются по его урокам по порядку (сначала самые ранние).
 * Так пакет автоматически «закрывает» следующие уроки, а частичная оплата видна как «частично».
 */
export async function allocate(
  env: Env,
  studentIds: number[],
  until = Number.MAX_SAFE_INTEGER,
): Promise<Map<number, { covered: number; state: PayState }>> {
  const out = new Map<number, { covered: number; state: PayState }>();
  if (!studentIds.length) return out;
  const ph = studentIds.map(() => '?').join(',');
  const [classes, pays] = await Promise.all([
    env.DB.prepare(
      `SELECT id, student_id, price FROM classes WHERE status = 'planned' AND student_id IN (${ph}) AND starts_at < ? ORDER BY starts_at, id`,
    )
      .bind(...studentIds, until)
      .all<{ id: number; student_id: number; price: number }>(),
    env.DB.prepare(`SELECT student_id, SUM(amount) AS total FROM payments WHERE student_id IN (${ph}) GROUP BY student_id`)
      .bind(...studentIds)
      .all<{ student_id: number; total: number }>(),
  ]);
  const left = new Map(pays.results.map((p) => [p.student_id, p.total]));
  for (const c of classes.results) {
    const money = left.get(c.student_id) ?? 0;
    const covered = Math.min(money, c.price);
    left.set(c.student_id, money - covered);
    out.set(c.id, { covered, state: c.price === 0 || covered >= c.price ? 'paid' : covered > 0 ? 'partial' : 'unpaid' });
  }
  return out;
}

/** Баланс: оплачено − стоимость проведённых уроков. Минус = долг, плюс = предоплата. */
export async function balance(env: Env, studentId: number) {
  const now = Date.now();
  const row = await env.DB.prepare(
    `SELECT (SELECT COALESCE(SUM(amount), 0) FROM payments WHERE student_id = ?1) AS paid,
            (SELECT COALESCE(SUM(price), 0) FROM classes WHERE student_id = ?1 AND status = 'planned' AND starts_at <= ?2) AS charged,
            (SELECT COUNT(*) FROM classes WHERE student_id = ?1 AND status = 'planned' AND starts_at <= ?2) AS held`,
  )
    .bind(studentId, now)
    .first<{ paid: number; charged: number; held: number }>();
  return { paid: row?.paid ?? 0, charged: row?.charged ?? 0, held: row?.held ?? 0, balance: (row?.paid ?? 0) - (row?.charged ?? 0) };
}

