"use client";
import { useMemo, useState } from "react";
import { motion } from "framer-motion";
import { Download } from "lucide-react";
import { useDesk } from "@/lib/desk";

const HZ: Record<string, string> = {
  "0.25": "a quarter in · ~22:00",
  "0.50": "halfway · ~00:00",
  "0.75": "three quarters · ~02:00",
  "0.90": "nearly open · ~03:10",
};

const rise = (d: number) => ({
  initial: { opacity: 0, y: 12 }, animate: { opacity: 1, y: 0 },
  transition: { delay: d, duration: 0.5, ease: "easeOut" as const },
});

export default function Record() {
  const { led, cal } = useDesk();
  const [all, setAll] = useState(false);

  const hz = useMemo(() => Object.entries(led?.summary.by_horizon ?? {}).sort(), [led]);
  const names = useMemo(() => {
    const p = [...(led?.per_symbol ?? [])].sort((a, b) => a.vs_lastclose_pct - b.vs_lastclose_pct);
    return all ? p : p.slice(0, 10);
  }, [led, all]);

  const deep = led?.summary.by_horizon["0.90"];
  const tiles = [
    { k: "forecasts graded", v: led ? led.summary.n_rows.toLocaleString() : "—", s: "each scored before its open was known" },
    { k: "names covered", v: cal ? String(cal.universe.length) : "—", s: cal ? `${cal.span[0]} → ${cal.span[1]}` : "" },
    { k: "better than the venue", v: deep ? `${(deep.lighthouse_beats_venue_share * 100).toFixed(1)}%` : "—", s: "of forecasts near the open" },
  ];

  return (
    <main className="relative min-h-screen px-4 md:px-6 py-7 max-w-[1320px] mx-auto z-10">
      <motion.header {...rise(0)} className="max-w-[640px]">
        <h1 className="text-[26px] font-semibold tracking-[-0.02em] leading-none">Record</h1>
        <p className="text-[14px] text-[var(--color-muted)] mt-3 leading-relaxed">
          Every forecast was made with only what was known at the time, then graded against the open that
          followed. Numbers below are median errors in basis points — lower is better.
        </p>
      </motion.header>

      <motion.section {...rise(0.06)} className="grid grid-cols-1 sm:grid-cols-3 gap-4 mt-6">
        {tiles.map((t) => (
          <div key={t.k} className="glass px-5 py-4">
            <div className="label">{t.k}</div>
            <div className="tnum text-[30px] leading-none mt-2">{t.v}</div>
            <div className="text-[11.5px] text-[var(--color-faint)] mt-2">{t.s}</div>
          </div>
        ))}
      </motion.section>

      <motion.section {...rise(0.12)} className="glass overflow-hidden mt-4">
        <div className="px-5 py-3.5 border-b border-[var(--color-line)]">
          <span className="text-[14px] font-semibold">How wrong everyone is, by hour of the night</span>
        </div>
        <div className="overflow-x-auto no-scrollbar">
          <table className="w-full text-[13px] min-w-[560px]">
            <thead>
              <tr className="label border-b border-[var(--color-line)]">
                <th className="text-left font-normal px-5 py-2.5">into the window</th>
                <th className="text-right font-normal px-3 py-2.5">assume close held</th>
                <th className="text-right font-normal px-3 py-2.5">venue quote</th>
                <th className="text-right font-normal px-5 py-2.5">lighthouse</th>
              </tr>
            </thead>
            <tbody>
              {hz.map(([k, r]) => (
                <tr key={k} className="border-b border-[var(--color-line)] last:border-0">
                  <td className="px-5 py-3">{HZ[k] ?? k}</td>
                  <td className="tnum text-right px-3 py-3 text-[var(--color-muted)]">{r.last_close_medae.toFixed(1)}</td>
                  <td className="tnum text-right px-3 py-3 text-[var(--color-muted)]">{r.venue_medae.toFixed(1)}</td>
                  <td className="tnum text-right px-5 py-3">
                    <span style={{ color: "var(--color-mint)" }}>{r.lighthouse_medae.toFixed(1)}</span>
                    <span className="label ml-2">{r.lighthouse_vs_lastclose_pct.toFixed(0)}%</span>
                  </td>
                </tr>
              ))}
              {!hz.length && <tr><td className="label px-5 py-10" colSpan={4}>loading…</td></tr>}
            </tbody>
          </table>
        </div>
      </motion.section>

      <motion.section {...rise(0.18)} className="glass overflow-hidden mt-4">
        <div className="flex items-center gap-3 px-5 py-3.5 border-b border-[var(--color-line)]">
          <span className="text-[14px] font-semibold">Name by name</span>
          <span className="label">best first · improvement over assuming the close held</span>
          <span className="flex-1" />
          <button onClick={() => setAll((a) => !a)}
                  className="label rounded-full px-3 py-1.5 hairline hover:bg-white/[0.05] transition-colors">
            {all ? "show top 10" : `show all ${led?.per_symbol.length ?? ""}`}
          </button>
        </div>
        <div className="overflow-x-auto no-scrollbar">
          <table className="w-full text-[13px] min-w-[520px]">
            <thead>
              <tr className="label border-b border-[var(--color-line)]">
                <th className="text-left font-normal px-5 py-2.5">name</th>
                <th className="text-right font-normal px-3 py-2.5">venue error</th>
                <th className="text-right font-normal px-3 py-2.5">our error</th>
                <th className="text-right font-normal px-5 py-2.5">improvement</th>
              </tr>
            </thead>
            <tbody>
              {names.map((s) => {
                const good = s.vs_lastclose_pct < 0;
                return (
                  <tr key={s.symbol} className="border-b border-[var(--color-line)] last:border-0 hover:bg-white/[0.02] transition-colors">
                    <td className="px-5 py-2.5 font-medium">r{s.ticker}</td>
                    <td className="tnum text-right px-3 py-2.5 text-[var(--color-muted)]">{s.venue.toFixed(1)}</td>
                    <td className="tnum text-right px-3 py-2.5">{s.lighthouse.toFixed(1)}</td>
                    <td className="tnum text-right px-5 py-2.5"
                        style={{ color: good ? "var(--color-mint)" : "var(--color-danger)" }}>
                      {good ? "" : "+"}{s.vs_lastclose_pct.toFixed(1)}%
                    </td>
                  </tr>
                );
              })}
              {!names.length && <tr><td className="label px-5 py-10" colSpan={4}>loading…</td></tr>}
            </tbody>
          </table>
        </div>
      </motion.section>

      <motion.div {...rise(0.24)} className="flex flex-wrap items-center gap-3 mt-4">
        <span className="text-[12.5px] text-[var(--color-faint)]">Check it yourself:</span>
        {[["ledger.csv", "every graded forecast"], ["ledger.json", "the summary"], ["calibration.json", "the fitted parameters"]].map(([f, d]) => (
          <a key={f} href={`/${f}`} download
             className="inline-flex items-center gap-2 hairline rounded-full px-3.5 py-1.5 text-[12.5px] hover:bg-white/[0.05] transition-colors">
            <Download size={12} strokeWidth={1.6} /> {f}
            <span className="label">{d}</span>
          </a>
        ))}
      </motion.div>
    </main>
  );
}
