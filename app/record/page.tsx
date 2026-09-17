"use client";
import { useMemo, useState } from "react";
import { motion } from "framer-motion";
import { useDesk } from "@/lib/desk";

const HORIZONS: [string, string][] = [["0.25", "≈22:00 ET"], ["0.50", "≈00:00 ET"], ["0.75", "≈02:00 ET"], ["0.90", "≈03:10 ET"]];

export default function RecordPage() {
  const { cal, led } = useDesk();
  const [only, setOnly] = useState<"all" | "win" | "lose">("all");

  const per = useMemo(() => {
    const rows = led?.per_symbol ?? [];
    const f = only === "all" ? rows : rows.filter((r) => (only === "win" ? r.lighthouse < r.venue : r.lighthouse >= r.venue));
    return [...f].sort((a, b) => a.vs_lastclose_pct - b.vs_lastclose_pct);
  }, [led, only]);

  const H = led?.summary.by_horizon;

  return (
    <main className="relative min-h-screen px-4 md:px-6 py-8 max-w-[1480px] mx-auto z-10">
      <div className="grid-atmos fixed inset-0 -z-10 opacity-25" />

      <motion.header initial={{ opacity: 0, y: -14 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.55 }}>
        <div className="label mb-4">the receipts</div>
        <h1 className="display text-[clamp(32px,5.2vw,54px)] leading-[1.02] max-w-[19ch]">
          Every forecast, graded against{" "}
          <span className="italic" style={{ color: "var(--color-mint)" }}>what actually happened.</span>
        </h1>
        <p className="text-[15px] text-[var(--color-muted)] leading-relaxed mt-5 max-w-[640px]">
          Each row was produced by weights fitted only on windows that had already closed, then scored against
          the 04:00 ET reopen it never saw. The full ledger ships as a CSV so every number on this page can be
          recomputed from scratch.
        </p>
      </motion.header>

      <section className="grid grid-cols-2 lg:grid-cols-4 gap-3 mt-8">
        <Tile label="graded forecasts" v={led ? led.summary.n_rows.toLocaleString() : "—"} sub="walk-forward, never in-sample" d={0.04} />
        <Tile label="closed windows" v={cal ? String(cal.n_windows.overnight) : "—"}
              sub={cal ? `${cal.span[0].slice(0, 10)} → ${cal.span[1].slice(0, 10)}` : "…"} d={0.08} />
        <Tile label="names in the universe" v={cal ? String(cal.universe.length) : "—"}
              sub={cal ? `${cal.universe_dropped_stale.length} dropped for stale books` : "…"} d={0.12} />
        <Tile label="best improvement" v={H ? `${H["0.90"].lighthouse_vs_lastclose_pct.toFixed(0)}%` : "—"}
              sub="late-window error vs baseline" accent="var(--color-mint)" d={0.16} />
      </section>

      <motion.section initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.18, duration: 0.5 }}
                      className="glass mt-4 overflow-hidden">
        <div className="flex items-center gap-3 px-5 py-3.5 border-b border-[var(--color-line)]">
          <span className="text-[14px] font-semibold">Median absolute error against the reopen</span>
          <span className="flex-1" />
          <span className="label hidden sm:inline">basis points · lower is better</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-[13px]">
            <thead>
              <tr className="border-b border-[var(--color-line)]">
                {["into the dark window", "forecasts", "close held", "bitget's quote", "lighthouse", "vs baseline", "beats the venue"].map((h, i) => (
                  <th key={h} className={`label py-2.5 px-3 ${i ? "text-right" : "text-left"}`}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {H && HORIZONS.map(([k, when]) => {
                const v = H[k];
                if (!v) return null;
                return (
                  <tr key={k} className="border-b border-[var(--color-line)] last:border-0">
                    <td className="py-3 px-3"><span className="font-semibold">{Math.round(+k * 100)}%</span>
                      <span className="label ml-2">{when}</span></td>
                    <td className="tnum py-3 px-3 text-right text-[var(--color-faint)]">{v.n.toLocaleString()}</td>
                    <td className="tnum py-3 px-3 text-right text-[var(--color-muted)]">{v.last_close_medae.toFixed(1)}</td>
                    <td className="tnum py-3 px-3 text-right" style={{ color: "var(--color-cyan)" }}>{v.venue_medae.toFixed(1)}</td>
                    <td className="tnum py-3 px-3 text-right font-semibold" style={{ color: "var(--color-mint)" }}>{v.lighthouse_medae.toFixed(1)}</td>
                    <td className="tnum py-3 px-3 text-right" style={{ color: "var(--color-mint)" }}>{v.lighthouse_vs_lastclose_pct.toFixed(1)}%</td>
                    <td className="tnum py-3 px-3 text-right">{(v.lighthouse_beats_venue_share * 100).toFixed(1)}%</td>
                  </tr>
                );
              })}
              {!H && <tr><td colSpan={7} className="label py-10 text-center">loading the record…</td></tr>}
            </tbody>
          </table>
        </div>
        <div className="px-5 py-3.5 border-t border-[var(--color-line)] text-[12px] text-[var(--color-muted)] leading-relaxed">
          The first row is the finding that surprised us: two hours into the dark window Bitget&apos;s own quote is
          <span className="text-[var(--color-fg)] font-semibold"> worse</span> than assuming the close held
          {H ? ` (${H["0.25"].venue_medae.toFixed(1)} vs ${H["0.25"].last_close_medae.toFixed(1)} bps)` : ""}.
          The quote only starts carrying real information in the last stretch before the reopen.
        </div>
      </motion.section>

      <motion.section initial={{ opacity: 0, y: 14 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}
                      transition={{ duration: 0.5 }} className="glass mt-4 overflow-hidden">
        <div className="flex items-center gap-3 px-5 py-3.5 border-b border-[var(--color-line)] flex-wrap">
          <span className="text-[14px] font-semibold">Name by name</span>
          <span className="flex-1" />
          <div className="flex gap-1 rounded-full p-1 hairline" style={{ background: "rgba(255,255,255,0.025)" }}>
            {(["all", "win", "lose"] as const).map((k) => (
              <button key={k} onClick={() => setOnly(k)}
                      className="px-3 py-1 rounded-full text-[11.5px] transition-colors"
                      style={only === k ? { background: "var(--color-mint)", color: "#08080b", fontWeight: 600 } : { color: "var(--color-muted)" }}>
                {k === "all" ? "All" : k === "win" ? "We win" : "The venue wins"}
              </button>
            ))}
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-[13px]">
            <thead>
              <tr className="border-b border-[var(--color-line)]">
                {["name", "forecasts", "close held", "venue", "lighthouse", "vs baseline", "beat rate", "typical move"].map((h, i) => (
                  <th key={h} className={`label py-2.5 px-3 ${i ? "text-right" : "text-left"}`}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {per.map((r) => (
                <tr key={r.symbol} className="border-b border-[var(--color-line)] last:border-0 hover:bg-white/[0.02] transition-colors">
                  <td className="py-2.5 px-3 font-medium">{r.ticker}</td>
                  <td className="tnum py-2.5 px-3 text-right text-[var(--color-faint)]">{r.n}</td>
                  <td className="tnum py-2.5 px-3 text-right text-[var(--color-muted)]">{r.last_close.toFixed(1)}</td>
                  <td className="tnum py-2.5 px-3 text-right" style={{ color: "var(--color-cyan)" }}>{r.venue.toFixed(1)}</td>
                  <td className="tnum py-2.5 px-3 text-right" style={{ color: r.lighthouse < r.venue ? "var(--color-mint)" : "var(--color-fg)" }}>
                    {r.lighthouse.toFixed(1)}
                  </td>
                  <td className="tnum py-2.5 px-3 text-right" style={{ color: r.vs_lastclose_pct < 0 ? "var(--color-mint)" : "var(--color-danger)" }}>
                    {r.vs_lastclose_pct.toFixed(1)}%
                  </td>
                  <td className="tnum py-2.5 px-3 text-right">{(r.beat_venue_share * 100).toFixed(0)}%</td>
                  <td className="tnum py-2.5 px-3 text-right text-[var(--color-faint)]">{r.median_realised_bps.toFixed(0)} bps</td>
                </tr>
              ))}
              {!per.length && <tr><td colSpan={8} className="label py-10 text-center">loading…</td></tr>}
            </tbody>
          </table>
        </div>
        <div className="px-5 py-3.5 border-t border-[var(--color-line)] text-[12px] text-[var(--color-muted)] leading-relaxed">
          Published in both directions. LITE, MU and TQQQ are where the model earns its keep; JPM and EWZ are
          names where the venue&apos;s quote is simply better than ours, and we have not hidden them.
        </div>
      </motion.section>

      <motion.section initial={{ opacity: 0, y: 14 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}
                      transition={{ duration: 0.5 }} className="glass mt-4 px-5 py-6 flex items-center gap-6 flex-wrap">
        <div className="flex-1 min-w-[280px]">
          <div className="label mb-2">check it yourself</div>
          <p className="text-[14px] text-[var(--color-muted)] leading-relaxed max-w-[560px]">
            Every graded forecast with its anchor close, the venue quote at the time, our fair value, the
            realised reopen, and the shrinkage weights that were in force — one row each.
          </p>
        </div>
        <div className="flex gap-2.5 flex-wrap">
          <a href="/ledger.csv" download
             className="rounded-full px-5 py-2.5 text-[13.5px] font-semibold transition-transform hover:scale-[1.03] active:scale-95"
             style={{ background: "var(--color-mint)", color: "#08080b" }}>
            Download the ledger
          </a>
          <a href="/calibration.json" target="_blank" rel="noreferrer"
             className="rounded-full px-5 py-2.5 text-[13.5px] hairline hover:bg-white/[0.04] transition-colors">
            Frozen calibration
          </a>
        </div>
      </motion.section>
    </main>
  );
}

function Tile({ label, v, sub, accent, d = 0 }: { label: string; v: string; sub: string; accent?: string; d?: number }) {
  return (
    <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: d, duration: 0.5 }}
                className="glass px-5 py-4 flex flex-col justify-between min-h-[104px]">
      <div className="label">{label}</div>
      <div className="tnum text-[26px] mt-2 leading-none" style={accent ? { color: accent } : undefined}>{v}</div>
      <div className="text-[11px] text-[var(--color-muted)] mt-1.5">{sub}</div>
    </motion.div>
  );
}
