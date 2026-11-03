// Панель преподавателя. Без сборки и зависимостей: обычный JS.
import { parseSchedule, DAY_NAMES, DAY_SHORT, formatLine, dayIndex } from '/parser.js';

const LEVELS = ['A1', 'A2', 'B1', 'B2', 'C1'];
const STATUS = {
  upcoming: ['Запланировано', ''],
  open: ['Открыто', 'blue'],
  done: ['Выполнено', 'green'],
  partial: ['Частично', 'amber'],
  missed: ['Пропущено', 'red'],
};
const DAY = 24 * 3600 * 1000;

// ───────── Иконки ─────────
const ICONS = {
  home: '<path d="M3 10.5 12 3l9 7.5V20a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z"/>',
  users: '<circle cx="9" cy="8" r="3.5"/><path d="M2.5 20c.6-3.5 3.3-5.5 6.5-5.5s5.9 2 6.5 5.5"/><path d="M16 4.6a3.5 3.5 0 0 1 0 6.8M18 14.8c2 .7 3.2 2.5 3.5 5.2"/>',
  book: '<path d="M4 5.5A2.5 2.5 0 0 1 6.5 3H20v15H6.5A2.5 2.5 0 0 0 4 20.5z"/><path d="M4 20.5A2.5 2.5 0 0 0 6.5 23H20v-5"/><path d="M8 7h8M8 11h6"/>',
  gear: '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/>',
  back: '<path d="M15 18l-6-6 6-6"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  link: '<path d="M10 13a5 5 0 0 0 7.5.5l3-3a5 5 0 0 0-7-7l-1.7 1.7"/><path d="M14 11a5 5 0 0 0-7.5-.5l-3 3a5 5 0 0 0 7 7l1.7-1.7"/>',
  copy: '<rect x="9" y="9" width="12" height="12" rx="2"/><path d="M5 15H4a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1h10a1 1 0 0 1 1 1v1"/>',
  share: '<path d="M12 3v13M7 8l5-5 5 5"/><path d="M5 12v7a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-7"/>',
  chevronL: '<path d="M15 18l-6-6 6-6"/>',
  wallet: '<path d="M4 7a2 2 0 0 1 2-2h12v4"/><path d="M4 7v11a2 2 0 0 0 2 2h14V9H6a2 2 0 0 1-2-2Z"/><circle cx="16" cy="14.5" r="1.3"/>',
  chevronR: '<path d="M9 6l6 6-6 6"/>',
  close: '<path d="M6 6l12 12M18 6 6 18"/>',
  search: '<circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/>',
  calendar: '<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18M8 3v4M16 3v4"/>',
  telegram: '<path d="M21.5 4.5 2.8 11.7c-.9.4-.9 1.6 0 1.9l4.6 1.5 1.8 5.6c.2.7 1.1.9 1.6.4l2.6-2.4 4.6 3.4c.6.4 1.4.1 1.6-.6l3.2-15.5c.2-.9-.6-1.6-1.4-1.3Z"/><path d="m7.4 15 10-7.5-7.6 9"/>',
};
const icon = (name) =>
  `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICONS[name]}</svg>`;

// ───────── Утилиты ─────────
const $ = (sel, el = document) => el.querySelector(sel);
const $$ = (sel, el = document) => [...el.querySelectorAll(sel)];
const esc = (s) =>
  String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const initials = (name) =>
  String(name || '?')
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? '')
    .join('');
const plural = (n, one, few, many) => {
  const a = Math.abs(n) % 100, b = a % 10;
  return a > 10 && a < 20 ? many : b === 1 ? one : b >= 2 && b <= 4 ? few : many;
};

function fmtTime(ts) {
  return new Date(ts).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
}
function dayLabel(ts) {
  const d = new Date(ts), today = new Date();
  const start = new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime();
  const diff = Math.floor((ts - start) / DAY);
  if (diff === 0) return 'сегодня';
  if (diff === 1) return 'завтра';
  if (diff === -1) return 'вчера';
  return d.toLocaleDateString('ru-RU', { weekday: 'short', day: 'numeric', month: 'short' });
}
const fmtWhen = (ts) => `${dayLabel(ts)}, ${fmtTime(ts)}`;
function fmtRange(a, b) {
  return dayLabel(a) === dayLabel(b) ? `${fmtWhen(a)}–${fmtTime(b)}` : `${fmtWhen(a)} — ${fmtWhen(b)}`;
}
function fmtAgo(ts) {
  if (!ts) return 'ещё не писал(а)';
  const m = Math.round((Date.now() - ts) / 60000);
  if (m < 1) return 'только что';
  if (m < 60) return `${m} мин назад`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h} ч назад`;
  const d = Math.round(h / 24);
  if (d < 30) return `${d} ${plural(d, 'день', 'дня', 'дней')} назад`;
  return new Date(ts).toLocaleDateString('ru-RU');
}
function toLocalInput(ts) {
  const d = new Date(ts);
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
}
const fromLocalInput = (v) => new Date(v).getTime();
function md(text) {
  return esc(text)
    .replace(/\*\*(.+?)\*\*/g, '<b>$1</b>')
    .replace(/(^|[^*\w])\*(?!\s)([^*\n]+?)\*(?!\w)/g, '$1<i>$2</i>');
}
const statusBadge = (s) => `<span class="badge ${STATUS[s][1]}">${STATUS[s][0]}</span>`;

let toastTimer;
function toast(text) {
  const el = $('#toast');
  el.textContent = text;
  el.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove('show'), 2400);
}

async function copyText(text) {
  try {
    await navigator.clipboard.writeText(text);
  } catch {
    const ta = document.createElement('textarea');
    ta.value = text;
    document.body.append(ta);
    ta.select();
    document.execCommand('copy');
    ta.remove();
  }
  toast('Скопировано ✓');
}

// ───────── API ─────────
class AuthError extends Error {}
async function api(path, { method = 'GET', body } = {}) {
  const res = await fetch('/api' + path, {
    method,
    headers: { 'content-type': 'application/json' },
    body: body !== undefined ? JSON.stringify(body) : method === 'GET' ? undefined : '{}',
    credentials: 'same-origin',
  });
  const data = await res.json().catch(() => ({}));
  if (res.status === 401 && path !== '/login') {
    renderLogin();
    throw new AuthError();
  }
  if (!res.ok) throw new Error(data.error || 'Ошибка');
  return data;
}

// Кэш тем и настроек (нужны в формах)
const cache = {};
async function getTopics(force) {
  if (!cache.topics || force) cache.topics = (await api('/topics')).topics;
  return cache.topics;
}
async function getSettings(force) {
  if (!cache.settings || force) cache.settings = await api('/settings');
  return cache.settings;
}

// ───────── Каркас ─────────
function setHeader({ title, back, action }) {
  $('#title').textContent = title;
  document.title = `${title} · English Bot`;
  const b = $('#back');
  b.hidden = !back;
  b.innerHTML = icon('back');
  b.onclick = () => (location.hash = back);
  $('#appbar-action').innerHTML = action ?? '';
}

function setFab(label, onClick) {
  $('.fab')?.remove();
  if (!label) return;
  const fab = document.createElement('button');
  fab.className = 'fab';
  fab.innerHTML = `${icon('plus')}<span>${esc(label)}</span>`;
  fab.onclick = onClick;
  document.body.append(fab);
}

function loading() {
  $('#view').innerHTML = '<div class="skeleton"></div><div class="skeleton"></div><div class="skeleton"></div>';
}

/** Нижняя шторка. Возвращает элемент и функцию закрытия. */
function sheet(title, html) {
  const bd = document.createElement('div');
  bd.className = 'sheet-backdrop';
  bd.innerHTML = `<div class="sheet" role="dialog" aria-modal="true" aria-label="${esc(title)}">
    <div class="sheet-handle"></div>
    <div class="sheet-head"><h3>${esc(title)}</h3><button class="icon-btn" data-close aria-label="Закрыть">${icon('close')}</button></div>
    <div class="sheet-body">${html}</div></div>`;
  const close = () => {
    bd.remove();
    document.removeEventListener('keydown', onKey);
  };
  const onKey = (e) => e.key === 'Escape' && close();
  bd.addEventListener('click', (e) => {
    if (e.target === bd || e.target.closest('[data-close]')) close();
  });
  document.addEventListener('keydown', onKey);
  document.body.append(bd);
  return { el: bd, close };
}

/** Обработка формы с блокировкой кнопки и показом ошибок. */
function onSubmit(form, handler) {
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const btn = form.querySelector('[type=submit]');
    if (btn) btn.disabled = true;
    try {
      await handler(Object.fromEntries(new FormData(form)));
    } catch (err) {
      if (!(err instanceof AuthError)) toast(err.message);
    } finally {
      if (btn) btn.disabled = false;
    }
  });
}

// ───────── Роутер ─────────
const routes = [
  [/^#?\/?$/, pageHome, 'home'],
  [/^#\/schedule(?:\/(\d{4}-\d{2}-\d{2}))?$/, pageSchedule, 'schedule'],
  [/^#\/template$/, pageTemplate, 'schedule'],
  [/^#\/week-text\/(\d{4}-\d{2}-\d{2})$/, pageWeekText, 'schedule'],
  [/^#\/students$/, pageStudents, 'students'],
  [/^#\/students\/(\d+)$/, pageStudent, 'students'],
  [/^#\/sessions\/(\d+)$/, pageSession, 'students'],
  [/^#\/topics$/, pageTopics, 'settings'],
  [/^#\/payments$/, pagePayments, 'payments'],
  [/^#\/settings$/, pageSettings, 'settings'],
];

async function render() {
  document.body.classList.remove('logged-out');
  $('#appbar').hidden = false;
  $('#tabbar').hidden = false;
  $$('.sheet-backdrop').forEach((el) => el.remove());
  const hash = location.hash || '#/';
  for (const [re, page, tab] of routes) {
    const m = hash.match(re);
    if (!m) continue;
    $$('#tabbar a').forEach((a) => a.classList.toggle('on', a.dataset.tab === tab));
    setFab(null);
    $('#view').onclick = null;
    loading();
    try {
      await page(...m.slice(1));
    } catch (err) {
      if (!(err instanceof AuthError)) {
        $('#view').innerHTML = `<div class="empty"><div class="emoji">⚠️</div>${esc(err.message)}</div>`;
      }
    }
    window.scrollTo(0, 0);
    return;
  }
  location.hash = '#/';
}

// ───────── Вход ─────────
function renderLogin() {
  $('#appbar').hidden = true;
  $('#tabbar').hidden = true;
  setFab(null);
  $('#view').innerHTML = `<div class="login"><form class="card" id="login-form">
    <img src="/icon.svg" alt="">
    <h2>English Bot</h2>
    <p>Панель преподавателя</p>
    <label class="field"><span>Пароль</span>
      <input class="input" type="password" name="password" autocomplete="current-password" required autofocus></label>
    <div class="error-text" id="login-error" hidden></div>
    <button class="btn block big" type="submit">Войти</button>
  </form></div>`;
  onSubmit($('#login-form'), async ({ password }) => {
    try {
      await api('/login', { method: 'POST', body: { password } });
      render();
    } catch (e) {
      const el = $('#login-error');
      el.hidden = false;
      el.textContent = e.message;
    }
  });
}

// ───────── Главная ─────────
function lessonRow(l, { showStudent = true } = {}) {
  const pct = Math.min(100, Math.round((l.messages / l.min_messages) * 100));
  const title = showStudent ? esc(l.student_name) : esc(l.topic_title ?? 'Свободная тема');
  const sub = showStudent ? `${esc(l.topic_title ?? 'Свободная тема')} · ${fmtRange(l.opens_at, l.closes_at)}` : fmtRange(l.opens_at, l.closes_at);
  return `<div class="row" data-lesson="${l.id}" data-student="${l.student_id}">
    ${showStudent ? `<div class="avatar">${esc(initials(l.student_name))}</div>` : ''}
    <div class="row-main">
      <div class="row-title">${title}</div>
      <div class="row-sub">${sub}</div>
      ${l.status === 'upcoming' ? '' : `<div class="progress ${l.status === 'done' ? 'green' : ''}"><div style="width:${pct}%"></div></div>`}
    </div>
    <div class="row-end">${statusBadge(l.status)}<span>${l.status === 'upcoming' ? '' : `${l.messages}/${l.min_messages}`}${l.score != null ? ` · ${l.score}/10` : ''}</span>
