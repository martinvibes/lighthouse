"use client";
import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { useDesk } from "@/lib/desk";
import { curveFor, exceedProb } from "@/lib/risk";

type Leg = { symbol: string; qty: number };
const usd = (v: number) => v.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });

const rise = (d: number) => ({
  initial: { opacity: 0, y: 12 }, animate: { opacity: 1, y: 0 },
  transition: { delay: d, duration: 0.5, ease: "easeOut" as const },
});

export default function Collateral() {
  const { rows, tails, horizon, cal } = useDesk();
  const [legs, setLegs] = useState<Leg[]>([]);
  const [debt, setDebt] = useState(50_000);
  const [haircut, setHaircut] = useState(0.95);

  // Open on a real book, not an empty form: the three deepest names on the board.
  useEffect(() => {
    if (legs.length || rows.length < 3) return;
    const deep = [...rows].sort((a, b) => b.volume - a.volume).slice(0, 3);
    setLegs(deep.map((r) => ({ symbol: r.symbol, qty: Math.max(1, Math.round(33_000 / r.quote)) })));
  }, [rows, legs.length]);

  const book = useMemo(() => legs.map((l) => {
    const r = rows.find((x) => x.symbol === l.symbol);
    return r ? { ...l, ticker: r.ticker, venue: l.qty * r.quote, fair: l.qty * r.fair } : null;
  }).filter(Boolean) as { symbol: string; ticker: string; qty: number; venue: number; fair: number }[], [legs, rows]);

  const V = book.reduce((s, b) => s + b.venue, 0);
  const F = book.reduce((s, b) => s + b.fair, 0);
  const liq = debt / haircut;
  const roomVenue = V > 0 ? ((V - liq) / V) * 1e4 : 0;
  const roomReal = F > 0 ? ((F - liq) / F) * 1e4 : 0;

  // Per-name measured error tails, blended by position size. Correlation is ignored,
  // which makes this a floor on the real probability rather than a ceiling.
  const pCross = useMemo(() => {
    if (!tails || !book.length) return null;
    const grid = tails.grid.map(() => 0);
    let w = 0;
    for (const b of book) {
      const c = curveFor(tails, b.symbol, horizon);
      if (!c) continue;
      for (let i = 0; i < grid.length; i++) grid[i] += c[i] * b.fair;
      w += b.fair;
    }
    if (w <= 0) return null;
    return roomReal > 0 ? exceedProb(tails, grid.map((g) => g / w), roomReal) / 2 : 0.5;
  }, [tails, book, horizon, roomReal]);

  const sev = pCross === null ? "var(--color-faint)"
    : pCross > 0.1 ? "var(--color-danger)" : pCross > 0.03 ? "var(--color-amber)" : "var(--color-mint)";
  const set = (i: number, patch: Partial<Leg>) => setLegs((ls) => ls.map((l, j) => (j === i ? { ...l, ...patch } : l)));

  return (
    <main className="relative min-h-screen px-4 md:px-6 py-7 max-w-[1320px] mx-auto z-10">
      <motion.header {...rise(0)} className="max-w-[640px]">
        <h1 className="text-[26px] font-semibold tracking-[-0.02em] leading-none">Collateral</h1>
        <p className="text-[14px] text-[var(--color-muted)] mt-3 leading-relaxed">
          rTokens are collateral at up to 95%. All night they are marked at a price nobody traded on.
          Enter what you hold and see how much room you really have.
        </p>
      </motion.header>

      <section className="grid grid-cols-1 lg:grid-cols-12 gap-4 mt-6">
        <motion.div {...rise(0.06)} className="lg:col-span-7 glass overflow-hidden">
          <div className="flex items-center gap-3 px-5 py-3.5 border-b border-[var(--color-line)]">
            <span className="text-[14px] font-semibold">What you hold</span>
            <span className="flex-1" />
            <button onClick={() => rows[0] && setLegs((l) => [...l, { symbol: rows[0].symbol, qty: 100 }])}
                    className="label rounded-full px-3 py-1.5 hairline hover:bg-white/[0.05] transition-colors">
              + add
            </button>
          </div>

          <div className="px-5 py-2">
            {book.map((b, i) => (
              <div key={i} className="flex items-center gap-3 py-2.5 border-b border-[var(--color-line)] last:border-0">
                <select value={b.symbol} onChange={(e) => set(i, { symbol: e.target.value })}
                        className="hairline rounded-lg px-2.5 py-1.5 text-[13px] outline-none w-[104px]"
                        style={{ background: "rgba(255,255,255,0.03)", color: "var(--color-fg)" }}>
                  {rows.map((r) => <option key={r.symbol} value={r.symbol} style={{ background: "#0f1014" }}>r{r.ticker}</option>)}
                </select>
                <input type="number" value={b.qty} min={0}
                       onChange={(e) => set(i, { qty: Math.max(0, +e.target.value) })}
                       className="tnum hairline rounded-lg px-2.5 py-1.5 text-[13px] w-[86px] text-right outline-none focus:border-[var(--color-mint)]"
                       style={{ background: "rgba(255,255,255,0.03)", color: "var(--color-fg)" }} />
                <span className="label">shares</span>
                <span className="flex-1" />
                <span className="tnum text-[13.5px]">{usd(b.venue)}</span>
                <button onClick={() => setLegs((l) => l.filter((_, j) => j !== i))}
                        className="label hover:text-[var(--color-danger)] transition-colors ml-1">×</button>
              </div>
            ))}
            {!book.length && <div className="label py-10 text-center">reading the board…</div>}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 px-5 py-5 border-t border-[var(--color-line)]">
            <label className="flex flex-col gap-2">
              <span className="label">borrowed against it</span>
              <input type="number" value={debt} min={0} step={5000}
                     onChange={(e) => setDebt(Math.max(0, +e.target.value))}
                     className="tnum hairline rounded-xl px-3.5 py-2.5 text-[15px] outline-none focus:border-[var(--color-mint)]"
                     style={{ background: "rgba(255,255,255,0.03)", color: "var(--color-fg)" }} />
            </label>
            <label className="flex flex-col gap-2">
              <span className="label">haircut · {(haircut * 100).toFixed(0)}%</span>
              <input type="range" min={50} max={95} value={haircut * 100}
                     onChange={(e) => setHaircut(+e.target.value / 100)} className="mandate-slider mt-3.5"
                     style={{
                       ["--thumb" as string]: "var(--color-mint)",
                       background: `linear-gradient(90deg, var(--color-mint) ${((haircut * 100 - 50) / 45) * 100}%, rgba(140,150,165,0.2) ${((haircut * 100 - 50) / 45) * 100}%)`,
                     }} />
            </label>
          </div>
        </motion.div>

        <motion.div {...rise(0.12)} className="lg:col-span-5 glass overflow-hidden flex flex-col">
          <div className="px-5 py-5">
            <div className="label">chance the open takes you out</div>
            <div className="tnum text-[58px] leading-none mt-2" style={{ color: sev }}>
              {pCross === null ? "—" : `${(pCross * 100).toFixed(1)}%`}
            </div>
            <p className="text-[12.5px] text-[var(--color-muted)] mt-3 leading-relaxed">
              How often the 04:00 open has landed further from fair value than your cushion — counted on these
              exact names, not modelled.
            </p>
          </div>

          <div className="grid grid-cols-2 border-t border-[var(--color-line)]">
            <div className="px-5 py-4">
              <div className="label">venue says</div>
              <div className="tnum text-[22px] mt-1.5">{V ? `${roomVenue.toFixed(0)}` : "—"}</div>
              <div className="label mt-0.5">bps of room</div>
            </div>
            <div className="px-5 py-4 border-l border-[var(--color-line)]">
              <div className="label">actually</div>
              <div className="tnum text-[22px] mt-1.5" style={{ color: "var(--color-amber)" }}>
                {F ? `${roomReal.toFixed(0)}` : "—"}
              </div>
              <div className="label mt-0.5">bps of room</div>
            </div>
          </div>

          <div className="px-5 py-4 border-t border-[var(--color-line)] mt-auto">
            <p className="text-[13px] leading-relaxed">
              {!book.length ? "Add a holding to see it." : (
                <>
                  The venue values this book at{" "}
                  <span className="tnum text-[var(--color-fg)]">{usd(V)}</span>; we make it{" "}
                  <span className="tnum" style={{ color: "var(--color-mint)" }}>{usd(F)}</span>.
                  {Math.abs(V - F) > 1 && (
                    <> That is <span className="tnum" style={{ color: V > F ? "var(--color-danger)" : "var(--color-mint)" }}>
                      {usd(Math.abs(V - F))}</span> of collateral {V > F ? "you may not have" : "you are not being credited"}.</>
                  )}
                </>
              )}
            </p>
          </div>
        </motion.div>
      </section>

      <motion.p {...rise(0.18)} className="text-[12px] text-[var(--color-faint)] leading-relaxed mt-5 max-w-[760px]">
        Collateral = mark × haircut; liquidation when it stops covering the debt. Correlation between holdings
        is ignored, so the figure is a floor. Bitget&apos;s own maintenance rules govern your real account.
        {cal && ` Weekends are the sharp end: ${(cal.weekend_gap.share_over_200bps * 100).toFixed(0)}% of them reprice by more than 200 bps before anyone can trade out.`}
      </motion.p>
    </main>
  );
}
