// Разбор постоянного графика из текста «как в заметках».
// Используется и в панели (живой предпросмотр), и на сервере (при сохранении).
//
// Формат:
//   Понедельник              ← день недели (можно Пн, Понеділок, с двоеточием)
//   10:00 Мария 350          ← урок: время, имя, цена
//   10:00-11:30 Мария 500    ← урок с временем окончания
//   11:00                    ← свободное окно
//   9:00 — 12:00             ← занято / нерабочее время
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
    const endRaw = m[3] ? normTime(m[3], m[4]) : null;
    if (!start || (m[3] && !endRaw)) {
      errors.push({ line, text: raw, message: 'Неверное время' });
      return;
    }
    const rest = m[5].trim();

    if (!rest) {
      if (endRaw) {
        if (toMinutes(endRaw) <= toMinutes(start)) {
          errors.push({ line, text: raw, message: 'Конец должен быть позже начала' });
          return;
        }
        items.push({ day, start, end: endRaw, kind: 'busy', line });
      } else {
        items.push({ day, start, end: fromMinutes(toMinutes(start) + defaultMinutes), kind: 'free', line });
      }
      return;
    }

    const p = rest.match(/^(.*?)[\s,]+(\d{1,6})\s*(?:грн\.?|₴|uah)?$/i);
    if (!p || !p[1].trim()) {
      errors.push({ line, text: raw, message: 'Укажи имя и цену, например «10:00 Мария 350»' });
      return;
    }
    const end = endRaw ?? fromMinutes(toMinutes(start) + defaultMinutes);
    if (toMinutes(end) <= toMinutes(start)) {
      errors.push({ line, text: raw, message: 'Конец должен быть позже начала' });
      return;
    }
    items.push({ day, start, end, kind: 'lesson', name: p[1].trim().replace(/[,;:]+$/, ''), price: Number(p[2]), line });
  });

  items.sort((a, b) => a.day - b.day || toMinutes(a.start) - toMinutes(b.start));
  return { items, errors };
}