</div>
  </div>`;
}

async function pageHome() {
  setHeader({ title: 'Главная' });
  const [d, settings] = await Promise.all([api('/dashboard'), getSettings(true)]);
  const c = d.counts;
  const hour = new Date().getHours();
  const hello = hour < 5 ? 'Доброй ночи' : hour < 12 ? 'Доброе утро' : hour < 18 ? 'Добрый день' : 'Добрый вечер';

  let html = `<div class="hello"><h2>${hello} 👋</h2><p>${new Date().toLocaleDateString('ru-RU', { weekday: 'long', day: 'numeric', month: 'long' })}</p></div>`;

  if (!settings.teacher_connected) {
    html += `<a class="banner" href="#/settings"><span style="font-size:22px">🔔</span><span class="grow"><b>Подключи свой Telegram</b>, чтобы получать разборы учеников и уведомления</span>${icon('back').replace('M15 18l-6-6 6-6', 'M9 6l6 6-6 6')}</a>`;
  }

  html += `<div class="stats three mt">
    <div class="stat"><div class="stat-value">${c.linked}<span class="muted" style="font-size:15px">/${c.students}</span></div><div class="stat-label">учеников подключено</div></div>
    <div class="stat"><div class="stat-value">${c.active_7d}</div><div class="stat-label">занимались за неделю</div></div>
    <div class="stat"><div class="stat-value">${c.messages_7d}</div><div class="stat-label">сообщений за неделю</div></div>
  </div>`;

  const w = d.week;
  html += `<a class="card mt money-week" href="#/schedule">
      <div><div class="small muted">Эта неделя · ${w.lessons} ${plural(w.lessons, 'урок', 'урока', 'уроков')}</div>
      <div class="money-big">${money(w.covered)} <span class="muted">из ${money(w.expected)}</span></div>
      <div class="small muted">оплачено · за 30 дней получено ${money(d.paid_30d)}</div></div>
      <div class="progress green" style="margin-top:10px"><div style="width:${w.expected ? Math.round((w.covered / w.expected) * 100) : 0}%"></div></div></a>`;

  if (d.classes_next.length) {
    html += `<div class="section-title">Ближайшие уроки <a class="link-btn" href="#/schedule">Расписание →</a></div>
      <div class="list">${d.classes_next.map((c) => classRow(c, { showDay: true })).join('')}</div>`;
  }
  if (d.debts.length) {
    const total = d.debts.reduce((a, x) => a - x.balance, 0);
    html += `<div class="section-title">Долги · ${money(total)} <a class="link-btn" href="#/payments">Все оплаты →</a></div><div class="list">${d.debts
      .map(
        (x) => `<a class="row" href="#/students/${x.id}"><div class="avatar">${esc(initials(x.name))}</div>
        <div class="row-main"><div class="row-title">${esc(x.name)}</div></div>
        <div class="row-end"><span class="badge red">−${money(-x.balance)}</span></div></a>`,
      )
      .join('')}</div>`;
  }
  if (d.open.length || d.upcoming.length) html += `<div class="section-title" style="margin-top:28px">🤖 Практика с ботом</div>`;
  if (d.open.length) html += `<div class="small muted" style="margin:0 4px 6px">Сейчас открыто</div><div class="list">${d.open.map((l) => lessonRow(l)).join('')}</div>`;

  if (d.upcoming.length) {
    html += `<div class="small muted" style="margin:12px 4px 6px">Скоро</div><div class="list">${d.upcoming.map((l) => lessonRow(l)).join('')}</div>`;
  }
  if (d.recent_lessons.length) {
    html += `<div class="section-title">Практика: недавно закончились</div><div class="list">${d.recent_lessons.map((l) => lessonRow(l)).join('')}</div>`;
  }
  if (d.recent_feedback.length) {
    html += `<div class="section-title">Последние разборы</div><div class="list">${d.recent_feedback
      .map(
        (s) => `<a class="row" href="#/sessions/${s.id}">
        <div class="avatar">${esc(initials(s.student_name))}</div>
        <div class="row-main"><div class="row-title">${esc(s.student_name)}</div>
        <div class="row-sub">${esc(s.topic_title ?? 'Свободная тема')} · ${s.messages} сообщ. · ${fmtAgo(s.finished_at)}</div></div>
        <div class="row-end">${s.score != null ? `<span class="badge ${s.score >= 7 ? 'green' : s.score >= 5 ? 'amber' : 'red'}">${s.score}/10</span>` : ''}</div></a>`,
      )
      .join('')}</div>`;
  }
  if (!c.students) {
    html += `<div class="card empty mt"><div class="emoji">👋</div>Начни с добавления учеников<div class="mt"><a class="btn" href="#/students">Перейти к ученикам</a></div></div>`;
  }

  $('#view').innerHTML = html;
  const all = [...d.open, ...d.upcoming, ...d.recent_lessons];
  $$('#view [data-lesson]').forEach((el) => (el.onclick = () => openLessonDetails(null, all.find((l) => l.id === Number(el.dataset.lesson)))));
  $$('#view [data-class]').forEach((el) => (el.onclick = () => (location.hash = `#/schedule/${d.classes_next.find((c) => c.id === Number(el.dataset.class)).week}`)));
}

// ───────── Ученики ─────────
async function pageStudents() {
  setHeader({ title: 'Ученики' });
  setFab('Ученик', openAddStudent);
  const { students } = await api('/students');

  const row = (s) => {
    let sub;
    if (!s.linked) sub = '<span class="dot gray"></span> Telegram не подключён';
    else if (s.open_lessons) sub = '<span class="dot blue"></span> Занятие открыто';
    else if (s.next_lesson_at) sub = `<span class="dot green"></span> Занятие ${fmtWhen(s.next_lesson_at)}`;
    else sub = `<span class="dot green"></span> ${fmtAgo(s.last_active)}`;
    return `<a class="row" href="#/students/${s.id}" data-name="${esc(s.name.toLowerCase())}">
      <div class="avatar">${esc(initials(s.name))}</div>
      <div class="row-main"><div class="row-title">${esc(s.name)}</div>
      <div class="row-sub" style="display:flex;align-items:center;gap:6px">${sub}</div></div>
      <div class="row-end"><span class="badge accent">${s.level}</span>${s.balance < 0 ? `<span class="badge red">−${money(-s.balance)}</span>` : s.balance > 0 ? `<span class="badge green">+${money(s.balance)}</span>` : s.avg_score != null ? `<span>⌀ ${s.avg_score}</span>` : ''}</div></a>`;
  };

  const active = students.filter((s) => !s.archived);
  const archived = students.filter((s) => s.archived);
  if (!students.length) {
    $('#view').innerHTML = `<div class="card empty"><div class="emoji">🧑‍🎓</div>Пока нет учеников.<br>Нажми «+ Ученик», чтобы добавить первого.</div>`;
    return;
  }
  $('#view').innerHTML = `
    <label class="search">${icon('search')}<input class="input" type="search" placeholder="Поиск по имени" id="q" autocomplete="off"></label>
    <div class="list" id="list">${active.map(row).join('') || '<div class="empty">Нет активных учеников</div>'}</div>
    ${archived.length ? `<div class="section-title">Архив</div><div class="list">${archived.map(row).join('')}</div>` : ''}
    <p class="muted small" style="text-align:center">${active.length} ${plural(active.length, 'ученик', 'ученика', 'учеников')}</p>`;
  $('#q').oninput = (e) => {
    const q = e.target.value.trim().toLowerCase();
    $$('#view [data-name]').forEach((el) => (el.hidden = q && !el.dataset.name.includes(q)));
  };
}

function levelOptions(selected, extra = '') {
  return extra + LEVELS.map((l) => `<option value="${l}" ${l === selected ? 'selected' : ''}>${l}</option>`).join('');
}

function openAddStudent() {
  const { el, close } = sheet(
    'Новый ученик',
    `<div class="segmented"><button class="on" data-mode="one">Один</button><button data-mode="many">Списком</button></div>
    <form id="f-one">
      <label class="field"><span>Имя и фамилия</span><input class="input" name="name" required maxlength="80" placeholder="Маша Коваленко" autocomplete="off"></label>
      <label class="field"><span>Уровень</span><select class="input" name="level">${levelOptions('B1')}</select></label>
      <label class="field"><span>Заметка (видишь только ты)</span><textarea class="input" name="note" maxlength="500" placeholder="Например: готовится к IELTS, слабое место — времена"></textarea></label>
      <button class="btn block big" type="submit">Добавить</button>
    </form>
    <form id="f-many" hidden>
      <label class="field"><span>Имена — каждое с новой строки</span><textarea class="input" name="names" rows="8" required placeholder="Маша Коваленко&#10;Иван Петренко&#10;..."></textarea></label>
      <label class="field"><span>Уровень для всех</span><select class="input" name="level">${levelOptions('B1')}</select></label>
      <button class="btn block big" type="submit">Добавить всех</button>
    </form>`,
  );
  $$('.segmented button', el).forEach(
    (b) =>
      (b.onclick = () => {
        $$('.segmented button', el).forEach((x) => x.classList.toggle('on', x === b));
        $('#f-one', el).hidden = b.dataset.mode !== 'one';
        $('#f-many', el).hidden = b.dataset.mode !== 'many';
      }),
  );
  onSubmit($('#f-one', el), async (v) => {
    const { ids } = await api('/students', { method: 'POST', body: v });
    close();
    location.hash = `#/students/${ids[0]}`;
  });
  onSubmit($('#f-many', el), async (v) => {
    const names = v.names.split('\n').map((s) => s.trim()).filter(Boolean);
    const { students } = await api('/students', { method: 'POST', body: { names, level: v.level } });
    close();
    render();
    const text = students.map((s) => `${s.name}: ${s.invite_link ?? '—'}`).join('\n');
    const r = sheet(
      `Добавлено: ${students.length}`,
      `<p style="margin-top:0">Личные ссылки для каждого ученика. Отправь каждому его ссылку — она одноразовая.</p>
      <div class="list">${students
        .map((s) => `<div class="row" data-link="${esc(s.invite_link ?? '')}"><div class="row-main"><div class="row-title">${esc(s.name)}</div>
        <div class="row-sub">${esc(s.invite_link ?? 'ссылка будет после /setup')}</div></div><div class="row-end">${icon('copy')}</div></div>`)
        .join('')}</div>
      <button class="btn block big mt" data-copy-all>${icon('copy')} Копировать всё</button>`,
    );
    r.el.addEventListener('click', (e) => {
      const row = e.target.closest('[data-link]');
      if (row?.dataset.link) copyText(row.dataset.link);
      if (e.target.closest('[data-copy-all]')) copyText(text);
    });
  });
}

// ───────── Карточка ученика ─────────
function sparkline(scores) {
  if (scores.length < 2) return '';
  const w = 300, h = 56, pad = 6;
  const x = (i) => pad + (i * (w - 2 * pad)) / (scores.length - 1);
  const y = (v) => h - pad - (v / 10) * (h - 2 * pad);
  const pts = scores.map((s, i) => `${x(i).toFixed(1)},${y(s.score).toFixed(1)}`).join(' ');
  const last = scores[scores.length - 1];
  return `<svg class="spark" viewBox="0 0 ${w} ${h}" preserveAspectRatio="none" role="img" aria-label="Динамика оценок">
    <line x1="${pad}" x2="${w - pad}" y1="${y(5)}" y2="${y(5)}" stroke="var(--border)" stroke-dasharray="3 4"/>
    <polyline points="${pts}" fill="none" stroke="var(--accent)" stroke-width="2.5" stroke-linejoin="round" stroke-linecap="round" vector-effect="non-scaling-stroke"/>
    <circle cx="${x(scores.length - 1)}" cy="${y(last.score)}" r="4" fill="var(--accent)"/>
  </svg>`;
}

function inviteBlock(s) {
  if (s.tg_id) {
    return `<div class="tg-linked">${icon('telegram')}<div style="flex:1">Telegram подключён
        <small>${esc(s.tg_name ?? '')}${s.tg_username ? ` · @${esc(s.tg_username)}` : ''} · с ${new Date(s.linked_at).toLocaleDateString('ru-RU')}</small></div></div>
      <button class="link-btn mt" data-action="relink">🔗 Сгенерировать новую ссылку (отвязать текущий Telegram)</button>`;
  }
  if (!s.invite_link) {
    return `<div class="invite"><b>Ученик ещё не подключён.</b>
      <p class="small muted" style="margin:4px 0 12px">Сгенерируй личную ссылку и отправь её ученику — он откроет её в Telegram, и его аккаунт привяжется к этой карточке.</p>
      <button class="btn block big" data-action="generate">${icon('link')} Сгенерировать ссылку</button></div>`;
  }
  return `<div class="invite"><b>Личная ссылка ученика</b>
    <div class="small muted">Одноразовая: после открытия ученик будет привязан к этой карточке.</div>
    <div class="invite-link">${esc(s.invite_link)}</div>
    <div class="btn-row">
      <button class="btn" data-action="copy">${icon('copy')} Копировать</button>
      ${navigator.share ? `<button class="btn secondary" data-action="share">${icon('share')} Отправить</button>` : ''}
    </div>
    <button class="link-btn mt" data-action="generate">↻ Сгенерировать новую</button></div>`;
}

