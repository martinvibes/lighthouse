"use client";
import { useState } from "react";
import type { Row } from "@/lib/model";

const fmtUsd = (v: number) => (v >= 1000 ? v.toFixed(0) : v.toFixed(2));
const fmtBps = (v: number) => `${v >= 0 ? "+" : ""}${v.toFixed(0)}`;
const fmtVol = (v: number) => (v >= 1e9 ? `${(v / 1e9).toFixed(1)}B` : `${(v / 1e6).toFixed(0)}M`);

type Key = "ticker" | "volume" | "quoteRet" | "devBps";

export default function Board({ rows, selected, onSelect, factor, lam, band, live }: {
  rows: Row[]; selected: string | null; onSelect: (s: string) => void;
  factor: number; lam: [number, number]; band: number | null; live: boolean;
}) {
  const [key, setKey] = useState<Key>("devBps");
  const [desc, setDesc] = useState(true);

  const sorted = [...rows].sort((a, b) => {
    const va = key === "ticker" ? a.ticker : Math.abs(a[key] as number);
    const vb = key === "ticker" ? b.ticker : Math.abs(b[key] as number);
    if (typeof va === "string" && typeof vb === "string") return desc ? vb.localeCompare(va) : va.localeCompare(vb);
    return desc ? (vb as number) - (va as number) : (va as number) - (vb as number);
  });
  const wide = rows.filter((r) => r.wide).length;
  const click = (k: Key) => { if (k === key) setDesc(!desc); else { setKey(k); setDesc(true); } };
  const arrow = (k: Key) => (k === key ? (desc ? " ↓" : " ↑") : "");

  return (
    <section>
      <div className="sechead">
        <div>
          <h2 className="serif">{live ? "The board, live" : "The board, last dark window"}</h2>
          <p className="sub">
            {rows.length} of the most-traded rTokens. Cross-sectional factor is{" "}
            <b className="mono">{fmtBps(factor * 1e4)} bps</b>; shrinkage in force is{" "}
            <b className="mono">{lam[0].toFixed(2)}</b> on the common move and{" "}
            <b className="mono">{lam[1].toFixed(2)}</b> on the name-specific part.{" "}
            {wide ? <><b>{wide}</b> quoting outside the ±{band?.toFixed(0)} bps band.</> : "All inside band."}
            {" "}Click a row for its chart.
          </p>
        </div>
      </div>
      <div className="tablewrap">
        <table>
          <thead>
            <tr>
              <th className="sortable" onClick={() => click("ticker")}>Instrument{arrow("ticker")}</th>
              <th className="sortable" onClick={() => click("volume")}>24h volume{arrow("volume")}</th>
              <th>Session close</th>
              <th>Venue quote</th>
              <th className="sortable" onClick={() => click("quoteRet")}>Quote move{arrow("quoteRet")}</th>
              <th>Fair value</th>
              <th className="sortable" onClick={() => click("devBps")}>Quote − fair{arrow("devBps")}</th>
              <th>Verdict</th>
            </tr>
          </thead>
          <tbody>
            {!sorted.length && <tr><td colSpan={8} className="skel">Fetching the universe…</td></tr>}
            {sorted.map((r) => (
              <tr key={r.symbol} className={`stripe ${r.wide ? "wide" : ""} ${selected === r.symbol ? "sel" : ""}`}
                onClick={() => onSelect(r.symbol)}>
                <td className="tkr">{r.ticker}<span>{r.symbol}</span></td>
                <td className="num">{fmtVol(r.volume)}</td>
                <td className="num">{fmtUsd(r.anchor)}</td>
                <td className="num">{fmtUsd(r.quote)}</td>
                <td className="num" style={{ color: r.quoteRet >= 0 ? "var(--sea)" : "var(--clay)" }}>{fmtBps(r.quoteRet * 1e4)}</td>
                <td className="num">{fmtUsd(r.fair)}</td>
                <td className="num">{fmtBps(r.devBps)}</td>
                <td><span className={`flag ${r.wide ? "wide" : "ok"}`}>{r.wide ? "outside band" : "inside"}</span></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="note">
        Fair value is the last regular-session close plus the part of the quote&apos;s move that history says
        survives to the reopen. <b>Quote − fair</b> is what the venue is showing you that the record does not
        support.
      </p>
    </section>
  );
}
