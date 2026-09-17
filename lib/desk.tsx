"use client";
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { candles, pool, tickers, type Candle } from "@/lib/bitget";
import { anchorClose, priceBoard, type Calibration, type Ledger, type Row } from "@/lib/model";
import { darkWindow, type DarkWindow } from "@/lib/time";
import { horizonKey, type Tails } from "@/lib/risk";

type Desk = {
  cal: Calibration | null;
  led: Ledger | null;
  tails: Tails | null;
  win: DarkWindow | null;
  rows: Row[];
  meta: Record<string, { change24h: number; volume: number; high: number; low: number }>;
  factor: number;
  lam: [number, number];
  band: number | null;
  horizon: string;
  sel: string | null;
  setSel: (s: string) => void;
  candles: Candle[];
  updated: Date | null;
  err: string | null;
  loading: boolean;
};

const Ctx = createContext<Desk | null>(null);
export const useDesk = () => {
  const v = useContext(Ctx);
  if (!v) throw new Error("useDesk outside provider");
  return v;
};

export function DeskProvider({ children }: { children: React.ReactNode }) {
  const [cal, setCal] = useState<Calibration | null>(null);
  const [led, setLed] = useState<Ledger | null>(null);
  const [tails, setTails] = useState<Tails | null>(null);
  const [win, setWin] = useState<DarkWindow | null>(null);
  const [rows, setRows] = useState<Row[]>([]);
  const [meta, setMeta] = useState<Desk["meta"]>({});
  const [factor, setFactor] = useState(0);
  const [lam, setLam] = useState<[number, number]>([0, 0]);
  const [band, setBand] = useState<number | null>(null);
  const [sel, setSel] = useState<string | null>(null);
  const [cs, setCs] = useState<Candle[]>([]);
  const [updated, setUpdated] = useState<Date | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const seeded = useRef(false);

  useEffect(() => {
    Promise.all([
      fetch("/calibration.json").then((r) => r.json()),
      fetch("/ledger.json").then((r) => r.json()).catch(() => null),
      fetch("/tails.json").then((r) => r.json()).catch(() => null),
    ]).then(([c, l, t]) => { setCal(c); setLed(l); setTails(t); });
  }, []);

  const refresh = useCallback(async (c: Calibration) => {
    const w = darkWindow(new Date());
    setWin(w);
    const ts = await tickers();
    const px: Record<string, { last: number; vol: number; chg: number; hi: number; lo: number }> = {};
    for (const t of ts) {
      px[t.symbol] = {
        last: +t.lastPr, vol: +t.usdtVolume, chg: +t.change24h,
        hi: +t.high24h || 0,
        lo: +t.low24h || 0,
      };
    }
    const raw = (await pool(c.universe, 8, async (sym) => {
      const ks = await candles(sym, "1h", 72);
      const anchor = anchorClose(ks, w);
      if (!anchor) return null;
      let quote = px[sym]?.last;
      if (!w.active) {
        // Window closed: replay its final quote rather than showing a live session price.
        let last: number | null = null;
        for (const k of ks) if (new Date(k.t) <= w.end) last = k.c;
        quote = last ?? quote;
      }
      if (!quote) return null;
      return { symbol: sym, anchor, quote, volume: px[sym]?.vol ?? 0 };
    })).filter(Boolean) as { symbol: string; anchor: number; quote: number; volume: number }[];

    if (!raw.length) throw new Error("no quotes");
    const out = priceBoard(raw, c, w.elapsed);
    setRows(out.rows);
    setMeta(Object.fromEntries(raw.map((r) => [r.symbol, {
      change24h: px[r.symbol]?.chg ?? 0, volume: px[r.symbol]?.vol ?? 0,
      high: px[r.symbol]?.hi ?? 0, low: px[r.symbol]?.lo ?? 0,
    }])));
    setFactor(out.factor); setLam(out.lam); setBand(out.band);
    setUpdated(new Date()); setErr(null); setLoading(false);
    if (!seeded.current && out.rows.length) { seeded.current = true; setSel(out.rows[0].symbol); }
  }, []);

  useEffect(() => {
    if (!cal) return;
    const run = () => refresh(cal).catch(() => {
      setLoading(false);
      setErr("Bitget did not answer. The measured record is unaffected.");
    });
    run();
    const id = setInterval(run, 45_000);
    return () => clearInterval(id);
  }, [cal, refresh]);

  useEffect(() => {
    if (!sel) return;
    let live = true;
    candles(sel, "1h", 120).then((k) => { if (live) setCs(k); }).catch(() => { if (live) setCs([]); });
    return () => { live = false; };
  }, [sel]);

  const value = useMemo<Desk>(() => ({
    cal, led, tails, win, rows, meta, factor, lam, band,
    horizon: horizonKey(win?.elapsed ?? 0.5),
    sel, setSel, candles: cs, updated, err, loading,
  }), [cal, led, tails, win, rows, meta, factor, lam, band, sel, cs, updated, err, loading]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}
