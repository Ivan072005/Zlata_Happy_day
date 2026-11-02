// Работа со временем по Киеву (график преподавателя задан в киевском времени).

const TZ = 'Europe/Kyiv';
const DAY = 24 * 3600 * 1000;

const fmt = new Intl.DateTimeFormat('en-GB', {
  timeZone: TZ,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
  hourCycle: 'h23',
});

function parts(ms: number) {
  const p = Object.fromEntries(fmt.formatToParts(new Date(ms)).map((x) => [x.type, x.value]));
  return { y: +p.year, mo: +p.month, d: +p.day, h: +p.hour, mi: +p.minute, s: +p.second };
}

/** Смещение Киева от UTC в мс в заданный момент. */
function offset(ms: number): number {
  const p = parts(ms);
  return Date.UTC(p.y, p.mo - 1, p.d, p.h, p.mi, p.s) - (ms - (ms % 1000));
}

/** Киевские дата+время → момент в мс. */
export function kyivToMs(y: number, mo: number, d: number, h = 0, mi = 0): number {
  const guess = Date.UTC(y, mo - 1, d, h, mi);
  let t = guess - offset(guess);
  t = guess - offset(t); // поправка на переход летнее/зимнее время
  return t;
}

/** Ключ недели (понедельник по Киеву) для момента времени: 'YYYY-MM-DD'. */
export function weekKeyOf(ms: number): string {
  const p = parts(ms);
  const utc = Date.UTC(p.y, p.mo - 1, p.d);
  const dow = (new Date(utc).getUTCDay() + 6) % 7; // пн = 0
  return new Date(utc - dow * DAY).toISOString().slice(0, 10);
}

export function isWeekKey(s: unknown): s is string {
  return typeof s === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s) && new Date(`${s}T00:00:00Z`).getUTCDay() === 1;
}

/** Момент начала дня недели `day` (0 = пн) в неделе `week` в заданное киевское время 'HH:MM'. */
export function slotMs(week: string, day: number, time: string): number {
  const base = new Date(`${week}T00:00:00Z`).getTime() + day * DAY;
  const d = new Date(base);
  return kyivToMs(d.getUTCFullYear(), d.getUTCMonth() + 1, d.getUTCDate(), Number(time.slice(0, 2)), Number(time.slice(3, 5)));
}

export function addWeeks(week: string, n: number): string {
  return new Date(new Date(`${week}T00:00:00Z`).getTime() + n * 7 * DAY).toISOString().slice(0, 10);
}

/** Границы недели [начало, конец) в мс. */
export function weekRange(week: string): [number, number] {
  return [slotMs(week, 0, '00:00'), slotMs(addWeeks(week, 1), 0, '00:00')];
}

/** Конец текущего дня по Киеву (полночь следующего дня). */
export function endOfKyivDay(ms: number): number {
  const p = parts(ms);
  const next = new Date(Date.UTC(p.y, p.mo - 1, p.d + 1));
  return kyivToMs(next.getUTCFullYear(), next.getUTCMonth() + 1, next.getUTCDate());
}
