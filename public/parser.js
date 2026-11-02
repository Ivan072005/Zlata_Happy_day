// Разбор постоянного графика из текста «как в заметках».
// Используется и в панели (живой предпросмотр), и на сервере (при сохранении).
//
// Формат:
//   Понедельник              ← день недели (можно Пн, Понеділок, с двоеточием)
//   10:00 Мария 350          ← урок: время, имя, цена
//   15:00 — 16:00 Иван 600   ← урок на два слота (15:00 и 16:00), то есть 15:00–17:00
//   11:00                    ← свободное окно
//   9:00 — 12:00             ← свободные слоты 9, 10, 11, 12 (до 13:00)
//   9:00 — 12:00 занято      ← занято / нерабочее время (слова: занято, перерыв, выходной, нерабочее)
//   17:00 Ева 350 отмена     ← урок отменён (не считается)
// Время — это начало часового слота, поэтому промежуток «А — Б» длится до Б + 1 час.
// Пустые строки, заголовки и значки в начале строки (|, -, •, >) игнорируются.

const DAYS = [
  ['понедельник', 'пн', 'понеділок', 'monday', 'mon'],
  ['вторник', 'вт', 'вівторок', 'tuesday', 'tue'],
  ['среда', 'ср', 'середа', 'wednesday', 'wed'],
  ['четверг', 'чт', 'четвер', 'thursday', 'thu'],
  ['пятница', 'пт', "п'ятниця", 'пʼятниця', 'пятниця', 'friday', 'fri'],
  ['суббота', 'сб', 'субота', 'saturday', 'sat'],
  ['воскресенье', 'вс', 'нд', 'неділя', 'sunday', 'sun'],
];
export const DAY_NAMES = ['Понедельник', 'Вторник', 'Среда', 'Четверг', 'Пятница', 'Суббота', 'Воскресенье'];

const TIME = '(\\d{1,2})[:.](\\d{2})';
const RANGE_SEP = '\\s*[-–—]\\s*';

function normTime(h, m) {
  const hh = Number(h), mm = Number(m);
  if (hh > 23 || mm > 59) return null;
  return `${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}`;
}

export const toMinutes = (t) => Number(t.slice(0, 2)) * 60 + Number(t.slice(3, 5));
export const fromMinutes = (m) => `${String(Math.floor(m / 60) % 24).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;

/** @returns {{ items: Array<{day:number,start:string,end:string,kind:'lesson'|'free'|'busy',name?:string,price?:number,line:number}>, errors: Array<{line:number,text:string,message:string}> }} */
export function parseSchedule(text, defaultMinutes = 60) {
  const items = [];
  const errors = [];
  let day = -1;
  const lines = String(text ?? '').split(/\r?\n/);

  lines.forEach((raw, i) => {
    const line = i + 1;
    const s = raw.replace(/^[\s|>•*·-]+/, '').replace(/\s+/g, ' ').trim();
    if (!s) return;

    const dayKey = s.toLowerCase().replace(/[:.]$/, '').trim();
    const dayIdx = DAYS.findIndex((names) => names.includes(dayKey));
    if (dayIdx >= 0) {
      day = dayIdx;
      return;
    }

    const m = s.match(new RegExp(`^${TIME}(?:${RANGE_SEP}${TIME})?\\s*(.*)$`));
    if (!m) {
      // Заголовок вроде «Постоянный график» — пропускаем, если ещё не начались дни
      if (day < 0) return;
      errors.push({ line, text: raw, message: 'Строка должна начинаться со времени, например «10:00 Мария 350»' });
      return;
    }
    if (day < 0) {
      errors.push({ line, text: raw, message: 'Сначала укажи день недели, например «Понедельник»' });
      return;
    }

    const start = normTime(m[1], m[2]);
    const lastSlot = m[3] ? normTime(m[3], m[4]) : null;
    // «15:00 — 16:00» = слоты 15:00 и 16:00 → конец в 17:00
    const endRaw = lastSlot ? fromMinutes(Math.min(toMinutes(lastSlot) + defaultMinutes, 24 * 60 - 1)) : null;
    if (!start || (m[3] && !lastSlot)) {
      errors.push({ line, text: raw, message: 'Неверное время' });
      return;
    }
    const rest = m[5].trim();
    const busy = /^(занято|занята|перерыв|выходной|нерабочее|не работаю|busy|off)\b/i.test(rest);

    if (!rest || busy) {
      const end = endRaw ?? fromMinutes(toMinutes(start) + defaultMinutes);
      if (lastSlot && toMinutes(lastSlot) < toMinutes(start)) {
        errors.push({ line, text: raw, message: 'Конец должен быть позже начала' });
        return;
      }
      items.push({ day, start, end, kind: busy ? 'busy' : 'free', line });
      return;
    }

    const p = rest.match(/^(.*?)[\s,]+(\d{1,6})\s*(?:грн\.?|₴|uah)?(?:\s*[-—,]?\s*(отмена|отменен[оа]?|отменили|отменён|cancel(?:led)?|❌))?$/i);
    if (!p || !p[1].trim()) {
      errors.push({ line, text: raw, message: 'Укажи имя и цену, например «10:00 Мария 350»' });
      return;
    }
    const end = endRaw ?? fromMinutes(toMinutes(start) + defaultMinutes);
    if (lastSlot && toMinutes(lastSlot) < toMinutes(start)) {
      errors.push({ line, text: raw, message: 'Конец должен быть позже начала' });
      return;
    }
    items.push({ day, start, end, kind: 'lesson', name: p[1].trim().replace(/[,;:]+$/, ''), price: Number(p[2]), cancelled: !!p[3], line });
  });

  items.sort((a, b) => a.day - b.day || toMinutes(a.start) - toMinutes(b.start));
  return { items, errors };
}

/** Строка графика из полей (обратная операция к разбору). */
export function formatLine(it, defaultMinutes = 60) {
  const dur = toMinutes(it.end) - toMinutes(it.start);
  const range = dur > defaultMinutes ? ` — ${fromMinutes(toMinutes(it.end) - defaultMinutes)}` : '';
  if (it.kind === 'lesson') return `${it.start}${range} ${it.name} ${it.price}${it.cancelled ? ' отмена' : ''}`;
  if (it.kind === 'busy') return `${it.start}${range} занято`;
  return `${it.start}${range}`;
}

/** Номер дня недели (0 = пн) для строки-заголовка или -1. */
export function dayIndex(line) {
  const key = String(line).replace(/^[\s|>•*·-]+/, '').trim().toLowerCase().replace(/[:.]$/, '').trim();
  return DAYS.findIndex((names) => names.includes(key));
}
