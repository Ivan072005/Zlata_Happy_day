// Панель преподавателя. Без сборки и зависимостей: обычный JS.

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
  [/^#\/students$/, pageStudents, 'students'],
  [/^#\/students\/(\d+)$/, pageStudent, 'students'],
  [/^#\/sessions\/(\d+)$/, pageSession, 'students'],
  [/^#\/topics$/, pageTopics, 'topics'],
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
    <div class="row-end">${statusBadge(l.status)}<span>${l.status === 'upcoming' ? '' : `${l.messages}/${l.min_messages}`}${l.score != null ? ` · ${l.score}/10` : ''}</span></div>
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

  html += `<div class="section-title">Сейчас открыто</div>`;
  html += d.open.length
    ? `<div class="list">${d.open.map((l) => lessonRow(l)).join('')}</div>`
    : `<div class="card empty"><div class="emoji">☕️</div>Сейчас нет открытых занятий</div>`;

  if (d.upcoming.length) {
    html += `<div class="section-title">Скоро</div><div class="list">${d.upcoming.map((l) => lessonRow(l)).join('')}</div>`;
  }
  if (d.recent_lessons.length) {
    html += `<div class="section-title">Недавно закончились</div><div class="list">${d.recent_lessons.map((l) => lessonRow(l)).join('')}</div>`;
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
  $$('#view [data-lesson]').forEach((el) => (el.onclick = () => (location.hash = `#/students/${el.dataset.student}`)));
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
      <div class="row-end"><span class="badge accent">${s.level}</span>${s.avg_score != null ? `<span>⌀ ${s.avg_score}</span>` : ''}</div></a>`;
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
  setFab('Занятие', () => openLessonForm(s));

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
          ${s.archived ? '<span class="badge red">в архиве</span>' : ''}</div>
        </div>
      </div>
      ${s.note ? `<div class="note">${esc(s.note)}</div>` : ''}
      ${inviteBlock(s)}
    </div>

    <div class="section-title">Статистика</div>
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

    <div class="section-title">Текущие и будущие занятия <button class="link-btn" data-action="add-lesson">+ Назначить</button></div>
    ${
      current.length
        ? `<div class="list">${current.map((l) => lessonRow(l, { showStudent: false })).join('')}</div>`
        : `<div class="card empty"><div class="emoji">📅</div>Нет запланированных занятий.<br>Пока занятие не назначено, ${s.free_practice ? 'ученик может только свободно практиковаться' : 'ученик не может общаться с ботом'}.</div>`
    }

    ${past.length ? `<div class="section-title">Прошедшие занятия</div><div class="list">${past.map((l) => lessonRow(l, { showStudent: false })).join('')}</div>` : ''}

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
async function openLessonForm(student, lesson = null) {
  const [topics, settings] = await Promise.all([getTopics(), getSettings()]);
  const active = topics.filter((t) => t.active || t.id === lesson?.topic_id);
  const now = Date.now();
  const roundUp = (ts) => Math.ceil(ts / (5 * 60000)) * 5 * 60000;
  const start = lesson ? lesson.opens_at : roundUp(now);
  const end = lesson ? lesson.closes_at : start + 3600000;

  const { el, close } = sheet(
    lesson ? 'Изменить занятие' : `Занятие для ${student.name}`,
    `<form id="f-lesson">
      <label class="field"><span>Тема</span><select class="input" name="topic_id">
        ${active.map((t) => `<option value="${t.id}" ${t.id === lesson?.topic_id ? 'selected' : ''}>${esc(t.title)}</option>`).join('')}
        <option value="" ${lesson && !lesson.topic_id ? 'selected' : ''}>💬 Свободная тема</option>
      </select><small>Свои темы можно добавить во вкладке «Темы»</small></label>

      <label class="field"><span>Уровень общения</span><select class="input" name="level">
        ${levelOptions(lesson?.level, `<option value="" ${!lesson?.level ? 'selected' : ''}>Как у ученика (${student.level})</option>`)}
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
      student_id: student.id,
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

function openLessonDetails(student, l, sessions) {
  const pct = Math.min(100, Math.round((l.messages / l.min_messages) * 100));
  const conv = sessions.filter((x) => x.lesson_id === l.id);
  const { el, close } = sheet(
    l.topic_title ?? 'Свободная тема',
    `<div class="card">
      <div style="display:flex;justify-content:space-between;align-items:center;gap:8px">${statusBadge(l.status)}<span class="small muted">${l.level ?? student.level}</span></div>
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
    if (a === 'edit') {
      close();
      openLessonForm(student, l);
    }
    if (a === 'delete' && confirm('Удалить занятие?')) {
      await api(`/lessons/${l.id}`, { method: 'DELETE' });
      close();
      toast('Занятие удалено');
      render();
    }
  });
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
