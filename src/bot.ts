import * as db from './db';
import { GeminiError, generate } from './gemini';
import { finishWithFeedback, fmtTime, statusText } from './lessons';
import { chatPrompt } from './prompts';
import { escapeHtml as esc, mdToHtml, send, typing } from './telegram';
import type { Env, Lesson, Session, Student, TgMessage, TgUpdate } from './types';

const MAX_INPUT = 1500;

const HELP =
  '🇬🇧 <b>Практика английского</b>\n\n' +
  'Когда преподаватель открывает занятие, я пришлю уведомление. Просто пиши мне по-английски — я буду собеседником на заданную тему.\n\n' +
  '/lesson — что сейчас открыто\n' +
  '/finish — закончить разговор и получить разбор ошибок\n' +
  '/help — эта подсказка\n\n' +
  'Когда время занятия закончится, разбор придёт автоматически.';

/** Полночь сегодняшнего дня по Киеву (для дневного лимита). */
function startOfDayKyiv(): number {
  const t = Date.now();
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Europe/Kyiv',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(new Date(t));
  const get = (type: string) => Number(parts.find((p) => p.type === type)?.value ?? 0);
  return t - ((get('hour') * 60 + get('minute')) * 60 + get('second')) * 1000 - (t % 1000);
}

export async function handleUpdate(update: TgUpdate, env: Env): Promise<void> {
  const msg = update.message;
  if (!msg?.from || msg.chat.type !== 'private') return;
  const text = msg.text?.trim() ?? '';

  const start = text.match(/^\/start(?:@\w+)?(?:\s+(\S+))?$/);
  if (start?.[1]) return handleStartPayload(env, msg, start[1]);

  const student = await db.getStudentByTg(env, msg.from.id);
  if (!student) {
    const settings = await db.getSettings(env);
    if (settings.teacher_tg_id === msg.from.id) {
      await send(env, msg.chat.id, '👩‍🏫 Это аккаунт преподавателя — сюда приходят уведомления и разборы. Управление учениками — в веб-панели.');
    } else {
      await send(env, msg.chat.id, '👋 Привет! Это бот для практики английского.\n\nЧтобы начать, попроси у преподавателя <b>персональную ссылку</b> и открой её.');
    }
    return;
  }
  if (student.archived) {
    await send(env, msg.chat.id, '🚫 Доступ к боту закрыт. Обратись к преподавателю.');
    return;
  }

  if (!text) {
    await send(env, msg.chat.id, '✍️ Я понимаю только текстовые сообщения. Напиши, пожалуйста, текстом.');
    return;
  }

  const cmd = text.match(/^\/(\w+)(?:@\w+)?/);
  if (cmd) {
    switch (cmd[1].toLowerCase()) {
      case 'start':
        await send(env, msg.chat.id, `Привет, ${esc(student.name)}! 👋\n\n${HELP}`);
        return send(env, msg.chat.id, await statusText(env, student));
      case 'lesson':
        return send(env, msg.chat.id, await statusText(env, student));
      case 'finish':
      case 'end': {
        const session = await db.getSession(env, student.current_session);
        if (!session || session.finished_at) return send(env, msg.chat.id, 'Сейчас нет активного разговора.');
        await finishWithFeedback(env, student, session, { retryable: true });
        return;
      }
      case 'help':
        return send(env, msg.chat.id, HELP);
      default:
        return send(env, msg.chat.id, 'Не знаю такой команды 🤔 Смотри /help');
    }
  }

  return chat(env, student, msg.chat.id, text);
}