async function pageStudent(id) {
  const data = await api(`/students/${id}`);
  const { student: s, stats, lessons, sessions } = data;
  setHeader({ title: s.name, back: '#/students' });
  setFab('Оплата', () => openPaymentSheet(s, data.finance));

  const now = Date.now();
  const current = lessons.filter((l) => l.closes_at > now).sort((a, b) => a.opens_at - b.opens_at);
  const past = lessons.filter((l) => l.closes_at <= now);
  const inviteText = () => `Привет, ${s.name.split(' ')[0]}! 👋\nВот твоя ссылка для практики английского с ботом:\n${s.invite_link}`;

  const wordsPct = stats.words_total ? Math.round((stats.words_used / stats.words_total) * 100) : null;

  $('#view').innerHTML = `
    <div class="card">
      <div class="profile">
        <div class="avatar lg">${esc(initials(s.name))}</div>
        <div style="min-width:0"><h2>${esc(s.name)}</h2>
          <div class="meta"><span class="badge accent">${s.level}</span>
          ${s.corrections === 'inline' ? '<span class="badge">✏️ исправления сразу</span>' : ''}
          ${s.free_practice ? '<span class="badge green">свободная практика</span>' : ''}
          ${s.archived ? '<span class="badge red">в архиве</span>' : ''}
</div>
        </div>
      </div>
      ${s.note ? `<div class="note">${esc(s.note)}</div>` : ''}
      ${inviteBlock(s)}
    </div>

    ${financeBlock(data.finance)}

    <div class="section-title">Статистика практики с ботом</div>
    <div class="stats four">
      <div class="stat"><div class="stat-value">${stats.lessons_done}<span class="muted" style="font-size:15px">/${stats.lessons_total}</span></div><div class="stat-label">занятий выполнено</div></div>
      <div class="stat"><div class="stat-value">${stats.avg_score ?? '—'}</div><div class="stat-label">средняя оценка</div></div>
      <div class="stat"><div class="stat-value">${stats.messages_7d}</div><div class="stat-label">сообщений за 7 дней</div></div>
      <div class="stat"><div class="stat-value" style="font-size:16px;padding:4px 0">${fmtAgo(stats.last_active)}</div><div class="stat-label">последняя активность</div></div>
    </div>
    ${
      stats.scores.length > 1 || stats.words_total || stats.lessons_missed
        ? `<div class="card mt">
      ${stats.scores.length > 1 ? `<div class="small muted">Оценки за последние ${stats.scores.length} разговоров</div>${sparkline(stats.scores)}` : ''}
      <div class="small muted mt" style="display:flex;gap:14px;flex-wrap:wrap">
        <span>💬 Всего сообщений: <b>${stats.messages}</b></span>
        <span>🗣 Разговоров: <b>${stats.conversations}</b></span>
        ${wordsPct !== null ? `<span>📚 Слова из тем: <b>${stats.words_used}/${stats.words_total}</b> (${wordsPct}%)</span>` : ''}
        ${stats.lessons_partial ? `<span>🟡 Частично: <b>${stats.lessons_partial}</b></span>` : ''}
        ${stats.lessons_missed ? `<span>🔴 Пропущено: <b>${stats.lessons_missed}</b></span>` : ''}
      </div></div>`
        : ''
    }

    <div class="section-title">🤖 Практика с ботом <button class="link-btn" data-action="add-lesson">+ Открыть</button></div>
    ${
      current.length
        ? `<div class="list">${current.map((l) => lessonRow(l, { showStudent: false })).join('')}</div>`
        : `<div class="card empty"><div class="emoji">🤖</div>Практика не назначена.<br>Пока её нет, ${s.free_practice ? 'ученик может только свободно практиковаться' : 'ученик не может общаться с ботом'}.</div>`
    }

    ${past.length ? `<div class="section-title">Прошедшая практика</div><div class="list">${past.map((l) => lessonRow(l, { showStudent: false })).join('')}</div>` : ''}

    ${
      sessions.length
        ? `<div class="section-title">Разговоры</div><div class="list">${sessions
            .slice(0, 30)
            .map(
              (x) => `<a class="row" href="#/sessions/${x.id}">
          <div class="row-main"><div class="row-title">${esc(x.topic_title ?? 'Свободная тема')}</div>
          <div class="row-sub">${fmtWhen(x.started_at)} · ${x.messages} сообщ. · ${x.level}${x.finished_at ? '' : ' · идёт сейчас'}</div></div>
          <div class="row-end">${x.score != null ? `<span class="badge ${x.score >= 7 ? 'green' : x.score >= 5 ? 'amber' : 'red'}">${x.score}/10</span>` : x.finished_at ? '' : '<span class="badge blue">идёт</span>'}</div></a>`,
            )
            .join('')}</div>`
        : ''
    }

    <div class="section-title">Настройки ученика</div>
    <form class="card" id="f-student">
      <label class="field"><span>Имя</span><input class="input" name="name" value="${esc(s.name)}" required maxlength="80"></label>
      <div class="grid-2">
        <label class="field"><span>Уровень</span><select class="input" name="level">${levelOptions(s.level)}</select></label>
        <label class="field"><span>Исправлять ошибки</span><select class="input" name="corrections">
          <option value="end" ${s.corrections === 'end' ? 'selected' : ''}>В конце разговора</option>
          <option value="inline" ${s.corrections === 'inline' ? 'selected' : ''}>Сразу, в каждом ответе</option></select></label>
      </div>
      <div class="switch-row" style="padding-top:0"><div><b>Свободная практика</b><small>Можно общаться с ботом на любую тему, когда нет занятий</small></div>
        <label class="switch"><input type="checkbox" name="free_practice" ${s.free_practice ? 'checked' : ''}><span></span></label></div>
      <label class="field mt"><span>Заметка</span><textarea class="input" name="note" maxlength="500">${esc(s.note ?? '')}</textarea></label>
      <button class="btn block" type="submit">Сохранить</button>
    </form>

    <div class="btn-row mt">
      <button class="btn ghost" data-action="archive">${s.archived ? 'Вернуть из архива' : 'В архив'}</button>
      <button class="btn danger" data-action="delete">Удалить</button>
    </div>
    <p class="small muted">В архиве ученик не может пользоваться ботом, но вся статистика сохраняется. Удаление стирает всё безвозвратно.</p>`;

  const v = $('#view');
  const generate = async (confirmText) => {
    if (confirmText && !confirm(confirmText)) return;
    const r = await api(`/students/${s.id}/invite`, { method: 'POST' });
    toast('Ссылка готова ✓');
    await render();
    return r;
  };
  v.onclick = async (e) => {
    const a = e.target.closest('[data-action]')?.dataset.action;
    const row = e.target.closest('[data-lesson]');
    try {
      if (a === 'generate') await generate(s.invite_link ? 'Старая ссылка перестанет работать. Создать новую?' : null);
      else if (a === 'relink') await generate(`Telegram ученика будет отвязан, и ${s.name} не сможет пользоваться ботом, пока не откроет новую ссылку. Продолжить?`);
      else if (a === 'copy') await copyText(inviteText());
      else if (a === 'share') await navigator.share({ text: inviteText() }).catch(() => {});
      else if (a === 'add-lesson') openLessonForm(s);
      else if (a === 'add-payment') openPaymentSheet(s, data.finance);
      else if (a === 'del-payment') {
        if (!confirm('Удалить эту оплату?')) return;
        await api(`/payments/${e.target.closest('[data-id]').dataset.id}`, { method: 'DELETE' });
        toast('Оплата удалена');
        render();
      } else if (e.target.closest('[data-class]')) {
        const c = data.finance.classes.find((x) => x.id === Number(e.target.closest('[data-class]').dataset.class));
        location.hash = `#/schedule/${c.week}`;
      }
      else if (a === 'archive') {
        await api(`/students/${s.id}`, { method: 'PATCH', body: { archived: !s.archived } });
        toast(s.archived ? 'Ученик возвращён' : 'Перемещён в архив');
        render();
      } else if (a === 'delete') {
        if (!confirm(`Удалить ${s.name} и всю его статистику? Это нельзя отменить.`)) return;
        await api(`/students/${s.id}`, { method: 'DELETE' });
        toast('Удалено');
        location.hash = '#/students';
      } else if (row) {
        openLessonDetails(s, lessons.find((l) => l.id === Number(row.dataset.lesson)), sessions);
      }
    } catch (err) {
      if (!(err instanceof AuthError)) toast(err.message);
    }
  };
  onSubmit($('#f-student'), async (f) => {
    await api(`/students/${s.id}`, {
      method: 'PATCH',
      body: { name: f.name, level: f.level, corrections: f.corrections, note: f.note, free_practice: !!f.free_practice },
    });
    toast('Сохранено ✓');
    render();
  });
}

// ───────── Занятия ─────────
async function openLessonForm(student, lesson = null, defaults = {}) {
  const [topics, settings, students] = await Promise.all([
    getTopics(),
    getSettings(),
    student ? Promise.resolve(null) : api('/students').then((r) => r.students.filter((s) => !s.archived)),
  ]);
  if (students && !students.length) {
    toast('Сначала добавь ученика');
    location.hash = '#/students';
    return;
  }
  const active = topics.filter((t) => t.active || t.id === lesson?.topic_id);
  const now = Date.now();
  const roundUp = (ts) => Math.ceil(ts / (5 * 60000)) * 5 * 60000;
  const start = lesson ? lesson.opens_at : defaults.opens ?? roundUp(now);
  const end = lesson ? lesson.closes_at : start + 3600000;
  const levelLabel = (lvl) => `Как у ученика${lvl ? ` (${lvl})` : ''}`;

  const { el, close } = sheet(
    lesson ? 'Изменить занятие' : student ? `Занятие для ${student.name}` : 'Новое занятие',
    `<form id="f-lesson">
      ${
        students
          ? `<label class="field"><span>Ученик</span><select class="input" name="student_id" required>
          ${students.map((s) => `<option value="${s.id}" data-level="${s.level}">${esc(s.name)} · ${s.level}</option>`).join('')}
        </select></label>`
          : ''
      }
      <label class="field"><span>Тема</span><select class="input" name="topic_id">
        ${active.map((t) => `<option value="${t.id}" ${t.id === lesson?.topic_id ? 'selected' : ''}>${esc(t.title)}</option>`).join('')}
        <option value="" ${lesson && !lesson.topic_id ? 'selected' : ''}>💬 Свободная тема</option>
      </select><small>Свои темы можно добавить во вкладке «Темы»</small></label>

      <label class="field"><span>Уровень общения</span><select class="input" name="level">
        ${levelOptions(lesson?.level, `<option value="" ${!lesson?.level ? 'selected' : ''} data-own>${levelLabel(student?.level ?? students?.[0]?.level)}</option>`)}
      </select></label>

      <div class="field"><span>Когда ученик может общаться с ботом</span>
        <div class="chips" id="presets">
          <button type="button" class="chip" data-p="now1">Сейчас · 1 час</button>
          <button type="button" class="chip" data-p="today">Сейчас · до конца дня</button>
          <button type="button" class="chip" data-p="tomorrow">Завтра 18:00–19:00</button>
          <button type="button" class="chip" data-p="week">Неделя</button>
        </div>
        <div class="dates">
          <label class="field" style="margin:0"><span>Начало</span><input class="input" type="datetime-local" name="opens" value="${toLocalInput(start)}" required></label>
          <label class="field" style="margin:0"><span>Конец</span><input class="input" type="datetime-local" name="closes" value="${toLocalInput(end)}" required></label>
        </div>
      </div>

      ${
        lesson
          ? ''
          : `<label class="field"><span>Повторять</span><select class="input" name="repeat">
        <option value="1">Не повторять</option><option value="2">Каждую неделю · 2 раза</option>
        <option value="4">Каждую неделю · 4 раза</option><option value="8">Каждую неделю · 8 раз</option>
        <option value="12">Каждую неделю · 12 раз</option></select></label>`
      }

      <label class="field"><span>Цель: минимум сообщений для зачёта</span>
        <input class="input" type="number" name="min_messages" min="1" max="200" value="${lesson?.min_messages ?? settings.default_min_messages}" required></label>

      <label class="field"><span>Указания для ИИ (необязательно)</span>
        <textarea class="input" name="instructions" maxlength="1000" placeholder="Например: тренируем Past Simple — спрашивай про прошлые выходные и поездки">${esc(lesson?.instructions ?? '')}</textarea></label>

      <button class="btn block big" type="submit">${lesson ? 'Сохранить' : 'Назначить занятие'}</button>
    </form>`,
  );

  const studentSel = $('[name=student_id]', el);
  if (studentSel) {
    studentSel.onchange = () => ($('[data-own]', el).textContent = levelLabel(studentSel.selectedOptions[0].dataset.level));
  }

  const opens = $('[name=opens]', el), closes = $('[name=closes]', el);
  $('#presets', el).onclick = (e) => {
    const p = e.target.closest('[data-p]')?.dataset.p;
    if (!p) return;
    $$('#presets .chip', el).forEach((c) => c.classList.toggle('on', c.dataset.p === p));
    const n = Date.now(), d = new Date();
    let a = n, b;
    if (p === 'now1') b = n + 3600000;
    if (p === 'today') b = new Date(d.getFullYear(), d.getMonth(), d.getDate(), 23, 59).getTime();
    if (p === 'tomorrow') {
      a = new Date(d.getFullYear(), d.getMonth(), d.getDate() + 1, 18, 0).getTime();
      b = a + 3600000;
    }
    if (p === 'week') b = new Date(d.getFullYear(), d.getMonth(), d.getDate() + 7, 23, 59).getTime();
    opens.value = toLocalInput(a);
    closes.value = toLocalInput(b);
  };

  onSubmit($('#f-lesson', el), async (f) => {
    const body = {
      student_id: student ? student.id : Number(f.student_id),
      topic_id: f.topic_id ? Number(f.topic_id) : null,
      level: f.level || null,
      opens_at: fromLocalInput(f.opens),
      closes_at: fromLocalInput(f.closes),
      min_messages: Number(f.min_messages),
      instructions: f.instructions,
      repeat_weeks: f.repeat ? Number(f.repeat) - 1 : 0,
    };
    if (lesson) await api(`/lessons/${lesson.id}`, { method: 'PATCH', body });
    else await api('/lessons', { method: 'POST', body });
    close();
    toast(lesson ? 'Сохранено ✓' : body.repeat_weeks ? `Назначено ${body.repeat_weeks + 1} занятий ✓` : 'Занятие назначено ✓');
    render();
  });
}

