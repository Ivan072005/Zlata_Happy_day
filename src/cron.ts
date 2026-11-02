import * as db from './db';
import { finishWithFeedback, notifyLessonOpen } from './lessons';
import type { Env, Lesson, Session, Student } from './types';

const FREE_PRACTICE_IDLE_MS = 3 * 3600 * 1000;

/** Запускается каждые 5 минут (см. [triggers] в wrangler.toml). */
export async function runCron(env: Env): Promise<void> {
  const t = Date.now();
  const settings = await db.getSettings(env);

  // 1. Уведомить учеников об открывшихся занятиях
  await env.DB.prepare('UPDATE lessons SET notified = 1 WHERE notified = 0 AND closes_at <= ?').bind(t).run();
  const { results: opened } = await env.DB.prepare(
    `SELECT l.* FROM lessons l JOIN students s ON s.id = l.student_id
     WHERE l.notified = 0 AND l.opens_at <= ?1 AND l.closes_at > ?1 LIMIT 15`,
  )
    .bind(t)
    .all<Lesson>();
  for (const lesson of opened) {
    await env.DB.prepare('UPDATE lessons SET notified = 1 WHERE id = ?').bind(lesson.id).run();
    const student = await db.getStudent(env, lesson.student_id);
    if (student && settings.notify_lesson_open) await notifyLessonOpen(env, student, lesson);
  }

  // 2. Закрыть разговоры, у которых закончилось время занятия, и прислать разбор
  //    (+ свободные разговоры без активности 3 часа)
  const { results: stale } = await env.DB.prepare(
    `SELECT s.* FROM sessions s LEFT JOIN lessons l ON l.id = s.lesson_id
     WHERE s.finished_at IS NULL AND (
       (s.lesson_id IS NOT NULL AND (l.id IS NULL OR l.closes_at <= ?1)) OR
       (s.lesson_id IS NULL AND COALESCE((SELECT MAX(created_at) FROM messages m WHERE m.session_id = s.id), s.started_at) <= ?2)
     ) LIMIT 3`,
  )
    .bind(t, t - FREE_PRACTICE_IDLE_MS)
    .all<Session>();
  for (const session of stale) {
    const student = await db.getStudent(env, session.student_id);
    if (!student) continue;
    await finishWithFeedback(env, student as Student, session, {
      reason: session.lesson_id ? '⏰ Время занятия закончилось.' : undefined,
    });
  }
}
