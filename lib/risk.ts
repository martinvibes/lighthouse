/** Empirical error tails, measured — not assumed normal. */
export type Tails = {
  grid: number[];
  by_horizon: Record<string, { n: number; tail: number[] }>;
  by_kind: Record<string, { n: number; tail: number[] }>;
  by_symbol: Record<string, { n: number; tail: number[]; p50: number; p90: number }>;
};

/** P(|reopen - fair| > x bps), linearly interpolated between measured grid points. */
export function exceedProb(t: Tails, curve: number[], xBps: number): number {
  const g = t.grid;
  if (xBps <= g[0]) return curve[0];
  for (let i = 1; i < g.length; i++) {
    if (xBps <= g[i]) {
      const w = (xBps - g[i - 1]) / (g[i] - g[i - 1]);
      return curve[i - 1] + w * (curve[i] - curve[i - 1]);
    }
  }
  // Beyond the measured grid we report the floor rather than extrapolating a tail we never saw.
  return curve[curve.length - 1];
}

export function curveFor(t: Tails | null, symbol: string | null, horizon: string): number[] | null {
  if (!t) return null;
  if (symbol && t.by_symbol[symbol]) return t.by_symbol[symbol].tail;
  return t.by_horizon[horizon]?.tail ?? t.by_kind.overnight?.tail ?? null;
}

export const horizonKey = (elapsed: number) =>
  ["0.25", "0.50", "0.75", "0.90"].reduce((best, k) =>
    Math.abs(+k - elapsed) < Math.abs(+best - elapsed) ? k : best, "0.25");
