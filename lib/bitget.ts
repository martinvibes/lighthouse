/** Public Bitget spot endpoints. No key, no account, no signing. */
const BASE = "https://api.bitget.com";

export type Ticker = {
  symbol: string; lastPr: string; usdtVolume: string; change24h: string;
  high24h: string; low24h: string; open: string;
};
export type Candle = { t: number; o: number; h: number; l: number; c: number; v: number };

async function get<T>(path: string, params: Record<string, string | number> = {}): Promise<T> {
  const qs = new URLSearchParams(Object.entries(params).map(([k, v]) => [k, String(v)]));
  const url = `${BASE}${path}${qs.toString() ? `?${qs}` : ""}`;
  const r = await fetch(url, { cache: "no-store" });
  if (!r.ok) throw new Error(`bitget ${r.status}`);
  const d = await r.json();
  if (d.code !== "00000") throw new Error(d.msg || "bitget error");
  return d.data as T;
}

export const tickers = () => get<Ticker[]>("/api/v2/spot/market/tickers");

export async function candles(symbol: string, granularity = "1h", limit = 200): Promise<Candle[]> {
  const rows = await get<string[][]>("/api/v2/spot/market/candles", { symbol, granularity, limit });
  return rows.map((r) => ({
    t: +r[0], o: +r[1], h: +r[2], l: +r[3], c: +r[4], v: +r[5],
  }));
}

/** Bounded-concurrency map; one slow symbol must not stall the board. */
export async function pool<T, R>(items: T[], n: number, fn: (x: T) => Promise<R>): Promise<(R | null)[]> {
  const out: (R | null)[] = new Array(items.length).fill(null);
  let i = 0;
  await Promise.all(
    Array.from({ length: Math.min(n, items.length) }, async () => {
      while (i < items.length) {
        const k = i++;
        try { out[k] = await fn(items[k]); } catch { out[k] = null; }
      }
    })
  );
  return out;
}