/** Подробности занятия. student и sessions есть, когда открыто из карточки ученика. */
function openLessonDetails(student, l, sessions = null) {
  if (!l) return;
  const pct = Math.min(100, Math.round((l.messages / l.min_messages) * 100));
  const conv = sessions ? sessions.filter((x) => x.lesson_id === l.id) : [];
  const { el, close } = sheet(
    l.topic_title ?? 'Свободная тема',
    `<div class="card">
      ${student ? '' : `<a class="row" style="padding:0 0 12px;min-height:0;border-bottom:1px solid var(--border);margin-bottom:12px" href="#/students/${l.student_id}">
        <div class="avatar">${esc(initials(l.student_name))}</div><div class="row-main"><div class="row-title">${esc(l.student_name)}</div>
        <div class="row-sub">Открыть карточку ученика →</div></div></a>`}
      <div style="display:flex;justify-content:space-between;align-items:center;gap:8px">${statusBadge(l.status)}<span class="small muted">${l.level ?? student?.level ?? 'уровень ученика'}</span></div>
      <div class="mt">${icon('calendar').replace('<svg', '<svg style="display:inline;width:16px;height:16px;vertical-align:-3px;margin-right:4px"')}${fmtRange(l.opens_at, l.closes_at)}</div>
      <div class="mt small muted">Сообщений: <b>${l.messages}</b> из ${l.min_messages}${l.score != null ? ` · Оценка: <b>${l.score}/10</b>` : ''}</div>
      <div class="progress ${l.status === 'done' ? 'green' : ''}"><div style="width:${pct}%"></div></div>
      ${l.instructions ? `<div class="note">🤖 ${esc(l.instructions)}</div>` : ''}
    </div>
    ${
      l.words?.length
        ? `<div class="section-title">Слова темы</div><div class="card"><div class="words">${l.words
            .map((w) => `<span class="badge ${w.used ? 'green' : ''}">${w.used ? '✓' : '·'} ${esc(w.word)}</span>`)
            .join('')}</div>
            <div class="small muted mt">Зелёные — ученик использовал в разговоре</div></div>`
        : ''
    }
    ${
      conv.length
        ? `<div class="section-title">Разговоры</div><div class="list">${conv
            .map(
              (x) => `<a class="row" href="#/sessions/${x.id}"><div class="row-main"><div class="row-title">${fmtWhen(x.started_at)}</div>
            <div class="row-sub">${x.messages} сообщ.${x.has_feedback ? ' · есть разбор' : ''}</div></div>
            <div class="row-end">${x.score != null ? `${x.score}/10` : ''}</div></a>`,
            )
            .join('')}</div>`
        : ''
    }
    <div class="btn-row mt">
      <button class="btn secondary" data-a="edit">Изменить</button>
      <button class="btn danger" data-a="delete">Удалить</button>
    </div>`,
  );
  el.addEventListener('click', async (e) => {
    const a = e.target.closest('[data-a]')?.dataset.a;
    if (e.target.closest('a.row')) close();
    try {
      if (a === 'edit') {
        close();
        const st = student ?? (await api(`/students/${l.student_id}`)).student;
        openLessonForm(st, l);
      }
      if (a === 'delete' && confirm('Удалить занятие?')) {
        await api(`/lessons/${l.id}`, { method: 'DELETE' });
        close();
        toast('Занятие удалено');
        render();
      }
    } catch (err) {
      if (!(err instanceof AuthError)) toast(err.message);
    }
  });
}

// ───────── Деньги ─────────
const money = (n) => `${Math.round(n).toLocaleString('ru-RU')} ₴`;

function payBadge(c) {
  if (c.status === 'cancelled') return '<span class="badge">отменён</span>';
  if (!c.pay || c.pay.state === 'unpaid') return `<span class="badge ${c.starts_at <= Date.now() ? 'red' : ''}">₴ не оплачено</span>`;
  if (c.pay.state === 'partial') return `<span class="badge amber">частично ${c.pay.covered}/${c.price}</span>`;
  return '<span class="badge green">✓ оплачено</span>';
}

function classRow(c, { showDay = false, showStudent = true } = {}) {
  const cancelled = c.status === 'cancelled';
  return `<div class="row sched ${cancelled ? 'cancelled' : ''}" data-class="${c.id}">
    <div class="sched-time"><b>${fmtTime(c.starts_at)}</b><span>${showDay ? dayLabel(c.starts_at) : fmtTime(c.ends_at)}</span></div>
    <div class="row-main"><div class="row-title">${showStudent ? esc(c.student_name) : dayLabel(c.starts_at)}</div>
      <div class="row-sub">${money(c.price)}${c.manual ? ' · разовый' : ''}${c.note ? ` · ${esc(c.note)}` : ''}</div></div>
    <div class="row-end">${payBadge(c)}</div></div>`;
}

function financeBlock(f) {
  let state;
  if (f.balance < 0) state = `<div class="money-big red-text">Долг ${money(-f.balance)}</div>`;
  else if (f.balance > 0) state = `<div class="money-big green-text">Предоплата ${money(f.balance)}</div>
      <div class="small muted">${f.prepaid_lessons ? `хватит на ${f.prepaid_lessons} ${plural(f.prepaid_lessons, 'следующий урок', 'следующих урока', 'следующих уроков')}` : 'частично покрывает следующий урок'}</div>`;
  else state = `<div class="money-big">0 ₴</div><div class="small muted">${f.held ? 'всё оплачено' : 'уроков ещё не было'}</div>`;
  const now = Date.now();
  const upcoming = f.classes.filter((c) => c.starts_at > now).sort((a, b) => a.starts_at - b.starts_at).slice(0, 4);
  const past = f.classes.filter((c) => c.starts_at <= now).slice(0, 8);
  return `<div class="section-title">💰 Оплата <button class="link-btn" data-action="add-payment">+ Внести</button></div>
    <div class="card">${state}
      <div class="small muted mt">Проведено уроков: <b>${f.held}</b> на ${money(f.charged)} · оплачено всего ${money(f.paid)}</div></div>
    ${upcoming.length ? `<div class="small muted" style="margin:12px 4px 6px">Следующие уроки</div><div class="list">${upcoming.map((c) => classRow(c, { showDay: true, showStudent: false })).join('')}</div>` : ''}
    ${past.length ? `<div class="small muted" style="margin:12px 4px 6px">Прошедшие уроки</div><div class="list">${past.map((c) => classRow(c, { showDay: true, showStudent: false })).join('')}</div>` : ''}
    ${
      f.payments.length
        ? `<div class="small muted" style="margin:12px 4px 6px">Оплаты</div><div class="list">${f.payments
            .slice(0, 10)
            .map(
              (p) => `<div class="row" data-id="${p.id}"><div class="row-main"><div class="row-title green-text">+${money(p.amount)}</div>
            <div class="row-sub">${new Date(p.paid_at).toLocaleDateString('ru-RU', { day: 'numeric', month: 'long' })}${p.note ? ` · ${esc(p.note)}` : ''}</div></div>
            <div class="row-end"><button class="link-btn" data-action="del-payment" aria-label="Удалить оплату">✕</button></div></div>`,
            )
            .join('')}</div>`
        : ''
    }`;
}

/** Окно «Внести оплату». */
async function openPaymentSheet(student, finance = null, defaults = {}) {
  if (!finance) finance = (await api(`/students/${student.id}`)).finance;
  const lastPrice = defaults.price || (finance.classes.find((c) => c.status === 'planned')?.price ?? 0);
  const debt = finance.balance < 0 ? -finance.balance : 0;
  const chips = [];
  if (debt) chips.push([debt, `Весь долг · ${money(debt)}`]);
  if (lastPrice) for (const n of [1, 4, 8]) chips.push([lastPrice * n, `${n} ${plural(n, 'урок', 'урока', 'уроков')} · ${money(lastPrice * n)}`]);
  const { el, close } = sheet(
    `Оплата · ${student.name}`,
    `<form id="f-pay">
      ${chips.length ? `<div class="chips" id="pay-chips">${chips.map(([v, l]) => `<button type="button" class="chip" data-v="${v}">${l}</button>`).join('')}</div>` : ''}
      ${lastPrice ? `<div class="grid-2">
        <label class="field"><span>Сколько уроков</span><input class="input" type="number" name="count" min="1" max="100" inputmode="numeric" placeholder="8"><small>по ${money(lastPrice)}</small></label>
        <label class="field"><span>Сумма, ₴</span><input class="input" type="number" name="amount" min="1" step="1" required inputmode="numeric" value="${defaults.amount ?? ''}" placeholder="${lastPrice}"></label>
      </div>` : `<label class="field"><span>Сумма, ₴</span><input class="input" type="number" name="amount" min="1" step="1" required inputmode="numeric" value="${defaults.amount ?? ''}" placeholder="350"></label>`}
      <label class="field"><span>Дата</span><input class="input" type="date" name="date" value="${toLocalInput(Date.now()).slice(0, 10)}" required></label>
      <label class="field"><span>Комментарий (необязательно)</span><input class="input" name="note" maxlength="200" placeholder="Например: пакет 8 уроков, наличными"></label>
      <p class="small muted" style="margin-top:0">Можно внести любую сумму: за урок, пакетом или частично. Деньги сами распределятся по урокам по порядку.</p>
      <button class="btn block big" type="submit">Внести оплату</button>
    </form>`,
  );
  $('[name=count]', el)?.addEventListener('input', (e) => {
    const n = Number(e.target.value);
    if (n > 0) {
      $('[name=amount]', el).value = n * lastPrice;
      if (!$('[name=note]', el).value || /^\d+ урок/.test($('[name=note]', el).value)) $('[name=note]', el).value = `${n} ${plural(n, 'урок', 'урока', 'уроков')}`;
    }
  });
  $('#pay-chips', el)?.addEventListener('click', (e) => {
    const b = e.target.closest('[data-v]');
    if (!b) return;
    $$('#pay-chips .chip', el).forEach((c) => c.classList.toggle('on', c === b));
    $('[name=amount]', el).value = b.dataset.v;
    if (/урок/.test(b.textContent) && !$('[name=note]', el).value) $('[name=note]', el).value = b.textContent.split(' · ')[0];
  });
  onSubmit($('#f-pay', el), async (f) => {
    const [y, m, d] = f.date.split('-').map(Number);
    const today = toLocalInput(Date.now()).slice(0, 10) === f.date;
    const r = await api('/payments', {
      method: 'POST',
      body: { student_id: student.id, amount: Number(f.amount), note: f.note, paid_at: today ? Date.now() : new Date(y, m - 1, d, 12).getTime() },
    });
    close();
    toast(r.balance < 0 ? `Внесено. Остаток долга ${money(-r.balance)}` : r.balance > 0 ? `Внесено. Предоплата ${money(r.balance)}` : 'Внесено. Всё оплачено ✓');
    render();
  });
}

