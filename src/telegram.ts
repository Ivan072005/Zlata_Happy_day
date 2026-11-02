import type { Env } from './types';

export type InlineKeyboard = { text: string; callback_data: string }[][];

export async function tg(env: Env, method: string, body: Record<string, unknown>): Promise<any> {
  const base = env.TG_API_BASE || 'https://api.telegram.org';
  const res = await fetch(`${base}/bot${env.BOT_TOKEN}/${method}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
  const data: any = await res.json().catch(() => ({ ok: false, description: `HTTP ${res.status}` }));
  if (!data.ok) console.error(`Telegram ${method} failed:`, data.description);
  return data;
}

const MAX_LEN = 4000;

function splitText(text: string): string[] {
  const parts: string[] = [];
  let rest = text;
  while (rest.length > MAX_LEN) {
    let cut = rest.lastIndexOf('\n', MAX_LEN);
    if (cut < MAX_LEN / 2) cut = rest.lastIndexOf(' ', MAX_LEN);
    if (cut < MAX_LEN / 2) cut = MAX_LEN;
    parts.push(rest.slice(0, cut));
    rest = rest.slice(cut).trimStart();
  }
  if (rest) parts.push(rest);
  return parts;
}

export function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

/** Простой перевод Markdown от ИИ в HTML для Telegram (жирный, курсив, код). */
export function mdToHtml(md: string): string {
  return escapeHtml(md)
    .replace(/^#{1,6}\s+(.+)$/gm, '<b>$1</b>')
    .replace(/\*\*(.+?)\*\*/g, '<b>$1</b>')
    .replace(/__(.+?)__/g, '<b>$1</b>')
    .replace(/(^|[^*\w])\*(?!\s)([^*\n]+?)(?<!\s)\*(?!\w)/g, '$1<i>$2</i>')
    .replace(/`([^`\n]+)`/g, '<code>$1</code>');
}

/**
 * Отправка сообщения. `html` — уже готовый HTML.
 * Если Telegram не принял разметку — отправляем как обычный текст.
 */
export async function send(
  env: Env,
  chatId: number,
  html: string,
  keyboard?: InlineKeyboard,
): Promise<void> {
  const parts = splitText(html);
  for (let i = 0; i < parts.length; i++) {
    const isLast = i === parts.length - 1;
    const body: Record<string, unknown> = {
      chat_id: chatId,
      text: parts[i],
      parse_mode: 'HTML',
      link_preview_options: { is_disabled: true },
    };
    if (isLast && keyboard) body.reply_markup = { inline_keyboard: keyboard };
    const res = await tg(env, 'sendMessage', body);
    if (!res.ok && String(res.description).includes("can't parse")) {
      delete body.parse_mode;
      body.text = parts[i].replace(/<[^>]+>/g, '').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&');
      await tg(env, 'sendMessage', body);
    }
  }
}

export function typing(env: Env, chatId: number): Promise<any> {
  return tg(env, 'sendChatAction', { chat_id: chatId, action: 'typing' });
}
