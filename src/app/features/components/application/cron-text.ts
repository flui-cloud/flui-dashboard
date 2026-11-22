const MINUTE = 60_000;

const MACROS: Record<string, string> = {
  '@yearly': '0 0 1 1 *',
  '@annually': '0 0 1 1 *',
  '@monthly': '0 0 1 * *',
  '@weekly': '0 0 * * 0',
  '@daily': '0 0 * * *',
  '@midnight': '0 0 * * *',
  '@hourly': '0 * * * *',
};

const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const SHORT_DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

const NAMES: Record<string, number> = {
  ...Object.fromEntries(SHORT_DAYS.map((d, i) => [d.toLowerCase(), i])),
  ...Object.fromEntries(MONTHS.map((m, i) => [m.toLowerCase(), i + 1])),
};

interface CronFields {
  min: Set<number>;
  hour: Set<number>;
  dom: Set<number>;
  mon: Set<number>;
  dow: Set<number>;
  domAny: boolean;
  dowAny: boolean;
}

const pad = (n: number) => String(n).padStart(2, '0');
const isNum = (v: string) => /^\d+$/.test(v);

function valueOf(text: string): number {
  return NAMES[text] ?? (isNum(text) ? Number(text) : Number.NaN);
}

function bounds(range: string, stepped: boolean, lo: number, hi: number): [number, number] {
  if (range === '*') return [lo, hi];
  const [a, b] = range.split('-');
  const from = valueOf(a);
  if (b !== undefined) return [from, valueOf(b)];
  return [from, stepped ? hi : from];
}

function withinBounds(from: number, to: number, lo: number, hi: number): boolean {
  return Number.isInteger(from) && Number.isInteger(to) && from >= lo && to <= hi && from <= to;
}

function field(text: string, lo: number, hi: number): Set<number> | null {
  const out = new Set<number>();
  for (const part of text.toLowerCase().split(',')) {
    const [range, stepText] = part.split('/');
    const step = stepText === undefined ? 1 : Number(stepText);
    if (!Number.isInteger(step) || step < 1) return null;
    const [from, to] = bounds(range, stepText !== undefined, lo, hi);
    if (!withinBounds(from, to, lo, hi)) return null;
    for (let v = from; v <= to; v += step) out.add(v);
  }
  return out;
}

function split(expr: string): string[] | null {
  const trimmed = expr.trim();
  const parts = (MACROS[trimmed.toLowerCase()] ?? trimmed).split(/\s+/);
  return parts.length === 5 ? parts : null;
}

function parse(expr: string): CronFields | null {
  const parts = split(expr);
  if (!parts) return null;
  const [min, hour, dom, mon, dow] = parts;
  const fields = {
    min: field(min, 0, 59),
    hour: field(hour, 0, 23),
    dom: field(dom, 1, 31),
    mon: field(mon, 1, 12),
    dow: field(dow, 0, 7),
  };
  if (!fields.min || !fields.hour || !fields.dom || !fields.mon || !fields.dow) return null;
  const dowSet = new Set([...fields.dow].map((d) => d % 7));
  return {
    min: fields.min,
    hour: fields.hour,
    dom: fields.dom,
    mon: fields.mon,
    dow: dowSet,
    domAny: dom.startsWith('*'),
    dowAny: dow.startsWith('*'),
  };
}

const every = (v: string) => /^\*\/\d+$/.exec(v) && Number(v.slice(2));
const allAny = (parts: string[]) => parts.every((p) => p === '*');

function describeSubDaily(min: string, hour: string, rest: string[]): string | null {
  const restAny = allAny(rest);
  if (min === '*' && hour === '*' && restAny) return 'Every minute';
  if (every(min) && hour === '*' && restAny) return `Every ${every(min)} minutes`;
  if (!isNum(min)) return 'Custom schedule';
  if (!restAny) return null;
  if (hour === '*') return `Hourly at :${pad(+min)}`;
  if (every(hour)) return `Every ${every(hour)} hours at :${pad(+min)}`;
  return null;
}

function describeWeekly(dow: string, at: string): string | null {
  if (dow === '*') return `Daily at ${at}`;
  if (dow === '1-5') return `Weekdays at ${at}`;
  const day = valueOf(dow.toLowerCase());
  return Number.isInteger(day) && day <= 7 ? `${DAYS[day % 7]}s at ${at}` : null;
}

function describeMonthly(dom: string, mon: string, at: string): string | null {
  if (mon === '*') return `Monthly on day ${+dom} at ${at}`;
  const month = valueOf(mon.toLowerCase());
  return Number.isInteger(month) ? `Yearly on ${+dom} ${MONTHS[month - 1]} at ${at}` : null;
}

export function describeCron(expr: string | null | undefined): string {
  const parts = expr ? split(expr) : null;
  if (!parts || !parse(expr!)) return 'Custom schedule';
  const [min, hour, dom, mon, dow] = parts;
  const subDaily = describeSubDaily(min, hour, [dom, mon, dow]);
  if (subDaily) return subDaily;
  if (!isNum(hour)) return 'Custom schedule';
  const at = `${pad(+hour)}:${pad(+min)}`;
  const weekly = dom === '*' && mon === '*' ? describeWeekly(dow, at) : null;
  if (weekly) return weekly;
  if (isNum(dom) && dow === '*') return describeMonthly(dom, mon, at) ?? 'Custom schedule';
  return 'Custom schedule';
}

interface WallClock {
  min: number;
  hour: number;
  dom: number;
  mon: number;
  dow: number;
}

function wallClock(format: Intl.DateTimeFormat, at: number): WallClock {
  const parts = format.formatToParts(new Date(at));
  const get = (type: Intl.DateTimeFormatPartTypes) => parts.find((p) => p.type === type)?.value;
  return {
    min: Number(get('minute')),
    hour: Number(get('hour')) % 24,
    dom: Number(get('day')),
    mon: Number(get('month')),
    dow: SHORT_DAYS.indexOf(get('weekday') ?? ''),
  };
}

function dayMatches(f: CronFields, w: WallClock): boolean {
  const dom = f.dom.has(w.dom);
  const dow = f.dow.has(w.dow);
  if (!f.domAny && !f.dowAny) return dom || dow;
  return dom && dow;
}

export function nextCronRun(
  expr: string | null | undefined,
  timezone?: string | null,
  from = Date.now(),
): Date | null {
  const f = expr ? parse(expr) : null;
  if (!f) return null;
  let format: Intl.DateTimeFormat;
  try {
    format = new Intl.DateTimeFormat('en-US', {
      timeZone: timezone || 'UTC',
      hourCycle: 'h23',
      minute: 'numeric',
      hour: 'numeric',
      day: 'numeric',
      month: 'numeric',
      weekday: 'short',
    });
  } catch {
    return null;
  }
  let at = Math.floor(from / MINUTE) * MINUTE + MINUTE;
  for (let i = 0; i < 5000; i++) {
    const w = wallClock(format, at);
    if (!f.mon.has(w.mon) || !dayMatches(f, w)) {
      at += ((23 - w.hour) * 60 + (60 - w.min)) * MINUTE;
    } else if (!f.hour.has(w.hour)) {
      at += (60 - w.min) * MINUTE;
    } else if (!f.min.has(w.min)) {
      at += MINUTE;
    } else {
      return new Date(at);
    }
  }
  return null;
}