/** Свободное окно / занятое время из графика. */
function slotRow(s, attrs = '') {
  const long = toMinutesStr(s.end) - toMinutesStr(s.start) > 60;
  const label = s.kind === 'free' ? (long ? `свободно до ${s.end}` : 'свободно') : `занято до ${s.end}`;
  return `<div class="row sched slot ${s.kind}" ${attrs}><div class="sched-time"><b>${s.start}</b></div>
    <div class="row-main"><div class="row-sub">${label}</div></div>${s.kind === 'free' && attrs ? '<div class="row-end small">+ урок</div>' : ''}</div>`;
}
const toMinutesStr = (t) => Number(t.slice(0, 2)) * 60 + Number(t.slice(3, 5));
const fromMinutesStr = (m) => `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
const DURATIONS = [60, 90, 120, 150, 180];
const durLabel = (m) => (m % 60 ? `${Math.floor(m / 60)},5 ч` : `${m / 60} ч`);

// ───────── Расписание недели (реальные уроки) ─────────
// У каждой недели свой текст (копия постоянного графика). Любая правка здесь меняет только эту неделю.

let schedStudents = [];

/** Применить правку к тексту недели и сохранить. */
async function saveWeekLines(d, mutate, okText = 'Сохранено ✓') {
  const lines = d.text.split('\n');
  mutate(lines);
  const text = lines.join('\n');
  const { errors } = parseSchedule(text);
  if (errors.length) throw new Error(`Не получилось: ${errors[0].message}`);
  const r = await api('/week', { method: 'PUT', body: { week: d.week, text } });
  toast(r.created?.length ? `${okText} Новый ученик: ${r.created.join(', ')}` : okText);
  render();
}

/** Вставить строку в нужный день (по времени). */
function insertLine(lines, items, day, start, text) {
  const dayItems = items.filter((i) => i.day === day);
  const after = dayItems.filter((i) => toMinutesStr(i.start) <= toMinutesStr(start)).pop();
  if (after) return lines.splice(after.line, 0, text);
  if (dayItems.length) return lines.splice(dayItems[0].line - 1, 0, text);
  const header = lines.findIndex((l) => dayIndex(l) === day);
  if (header >= 0) return lines.splice(header + 1, 0, text);
  lines.push('', DAY_NAMES[day], text);
}

/**
 * Поставить урок в день: если время попадает в свободное окно — занять его (остаток окна останется свободным),
 * иначе просто вставить строку по времени. `skipLine` — строка, которую не трогаем (старое место урока).
 */
function placeLesson(lines, items, day, startMin, durMin, lessonText, skipLine = null) {
  const endMin = startMin + durMin;
  const win = items.find(
    (i) => i.day === day && i.kind === 'free' && i.line !== skipLine && toMinutesStr(i.start) <= startMin && toMinutesStr(i.end) >= endMin,
  );
  if (win) {
    const parts = [];
    if (startMin > toMinutesStr(win.start)) parts.push(formatLine({ kind: 'free', start: win.start, end: fromMinutesStr(startMin) }));
    parts.push(lessonText);
    if (endMin < toMinutesStr(win.end)) parts.push(formatLine({ kind: 'free', start: fromMinutesStr(endMin), end: win.end }));
    lines.splice(win.line - 1, 1, ...parts);
    return;
  }
  insertLine(lines, items, day, fromMinutesStr(startMin), lessonText);
}

function studentsDatalist() {
  return `<datalist id="students-dl">${schedStudents.map((s) => `<option value="${esc(s.name)}">`).join('')}</datalist>`;
}

function lessonFields(it, { withDay = false } = {}) {
  const dur = it.end ? toMinutesStr(it.end) - toMinutesStr(it.start) : 60;
  const durs = DURATIONS.includes(dur) ? DURATIONS : [...DURATIONS, dur].sort((a, b) => a - b);
  return `
    ${withDay ? `<label class="field"><span>День</span><select class="input" name="day">${DAY_NAMES.map((n, i) => `<option value="${i}" ${i === it.day ? 'selected' : ''}>${n}</option>`).join('')}</select></label>` : ''}
    <label class="field"><span>Ученик</span><input class="input" name="name" list="students-dl" required maxlength="80" value="${esc(it.name ?? '')}" placeholder="Имя (новое имя станет учеником)" autocomplete="off"></label>
    ${studentsDatalist()}
    <div class="grid-3">
      <label class="field"><span>Начало</span><input class="input" type="time" name="start" step="300" value="${it.start}" required></label>
      <label class="field"><span>Длительность</span><select class="input" name="dur">${durs.map((m) => `<option value="${m}" ${m === dur ? 'selected' : ''}>${durLabel(m)}</option>`).join('')}</select></label>
      <label class="field"><span>Цена, ₴</span><input class="input" type="number" name="price" min="0" required inputmode="numeric" value="${it.price ?? ''}" placeholder="350"></label>
    </div>`;
}

const lineFromForm = (f, extra = {}) => {
  const start = f.start.slice(0, 5);
  return formatLine({ kind: 'lesson', start, end: fromMinutesStr(toMinutesStr(start) + Number(f.dur)), name: f.name.trim(), price: Number(f.price), ...extra });
};

/** Последняя цена ученика в этой неделе (для подсказки). */
function priceOf(d, name) {
  const n = name.trim().toLowerCase();
  return d.items.find((i) => i.kind === 'lesson' && i.name.trim().toLowerCase() === n)?.price ?? '';
}

/** Урок недели: всё редактируется, отмена с переносом. */
function openLessonItem(d, it) {
  const st = it.status ?? (it.cancelled ? 'cancelled' : 'ok');
  const statusSel = `<label class="field"><span>Статус</span><select class="input" name="status">
      <option value="ok" ${st === 'ok' ? 'selected' : ''}>Проводится</option>
      <option value="pending" ${st === 'pending' ? 'selected' : ''}>Отменён — нужно перенести</option>
      <option value="cancelled" ${st === 'cancelled' ? 'selected' : ''}>Отменён без переноса</option>
      ${st === 'moved' ? `<option value="moved" selected>Перенесён → ${DAY_SHORT[it.to.day]}, ${it.to.time}</option>` : ''}
    </select></label>`;
  const { el, close } = sheet(
    `${DAY_NAMES[it.day]}, ${it.start}`,
    `<div class="card" style="display:flex;justify-content:space-between;align-items:center;gap:8px;flex-wrap:wrap"><b>${esc(it.name)}</b>${itemPayBadge(d, it)}</div>
    ${it.from ? `<p class="small muted">↩ Это перенос с ${DAY_NAMES[it.from.day].toLowerCase()}, ${it.from.time}</p>` : ''}
    <div class="row-gap mt">
      ${st === 'ok' || st === 'pending' ? `<button class="btn ${st === 'pending' ? '' : 'secondary'} block" data-a="move">↪ Перенести на другое время</button>` : ''}
      ${st === 'ok' ? `<button class="btn ghost block" data-a="cancel-move">⏳ Отменить и перенести позже</button>` : ''}
      ${st !== 'ok' ? `<button class="btn ghost block" data-a="other">➕ Поставить другого ученика в это время</button>` : ''}
    </div>
    <form id="f-item" class="mt">
      ${lessonFields(it)}
      ${statusSel}
      <button class="btn block big" type="submit">Сохранить</button>
    </form>
    <p class="small muted">Изменения — только для этой недели. Следующие недели — по постоянному графику.</p>
    <div class="row-gap">
      ${it.student_id && st === 'ok' ? `<button class="btn secondary block" data-a="pay">💰 Внести оплату</button>` : ''}
      <button class="btn ghost block" data-a="free">🕳 Убрать урок совсем</button>
      ${it.student_id ? `<button class="btn ghost block" data-a="practice">🤖 Открыть практику с ботом</button>
      <a class="btn ghost block" href="#/students/${it.student_id}">Карточка ученика</a>` : ''}
    </div>`,
  );

  // Связанные уроки переноса: откуда пришёл этот урок / куда ушёл
  const origin = it.from
    ? d.items.find((o) => o.kind === 'lesson' && o.status === 'moved' && o.name === it.name && o.day === it.from.day && o.start === it.from.time)
    : null;
  const target =
    st === 'moved' ? d.items.find((o) => o.kind === 'lesson' && o.from && o.name === it.name && o.from.day === it.day && o.from.time === it.start) : null;

  onSubmit($('#f-item', el), async (f) => {
    const status = f.status;
    await saveWeekLines(d, (lines) => {
      lines[it.line - 1] = lineFromForm(f, { status, to: status === 'moved' ? it.to : undefined, from: status === 'ok' ? it.from : undefined });
      // Перенесённый урок вернули обратно — урок-перенос на новом месте убираем
      if (st === 'moved' && status !== 'moved' && target) lines[target.line - 1] = formatLine({ kind: 'free', start: target.start, end: target.end });
    });
    close();
  });
  el.addEventListener('click', async (e) => {
    const a = e.target.closest('[data-a]')?.dataset.a;
    if (e.target.closest('a.btn')) close();
    try {
      if (a === 'move') {
        close();
        openMoveItem(d, it);
      } else if (a === 'cancel-move') {
        await saveWeekLines(d, (lines) => (lines[it.line - 1] = formatLine({ ...it, status: 'pending', from: undefined })), `${it.name}: ждёт переноса ⏳`);
        close();
      } else if (a === 'other') {
        close();
        openFreeItem(d, { day: it.day, start: it.start, end: it.end, kind: 'free', line: null, after: it.line });
      } else if (a === 'pay') {
        close();
        openPaymentSheet({ id: it.student_id, name: it.name }, null, { amount: it.pay ? it.price - it.pay.covered : it.price });
      } else if (a === 'free') {
        if (!confirm(`Убрать урок ${it.name} в ${it.start} на этой неделе? Время станет свободным.`)) return;
        await saveWeekLines(
          d,
          (lines) => {
            lines[it.line - 1] = formatLine({ kind: 'free', start: it.start, end: it.end });
            if (origin) lines[origin.line - 1] = formatLine({ ...origin, status: 'pending', to: undefined });
            if (target) lines[target.line - 1] = formatLine({ kind: 'free', start: target.start, end: target.end });
          },
          origin ? 'Перенос убран — исходный урок снова ждёт переноса' : 'Урок убран ✓',
        );
        close();
      } else if (a === 'practice') {
        close();
        openLessonForm((await api(`/students/${it.student_id}`)).student);
      }
    } catch (err) {
      if (!(err instanceof AuthError)) toast(err.message);
    }
  });
}

/** Перенести урок на другое время этой недели (видно откуда → куда). */
function openMoveItem(d, it) {
  const now = Date.now();
  const [y, mo, dd] = d.week.split('-').map(Number);
  const dur = toMinutesStr(it.end) - toMinutesStr(it.start);
  // Свободные окна недели (ещё не прошедшие) — подсказки
  const wins = d.items
    .filter((w) => w.kind === 'free')
    .flatMap((w) => {
      const out = [];
      for (let m = toMinutesStr(w.start); m + 60 <= toMinutesStr(w.end); m += 60) out.push({ day: w.day, time: fromMinutesStr(m) });
      return out;
    })
    .filter((w) => new Date(y, mo - 1, dd + w.day, ...w.time.split(':').map(Number)).getTime() > now);
  const durs = [...new Set([...DURATIONS, dur])].sort((a, b) => a - b);
  const { el, close } = sheet(
    `Перенести · ${it.name}`,
    `<p class="muted" style="margin-top:0">С ${DAY_SHORT[it.day]}, ${it.start}. На старом месте останется пометка «перенесён», а время освободится.</p>
    ${
      wins.length
        ? `<div class="small muted" style="margin-bottom:6px">Свободные окна:</div><div class="chips" id="wins">${wins
            .slice(0, 30)
            .map((w) => `<button type="button" class="chip" data-day="${w.day}" data-time="${w.time}">${DAY_SHORT[w.day]} ${w.time}</button>`)
            .join('')}</div>`
        : ''
    }
    <form id="f-move">
      <label class="field"><span>День</span><select class="input" name="day">${DAY_NAMES.map((n, i) => `<option value="${i}" ${i === it.day ? 'selected' : ''}>${n}</option>`).join('')}</select></label>
      <div class="grid-2">
        <label class="field"><span>Начало</span><input class="input" type="time" name="start" step="300" value="${it.start}" required></label>
        <label class="field"><span>Длительность</span><select class="input" name="dur">${durs.map((m) => `<option value="${m}" ${m === dur ? 'selected' : ''}>${durLabel(m)}</option>`).join('')}</select></label>
      </div>
      <button class="btn block big" type="submit">Перенести</button>
    </form>`,
  );
  $('#wins', el)?.addEventListener('click', (e) => {
    const c = e.target.closest('[data-day]');
    if (!c) return;
    $$('#wins .chip', el).forEach((x) => x.classList.toggle('on', x === c));
    $('[name=day]', el).value = c.dataset.day;
    $('[name=start]', el).value = c.dataset.time;
  });
  onSubmit($('#f-move', el), async (f) => {
    const day = Number(f.day);
    const start = f.start.slice(0, 5);
    const mins = Number(f.dur);
    if (day === it.day && start === it.start) throw new Error('Выбери другое время');
    await saveWeekLines(
      d,
      (lines) => {
        // 1) старое место: «перенос → день время» (меняем строку на месте — номера строк не сдвигаются)
        lines[it.line - 1] = formatLine({ ...it, status: 'moved', to: { day, time: start }, from: undefined });
        // 2) новое место: урок с пометкой «с …»
        const text = formatLine({
          kind: 'lesson',
          start,
          end: fromMinutesStr(toMinutesStr(start) + mins),
          name: it.name,
          price: it.price,
          status: 'ok',
          from: it.from ?? { day: it.day, time: it.start },
        });
        placeLesson(lines, d.items, day, toMinutesStr(start), mins, text, it.line);
      },
      `${it.name}: ${DAY_SHORT[it.day]} ${it.start} → ${DAY_SHORT[day]} ${start} ✓`,
    );
    close();
  });
}

/** Свободное окно: поставить туда урок. */
function openFreeItem(d, it) {
  const winStart = toMinutesStr(it.start), winEnd = toMinutesStr(it.end);
  const { el, close } = sheet(
    `Свободно · ${DAY_NAMES[it.day]}`,
    `<p class="muted" style="margin-top:0">Окно ${it.start}–${it.end}. Поставь сюда урок — только на эту неделю.</p>
    <form id="f-free">
      ${lessonFields({ day: it.day, start: it.start, end: fromMinutesStr(Math.min(winStart + 60, winEnd > winStart ? Math.max(winStart + 60, 0) : winStart + 60)) })}
      <button class="btn block big mt" type="submit">Поставить урок</button>
    </form>
    ${it.line == null ? '' : it.kind === 'free' ? `<button class="btn ghost block mt" data-a="busy">Отметить как занятое</button>` : `<button class="btn ghost block mt" data-a="unbusy">Сделать свободным</button>`}`,
  );
  const nameInput = $('[name=name]', el), priceInput = $('[name=price]', el);
  nameInput.addEventListener('change', () => {
    if (!priceInput.value) priceInput.value = priceOf(d, nameInput.value);
  });
  onSubmit($('#f-free', el), async (f) => {
    const s = toMinutesStr(f.start.slice(0, 5)), e = s + Number(f.dur);
    await saveWeekLines(
      d,
      (lines) => {
        // Урок + оставшиеся свободные части окна до и после
        const parts = [];
        if (it.line == null) {
          // Время отменённого урока: новый урок ставим рядом, отметка об отмене остаётся
          lines.splice(it.after, 0, lineFromForm(f));
          return;
        }
        if (s > winStart) parts.push(formatLine({ kind: 'free', start: it.start, end: fromMinutesStr(s) }));
        parts.push(lineFromForm(f));
        if (e < winEnd) parts.push(formatLine({ kind: 'free', start: fromMinutesStr(e), end: it.end }));
        lines.splice(it.line - 1, 1, ...parts);
      },
      'Урок поставлен ✓',
    );
    close();
  });
  el.addEventListener('click', async (e) => {
    const a = e.target.closest('[data-a]')?.dataset.a;
    try {
      if (a === 'busy' || a === 'unbusy') {
        await saveWeekLines(d, (lines) => (lines[it.line - 1] = formatLine({ ...it, kind: a === 'busy' ? 'busy' : 'free' })));
        close();
      }
    } catch (err) {
      if (!(err instanceof AuthError)) toast(err.message);
    }
  });
}

/** Новый урок в эту неделю (в любой день и время). */
function openAddItem(d) {
  const today = (new Date().getDay() + 6) % 7;
  const { el, close } = sheet(
    'Урок на эту неделю',
    `<form id="f-add">
      ${lessonFields({ day: d.week === d.current ? today : 0, start: '18:00', end: '19:00' }, { withDay: true })}
      <p class="small muted" style="margin-top:0">Добавится только в эту неделю. Чтобы урок был каждую неделю — добавь его в постоянный график.</p>
      <button class="btn block big" type="submit">Добавить</button>
    </form>`,
  );
  const nameInput = $('[name=name]', el), priceInput = $('[name=price]', el);
  nameInput.addEventListener('change', () => {
    if (!priceInput.value) priceInput.value = priceOf(d, nameInput.value);
  });
  onSubmit($('#f-add', el), async (f) => {
    const start = f.start.slice(0, 5);
    await saveWeekLines(d, (lines) => insertLine(lines, d.items, Number(f.day), start, lineFromForm(f)), 'Урок добавлен ✓');
    close();
  });
}

function itemPayBadge(d, it) {
  if (it.status === 'pending') return '<span class="badge amber">⏳ ждёт переноса</span>';
  if (it.status === 'moved') return `<span class="badge blue">→ ${DAY_SHORT[it.to.day]}, ${it.to.time}</span>`;
  if (it.cancelled) return '<span class="badge">отменён</span>';
  const [y, m, dd] = d.week.split('-').map(Number);
  const startMs = new Date(y, m - 1, dd + it.day, ...it.start.split(':').map(Number)).getTime();
  return payBadge({ status: 'planned', pay: it.pay, price: it.price, starts_at: startMs });
}

async function pageSchedule(week) {
  const [d, st] = await Promise.all([api(`/week${week ? `?week=${week}` : ''}`), api('/students')]);
  schedStudents = st.students.filter((s) => !s.archived);
  setHeader({
    title: 'Расписание',
    action: `<a class="btn secondary" style="min-height:38px;padding:6px 12px" href="#/template">📋 Постоянный график</a>`,
  });
  setFab('Урок', () => openAddItem(d));

  const from = new Date(`${d.week}T00:00:00`);
  const last = new Date(from.getFullYear(), from.getMonth(), from.getDate() + 6);
  const range =
    from.getMonth() === last.getMonth()
      ? `${from.getDate()}–${last.toLocaleDateString('ru-RU', { day: 'numeric', month: 'long' })}`
      : `${from.toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' })} – ${last.toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' })}`;
  const label = d.week === d.current ? 'эта неделя' : d.prev === d.current ? 'следующая неделя' : d.next === d.current ? 'прошлая неделя' : d.week > d.current ? 'будущая неделя' : 'прошедшая неделя';
  const t = d.totals;
  const todayKey = new Date().toDateString();
  const nowMs = Date.now();

  let html = `
    <div class="week-nav">
      <a class="icon-btn" href="#/schedule/${d.prev}" aria-label="Прошлая неделя">${icon('chevronL')}</a>
      <div class="week-title"><b>${range}</b><span>${label}</span></div>
      <a class="icon-btn" href="#/schedule/${d.next}" aria-label="Следующая неделя">${icon('chevronR')}</a>
    </div>
    ${d.week !== d.current ? `<a class="link-btn" href="#/schedule" style="display:block;text-align:center;margin:0 0 8px">Вернуться к этой неделе</a>` : ''}`;

  if (!d.has_template) {
    html += `<div class="card empty"><div class="emoji">🗓</div><b>Заполни постоянный график</b><br>Вставь его текстом, как в заметках, — каждая неделя будет начинаться с него.
      <div class="mt"><a class="btn" href="#/template">📋 Заполнить график</a></div></div>`;
    $('#view').innerHTML = html;
    return;
  }
  if (!d.text) {
    html += `<div class="card empty"><div class="emoji">🗓</div>Эта неделя раньше, чем начат график.</div>`;
    $('#view').innerHTML = html;
    return;
  }

  html += `<div class="stats three">
      <div class="stat"><div class="stat-value">${t.lessons}</div><div class="stat-label">${plural(t.lessons, 'урок', 'урока', 'уроков')}${t.cancelled ? ` · ${t.cancelled} отм.` : ''}</div></div>
      <div class="stat"><div class="stat-value">${money(t.expected)}</div><div class="stat-label">ожидается</div></div>
      <div class="stat"><div class="stat-value green-text">${money(t.covered)}</div><div class="stat-label">оплачено</div></div>
    </div>
    <div class="week-actions">
      ${d.edited ? `<span class="badge amber">✏️ неделя изменена</span><button class="link-btn" data-act="reset">↺ Вернуть как в постоянном</button>` : `<span class="small muted">По постоянному графику. Нажми на урок или окно, чтобы изменить только эту неделю.</span>`}
      <a class="link-btn" href="#/week-text/${d.week}">✏️ Текстом</a>
    </div>`;

  // Отменённые уроки, которые ещё нужно перенести
  const pending = d.items.filter((it) => it.kind === 'lesson' && it.status === 'pending');
  if (pending.length) {
    html += `<div class="card pending-card mt"><b>⏳ Ждут переноса · ${pending.length}</b>
      <div class="list mt">${pending
        .map(
          (it) => `<div class="row" data-line="${it.line}"><div class="row-main"><div class="row-title">${esc(it.name)}</div>
          <div class="row-sub">был: ${DAY_NAMES[it.day].toLowerCase()}, ${it.start} · ${money(it.price)}</div></div>
          <div class="row-end"><button class="btn" style="min-height:36px;padding:6px 12px" data-move="${it.line}">↪ Перенести</button></div></div>`,
        )
        .join('')}</div></div>`;
  }

  for (let i = 0; i < 7; i++) {
    const day = new Date(from.getFullYear(), from.getMonth(), from.getDate() + i);
    const items = d.items.filter((it) => it.day === i);
    const isToday = day.toDateString() === todayKey;
    const visible = items.filter((it) => {
      if (it.kind === 'lesson') return true;
      const [eh, em] = it.end.split(':').map(Number);
      return new Date(day.getFullYear(), day.getMonth(), day.getDate(), eh, em).getTime() > nowMs; // прошедшие окна не показываем
    });
    if (!visible.length && i >= 5) continue;
    const sum = items.filter((it) => it.kind === 'lesson' && !it.cancelled).reduce((a, it) => a + it.price, 0);
    html += `<div class="section-title day ${isToday ? 'today' : ''}"><span>${day.toLocaleDateString('ru-RU', { weekday: 'long', day: 'numeric', month: 'long' })}${isToday ? ' · сегодня' : ''}</span>
        <span class="small muted" style="font-weight:500">${sum ? money(sum) : ''}</span></div>
      ${
        visible.length
          ? `<div class="list">${visible
              .map((it) =>
                it.kind === 'lesson'
                  ? `<div class="row sched ${it.cancelled ? 'cancelled' : ''} ${it.status === 'pending' ? 'pending' : ''}" data-line="${it.line}">
                    <div class="sched-time"><b>${it.start}</b><span>${it.end}</span></div>
                    <div class="row-main"><div class="row-title">${esc(it.name)}</div><div class="row-sub">${money(it.price)}${
                      it.from ? ` · <span class="from-mark">↩ с ${DAY_SHORT[it.from.day]}, ${it.from.time}</span>` : ''
                    }${it.cancelled ? ' · <span class="free-mark">время свободно</span>' : ''}</div></div>
                    <div class="row-end">${itemPayBadge(d, it)}</div></div>`
                  : slotRow(it, `data-line="${it.line}" style="cursor:pointer"`),
              )
              .join('')}</div>`
          : '<div class="day-empty">Нет уроков</div>'
      }`;
  }

  $('#view').innerHTML = html;
  $('#view').onclick = async (e) => {
    try {
      if (e.target.closest('[data-act=reset]')) {
        if (!confirm('Вернуть эту неделю как в постоянном графике? Ручные изменения недели пропадут (оплаты останутся).')) return;
        await api('/week/reset', { method: 'POST', body: { week: d.week } });
        toast('Неделя как в постоянном графике ✓');
        return render();
      }
      const mv = e.target.closest('[data-move]');
      if (mv) return openMoveItem(d, d.items.find((x) => x.line === Number(mv.dataset.move)));
      const r = e.target.closest('[data-line]');
      if (!r) return;
      const it = d.items.find((x) => x.line === Number(r.dataset.line));
      if (it.kind === 'lesson') openLessonItem(d, it);
      else openFreeItem(d, it);
    } catch (err) {
      if (!(err instanceof AuthError)) toast(err.message);
    }
  };
}

// ───────── Текст графика: постоянный или конкретной недели ─────────
const TEMPLATE_HELP = `Понедельник
10:00 Мария 350
11:00
12:00 Оля 350

