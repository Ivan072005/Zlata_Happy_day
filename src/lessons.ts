import * as db from './db';
import { GeminiError, generate } from './gemini';
import { feedbackPrompt } from './prompts';
import { escapeHtml as esc, mdToHtml, send, typing } from './telegram';
import type { Env, Lesson, Session, Student } from './types';

export const msgs = (n: number) => {
  const a = Math.abs(n) % 100, b = a % 10;
  return `${n} ${a > 10 && a < 20 ? 'сообщений' : b === 1 ? 'сообщение' : b >= 2 && b <= 4 ? 'сообщения' : 'сообщений'}`;
};

export type LessonStatus = 'upcoming' | 'open' | 'done' | 'partial' | 'missed';

export function lessonStatus(lesson: Pick<Lesson, 'opens_at' | 'closes_at' | 'min_messages'>, messages: number, t = Date.now()): LessonStatus {
  if (t < lesson.opens_at) return 'upcoming';
  if (messages >= lesson.min_messages) return 'done';
  if (t < lesson.closes_at) return 'open';
  return messages > 0 ? 'partial' : 'missed';
}

/** Какие слова из списка ученик употребил. Учитывает простые формы: -s, -es, -ed, -d, -ing. */
export function wordsUsed(vocab: string | null, studentTexts: string[]): { word: string; used: boolean }[] {
  if (!vocab) return [];
  const text = studentTexts.join('\n').toLowerCase();
  return vocab
    .split(',')
    .map((w) => w.trim())
    .filter(Boolean)
    .map((word) => {
      const parts = word.toLowerCase().split(/\s+/).map((p) => p.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
      const re = new RegExp(`\\b${parts.map((p) => `${p}(?:s|es|ed|d|ing)?`).join('\\s+')}\\b`, 'i');
      return { word, used: re.test(text) };
    });
}

export function fmtTime(ts: number, withDate = true): string {
  return new Date(ts).toLocaleString('ru-RU', {
    timeZone: 'Europe/Kyiv',
    ...(withDate ? { weekday: 'short', day: '2-digit', month: '2-digit' } : {}),
    hour: '2-digit',
    minute: '2-digit',
  });
}

/** Текст «что сейчас у ученика»: открытое занятие, следующее или свободная практика. */
export async function statusText(env: Env, student: Student): Promise<string> {
  const lesson = await db.activeLesson(env, student.id);
  if (lesson) {
    const [topic, done] = await Promise.all([db.getTopic(env, lesson.topic_id), db.countLessonMessages(env, lesson.id)]);
    return (
      `📚 <b>Сейчас открыто занятие:</b> ${esc(topic?.title ?? 'Свободная тема')}\n` +
      `⏰ До ${fmtTime(lesson.closes_at)}\n` +
      `🎯 Цель: ${msgs(lesson.min_messages)} (сейчас ${Math.min(done, lesson.min_messages)})\n\n` +
      'Напиши что-нибудь по-английски, чтобы начать!'
    );
  }
  const next = await db.nextLesson(env, student.id);
  let text = '';
  if (student.free_practice) {
    text = '💬 Сейчас занятий нет, но можно просто поболтать по-английски на любую тему — пиши!';
  } else {
    text = '😴 Сейчас нет открытых занятий.';
  }
  if (next) {
    const topic = await db.getTopic(env, next.topic_id);
    text += `\n\n📅 Следующее занятие: <b>${esc(topic?.title ?? 'Свободная тема')}</b>\n${fmtTime(next.opens_at)} – ${fmtTime(next.closes_at, false)}`;
  }
  return text;
}

/**
 * Завершает разговор и присылает разбор ученику (и копию преподавателю).
 * Возвращает false, если не получилось (например, ИИ недоступен) — тогда разговор остаётся открытым.
 */
export async function finishWithFeedback(
  env: Env,
  student: Student,
  session: Session,
  opts: { reason?: string; retryable?: boolean } = {},
): Promise<boolean> {
  if (!(await db.claimFinish(env, session.id))) return true; // уже завершён кем-то ещё
  if (student.current_session === session.id) await db.setCurrentSession(env, student.id, null);

  const n = await db.countSessionMessages(env, session.id);
  const chatId = student.tg_id;
  if (n < 2) {
    if (chatId && opts.retryable) await send(env, chatId, 'Разговор был слишком коротким для разбора 🙂');
    return true;
  }

  if (chatId) {
    await send(env, chatId, `${opts.reason ? opts.reason + '\n' : ''}⏳ Готовлю разбор разговора...`);
    await typing(env, chatId);
  }

  const settings = await db.getSettings(env);
  const [history, topic] = await Promise.all([db.getHistory(env, session.id, 100), db.getTopic(env, session.topic_id)]);
  const transcript = history.map((m) => `${m.role === 'user' ? 'STUDENT' : 'PARTNER'}: ${m.content}`).join('\n');

  let raw: string;
  try {
    raw = await generate(env, feedbackPrompt(session.level || student.level, topic, settings.feedback_language), [
      { role: 'user', content: transcript },
    ]);
  } catch (e) {
    console.error('feedback failed', e);
    if (opts.retryable) {
      await db.unclaimFinish(env, session.id);
      await db.setCurrentSession(env, student.id, session.id);
      if (chatId) {
        const busy = e instanceof GeminiError && e.status === 429;
        await send(env, chatId, busy ? '⏳ ИИ сейчас перегружен. Нажми /finish ещё раз через минуту.' : '⚠️ Не получилось сделать разбор. Нажми /finish ещё раз чуть позже.');
      }
      return false;
    }
    return false;
  }

  const m = raw.match(/SCORE:\s*(\d{1,2})\s*\/\s*10\s*$/i);
  const score = m ? Math.max(0, Math.min(10, parseInt(m[1], 10))) : null;
  const feedback = raw.replace(/\n?.*SCORE:\s*\d{1,2}\s*\/\s*10\s*$/i, '').trim();
  await db.saveFeedback(env, session.id, feedback, score);

  if (chatId) await send(env, chatId, mdToHtml(feedback));

  if (settings.notify_feedback && settings.teacher_tg_id) {
    await send(
      env,
      settings.teacher_tg_id,
      `📝 <b>${esc(student.name)}</b> · ${esc(topic?.title ?? 'Свободная тема')} · ${session.level ?? student.level}` +
        `${score !== null ? ` · <b>${score}/10</b>` : ''}\nСообщений: ${n}\n\n${mdToHtml(feedback)}`,
    );
  }
  return true;
}

/** Уведомление ученику об открытии занятия. */
export async function notifyLessonOpen(env: Env, student: Student, lesson: Lesson) {
  if (!student.tg_id || student.archived) return;
  const topic = await db.getTopic(env, lesson.topic_id);
  await send(
    env,
    student.tg_id,
    `🔔 <b>Открыто новое занятие!</b>\n\n📚 Тема: ${esc(topic?.title ?? 'Свободная тема')}\n⏰ До ${fmtTime(lesson.closes_at)}\n` +
      `🎯 Цель: ${msgs(lesson.min_messages)}\n\nНапиши что-нибудь по-английски, чтобы начать!`,
  );
}
