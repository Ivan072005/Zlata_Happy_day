// Постоянный график → конкретные уроки по неделям, оплаты и баланс.
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

export function parse(text: string): { items: Slot[]; errors: { line: number; text: string; message: string }[] } {
  return parseSchedule(text) as any;
}

export async function getTemplate(env: Env) {
  return env.DB.prepare('SELECT * FROM templates ORDER BY id DESC LIMIT 1').first<{ id: number; text: string; created_at: number }>();
}

const norm = (s: string) => s.trim().toLowerCase().replace(/\s+/g, ' ').replace(/ё/g, 'е');

/** Имя из графика → ученик (только активные). */
async function studentMap(env: Env): Promise<Map<string, number>> {
  const { results } = await env.DB.prepare('SELECT id, name FROM students WHERE archived = 0').all<{ id: number; name: string }>();
  const m = new Map<string, number>();
  for (const r of results) if (!m.has(norm(r.name))) m.set(norm(r.name), r.id);
  return m;
}

/** Создать уроки недели из графика (только те, что начинаются после `from`). */
async function generate(env: Env, week: string, slots: Slot[], from: number, students: Map<string, number>) {
  const existing = await env.DB.prepare('SELECT student_id, starts_at FROM classes WHERE week = ?').bind(week).all<{ student_id: number; starts_at: number }>();
  const taken = new Set(existing.results.map((r) => `${r.student_id}:${r.starts_at}`));
  const stmts: D1PreparedStatement[] = [];
  for (const s of slots) {
    if (s.kind !== 'lesson' || !s.name) continue;
    const sid = students.get(norm(s.name));
    if (!sid) continue;
    const start = slotMs(week, s.day, s.start);
    if (start < from || taken.has(`${sid}:${start}`)) continue;
    stmts.push(
      env.DB.prepare('INSERT INTO classes (student_id, week, starts_at, ends_at, price, created_at) VALUES (?, ?, ?, ?, ?, ?)').bind(
        sid,
        week,
        start,
        slotMs(week, s.day, s.end),
        s.price ?? 0,
        Date.now(),
      ),
    );
  }
  stmts.push(env.DB.prepare('INSERT OR IGNORE INTO class_weeks (week) VALUES (?)').bind(week));
  await env.DB.batch(stmts);
}

/** Гарантирует, что уроки недели созданы из текущего графика. */
export async function ensureWeek(env: Env, week: string): Promise<void> {
  const done = await env.DB.prepare('SELECT 1 FROM class_weeks WHERE week = ?').bind(week).first();
  if (done) return;
  const tpl = await getTemplate(env);
  if (!tpl) return;
  const first = await env.DB.prepare('SELECT MIN(created_at) AS t FROM templates').first<{ t: number }>();
  const startFrom = weekRange(weekKeyOf(first!.t))[0];
  const [, end] = weekRange(week);
  if (end <= startFrom) return; // недели до начала работы с графиком — не выдумываем прошлые уроки
  await generate(env, week, parse(tpl.text).items, startFrom, await studentMap(env));
}

/**
 * Сохранить новый график: создать недостающих учеников и пересоздать будущие уроки.
 * Прошедшие уроки, отмены и ручные правки не трогаются.
 */
export async function saveTemplate(env: Env, text: string, applyFrom: 'this' | 'next' = 'this'): Promise<{ created: string[]; lessons: number }> {
  const { items } = parse(text);
  const now = Date.now();

  // 1. Новые ученики
  const students = await studentMap(env);
  const created: string[] = [];
  for (const s of items) {
    if (s.kind !== 'lesson' || !s.name || students.has(norm(s.name))) continue;
    const res = await env.DB.prepare("INSERT INTO students (name, level, created_at) VALUES (?, 'B1', ?)").bind(s.name, now).run();
    students.set(norm(s.name), Number(res.meta.last_row_id));
    created.push(s.name);
  }

  // 2. Сохранить версию графика
  const first = await env.DB.prepare('SELECT MIN(created_at) AS t FROM templates').first<{ t: number | null }>();
  await env.DB.prepare('INSERT INTO templates (text, created_at) VALUES (?, ?)').bind(text, now).run();
  // В первую неделю работы с графиком заполняем неделю целиком (уроки с начала недели тоже были)
  const firstWeek = weekKeyOf(first?.t ?? now);
  const fillFrom = firstWeek === weekKeyOf(now) ? weekRange(firstWeek)[0] : now;

  // 3. Удалить будущие автоматические уроки и создать заново по новому графику
  //    (с этой недели или только со следующей — текущая неделя тогда не меняется)
  const thisWeek = weekKeyOf(now);
  const startWeek = applyFrom === 'next' ? addWeeks(thisWeek, 1) : thisWeek;
  if (applyFrom === 'next') await ensureWeek(env, thisWeek); // зафиксировать текущую неделю по старому графику
  await env.DB.prepare("DELETE FROM classes WHERE starts_at > ? AND week >= ? AND manual = 0 AND edited = 0 AND status = 'planned'")
    .bind(now, startWeek)
    .run();
  const { results: weeks } = await env.DB.prepare('SELECT week FROM class_weeks WHERE week >= ?').bind(startWeek).all<{ week: string }>();
  const toGen = new Set([startWeek, ...weeks.map((w) => w.week)]);
  for (const w of toGen) await generate(env, w, items, w === thisWeek ? fillFrom : now, students);

  return { created, lessons: items.filter((i) => i.kind === 'lesson').length };
}

export { addWeeks, weekKeyOf };

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