Вторник
9:00 — 12:00
13:00 Макс 350`;

function pageTemplate() {
  return pageTextEditor('template');
}
function pageWeekText(week) {
  return pageTextEditor('week', week);
}

async function pageTextEditor(mode, week = null) {
  const isWeek = mode === 'week';
  const [data, { students }] = await Promise.all([isWeek ? api(`/week?week=${week}`) : api('/template'), api('/students')]);
  const text = data.text;
  let savedText = text;
  const updated_at = data.updated_at;
  let title = 'Постоянный график';
  if (isWeek) {
    const from = new Date(`${week}T00:00:00`);
    const last = new Date(from.getFullYear(), from.getMonth(), from.getDate() + 6);
    title = `Неделя ${from.getDate()}.${String(from.getMonth() + 1).padStart(2, '0')}–${last.getDate()}.${String(last.getMonth() + 1).padStart(2, '0')}`;
  }
  setHeader({ title, back: isWeek ? `#/schedule/${week}` : '#/schedule' });
  const known = new Set(students.filter((s) => !s.archived).map((s) => s.name.trim().toLowerCase().replace(/\s+/g, ' ').replace(/ё/g, 'е')));

  $('#view').innerHTML = `
    <div class="editor-bar">
      <button class="btn secondary" id="toggle-edit">✏️ Редактировать текстом</button>
      <a class="btn ghost" href="${isWeek ? `#/schedule/${week}` : '#/schedule'}">📅 Недельный график</a>
    </div>
    <div id="editor">
    <details class="card help mt" ${text ? '' : 'open'}>
      <summary><b>Как заполнять</b></summary>
      <div class="small" style="margin-top:8px">Пиши как в заметках — можно просто вставить свои заметки целиком:
        <ul style="margin:6px 0;padding-left:18px">
          <li><code>Понедельник</code> — день недели</li>
          <li><code>10:00 Мария 350</code> — урок: время, имя, цена</li>
          <li><code>11:00</code> — свободное окно</li>
          <li><code>9:00 — 12:00</code> — свободно с 9:00 до 13:00 (время = начало часа)</li>
          <li><code>15:00 — 16:00 Иван 600</code> — урок на 2 часа, 15:00–17:00</li>
          <li><code>17:00 Ева 350 отмена</code> — отменён без переноса (не считается)</li>
          <li><code>17:00 Ева 350 перенос</code> — отменён, ждёт переноса</li>
          <li><code>17:00 Ева 350 перенос → ср 16:00</code> и <code>16:00 Ева 350 с вт 17:00</code> — перенос</li>
          <li><code>9:00 — 12:00 занято</code> — занятое время</li>
          <li>Одно имя = один ученик. Разных с одинаковым именем пиши с буквой: <code>София К.</code></li>
        </ul>
        Новые имена станут учениками автоматически.</div>
    </details>
    <textarea class="input tpl" id="tpl" spellcheck="false" placeholder="${esc(TEMPLATE_HELP)}">${esc(text)}</textarea>
    <div class="save-bar">
      ${!isWeek && text ? `<div class="segmented" id="apply" style="margin-bottom:8px"><button class="on" data-v="this">С этой недели</button><button data-v="next">Со следующей недели</button></div>` : ''}
      <button class="btn block big" id="save">${isWeek ? 'Сохранить неделю' : 'Сохранить график'}</button>
      <button class="btn ghost block" id="cancel-edit" style="margin-top:8px">Свернуть без сохранения</button></div>
    </div>
    <div id="preview"></div>
    <p class="small muted" id="updated" style="text-align:center">${updated_at ? `Последнее изменение: ${fmtWhen(updated_at)}` : ''}</p>`;

  const ta = $('#tpl');
  const autosize = () => {
    ta.style.height = 'auto';
    ta.style.height = Math.max(240, ta.scrollHeight + 4) + 'px';
  };
  let parsed;
  const okLabel = isWeek ? 'Сохранить неделю' : 'Сохранить график';
  const update = () => {
    parsed = parseSchedule(ta.value);
    const lessons = parsed.items.filter((i) => i.kind === 'lesson' && !i.cancelled);
    const total = lessons.reduce((a, i) => a + i.price, 0);
    const newNames = [...new Set(lessons.map((i) => i.name).filter((n) => !known.has(n.trim().toLowerCase().replace(/\s+/g, ' ').replace(/ё/g, 'е'))))];
    const people = new Set(lessons.map((i) => i.name.trim().toLowerCase())).size;
    let h = '';
    if (parsed.errors.length) {
      h += `<div class="card error-card"><b>⚠️ Не понял ${parsed.errors.length} ${plural(parsed.errors.length, 'строку', 'строки', 'строк')}:</b>${parsed.errors
        .map((e) => `<div class="err-line"><code>${e.line}: ${esc(e.text.trim())}</code><span>${esc(e.message)}</span></div>`)
        .join('')}</div>`;
    }
    if (lessons.length) {
      h += `<div class="card mt"><b>${lessons.length} ${plural(lessons.length, 'урок', 'урока', 'уроков')} · ${people} ${plural(people, 'ученик', 'ученика', 'учеников')} · ${money(total)}</b>
        ${newNames.length ? `<div class="small mt">🆕 Будут добавлены ученики: ${newNames.map((n) => `<span class="badge accent">${esc(n)}</span>`).join(' ')}</div>` : ''}</div>`;
    }
    for (let d = 0; d < 7; d++) {
      const items = parsed.items.filter((i) => i.day === d);
      if (!items.length) continue;
      h += `<div class="section-title day"><span>${DAY_NAMES[d]}</span></div><div class="list">${items
        .map((i) =>
          i.kind === 'lesson'
            ? `<div class="row sched ${i.cancelled ? 'cancelled' : ''}"><div class="sched-time"><b>${i.start}</b><span>${i.end}</span></div>
          <div class="row-main"><div class="row-title">${esc(i.name)}</div></div><div class="row-end">${i.cancelled ? 'отменён' : money(i.price)}</div></div>`
            : slotRow(i),
        )
        .join('')}</div>`;
    }
    $('#preview').innerHTML = h || '<div class="empty small">Здесь появится предпросмотр</div>';
    $('#save').classList.toggle('danger', parsed.errors.length > 0);
    $('#save').textContent = parsed.errors.length
      ? `⚠️ Ошибка в ${plural(parsed.errors.length, 'строке', 'строках', 'строках')} ${parsed.errors.map((e) => e.line).join(', ')} — показать`
      : okLabel;
  };
  ta.addEventListener('input', () => {
    autosize();
    update();
  });
  autosize();
  update();

  // Текст свёрнут, пока график заполнен: видно только таблицу. Редактирование — по кнопке.
  const setEditing = (on) => {
    $('#editor').hidden = !on;
    $('#toggle-edit').hidden = on;
    if (on) {
      autosize();
      ta.focus({ preventScroll: true });
      $('#editor').scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };
  setEditing(!text);
  $('#toggle-edit').onclick = () => setEditing(true);
  $('#cancel-edit').onclick = () => {
    if (ta.value !== savedText && !confirm('Есть несохранённые изменения. Отменить их?')) return;
    ta.value = savedText;
    update();
    setEditing(false);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  $('#apply')?.addEventListener('click', (e) => {
    const b = e.target.closest('button');
    if (b) $$('#apply button').forEach((x) => x.classList.toggle('on', x === b));
  });
  $('#save').onclick = async () => {
    if (parsed.errors.length) {
      const first = parsed.errors[0].line;
      const lines = ta.value.split('\n');
      const start = lines.slice(0, first - 1).join('\n').length + (first > 1 ? 1 : 0);
      ta.focus();
      ta.setSelectionRange(start, start + lines[first - 1].length);
      $('.error-card')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      return;
    }
    $('#save').disabled = true;
    try {
      let r, msg;
      if (isWeek) {
        r = await api('/week', { method: 'PUT', body: { week, text: ta.value } });
        msg = r.created.length ? `Неделя сохранена. Новые ученики: ${r.created.length}` : 'Неделя сохранена ✓';
      } else {
        const apply = $('#apply .on')?.dataset.v ?? 'this';
        r = await api('/template', { method: 'PUT', body: { text: ta.value, apply } });
        msg = r.created.length ? `Сохранено. Новых учеников: ${r.created.length}` : 'График сохранён ✓';
        if (r.kept?.length) msg += `. Недели, изменённые вручную, не тронуты (${r.kept.length})`;
      }
      // Сохранено: сворачиваем текст, остаёмся на странице с обновлённым графиком
      for (const n of r.created ?? []) known.add(n.trim().toLowerCase().replace(/\s+/g, ' ').replace(/ё/g, 'е'));
      savedText = ta.value;
      update();
      setEditing(false);
      $('#save').disabled = false;
      $('#updated').textContent = `Последнее изменение: ${fmtWhen(Date.now())}`;
      window.scrollTo({ top: 0, behavior: 'smooth' });
      toast(msg);
    } catch (err) {
      if (!(err instanceof AuthError)) toast(err.message);
      $('#save').disabled = false;
    }
  };
}

// ───────── Оплаты (как в заметках) ─────────
const shortDate = (ts) => new Date(ts).toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit' });
const lessonsWord = (n) => `${n} ${plural(n, 'урок', 'урока', 'уроков')}`;

function payCard(s, { expanded = false } = {}) {
  // Сводка: долг / наперёд / всё оплачено
  const badges = [];
  if (s.unpaid.length) badges.push(`<span class="badge red">не оплачено ${lessonsWord(s.unpaid.length)} · ${money(s.debt)}</span>`);
  if (s.prepaid_lessons) badges.push(`<span class="badge green">наперёд ${lessonsWord(s.prepaid_lessons)}</span>`);
  else if (s.leftover > 0) badges.push(`<span class="badge green">наперёд ${money(s.leftover)}</span>`);
  if (!badges.length) badges.push('<span class="badge">всё оплачено</span>');

  // Показываем последние оплаты (как в заметках), старые — по кнопке
  const pk = s.packages;
  const shown = expanded ? pk : pk.slice(-2);
  const hidden = pk.length - shown.length;

  const pkHtml = shown
    .map((p, idx) => {
      const isLast = p === pk[pk.length - 1];
      const items = p.lessons.map(
        (l, i) =>
          `<div class="pl ${l.covered < l.price ? 'part' : 'done'}"><span class="pl-mark">${l.covered < l.price ? '◐' : '✓'}</span>
          <span class="pl-n">${i + 1}</span><span class="pl-d">${shortDate(l.date)}</span>${l.covered < l.price ? `<span class="pl-x">${l.covered}/${l.price}</span>` : ''}</div>`,
      );
      // Оплачено наперёд — пустые кружки у последней оплаты (с датой будущего урока, если он уже в расписании)
      if (isLast) {
        s.ahead.forEach((a, i) =>
          items.push(`<div class="pl empty"><span class="pl-mark">○</span><span class="pl-n">${p.lessons.length + i + 1}</span><span class="pl-d">${a.date ? shortDate(a.date) : ''}</span></div>`),
        );
      }
      const rest = isLast ? s.ahead_rest : 0;
      return `<div class="pk">
        <div class="pk-head"><b>Оплата ${shortDate(p.paid_at)} · ${money(p.amount)}</b>${p.note ? `<span class="muted"> · ${esc(p.note)}</span>` : ''}</div>
        <div class="pl-grid">${items.join('') || '<span class="small muted">уроков ещё не было</span>'}</div>
        ${rest > 0 ? `<div class="small muted">+ ${money(rest)} в счёт следующего урока</div>` : ''}
      </div>`;
    })
    .join('');

  const unpaidHtml = s.unpaid.length
    ? `<div class="pk unpaid"><div class="pk-head"><b>Не оплачено</b></div><div class="pl-grid">${s.unpaid
        .map(
          (u, i) =>
            `<div class="pl due"><span class="pl-mark">✗</span><span class="pl-n">${i + 1}</span><span class="pl-d">${shortDate(u.date)}</span>${u.owed < u.price ? `<span class="pl-x">−${u.owed}</span>` : ''}</div>`,
        )
        .join('')}</div></div>`
    : '';

  return `<div class="card pay-card" data-sid="${s.id}" data-name="${esc(s.name.toLowerCase())}">
    <div class="pay-head">
      <a href="#/students/${s.id}" class="pay-name">${esc(s.name)}</a>
      <button class="btn" style="min-height:36px;padding:6px 12px" data-pay="${s.id}">+ Оплата</button>
    </div>
    <div class="pay-badges">${badges.join('')}${s.price ? `<span class="small muted">урок ${money(s.price)}</span>` : ''}</div>
    ${hidden > 0 ? `<button class="link-btn" data-more="${s.id}">Показать ещё ${hidden} ${plural(hidden, 'оплату', 'оплаты', 'оплат')}</button>` : ''}
    ${pkHtml}
    ${unpaidHtml}
    ${!pk.length && !s.unpaid.length ? '<p class="small muted">Пока нет ни уроков, ни оплат.</p>' : ''}
  </div>`;
}

async function pagePayments() {
  setHeader({ title: 'Оплаты' });
  const { students } = await api('/payments-board');
  const totalDebt = students.reduce((a, s) => a + s.debt, 0);
  const debtors = students.filter((s) => s.unpaid.length).length;
  const prepaid = students.filter((s) => s.leftover > 0).length;
  let filter = 'all';
  const expanded = new Set();

  const draw = () => {
    const q = ($('#q')?.value ?? '').trim().toLowerCase();
    const list = students
      .filter((s) => (filter === 'debt' ? s.unpaid.length : filter === 'prepaid' ? s.leftover > 0 : true))
      .filter((s) => !q || s.name.toLowerCase().includes(q))
      // Сначала должники, потом остальные
      .sort((a, b) => b.debt - a.debt || a.name.localeCompare(b.name, 'ru'));
    $('#pay-list').innerHTML = list.length
      ? list.map((s) => payCard(s, { expanded: expanded.has(s.id) })).join('')
      : '<div class="card empty">Никого не найдено</div>';
  };

  $('#view').innerHTML = `
    <div class="stats three">
      <div class="stat"><div class="stat-value red-text">${money(totalDebt)}</div><div class="stat-label">долг всего</div></div>
      <div class="stat"><div class="stat-value">${debtors}</div><div class="stat-label">должны</div></div>
      <div class="stat"><div class="stat-value">${prepaid}</div><div class="stat-label">оплатили наперёд</div></div>
    </div>
    <div class="chips mt" id="pay-filter">
      <button class="chip on" data-f="all">Все</button>
      <button class="chip" data-f="debt">Есть долг</button>
      <button class="chip" data-f="prepaid">Наперёд</button>
    </div>
    <label class="search">${icon('search')}<input class="input" type="search" placeholder="Поиск по имени" id="q" autocomplete="off"></label>
    <div id="pay-list" class="row-gap"></div>
    <p class="small muted" style="text-align:center">✓ — урок оплачен · ◐ — оплачен частично · ○ — оплачено наперёд · ✗ — не оплачен</p>`;
  draw();

  $('#q').oninput = draw;
  $('#pay-filter').onclick = (e) => {
    const b = e.target.closest('[data-f]');
    if (!b) return;
    filter = b.dataset.f;
    $$('#pay-filter .chip').forEach((c) => c.classList.toggle('on', c === b));
    draw();
  };
  $('#view').onclick = async (e) => {
    const more = e.target.closest('[data-more]');
    if (more) {
      expanded.add(Number(more.dataset.more));
      return draw();
    }
    const pay = e.target.closest('[data-pay]');
    if (pay) {
      const s = students.find((x) => x.id === Number(pay.dataset.pay));
      openPaymentSheet({ id: s.id, name: s.name }, null, { price: s.price });
    }
  };
}

// ───────── Разговор ─────────
async function pageSession(id) {
  const { session: s, messages } = await api(`/sessions/${id}`);
  setHeader({ title: s.student_name, back: `#/students/${s.student_id}` });
  $('#view').innerHTML = `
    <div class="card">
      <div style="display:flex;justify-content:space-between;gap:8px;align-items:center">
        <b>${esc(s.topic_title ?? 'Свободная тема')}</b>
        ${s.score != null ? `<span class="badge ${s.score >= 7 ? 'green' : s.score >= 5 ? 'amber' : 'red'}">${s.score}/10</span>` : ''}
      </div>
      <div class="small muted">${fmtWhen(s.started_at)} · ${s.level} · ${messages.filter((m) => m.role === 'user').length} сообщ.${s.finished_at ? '' : ' · идёт сейчас'}</div>
    </div>
    ${s.feedback ? `<div class="section-title">Разбор</div><div class="card feedback">${md(s.feedback)}</div>` : ''}
    <div class="section-title">Переписка</div>
    <div class="chat">${
      messages
        .map((m) => `<div class="bubble ${m.role}">${m.role === 'model' ? md(m.content) : esc(m.content)}<time>${fmtTime(m.created_at)}</time></div>`)
        .join('') || '<div class="empty">Сообщений нет</div>'
    }</div>`;
}