/** /start <код>: привязка ученика по ссылке-приглашению или подключение уведомлений преподавателя. */
async function handleStartPayload(env: Env, msg: TgMessage, payload: string) {
  const from = msg.from!;
  const chatId = msg.chat.id;

  if (payload.startsWith('teacher_')) {
    const settings = await db.getSettings(env);
    if (!settings.teacher_link_code || payload !== `teacher_${settings.teacher_link_code}`) {
      return send(env, chatId, 'Ссылка недействительна. Сгенерируй новую в настройках веб-панели.');
    }
    await db.setSetting(env, 'teacher_tg_id', String(from.id));
    await db.setSetting(env, 'teacher_link_code', null);
    return send(env, chatId, '✅ Готово! Сюда будут приходить разборы учеников и уведомления.');
  }

  const already = await db.getStudentByTg(env, from.id);
  const student = await db.getStudentByInvite(env, payload);

  if (!student || student.archived) {
    if (already) return send(env, chatId, `Ты уже подключен(а) как <b>${esc(already.name)}</b> ✅\n\n${await statusText(env, already)}`);
    return send(env, chatId, '❌ Ссылка недействительна или уже использована. Попроси у преподавателя новую.');
  }
  if (already && already.id !== student.id) {
    return send(env, chatId, `Этот Telegram уже привязан к ученику <b>${esc(already.name)}</b>. Если это ошибка — напиши преподавателю.`);
  }

  const tgName = [from.first_name, from.last_name].filter(Boolean).join(' ') || null;
  await env.DB.prepare(
    'UPDATE students SET tg_id = ?, tg_username = ?, tg_name = ?, linked_at = ?, invite_code = NULL WHERE id = ?',
  )
    .bind(from.id, from.username ?? null, tgName, Date.now(), student.id)
    .run();
  student.tg_id = from.id;

  await send(env, chatId, `Привет, ${esc(student.name)}! 👋 Ты подключен(а).\n\n${HELP}`);
  await send(env, chatId, await statusText(env, student));

  const settings = await db.getSettings(env);
  if (settings.teacher_tg_id) {
    await send(env, settings.teacher_tg_id, `✅ <b>${esc(student.name)}</b> подключился к боту${from.username ? ` (@${esc(from.username)})` : ''}`);
  }
}

/** Проверяет, что текущий разговор ещё актуален; иначе закрывает его (с разбором). */
async function resolveSession(env: Env, student: Student, chatId: number, lesson: Lesson | null): Promise<Session | null> {
  const session = await db.getSession(env, student.current_session);
  if (!session || session.finished_at) return null;

  const valid = session.lesson_id ? lesson?.id === session.lesson_id : !lesson && !!student.free_practice;
  if (valid) return session;

  const reason = session.lesson_id ? '⏰ Время занятия закончилось.' : '📚 Открылось занятие — заканчиваем свободный разговор.';
  await finishWithFeedback(env, student, session, { reason });
  student.current_session = null;
  return null;
}

async function chat(env: Env, student: Student, chatId: number, text: string) {
  const settings = await db.getSettings(env);
  if ((await db.countStudentMessagesSince(env, student.id, startOfDayKyiv())) >= settings.daily_limit) {
    await send(env, chatId, `⛔ На сегодня лимит (${settings.daily_limit} сообщений) исчерпан. Возвращайся завтра!`);
    return;
  }
  if (text.length > MAX_INPUT) {
    await send(env, chatId, `Слишком длинное сообщение (максимум ${MAX_INPUT} символов). Это чат — пиши короче 🙂`);
    return;
  }

  const lesson = await db.activeLesson(env, student.id);
  let session = await resolveSession(env, student, chatId, lesson);

  if (!session) {
    if (!lesson && !student.free_practice) {
      await send(env, chatId, await statusText(env, student));
      return;
    }
    session = await db.createSession(env, student, lesson);
    const topic = await db.getTopic(env, session.topic_id);
    await send(
      env,
      chatId,
      lesson
        ? `🎯 <b>${esc(topic?.title ?? 'Свободная тема')}</b> · ${session.level} · до ${fmtTime(lesson.closes_at, false)}\n<i>Когда закончишь — /finish, и я пришлю разбор.</i>`
        : `💬 <b>Свободная практика</b> · ${session.level}\n<i>Когда закончишь — /finish, и я пришлю разбор.</i>`,
    );
  }

  await db.addMessage(env, session, 'user', text);
  await typing(env, chatId);

  const [history, topic] = await Promise.all([db.getHistory(env, session.id), db.getTopic(env, session.topic_id)]);
  let reply: string;
  try {
    reply = await generate(env, chatPrompt(session.level || student.level, topic, student.corrections === 'inline', lesson?.instructions), history);
  } catch (e) {
    console.error('Gemini error', e);
    const busy = e instanceof GeminiError && e.status === 429;
    await send(env, chatId, busy ? '⏳ ИИ сейчас перегружен. Подожди минутку и отправь сообщение ещё раз.' : '⚠️ Не получилось получить ответ. Попробуй ещё раз чуть позже.');
    return;
  }
  await db.addMessage(env, session, 'model', reply);

  let html = mdToHtml(reply);
  if (lesson && (await db.countLessonMessages(env, lesson.id)) === lesson.min_messages) {
    html += '\n\n🎉 <i>Цель занятия выполнена! Можешь продолжать или нажми /finish, чтобы получить разбор.</i>';
  }
  await send(env, chatId, html);
}
