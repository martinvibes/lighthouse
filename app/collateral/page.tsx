"use client";
import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { useDesk } from "@/lib/desk";
import { curveFor, exceedProb } from "@/lib/risk";

type Leg = { symbol: string; qty: number };
const usd = (v: number) => v.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });

export default function Collateral() {
  const { rows, tails, horizon, band, win, cal, led } = useDesk();
  const [legs, setLegs] = useState<Leg[]>([]);
  const [debt, setDebt] = useState(50_000);
  const [haircut, setHaircut] = useState(0.95);

  // Open on a realistic book rather than an empty form: the three deepest names on the board.
  useEffect(() => {
    if (legs.length || rows.length < 3) return;
    const deep = [...rows].sort((a, b) => b.volume - a.volume).slice(0, 3);
    setLegs(deep.map((r) => ({ symbol: r.symbol, qty: Math.max(1, Math.round(30_000 / r.quote)) })));
  }, [rows, legs.length]);

  const book = useMemo(() => legs.map((l) => {
    const r = rows.find((x) => x.symbol === l.symbol);
    return r ? { ...l, venue: l.qty * r.quote, fair: l.qty * r.fair } : null;
  }).filter(Boolean) as { symbol: string; qty: number; venue: number; fair: number }[], [legs, rows]);

  const V = book.reduce((s, b) => s + b.venue, 0);
  const F = book.reduce((s, b) => s + b.fair, 0);
  const mirageBps = F > 0 ? ((V - F) / F) * 1e4 : 0;
  const liqValue = debt / haircut;              // mark at which collateral stops covering the debt
  const distVenue = V > 0 ? ((V - liqValue) / V) * 1e4 : 0;
  const distFair = F > 0 ? ((F - liqValue) / F) * 1e4 : 0;
  const mrVenue = debt > 0 ? (V * haircut) / debt : Infinity;
  const mrFair = debt > 0 ? (F * haircut) / debt : Infinity;

  // Blend the per-name measured error tails by position weight. Correlation between names is ignored,
  // which makes the probability below a floor rather than a ceiling.
  const blended = useMemo(() => {
    if (!tails || !book.length) return null;
    const grid = tails.grid.map(() => 0);
    let w = 0;
    for (const b of book) {
      const c = curveFor(tails, b.symbol, horizon);
      if (!c) continue;
      for (let i = 0; i < grid.length; i++) grid[i] += c[i] * b.fair;
      w += b.fair;
    }
    return w > 0 ? grid.map((g) => g / w) : null;
  }, [tails, book, horizon]);

  const pCross = !blended || !tails ? null : distFair > 0 ? exceedProb(tails, blended, distFair) / 2 : 0.5;
  const sev = pCross === null ? "ok" : pCross > 0.1 ? "bad" : pCross > 0.03 ? "warn" : "ok";
  const sevColor = sev === "bad" ? "var(--color-danger)" : sev === "warn" ? "var(--color-amber)" : "var(--color-mint)";
  const set = (i: number, patch: Partial<Leg>) => setLegs((ls) => ls.map((l, j) => (j === i ? { ...l, ...patch } : l)));
  const rich = Math.abs(mirageBps) > (band ?? 30);

  return (
    <main className="relative min-h-screen px-4 md:px-6 py-8 max-w-[1480px] mx-auto z-10">
      <div className="grid-atmos fixed inset-0 -z-10 opacity-25" />

      <motion.header initial={{ opacity: 0, y: -14 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.55 }}>
        <div className="label mb-4">the money question</div>
        <h1 className="display text-[clamp(32px,5.4vw,56px)] leading-[1.02] max-w-[19ch]">
          Your margin is marked on a price{" "}
          <span className="italic" style={{ color: "var(--color-mint)" }}>nobody traded on.</span>
        </h1>
        <p className="text-[15px] text-[var(--color-muted)] leading-relaxed mt-5 max-w-[640px]">
          Bitget accepts rTokens as collateral in the unified account at up to 95%. Between 20:00 and 04:00 ET
          no US venue is quoting, so the mark on your book is the indicative price — and we have measured, across{" "}
          {led ? led.summary.n_rows.toLocaleString() : "20,934"} graded forecasts, how far that quote tends to sit
          from where the market actually reopens. This is what that gap does to your liquidation distance.
        </p>
      </motion.header>

      <section className="grid grid-cols-1 lg:grid-cols-12 gap-4 mt-8">
        {/* ── the book ── */}
        <motion.div initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.08, duration: 0.5 }}
                    className="lg:col-span-7 glass overflow-hidden flex flex-col">
          <div className="flex items-center gap-3 px-5 py-3.5 border-b border-[var(--color-line)]">
            <span className="text-[14px] font-semibold">Your book</span>
            <span className="flex-1" />
            <button
              onClick={() => rows[0] && setLegs((l) => [...l, { symbol: rows[0].symbol, qty: 100 }])}
              className="label rounded-full px-3 py-1.5 hairline hover:bg-white/[0.04] transition-colors"
            >+ add a leg</button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-[13px]">
              <thead>
                <tr className="border-b border-[var(--color-line)]">
                  {["holding", "quantity", "at the venue mark", "at fair value", ""].map((h, i) => (
                    <th key={h + i} className={`label py-2.5 px-3 ${i ? "text-right" : "text-left"}`}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {book.map((b, i) => (
                  <tr key={i} className="border-b border-[var(--color-line)] last:border-0">
                    <td className="py-2.5 px-3">
                      <select
                        value={b.symbol} onChange={(e) => set(i, { symbol: e.target.value })}
                        className="hairline rounded-lg px-2.5 py-1.5 text-[12.5px] outline-none"
                        style={{ background: "rgba(255,255,255,0.03)", color: "var(--color-fg)" }}
                      >
                        {rows.map((r) => <option key={r.symbol} value={r.symbol} style={{ background: "#0f1014" }}>r{r.ticker}</option>)}
                      </select>
                    </td>
                    <td className="py-2.5 px-3 text-right">
                      <input
                        type="number" value={b.qty} min={0}
                        onChange={(e) => set(i, { qty: Math.max(0, +e.target.value) })}
                        className="tnum hairline rounded-lg px-2.5 py-1.5 text-[12.5px] w-[92px] text-right outline-none focus:border-[var(--color-mint)]"
                        style={{ background: "rgba(255,255,255,0.03)", color: "var(--color-fg)" }}
                      />
                    </td>
                    <td className="tnum py-2.5 px-3 text-right">{usd(b.venue)}</td>
                    <td className="tnum py-2.5 px-3 text-right" style={{ color: "var(--color-cyan)" }}>{usd(b.fair)}</td>
                    <td className="py-2.5 px-3 text-right">
                      <button onClick={() => setLegs((l) => l.filter((_, j) => j !== i))}
                              className="label hover:text-[var(--color-danger)] transition-colors">remove</button>
                    </td>
                  </tr>
                ))}
                {!book.length && <tr><td colSpan={5} className="label py-10 text-center">waiting for the board…</td></tr>}
              </tbody>
              <tfoot>
                <tr className="border-t border-[var(--color-line)]">
                  <td className="label py-3 px-3">total</td><td />
                  <td className="tnum py-3 px-3 text-right text-[15px]">{usd(V)}</td>
                  <td className="tnum py-3 px-3 text-right text-[15px]" style={{ color: "var(--color-cyan)" }}>{usd(F)}</td>
                  <td />
                </tr>
              </tfoot>
            </table>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 px-5 py-5 border-t border-[var(--color-line)]">
            <label className="flex flex-col gap-2">
              <span className="label">borrowed against it · usdt</span>
              <input
                type="number" value={debt} min={0} step={1000}
                onChange={(e) => setDebt(Math.max(0, +e.target.value))}
                className="tnum hairline rounded-xl px-3.5 py-2.5 text-[15px] outline-none focus:border-[var(--color-mint)]"
                style={{ background: "rgba(255,255,255,0.03)", color: "var(--color-fg)" }}
              />
            </label>
            <label className="flex flex-col gap-2">
              <span className="label">collateral haircut · {(haircut * 100).toFixed(0)}%</span>
              <input
                type="range" min={50} max={95} value={haircut * 100}
                onChange={(e) => setHaircut(+e.target.value / 100)}
                className="mandate-slider mt-3"
                style={{
                  ["--thumb" as string]: "var(--color-mint)",
                  background: `linear-gradient(90deg, var(--color-mint) ${((haircut * 100 - 50) / 45) * 100}%, rgba(255,255,255,0.08) ${((haircut * 100 - 50) / 45) * 100}%)`,
                }}
              />
            </label>
          </div>
        </motion.div>

        {/* ── the mirage ── */}
        <motion.div initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.14, duration: 0.5 }}
                    className="lg:col-span-5 glass overflow-hidden">
          <div className="flex items-center gap-3 px-5 py-3.5 border-b border-[var(--color-line)]">
            <span className="text-[14px] font-semibold">The mirage</span>
            <span className="flex-1" />
            <span className="label rounded-full px-2.5 py-1" style={{ color: sevColor, background: "rgba(255,255,255,0.04)" }}>
              {sev === "bad" ? "exposed" : sev === "warn" ? "thin" : "comfortable"}
            </span>
          </div>

          <div className="px-5 py-5 flex flex-col gap-5">
            <div>
              <div className="label">chance the 04:00 reopen takes you through liquidation</div>
              <div className="tnum text-[54px] leading-none mt-2"
                   style={{ color: sevColor, textShadow: `0 0 30px ${sevColor}55` }}>
                {pCross === null ? "—" : `${(pCross * 100).toFixed(1)}%`}
              </div>
              <p className="text-[11.5px] text-[var(--color-muted)] mt-2 leading-relaxed">
                Read off the measured error distribution for the names you actually hold, at{" "}
                {win ? `${(win.elapsed * 100).toFixed(0)}%` : "this point"} through the window. Not a volatility
                model — a count of how often we have been that wrong before.
              </p>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <Split title="venue shows you" value={usd(V * haircut)}
                     rows={[["margin ratio", mrVenue === Infinity ? "∞" : `${mrVenue.toFixed(2)}×`],
                            ["room to liq.", `${distVenue.toFixed(0)} bps`]]} />
              <Split title="history honours" value={usd(F * haircut)} c="var(--color-cyan)"
                     rows={[["margin ratio", mrFair === Infinity ? "∞" : `${mrFair.toFixed(2)}×`],
                            ["room to liq.", `${distFair.toFixed(0)} bps`]]} />
            </div>

            <div className="rounded-xl px-4 py-3.5" style={{
              background: rich ? "rgba(255,93,108,0.07)" : "rgba(255,255,255,0.02)",
              border: `1px solid ${rich ? "rgba(255,93,108,0.28)" : "var(--color-line)"}`,
            }}>
              <div className="label mb-1.5">the verdict</div>
              <p className="text-[13px] leading-relaxed">
                {!book.length ? "Add a holding to see it." : (
                  <>
                    Your book is marked{" "}
                    <span className="tnum font-semibold" style={{ color: mirageBps >= 0 ? "var(--color-danger)" : "var(--color-mint)" }}>
                      {Math.abs(mirageBps).toFixed(0)} bps {mirageBps >= 0 ? "richer" : "cheaper"}
                    </span>{" "}
                    than fair value — {usd(Math.abs(V - F))} of{" "}
                    {mirageBps >= 0 ? "collateral you may not actually have" : "collateral the venue is not crediting you"}.
                    {debt > 0 && <> The venue says there is {distVenue.toFixed(0)} bps of room before liquidation;
                      measured against where these names have historically reopened, it is {distFair.toFixed(0)} bps.</>}
                    {" "}This is not a trade instruction and not an order you can place. It is the size of the gap
                    between an indicative mark and a transaction price.
                  </>
                )}
              </p>
            </div>
          </div>

          <div className="px-5 py-3 border-t border-[var(--color-line)] text-[11px] text-[var(--color-faint)] leading-relaxed">
            Simplified unified-account arithmetic: collateral = mark × haircut, liquidation when collateral stops
            covering the debt. Correlation between holdings is ignored, making the figure a floor. Bitget&apos;s own
            maintenance rules govern your real account.
          </div>
        </motion.div>
      </section>

      {cal && (
        <motion.section initial={{ opacity: 0, y: 14 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}
                        transition={{ duration: 0.5 }} className="glass mt-4 overflow-hidden">
          <div className="px-5 py-3.5 border-b border-[var(--color-line)]">
            <span className="text-[14px] font-semibold">Why the weekend is the dangerous one</span>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 px-5 py-6">
            <Big v={`${cal.weekend_gap.median_bps.toFixed(0)} bps`} k="median friday close → monday open" />
            <Big v={`${cal.weekend_gap.p90_bps.toFixed(0)} bps`} k="at the 90th percentile" c="var(--color-amber)" />
            <Big v={`${(cal.weekend_gap.share_over_200bps * 100).toFixed(0)}%`} k="of weekends reprice past 200 bps" c="var(--color-danger)" />
          </div>
          <div className="px-5 py-3 border-t border-[var(--color-line)] text-[11.5px] text-[var(--color-muted)]">
            Measured across {cal.weekend_gap.n} weekend windows. A 95% haircut leaves 5% of room, and roughly one
            weekend in five moves more than 2% before anyone can trade out of it.
          </div>
        </motion.section>
      )}
    </main>
  );
}

const Split = ({ title, value, rows, c }: { title: string; value: string; rows: [string, string][]; c?: string }) => (
  <div className="panel px-3.5 py-3.5">
    <div className="label">{title}</div>
    <div className="tnum text-[20px] mt-1.5" style={c ? { color: c } : undefined}>{value}</div>
    <div className="flex flex-col gap-1 mt-3">
      {rows.map(([k, v]) => (
        <div key={k} className="flex justify-between items-baseline">
          <span className="label">{k}</span><span className="tnum text-[11.5px]">{v}</span>
        </div>
      ))}
    </div>
  </div>
);

const Big = ({ v, k, c }: { v: string; k: string; c?: string }) => (
  <div className="panel px-4 py-4">
    <div className="tnum text-[30px] leading-none" style={c ? { color: c } : undefined}>{v}</div>
    <div className="text-[12px] text-[var(--color-muted)] mt-2">{k}</div>
  </div>
);