// ───────── Темы ─────────
async function pageTopics() {
  setHeader({ title: 'Темы' });
  setFab('Тема', () => openTopicForm());
  const topics = await getTopics(true);
  $('#view').innerHTML = `
    <p class="muted small" style="margin:0 4px 12px">Тема — это сценарий для ИИ: кого он играет и о чём говорить. Слова из списка ИИ будет вплетать в разговор, а в статистике видно, какие ученик употребил.</p>
    <div class="row-gap">${topics
      .map(
        (t) => `<div class="card" data-topic="${t.id}" style="cursor:pointer;${t.active ? '' : 'opacity:.6'}">
        <div style="display:flex;justify-content:space-between;gap:8px;align-items:center"><b>${esc(t.title)}</b>
          ${t.active ? (t.lessons ? `<span class="small muted">${t.lessons} ${plural(t.lessons, 'занятие', 'занятия', 'занятий')}</span>` : '') : '<span class="badge">скрыта</span>'}</div>
        <div class="small muted" style="margin-top:4px;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden">${esc(t.scenario)}</div>
        ${t.vocab ? `<div class="words mt">${t.vocab.split(',').map((w) => `<span class="badge accent">${esc(w.trim())}</span>`).join('')}</div>` : ''}
      </div>`,
      )
      .join('')}</div>`;
  $$('[data-topic]').forEach((el) => (el.onclick = () => openTopicForm(topics.find((t) => t.id === Number(el.dataset.topic)))));
}

