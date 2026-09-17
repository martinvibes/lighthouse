"use client";
import { useMemo, useState } from "react";
import { useDesk } from "@/lib/desk";
import type { Row } from "@/lib/model";

type Key = "ticker" | "quote" | "chg" | "anchor" | "fair" | "dev" | "vol";
const usd = (v: number) => v.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const compact = (v: number) =>
  v >= 1e9 ? `$${(v / 1e9).toFixed(2)}B` : v >= 1e6 ? `$${(v / 1e6).toFixed(1)}M` : `$${(v / 1e3).toFixed(0)}K`;

export default function Board() {
  const { rows, meta, sel, setSel, band, loading } = useDesk();
  const [key, setKey] = useState<Key>("dev");
  const [asc, setAsc] = useState(false);
  const [q, setQ] = useState("");

  const pick = (r: Row): number | string =>
    ({ ticker: r.ticker, quote: r.quote, chg: meta[r.symbol]?.change24h ?? 0,
       anchor: r.anchor, fair: r.fair, dev: Math.abs(r.devBps), vol: r.volume }[key]);

  const view = useMemo(() => {
    const f = rows.filter((r) => !q || r.ticker.toLowerCase().includes(q.toLowerCase()));
    return [...f].sort((a, b) => {
      const x = pick(a), y = pick(b);
      const c = typeof x === "string" ? String(x).localeCompare(String(y)) : (x as number) - (y as number);
      return asc ? c : -c;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rows, meta, key, asc, q]);

  const H = ({ k, children, right = true }: { k: Key; children: React.ReactNode; right?: boolean }) => (
    <th
      onClick={() => (key === k ? setAsc(!asc) : (setKey(k), setAsc(k === "ticker")))}
      className={`label py-2.5 px-3 whitespace-nowrap select-none ${right ? "text-right" : "text-left"}`}
      style={key === k ? { color: "var(--color-mint)" } : undefined}
    >
      {children}{key === k ? (asc ? " ↑" : " ↓") : ""}
    </th>
  );

  return (
    <div className="glass overflow-hidden flex flex-col">
      <div className="flex items-center gap-3 px-5 py-3.5 border-b border-[var(--color-line)] flex-wrap">
        <span className="text-[14px] font-semibold">Tonight&apos;s board</span>
        <span className="label">{rows.length} names</span>
        <span className="flex-1" />
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="filter ticker"
          className="hairline rounded-lg px-3 py-1.5 text-[12.5px] w-[140px] outline-none focus:border-[var(--color-mint)] transition-colors"
          style={{ background: "rgba(255,255,255,0.02)" }}
        />
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-[13px]">
          <thead>
            <tr className="border-b border-[var(--color-line)]">
              <H k="ticker" right={false}>instrument</H>
              <H k="quote">venue quote</H>
              <H k="chg">24h</H>
              <H k="anchor">session close</H>
              <H k="fair">fair value</H>
              <H k="dev">quote − fair</H>
              <th className="label py-2.5 px-3 text-right">verdict</th>
              <H k="vol">24h turnover</H>
            </tr>
          </thead>
          <tbody>
            {view.map((r) => {
              const chg = meta[r.symbol]?.change24h ?? 0;
              const on = sel === r.symbol;
              return (
                <tr
                  key={r.symbol}
                  onClick={() => setSel(r.symbol)}
                  className="border-b border-[var(--color-line)] last:border-0 cursor-pointer transition-colors hover:bg-white/[0.025]"
                  style={on ? { background: "rgba(78,230,168,0.06)", boxShadow: "inset 2px 0 0 var(--color-mint)" } : undefined}
                >
                  <td className="py-2.5 px-3">
                    <span className="font-medium">{r.ticker}</span>
                    <span className="tnum text-[10.5px] text-[var(--color-faint)] ml-2">r{r.ticker}</span>
                  </td>
                  <td className="tnum py-2.5 px-3 text-right">{usd(r.quote)}</td>
                  <td className="tnum py-2.5 px-3 text-right" style={{ color: chg >= 0 ? "var(--color-mint)" : "var(--color-danger)" }}>
                    {(chg * 100).toFixed(2)}%
                  </td>
                  <td className="tnum py-2.5 px-3 text-right text-[var(--color-muted)]">{usd(r.anchor)}</td>
                  <td className="tnum py-2.5 px-3 text-right" style={{ color: "var(--color-cyan)" }}>{usd(r.fair)}</td>
                  <td className="tnum py-2.5 px-3 text-right" style={{ color: r.wide ? "var(--color-danger)" : "var(--color-fg)" }}>
                    {r.devBps >= 0 ? "+" : ""}{r.devBps.toFixed(0)} bps
                  </td>
                  <td className="py-2.5 px-3 text-right">
                    <span
                      className="label rounded px-1.5 py-0.5"
                      style={r.wide
                        ? { color: "var(--color-danger)", background: "rgba(255,93,108,0.12)" }
                        : { color: "var(--color-faint)", background: "rgba(255,255,255,0.04)" }}
                    >
                      {r.wide ? "drifted" : "inside"}
                    </span>
                  </td>
                  <td className="tnum py-2.5 px-3 text-right text-[var(--color-faint)]">{compact(r.volume)}</td>
                </tr>
              );
            })}
            {!view.length && (
              <tr><td colSpan={8} className="label py-12 text-center">{loading ? "reading bitget…" : "nothing to show"}</td></tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="px-5 py-3 border-t border-[var(--color-line)] text-[11.5px] text-[var(--color-muted)] leading-relaxed">
        Fair value is tonight&apos;s quote shrunk toward the session close by weights fitted on the last 40 closed
        windows. A name is flagged when its quote sits further from fair value than this hour&apos;s measured typical
        error{band !== null ? ` of ±${band} bps` : ""}. Click a row to chart it.
      </div>
    </div>
  );
}
