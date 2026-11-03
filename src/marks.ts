// Оплаты «как в заметках»: оплата = N уроков (N кружков). Злата сама закрашивает кружок
// и вписывает дату урока. Урок без оплаты = «долг» (отметка без оплаты).
// Когда приходит новая оплата, долги автоматически переходят в её кружки.
import type { Env } from './types';

export interface Mark {
  id: number;
  student_id: number;
  payment_id: number | null;
  date: string; // YYYY-MM-DD
  price: number;
}

/** Обновления базы для отметок (выполняются сами, один раз). */
export async function migrateMarks(env: Env) {
  const tryRun = async (sql: string) => {
    try {
      await env.DB.prepare(sql).run();
      return true;
    } catch {
      return false;
    }
  };
  await tryRun('ALTER TABLE payments ADD COLUMN lesson_price INTEGER');
  if (await tryRun('ALTER TABLE payments ADD COLUMN lessons INTEGER')) {
    // Старые оплаты: число уроков = сумма / цена урока
    await tryRun('UPDATE payments SET lessons = amount / lesson_price WHERE lessons IS NULL AND lesson_price > 0');
  }
  await tryRun(`CREATE TABLE IF NOT EXISTS lesson_marks (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    student_id INTEGER NOT NULL,
    payment_id INTEGER,
    date TEXT NOT NULL,
    price INTEGER NOT NULL DEFAULT 0,
    created_at INTEGER NOT NULL
  )`);
  await tryRun('CREATE INDEX IF NOT EXISTS idx_marks_student ON lesson_marks(student_id, date)');
}

/** Обычная цена урока ученика: ближайший урок в расписании, иначе из последней оплаты. */
export async function studentPrice(env: Env, studentId: number): Promise<number> {
  const t = Date.now();
  const c = await env.DB.prepare(
    "SELECT price FROM classes WHERE student_id = ?1 AND status = 'planned' ORDER BY (starts_at < ?2), ABS(starts_at - ?2) LIMIT 1",
  )
    .bind(studentId, t)
    .first<{ price: number }>();
  if (c?.price) return c.price;
  const p = await env.DB.prepare('SELECT lesson_price FROM payments WHERE student_id = ? AND lesson_price > 0 ORDER BY paid_at DESC, id DESC LIMIT 1')
    .bind(studentId)
    .first<{ lesson_price: number }>();
  return p?.lesson_price ?? 0;
}

/** SQL-выражения сводки по ученику s.id (для списков). */
export const SUMMARY_SQL = `
  (SELECT COALESCE(SUM(lessons), 0) FROM payments p WHERE p.student_id = s.id) -
  (SELECT COUNT(*) FROM lesson_marks m WHERE m.student_id = s.id AND m.payment_id IS NOT NULL) AS prepaid,
  (SELECT COUNT(*) FROM lesson_marks m WHERE m.student_id = s.id AND m.payment_id IS NULL) AS debt_count,
  (SELECT COALESCE(SUM(price), 0) FROM lesson_marks m WHERE m.student_id = s.id AND m.payment_id IS NULL) AS debt_sum`;

export async function summary(env: Env, studentId: number) {
  const row = await env.DB.prepare(`SELECT ${SUMMARY_SQL} FROM students s WHERE s.id = ?`)
    .bind(studentId)
    .first<{ prepaid: number; debt_count: number; debt_sum: number }>();
  return { prepaid: row?.prepaid ?? 0, debt_count: row?.debt_count ?? 0, debt_sum: row?.debt_sum ?? 0 };
}

/** Перенести неоплаченные уроки (долги) в оплату — сколько влезет. */
export async function absorbDebts(env: Env, studentId: number, paymentId: number) {
  const p = await env.DB.prepare('SELECT lessons FROM payments WHERE id = ?').bind(paymentId).first<{ lessons: number | null }>();
  const used = await env.DB.prepare('SELECT COUNT(*) AS n FROM lesson_marks WHERE payment_id = ?').bind(paymentId).first<{ n: number }>();
  const free = (p?.lessons ?? 0) - (used?.n ?? 0);
  if (free <= 0) return 0;
  const res = await env.DB.prepare(
    `UPDATE lesson_marks SET payment_id = ?1 WHERE id IN (
       SELECT id FROM lesson_marks WHERE student_id = ?2 AND payment_id IS NULL ORDER BY date, id LIMIT ?3)`,
  )
    .bind(paymentId, studentId, free)
    .run();
  return res.meta.changes ?? 0;
}

/** Первая оплата ученика, в которой есть пустой кружок. */
export async function paymentWithFreeSlot(env: Env, studentId: number) {
  return env.DB.prepare(
    `SELECT p.id, p.lesson_price FROM payments p
     WHERE p.student_id = ? AND COALESCE(p.lessons, 0) > (SELECT COUNT(*) FROM lesson_marks m WHERE m.payment_id = p.id)
     ORDER BY p.paid_at, p.id LIMIT 1`,
  )
    .bind(studentId)
    .first<{ id: number; lesson_price: number | null }>();
}
