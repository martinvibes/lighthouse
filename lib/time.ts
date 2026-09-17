/**
 * US venues of every kind - regular session and extended hours - are shut
 * between 20:00 and 04:00 ET. That, and only that, is the dark window.
 * 16:00-20:00 and 04:00-09:30 are extended-hours sessions and are NOT dark;
 * treating them as dark roughly triples every error figure.
 */
export const ET = "America/New_York";

export type ETParts = { y: number; m: number; d: number; h: number; mi: number; wd: string };

const FMT = new Intl.DateTimeFormat("en-US", {
  timeZone: ET, hour12: false, year: "numeric", month: "2-digit",
  day: "2-digit", hour: "2-digit", minute: "2-digit", weekday: "short",
});

export function etParts(d: Date): ETParts {
  const o: Record<string, string> = {};
  for (const p of FMT.formatToParts(d)) o[p.type] = p.value;
  return { y: +o.year, m: +o.month, d: +o.day, h: +o.hour % 24, mi: +o.minute, wd: o.weekday };
}

export function etHour(d: Date): number {
  return etParts(d).h;
}

/** The UTC instant matching a given ET wall-clock hour. Converges through DST. */
export function etInstant(y: number, m: number, d: number, h: number): Date {
  let t = Date.UTC(y, m - 1, d, h);
  for (let i = 0; i < 4; i++) {
    const p = etParts(new Date(t));
    t += Date.UTC(y, m - 1, d, h, 0) - Date.UTC(p.y, p.m - 1, p.d, p.h, p.mi);
  }
  return new Date(t);
}

const WD = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function shiftDays(p: { y: number; m: number; d: number }, n: number) {
  const t = new Date(Date.UTC(p.y, p.m - 1, p.d) + n * 864e5);
  return { y: t.getUTCFullYear(), m: t.getUTCMonth() + 1, d: t.getUTCDate(), wd: WD[t.getUTCDay()] };
}

export type DarkWindow = {
  start: Date; end: Date; active: boolean;
  kind: "overnight" | "weekend"; asOf: Date; elapsed: number;
};

export function darkWindow(now: Date): DarkWindow {
  const p = etParts(now);
  let day = { y: p.y, m: p.m, d: p.d, wd: p.wd };
  if (p.h < 20) day = shiftDays(day, -1);
  while (day.wd === "Sat" || day.wd === "Sun") day = shiftDays(day, -1);
  const start = etInstant(day.y, day.m, day.d, 20);
  const weekend = day.wd === "Fri";
  const endDay = shiftDays(day, weekend ? 3 : 1);
  const end = etInstant(endDay.y, endDay.m, endDay.d, 4);
  const active = now >= start && now <= end;
  const asOf = active ? now : end;
  return {
    start, end, active, asOf,
    kind: weekend ? "weekend" : "overnight",
    elapsed: Math.max(0, Math.min(1, (+asOf - +start) / (+end - +start))),
  };
}

export const fmtET = (d: Date, opts: Intl.DateTimeFormatOptions = {}) =>
  new Intl.DateTimeFormat("en-US", { timeZone: ET, hour12: false, ...opts }).format(d);
