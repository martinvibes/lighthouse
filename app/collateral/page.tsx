"use client";
import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { useDesk } from "@/lib/desk";
import { curveFor, exceedProb } from "@/lib/risk";

type Leg = { symbol: string; qty: number };
const usd0 = (v: number) => v.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });

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

  const V = book.reduce((s, b) => s + b.venue, 0);   // what the screen says it's worth
  const F = book.reduce((s, b) => s + b.fair, 0);    // what the history says it's worth
  const floorAt = debt / haircut;                     // the value at which you get liquidated
  const cushionVenue = V - floorAt;
  const cushionReal = F - floorAt;
  const dropReal = F > 0 ? (cushionReal / F) * 1e4 : 0;

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
    return dropReal > 0 ? exceedProb(tails, grid.map((g) => g / w), dropReal) / 2 : 0.5;
  }, [tails, book, horizon, dropReal]);

  const sev = pCross === null ? "var(--color-faint)"
    : pCross > 0.1 ? "var(--color-danger)" : pCross > 0.03 ? "var(--color-amber)" : "var(--color-mint)";
  const set = (i: number, patch: Partial<Leg>) => setLegs((ls) => ls.map((l, j) => (j === i ? { ...l, ...patch } : l)));

  return (
    <main className="relative min-h-screen px-4 md:px-6 py-7 max-w-[1320px] mx-auto z-10">
      <motion.header {...rise(0)} className="max-w-[720px]">
        <h1 className="text-[26px] font-semibold tracking-[-0.02em] leading-none">Collateral</h1>
        <p className="text-[15px] mt-3 leading-relaxed">
          Bitget lends against rTokens at up to 95%. Between 20:00 and 04:00 it values them at a price no
          market set — so the cushion on your screen is an estimate, and you find out how good it was at
          the open.
        </p>
      </motion.header>

      <motion.ol {...rise(0.04)} className="grid grid-cols-1 sm:grid-cols-3 gap-3 mt-6">
        {[
          ["What the screen says", "Your holdings marked at tonight's indicative quote."],
          ["What we think", "The same holdings at the fair value the history supports."],
          ["What it costs you", "How much of your cushion is real, and the odds the open eats it."],
        ].map(([h, d], i) => (
          <li key={h} className="panel px-4 py-3.5 flex gap-3">
            <span className="tnum text-[13px] text-[var(--color-mint)] leading-[1.5]">{i + 1}</span>
            <span>
              <span className="block text-[13px] font-medium">{h}</span>
              <span className="block text-[12px] text-[var(--color-muted)] leading-relaxed mt-0.5">{d}</span>
            </span>
          </li>
        ))}
      </motion.ol>

      <section className="grid grid-cols-1 lg:grid-cols-12 gap-4 mt-4">
        <motion.div {...rise(0.08)} className="lg:col-span-7 glass overflow-hidden">
          <div className="flex items-center gap-3 px-5 py-3.5 border-b border-[var(--color-line)]">
            <span className="text-[14px] font-semibold">What you hold</span>
            <span className="label">edit it — the numbers follow</span>
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
                <span className="tnum text-[13.5px]">{usd0(b.venue)}</span>
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
              <span className="label">how much of it counts · {(haircut * 100).toFixed(0)}%</span>
              <input type="range" min={50} max={95} value={haircut * 100}
                     onChange={(e) => setHaircut(+e.target.value / 100)} className="mandate-slider mt-3.5"
                     style={{
                       ["--thumb" as string]: "var(--color-mint)",
                       background: `linear-gradient(90deg, var(--color-mint) ${((haircut * 100 - 50) / 45) * 100}%, rgba(140,150,165,0.2) ${((haircut * 100 - 50) / 45) * 100}%)`,
                     }} />
            </label>
          </div>

          <div className="px-5 py-3.5 border-t border-[var(--color-line)] text-[12.5px] text-[var(--color-muted)]">
            You get liquidated once this book is worth less than{" "}
            <span className="tnum text-[var(--color-fg)]">{usd0(floorAt)}</span>.
          </div>
        </motion.div>

        <motion.div {...rise(0.14)} className="lg:col-span-5 glass overflow-hidden flex flex-col">
          <div className="px-5 py-5">
            <div className="label">chance the 04:00 open takes you out</div>
            <div className="tnum text-[58px] leading-none mt-2" style={{ color: sev }}>
              {pCross === null ? "—" : `${(pCross * 100).toFixed(1)}%`}
            </div>
            <p className="text-[12.5px] text-[var(--color-muted)] mt-3 leading-relaxed">
              How often the open has landed further from fair value than your cushion — counted on these exact
              names across every graded night, not modelled.
            </p>
          </div>

          <div className="border-t border-[var(--color-line)]">
            <Line k="the screen says you can lose" v={V ? usd0(Math.max(0, cushionVenue)) : "—"} />
            <Line k="you can actually lose" v={F ? usd0(Math.max(0, cushionReal)) : "—"}
                  c={cushionReal < cushionVenue ? "var(--color-amber)" : "var(--color-mint)"} />
            <Line k="the difference" v={V && F ? usd0(Math.abs(cushionVenue - cushionReal)) : "—"}
                  c={cushionReal < cushionVenue ? "var(--color-danger)" : "var(--color-mint)"} />
          </div>

          <div className="px-5 py-4 border-t border-[var(--color-line)] mt-auto">
            <p className="text-[13px] leading-relaxed">
              {!book.length ? "Add a holding to see it." : cushionReal <= 0 ? (
                <>On our numbers this book is <span style={{ color: "var(--color-danger)" }}>already under water</span>;
                  the venue&apos;s mark is the only thing holding it up.</>
              ) : (
                <>The screen shows <span className="tnum text-[var(--color-fg)]">{usd0(Math.max(0, cushionVenue))}</span> of
                  room. We make it <span className="tnum" style={{ color: "var(--color-mint)" }}>{usd0(Math.max(0, cushionReal))}</span>
                  {Math.abs(cushionVenue - cushionReal) > 1 && (
                    <> — <span className="tnum" style={{ color: cushionReal < cushionVenue ? "var(--color-danger)" : "var(--color-mint)" }}>
                      {usd0(Math.abs(cushionVenue - cushionReal))}</span>{" "}
                      {cushionReal < cushionVenue ? "less than you think" : "more than you think"}</>
                  )}.
                </>
              )}
            </p>
          </div>
        </motion.div>
      </section>

      <motion.p {...rise(0.2)} className="text-[12px] text-[var(--color-faint)] leading-relaxed mt-5 max-w-[780px]">
        Liquidation price = what you borrowed ÷ how much of the collateral counts. Holdings are assumed to move
        independently, which they don&apos;t, so the probability is a floor rather than a ceiling. Bitget&apos;s own
        maintenance rules govern your real account.
        {cal && ` Weekends are the sharp end: ${(cal.weekend_gap.share_over_200bps * 100).toFixed(0)}% of them reprice by more than 200 bps with no way to trade out.`}
      </motion.p>
    </main>
  );
}

const Line = ({ k, v, c }: { k: string; v: string; c?: string }) => (
  <div className="flex items-baseline justify-between px-5 py-3 border-b border-[var(--color-line)] last:border-0">
    <span className="text-[12.5px] text-[var(--color-muted)]">{k}</span>
    <span className="tnum text-[17px]" style={c ? { color: c } : undefined}>{v}</span>
  </div>
);
