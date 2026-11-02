import type { ChatMessage, Env } from './types';

export class GeminiError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

/** Gemini требует чередования ролей user/model и начала с user — приводим историю к этому виду. */
function normalize(history: ChatMessage[]) {
  const contents: { role: string; parts: { text: string }[] }[] = [];
  for (const m of history) {
    const last = contents[contents.length - 1];
    if (last && last.role === m.role) last.parts[0].text += '\n' + m.content;
    else contents.push({ role: m.role, parts: [{ text: m.content }] });
  }
  if (contents.length === 0 || contents[0].role !== 'user') {
    contents.unshift({ role: 'user', parts: [{ text: "Hi! Let's start." }] });
  }
  return contents;
}

export async function generate(env: Env, system: string, history: ChatMessage[]): Promise<string> {
  const base = env.GEMINI_API_BASE || 'https://generativelanguage.googleapis.com';
  const model = env.GEMINI_MODEL || 'gemini-flash-latest';
  const body = JSON.stringify({
    systemInstruction: { parts: [{ text: system }] },
    contents: normalize(history),
    generationConfig: { temperature: 0.8 },
  });

  for (let attempt = 0; ; attempt++) {
    const res = await fetch(`${base}/v1beta/models/${model}:generateContent`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-goog-api-key': env.GEMINI_API_KEY },
      body,
    });
    if (res.ok) {
      const data: any = await res.json();
      const parts: any[] = data?.candidates?.[0]?.content?.parts ?? [];
      const text = parts
        .filter((p) => typeof p.text === 'string' && !p.thought)
        .map((p) => p.text)
        .join('')
        .trim();
      if (!text) throw new GeminiError(500, `Empty response: ${JSON.stringify(data).slice(0, 500)}`);
      return text;
    }
    const errText = await res.text();
    // Перегрузка / лимит — одна повторная попытка
    if ((res.status === 429 || res.status >= 500) && attempt === 0) {
      await new Promise((r) => setTimeout(r, 2000));
      continue;
    }
    throw new GeminiError(res.status, errText.slice(0, 500));
  }
}
