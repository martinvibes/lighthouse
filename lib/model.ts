import type { Candle } from "./bitget";
import { etHour, type DarkWindow } from "./time";

export type Calibration = {
  generated_utc: string;
  universe: string[];
  universe_dropped_stale: string[];
  n_windows: { overnight: number; weekend: number };
  span: [string, string];
  edges: number[];
  lambda: Record<string, [number, number]>;
  band_bps: Record<string, number | null>;
  beta: Record<string, number>;
  /** Walk-forward record. `n_windows` is every closed window; `n_scored` excludes
   *  the warm-up windows that only ever trained, so it is what the ledger covers. */
  validation: Record<string, { n_windows: number; n_scored: number; from: string; to: string }>;
  overshoot: Record<string, { median_quote_move_bps: number; median_realised_bps: number; ratio: number }>;
  weekend_gap: { n: number; median_bps: number; p90_bps: number; share_over_200bps: number };
};

export type Ledger = {
  summary: {
    n_rows: number;
    by_horizon: Record<string, {
      n: number; lighthouse_medae: number; venue_medae: number; last_close_medae: number;
      lighthouse_vs_lastclose_pct: number; lighthouse_beats_venue_share: number;
    }>;
  };
  per_symbol: {
    symbol: string; ticker: string; n: number; lighthouse: number; venue: number;
    last_close: number; vs_lastclose_pct: number; beat_venue_share: number;
    median_realised_bps: number;
  }[];
};

export const median = (a: number[]) => {
  if (!a.length) return 0;
  const s = [...a].sort((x, y) => x - y);
  const m = s.length >> 1;
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
};

export const bps = (v: number) => v * 1e4;

export function bucketOf(cal: Calibration, elapsed: number): number {
  const E = cal.edges;
  for (let i = 0; i < E.length - 1; i++) if (elapsed >= E[i] && elapsed < E[i + 1]) return i;
  return E.length - 2;
}

/** Close of the 19:00 ET bar at or before the window start = the 20:00 ET session close. */
export function anchorClose(cs: Candle[], win: DarkWindow): number | null {
  let anchor: number | null = null;
  for (const c of cs) {
    const d = new Date(c.t);
    if (d <= win.start && etHour(d) === 19) anchor = c.c;
  }
  return anchor;
}

export type Row = {
  symbol: string; ticker: string;
  anchor: number; quote: number; quoteRet: number;
  fair: number; fairRet: number; devBps: number;
  wide: boolean; beta: number; volume: number;
};

export function priceBoard(
  raw: { symbol: string; anchor: number; quote: number; volume: number }[],
  cal: Calibration,
  elapsed: number
): { rows: Row[]; factor: number; lam: [number, number]; band: number | null } {
  const b = bucketOf(cal, elapsed);
  const lam = cal.lambda[String(b)] ?? [0, 0];
  const band = cal.band_bps[String(b)] ?? null;
  const rets = raw.map((r) => r.quote / r.anchor - 1);
  const factor = median(rets);

  const rows: Row[] = raw.map((r) => {
    const quoteRet = r.quote / r.anchor - 1;
    const beta = cal.beta[r.symbol] ?? 1;
    const common = beta * factor;
    const idio = quoteRet - common;
    const fairRet = lam[0] * common + lam[1] * idio;
    const fair = r.anchor * (1 + fairRet);
    const devBps = bps((r.quote - fair) / fair);
    return {
      symbol: r.symbol,
      ticker: r.symbol.replace(/^R/, "").replace(/USDT$/, ""),
      anchor: r.anchor, quote: r.quote, quoteRet,
      fair, fairRet, devBps,
      wide: band !== null && Math.abs(devBps) > band,
      beta, volume: r.volume,
    };
  });
  rows.sort((a, b2) => Math.abs(b2.devBps) - Math.abs(a.devBps));
  return { rows, factor, lam: lam as [number, number], band };
}
