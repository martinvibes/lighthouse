"use client";
import { useCallback, useEffect, useMemo, useState } from "react";
import { candles, pool, tickers, type Candle } from "@/lib/bitget";
import { anchorClose, priceBoard, type Calibration, type Ledger, type Row } from "@/lib/model";
import { darkWindow, fmtET, type DarkWindow } from "@/lib/time";
import NightBand from "@/components/NightBand";
import Board from "@/components/Board";
import Instrument from "@/components/Instrument";
import Record from "@/components/Record";
import Ask from "@/components/Ask";

const BOARD_SIZE = 24;

export default function Page() {
  const [cal, setCal] = useState<Calibration | null>(null);
  const [led, setLed] = useState<Ledger | null>(null);
  const [win, setWin] = useState<DarkWindow | null>(null);
  const [rows, setRows] = useState<Row[]>([]);
  const [factor, setFactor] = useState(0);
  const [lam, setLam] = useState<[number, number]>([0, 0]);
  const [band, setBand] = useState<number | null>(null);
  const [sel, setSel] = useState<string | null>(null);
  const [selCandles, setSelCandles] = useState<Candle[]>([]);
  const [err, setErr] = useState<string | null>(null);
  const [updated, setUpdated] = useState<Date | null>(null);

  // Static evidence first, so the record renders even if the venue is unreachable.
  useEffect(() => {
    Promise.all([
      fetch("/calibration.json").then((r) => r.json()),
      fetch("/ledger.json").then((r) => r.json()).catch(() => null),
    ]).then(([c, l]) => { setCal(c); setLed(l); });
  }, []);

  const refresh = useCallback(async (c: Calibration) => {
    const w = darkWindow(new Date());
    setWin(w);
    const universe = c.universe.slice(0, BOARD_SIZE);
    const ts = await tickers();
    const px: Record<string, { last: number; vol: number }> = {};
    for (const t of ts) px[t.symbol] = { last: +t.lastPr, vol: +t.usdtVolume };

    const raw = (await pool(universe, 6, async (sym) => {
      const cs = await candles(sym, "1h", 72);
      const anchor = anchorClose(cs, w);
      if (!anchor) return null;
      let quote = px[sym]?.last;
      if (!w.active) {
        // Window has closed: replay its final quote rather than showing a live session price.
        let last: number | null = null;
        for (const k of cs) if (new Date(k.t) <= w.end) last = k.c;
        quote = last ?? quote;
      }
      if (!quote) return null;
      return { symbol: sym, anchor, quote, volume: px[sym]?.vol ?? 0 };
    })).filter(Boolean) as { symbol: string; anchor: number; quote: number; volume: number }[];

    if (!raw.length) { setErr("No quotes returned for this window."); return; }
    const out = priceBoard(raw, c, w.elapsed);
    setRows(out.rows); setFactor(out.factor); setLam(out.lam); setBand(out.band);
    setUpdated(new Date());
    setErr(null);
    setSel((s) => s ?? out.rows[0]?.symbol ?? null);
  }, []);

  useEffect(() => {
    if (!cal) return;
    refresh(cal).catch(() => setErr("Couldn't reach Bitget. The measured record below is unaffected."));
    const id = setInterval(() => refresh(cal).catch(() => {}), 60_000);
    return () => clearInterval(id);
  }, [cal, refresh]);

  useEffect(() => {
    if (!sel) return;
    candles(sel, "1h", 96).then(setSelCandles).catch(() => setSelCandles([]));
  }, [sel]);

  const selRow = useMemo(() => rows.find((r) => r.symbol === sel) ?? null, [rows, sel]);

  const buildState = useCallback(() => {
    if (!cal || !win) return "";
    const top = rows.slice(0, 12).map((r) =>
      `${r.ticker}: close ${r.anchor.toFixed(2)}, venue quote ${r.quote.toFixed(2)} (${(r.quoteRet * 1e4).toFixed(0)} bps), ` +
      `fair value ${r.fair.toFixed(2)}, quote minus fair ${r.devBps.toFixed(0)} bps, ${r.wide ? "OUTSIDE" : "inside"} the band`
    ).join("\n");
    const H = led?.summary.by_horizon ?? {};
    const g = cal.weekend_gap;
    return `DESK STATE (all figures measured; do not invent others)
Window: ${win.kind}, ${win.active ? "currently dark" : "closed, replaying"}, ${(win.elapsed * 100).toFixed(0)}% elapsed.
Shrinkage in force: ${lam[0].toFixed(2)} on the common move, ${lam[1].toFixed(2)} on the name-specific move.
Calibrated typical error at this hour: ${band ?? "n/a"} bps.
Weekend repricing: median ${g.median_bps.toFixed(0)} bps, p90 ${g.p90_bps.toFixed(0)} bps, ${(g.share_over_200bps * 100).toFixed(0)}% exceed 200 bps.
Walk-forward median abs error vs the 04:00 ET reopen:
${Object.entries(H).map(([k, v]) => `  ${Math.round(+k * 100)}% into window: assume-close-held ${v.last_close_medae.toFixed(1)} bps, venue quote ${v.venue_medae.toFixed(1)} bps, Lighthouse ${v.lighthouse_medae.toFixed(1)} bps`).join("\n")}

BOARD
${top}`;
  }, [cal, win, rows, lam, band, led]);

  return (
    <div className="wrap">
      <header className="mast">
        <div className="markrow">
          <svg width="34" height="34" viewBox="0 0 34 34" aria-hidden="true">
            <path d="M17 4 L17 30" stroke="var(--line)" strokeWidth="1" />
            <circle cx="17" cy="11" r="5" fill="var(--lamp)" />
            <path d="M17 11 L33 3 L33 19 Z" fill="var(--lamp)" opacity=".2" />
            <path d="M17 11 L1 3 L1 19 Z" fill="var(--lamp)" opacity=".2" />
            <path d="M11 30 L23 30 L21 22 L13 22 Z" fill="none" stroke="var(--text)" strokeWidth="1.4" />
          </svg>
          <h1 className="serif">Lighthouse</h1>
          <span className="eyebrow">Dark-hours desk</span>
        </div>
        <p className="thesis">
          Tokenized US equities keep quoting after NYSE and Nasdaq go dark. Bitget says plainly that those
          prices are <b>indicative quotes, not transaction prices</b>. This desk measures how much of
          tonight&apos;s quote will still be true at the reopen — and marks the names where it won&apos;t.
        </p>
        <div className="chips">
          {win ? (
            win.active ? (
              <span className="chip live"><span className="dot" />
                Market dark · {((+win.end - +win.asOf) / 3600e3).toFixed(1)}h to reopen</span>
            ) : (
              <span className="chip"><span className="dot" />US venues open — replaying the last dark window</span>
            )
          ) : (<span className="chip"><span className="dot" />Connecting to Bitget…</span>)}
          {win && <span className="chip">{win.kind === "weekend" ? "Weekend window" : "Overnight window"} ·{" "}
            {fmtET(win.start, { weekday: "short", hour: "2-digit", minute: "2-digit" })} →{" "}
            {fmtET(win.end, { weekday: "short", hour: "2-digit", minute: "2-digit" })} ET</span>}
          {cal && <span className="chip">Calibrated on {cal.n_windows.overnight} overnight + {cal.n_windows.weekend} weekend windows</span>}
          {led && <span className="chip">{led.summary.n_rows.toLocaleString()} graded forecasts</span>}
          {updated && <span className="chip">Updated {fmtET(updated, { hour: "2-digit", minute: "2-digit" })} ET</span>}
        </div>
        {err && <div className="chip" style={{ borderColor: "var(--clay)", color: "var(--clay)" }}>{err}</div>}
      </header>

      {cal && win && <NightBand cal={cal} win={win} lam={lam} band={band} />}

      <Board rows={rows} selected={sel} onSelect={setSel} factor={factor} lam={lam} band={band}
        live={!!win?.active} />

      {selRow && win && <Instrument row={selRow} candles={selCandles} win={win} band={band} />}

      <Ask buildState={buildState} />

      {cal && <Record cal={cal} led={led} />}

      <footer>
        <span>Lighthouse · Bitget AI Base Camp Hackathon S2 · AI Trading Desk</span>
        <span><a href="https://github.com/martinvibes/lighthouse">github.com/martinvibes/lighthouse</a></span>
      </footer>
    </div>
  );
}
