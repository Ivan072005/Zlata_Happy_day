import type { Env } from './types';

const COOKIE = 'admin_session';
const TTL_MS = 30 * 24 * 3600 * 1000; // 30 дней

const enc = new TextEncoder();

function b64url(buf: ArrayBuffer | Uint8Array): string {
  const bytes = buf instanceof Uint8Array ? buf : new Uint8Array(buf);
  let s = '';
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

async function hmac(env: Env, data: string): Promise<string> {
  // Ключ зависит от пароля: смена пароля разлогинивает все устройства
  const key = await crypto.subtle.importKey(
    'raw',
    enc.encode(`${env.ADMIN_PASSWORD}\u0000${env.WEBHOOK_SECRET}`),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  return b64url(await crypto.subtle.sign('HMAC', key, enc.encode(data)));
}

function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

export async function checkPassword(env: Env, password: string): Promise<boolean> {
  if (!env.ADMIN_PASSWORD) return false;
  // Сравниваем хэши, чтобы время не зависело от длины
  const [a, b] = await Promise.all([hmac(env, `pw:${password}`), hmac(env, `pw:${env.ADMIN_PASSWORD}`)]);
  return safeEqual(a, b);
}

export async function makeSessionCookie(env: Env): Promise<string> {
  const exp = String(Date.now() + TTL_MS);
  const token = `${exp}.${await hmac(env, `session:${exp}`)}`;
  return `${COOKIE}=${token}; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=${TTL_MS / 1000}`;
}

export function clearSessionCookie(): string {
  return `${COOKIE}=; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=0`;
}

export async function isAuthed(env: Env, req: Request): Promise<boolean> {
  if (!env.ADMIN_PASSWORD) return false;
  const cookie = req.headers.get('cookie') ?? '';
  const m = cookie.match(new RegExp(`(?:^|;\\s*)${COOKIE}=([^;]+)`));
  if (!m) return false;
  const [exp, sig] = m[1].split('.');
  if (!exp || !sig || Number(exp) < Date.now()) return false;
  return safeEqual(sig, await hmac(env, `session:${exp}`));
}
