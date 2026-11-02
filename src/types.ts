export interface Env {
  DB: D1Database;
  BOT_TOKEN: string;
  GEMINI_API_KEY: string;
  WEBHOOK_SECRET: string;
  ADMIN_PASSWORD: string;
  GEMINI_MODEL: string;
  // Только для локальных тестов: подмена адресов API
  TG_API_BASE?: string;
  GEMINI_API_BASE?: string;
}

export const LEVELS = ['A1', 'A2', 'B1', 'B2', 'C1'] as const;

export interface Student {
  id: number;
  name: string;
  note: string | null;
  level: string;
  corrections: 'end' | 'inline';
  free_practice: number;
  tg_id: number | null;
  tg_username: string | null;
  tg_name: string | null;
  invite_code: string | null;
  linked_at: number | null;
  archived: number;
  current_session: number | null;
  created_at: number;
}

export interface Topic {
  id: number;
  title: string;
  scenario: string;
  vocab: string | null;
  active: number;
  created_at: number;
}

export interface Lesson {
  id: number;
  student_id: number;
  topic_id: number | null;
  level: string | null;
  instructions: string | null;
  opens_at: number;
  closes_at: number;
  min_messages: number;
  notified: number;
  paid: number;
  created_at: number;
}

export interface Session {
  id: number;
  student_id: number;
  lesson_id: number | null;
  topic_id: number | null;
  level: string | null;
  started_at: number;
  finished_at: number | null;
  feedback: string | null;
  score: number | null;
}

export interface ChatMessage {
  role: 'user' | 'model';
  content: string;
}

export interface Settings {
  daily_limit: number;
  feedback_language: string;
  default_min_messages: number;
  notify_feedback: boolean;
  notify_lesson_open: boolean;
  teacher_tg_id: number | null;
  teacher_link_code: string | null;
  bot_username: string | null;
}

// Минимальные типы Telegram
export interface TgUser {
  id: number;
  first_name?: string;
  last_name?: string;
  username?: string;
}

export interface TgMessage {
  message_id: number;
  from?: TgUser;
  chat: { id: number; type: string };
  text?: string;
}

export interface TgUpdate {
  update_id: number;
  message?: TgMessage;
}
