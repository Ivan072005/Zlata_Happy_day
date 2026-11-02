import { handleApi } from './api';
import { handleUpdate } from './bot';
import { runCron } from './cron';
import { tg } from './telegram';
import type { Env, TgUpdate } from './types';

export default {
  async fetch(req: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(req.url);

    // API веб-панели
    if (url.pathname.startsWith('/api/')) return handleApi(req, env);

    // Сюда Telegram присылает сообщения
    if (req.method === 'POST' && url.pathname === '/webhook') {
      if (req.headers.get('X-Telegram-Bot-Api-Secret-Token') !== env.WEBHOOK_SECRET) {
        return new Response('forbidden', { status: 403 });
      }
      const update = (await req.json()) as TgUpdate;
      // Отвечаем Telegram сразу, а сообщение обрабатываем в фоне
      ctx.waitUntil(handleUpdate(update, env).catch((e) => console.error('handleUpdate failed', e)));
      return new Response('ok');
    }

    // Одноразовая настройка: открыть https://<worker>/setup?key=<WEBHOOK_SECRET>
    if (url.pathname === '/setup') {
      if (!env.WEBHOOK_SECRET || url.searchParams.get('key') !== env.WEBHOOK_SECRET) {
        return new Response('forbidden', { status: 403 });
      }
      const webhook = await tg(env, 'setWebhook', {
        url: `${url.origin}/webhook`,
        secret_token: env.WEBHOOK_SECRET,
        allowed_updates: ['message'],
        drop_pending_updates: true,
      });
      const commands = await tg(env, 'setMyCommands', {
        commands: [
          { command: 'lesson', description: 'Что сейчас открыто' },
          { command: 'finish', description: 'Закончить и получить разбор ошибок' },
          { command: 'help', description: 'Помощь' },
        ],
      });
      const me = await tg(env, 'getMe', {});
      if (me.ok) {
        await env.DB.prepare("INSERT INTO settings (key, value) VALUES ('bot_username', ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value")
          .bind(me.result.username)
          .run();
      }
      return Response.json({ webhook, commands, bot: me.result?.username ?? null });
    }

    return new Response('Not found', { status: 404 });
  },

  async scheduled(_event: ScheduledController, env: Env, ctx: ExecutionContext): Promise<void> {
    ctx.waitUntil(runCron(env));
  },
} satisfies ExportedHandler<Env>;
