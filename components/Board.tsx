"use client";
import { useMemo, useState } from "react";
import { useDesk } from "@/lib/desk";
import type { Row } from "@/lib/model";

type Key = "ticker" | "quote" | "chg" | "anchor" | "fair" | "dev" | "vol";
const usd = (v: number) => v.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const compact = (v: number) => v >= 1e9 ? `$${(v / 1e9).toFixed(2)}B` : v >= 1e6 ? `$${(v / 1e6).toFixed(1)}M` : `$${(v / 1e3).toFixed(0)}K`;

export default function Board() {
  const { rows, meta, sel, setSel, band, loading } = useDesk();
  const [key, setKey] = useState<Key>("dev");
  const [asc, setAsc] = useState(false);
  const [q, setQ] = useState("");

  const pick = (r: Row): number | string => ({
    ticker: r.ticker, quote: r.quote, chg: meta[r.symbol]?.change24h ?? 0,
    anchor: r.anchor, fair: r.fair, dev: Math.abs(r.devBps), vol: r.volume,
  }[key]);

  const view = useMemo(() => {
    const f = rows.filter((r) => !q || r.ticker.toLowerCase().includes(q.toLowerCase()));
    return [...f].sort((a, b) => {
      const x = pick(a), y = pick(b);
      const c = typeof x === "string" ? String(x).localeCompare(String(y)) : (x as number) - (y as number);
      return asc ? c : -c;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rows, meta, key, asc, q]);

  const head = (k: Key, label: string) => (
    <th onClick={() => { key === k ? setAsc(!asc) : (setKey(k), setAsc(k === "ticker")); }}
        style={key === k ? { color: "var(--lamp)" } : undefined}>
      {label}{key === k ? (asc ? " ↑" : " ↓") : ""}
    </th>
  );

  return (
    <section className="panel">
      <div className="panel-head">
        <h3>Tonight&apos;s board</h3>
        <span className="label">{rows.length} names</span>
        <span className="spacer" />
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Filter ticker"
               style={{ width: 150, padding: "6px 10px", fontSize: 12.5 }} />
      </div>
      <div className="tablewrap">
        <table className="grid">
          <thead>
            <tr>
              {head("ticker", "Instrument")}
              {head("quote", "Venue quote")}
              {head("chg", "24h")}
              {head("anchor", "Session close")}
              {head("fair", "Fair value")}
              {head("dev", "Quote − fair")}
              <th>Verdict</th>
              {head("vol", "24h turnover")}
            </tr>
          </thead>
          <tbody>
            {view.map((r) => {
              const chg = meta[r.symbol]?.change24h ?? 0;
              const dev = r.devBps;
              return (
                <tr key={r.symbol} className={sel === r.symbol ? "on" : ""} onClick={() => setSel(r.symbol)}>
                  <td>
                    <span className="tick">{r.ticker}</span>
                    <span className="faint mono" style={{ fontSize: 10.5, marginLeft: 7 }}>r{r.ticker}</span>
                  </td>
                  <td className="num">{usd(r.quote)}</td>
                  <td className={`num ${chg >= 0 ? "up" : "down"}`}>{(chg * 100).toFixed(2)}%</td>
                  <td className="num dim">{usd(r.anchor)}</td>
                  <td className="num lamp">{usd(r.fair)}</td>
                  <td className="num" style={{ color: r.wide ? "var(--down)" : "var(--text)" }}>
                    {dev >= 0 ? "+" : ""}{dev.toFixed(0)} bps
                  </td>
                  <td>
                    <span className={`flag ${r.wide ? "wide" : "ok"}`}>
                      {r.wide ? "rich vs history" : "inside band"}
                    </span>
                  </td>
                  <td className="num faint">{compact(r.volume)}</td>
                </tr>
              );
            })}
            {!view.length && (
              <tr><td colSpan={8} style={{ textAlign: "center", padding: 34 }} className="faint">
                {loading ? "Reading the venue…" : "Nothing to show."}
              </td></tr>
            )}
          </tbody>
        </table>
      </div>
      <div className="panel-note">
        Fair value is tonight&apos;s quote shrunk toward the session close by weights fitted on the last 40 closed
        windows. A name is flagged when the quote sits further from fair value than this hour&apos;s measured typical
        error{band !== null ? ` of ±${band} bps` : ""}. Click a row to chart it.
      </div>
    </section>
  );
}