function openTopicForm(t = null) {
  const { el, close } = sheet(
    t ? 'Тема' : 'Новая тема',
    `<form id="f-topic">
      <label class="field"><span>Название</span><input class="input" name="title" required maxlength="80" value="${esc(t?.title ?? '')}" placeholder="At the hotel"></label>
      <label class="field"><span>Сценарий для ИИ</span><textarea class="input" name="scenario" required maxlength="2000" rows="5"
        placeholder="Ты администратор отеля. Ученик заселяется: спроси бронь, расскажи про завтрак, реши проблему с номером.">${esc(t?.scenario ?? '')}</textarea>
        <small>Можно по-русски или по-английски. Опиши роль ИИ и ситуацию.</small></label>
      <label class="field"><span>Слова для отработки (через запятую)</span><input class="input" name="vocab" maxlength="500" value="${esc(t?.vocab ?? '')}" placeholder="reservation, check in, single room, view"></label>
      ${t ? `<div class="switch-row" style="padding-top:0"><div><b>Показывать</b><small>Скрытые темы нельзя выбрать для новых занятий</small></div>
        <label class="switch"><input type="checkbox" name="active" ${t.active ? 'checked' : ''}><span></span></label></div>` : ''}
      <button class="btn block big mt" type="submit">${t ? 'Сохранить' : 'Добавить тему'}</button>
      ${t ? '<button class="btn danger block mt" type="button" data-a="delete">Удалить тему</button>' : ''}
    </form>`,
  );
  onSubmit($('#f-topic', el), async (f) => {
    const body = { title: f.title, scenario: f.scenario, vocab: f.vocab, active: t ? !!f.active : true };
    if (t) await api(`/topics/${t.id}`, { method: 'PATCH', body });
    else await api('/topics', { method: 'POST', body });
    close();
    toast('Сохранено ✓');
    render();
  });
  $('[data-a=delete]', el)?.addEventListener('click', async () => {
    if (!confirm(`Удалить тему «${t.title}»?`)) return;
    const r = await api(`/topics/${t.id}`, { method: 'DELETE' });
    close();
    toast(r.hidden ? 'Тема используется в занятиях — она скрыта' : 'Тема удалена');
    render();
  });
}

// ───────── Настройки ─────────
let installPrompt = null;
window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault();
  installPrompt = e;
});

async function pageSettings() {
  setHeader({ title: 'Настройки' });
  const s = await getSettings(true);
  const standalone = matchMedia('(display-mode: standalone)').matches || navigator.standalone;
  const ios = /iphone|ipad|ipod/i.test(navigator.userAgent);

  $('#view').innerHTML = `
    <div class="section-title">Мой Telegram</div>
    <div class="card">
      ${
        s.teacher_connected
          ? `<div class="tg-linked" style="margin:0">${icon('telegram')}<div style="flex:1">Подключён<small>Сюда приходят разборы и уведомления</small></div></div>
             <button class="link-btn mt" data-action="disconnect">Отключить</button>`
          : `<p style="margin:0 0 12px">Подключи свой Telegram, чтобы бот присылал тебе разборы учеников и сообщал, когда кто-то подключился.</p>
             <button class="btn block" data-action="connect">${icon('telegram')} Подключить мой Telegram</button>`
      }
      ${s.bot_username ? `<p class="small muted" style="margin:12px 0 0">Бот: <a href="https://t.me/${esc(s.bot_username)}" target="_blank" rel="noopener">@${esc(s.bot_username)}</a></p>` : ''}
    </div>

    <div class="section-title">Практика с ботом</div>
    <a class="card row" href="#/topics" style="min-height:0">
      <div class="row-main"><div class="row-title">📚 Темы для практики</div><div class="row-sub">Сценарии и слова для разговоров с ботом</div></div>
      <div class="row-end">${icon('chevronR')}</div></a>

    <div class="section-title">Уведомления</div>
    <div class="card" style="padding-top:4px;padding-bottom:4px">
      <div class="switch-row"><div><b>Присылать мне разборы</b><small>После каждого разговора ученика — копия разбора с оценкой</small></div>
        <label class="switch"><input type="checkbox" data-setting="notify_feedback" ${s.notify_feedback ? 'checked' : ''}><span></span></label></div>
      <div class="switch-row"><div><b>Напоминать ученикам</b><small>Бот пишет ученику, когда открывается занятие</small></div>
        <label class="switch"><input type="checkbox" data-setting="notify_lesson_open" ${s.notify_lesson_open ? 'checked' : ''}><span></span></label></div>
    </div>

    <div class="section-title">Бот</div>
    <form class="card" id="f-settings">
      <div class="grid-2">
        <label class="field"><span>Лимит сообщений в день</span><input class="input" type="number" name="daily_limit" min="1" max="1000" value="${s.daily_limit}"><small>на одного ученика</small></label>
        <label class="field"><span>Цель по умолчанию</span><input class="input" type="number" name="default_min_messages" min="1" max="200" value="${s.default_min_messages}"><small>сообщений на занятие</small></label>
      </div>
      <label class="field"><span>Язык объяснений в разборе</span><select class="input" name="feedback_language">
        ${[['Russian', 'Русский'], ['Ukrainian', 'Українська'], ['English', 'English']]
          .map(([v, l]) => `<option value="${v}" ${s.feedback_language === v ? 'selected' : ''}>${l}</option>`)
          .join('')}
      </select></label>
      <button class="btn block" type="submit">Сохранить</button>
    </form>

    ${
      standalone
        ? ''
        : `<div class="section-title">Приложение на телефоне</div>
    <div class="card">
      ${
        installPrompt
          ? `<button class="btn block" data-action="install">📲 Установить на главный экран</button>`
          : ios
            ? `<p style="margin:0">На iPhone: нажми <b>«Поделиться»</b> ${icon('share').replace('<svg', '<svg style="display:inline;width:16px;height:16px;vertical-align:-2px"')} внизу Safari → <b>«На экран „Домой“»</b>.</p>`
            : `<p style="margin:0">На Android: меню браузера <b>⋮</b> → <b>«Добавить на главный экран»</b> или <b>«Установить приложение»</b>.</p>`
      }
      <p class="small muted" style="margin:10px 0 0">Панель откроется как обычное приложение — без адресной строки.</p>
    </div>`
    }

    <button class="btn ghost block mt" data-action="logout" style="margin-top:24px">Выйти</button>`;

  const v = $('#view');
  v.onclick = async (e) => {
    const a = e.target.closest('[data-action]')?.dataset.action;
    try {
      if (a === 'connect') {
        const { link } = await api('/settings/teacher-link', { method: 'POST' });
        const { el } = sheet(
          'Подключить Telegram',
          `<p style="margin-top:0">Открой ссылку на телефоне, где установлен твой Telegram, и нажми <b>«Старт»</b>.</p>
          <div class="invite-link" style="background:var(--surface)">${esc(link)}</div>
          <div class="btn-row"><a class="btn" href="${esc(link)}" target="_blank" rel="noopener">${icon('telegram')} Открыть в Telegram</a>
          <button class="btn secondary" data-copy>${icon('copy')} Копировать</button></div>
          <button class="btn ghost block mt" data-close>Готово</button>`,
        );
        $('[data-copy]', el).onclick = () => copyText(link);
        el.addEventListener('click', (ev) => ev.target.closest('[data-close]') && render());
      } else if (a === 'disconnect') {
        if (!confirm('Отключить уведомления в Telegram?')) return;
        await api('/settings/teacher', { method: 'DELETE' });
        render();
      } else if (a === 'install' && installPrompt) {
        installPrompt.prompt();
        installPrompt = null;
      } else if (a === 'logout') {
        await api('/logout', { method: 'POST' });
        renderLogin();
      }
    } catch (err) {
      if (!(err instanceof AuthError)) toast(err.message);
    }
  };
  $$('[data-setting]').forEach(
    (inp) =>
      (inp.onchange = async () => {
        try {
          await api('/settings', { method: 'PATCH', body: { [inp.dataset.setting]: inp.checked } });
          toast('Сохранено ✓');
        } catch (err) {
          if (!(err instanceof AuthError)) toast(err.message);
        }
      }),
  );
  onSubmit($('#f-settings'), async (f) => {
    await api('/settings', {
      method: 'PATCH',
      body: { daily_limit: Number(f.daily_limit), default_min_messages: Number(f.default_min_messages), feedback_language: f.feedback_language },
    });
    cache.settings = null;
    toast('Сохранено ✓');
  });
}

// ───────── Старт ─────────
$$('[data-icon]').forEach((el) => (el.outerHTML = icon(el.dataset.icon)));
window.addEventListener('hashchange', render);
if ('serviceWorker' in navigator) navigator.serviceWorker.register('/sw.js').catch(() => {});
render();
