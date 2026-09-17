"use client";
import { useEffect, useMemo, useState } from "react";
import Chart from "./Chart";
import GapMeter from "./GapMeter";
import { candles, type Candle } from "@/lib/bitget";
import { useDesk } from "@/lib/desk";

const TFS: [string, string][] = [["15min", "15m"], ["1h", "1H"], ["4h", "4H"], ["1day", "1D"]];
const usd = (v: number) => v.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export default function Instrument() {
  const { rows, sel, meta, band, win, candles: hourly } = useDesk();
  const [tf, setTf] = useState("1h");
  const [ks, setKs] = useState<Candle[]>([]);
  const row = useMemo(() => rows.find((r) => r.symbol === sel) ?? null, [rows, sel]);

  useEffect(() => {
    if (!sel) return;
    if (tf === "1h") { setKs(hourly); return; }
    let live = true;
    candles(sel, tf, 200).then((k) => live && setKs(k)).catch(() => live && setKs([]));
    return () => { live = false; };
  }, [sel, tf, hourly]);

  const m = sel ? meta[sel] : undefined;
  const lines = row ? [
    { price: row.anchor, color: "var(--sea)", title: "session close", dashed: true },
    { price: row.fair, color: "var(--lamp)", title: "fair value" },
    ...(band !== null ? [
      { price: row.fair * (1 + band / 1e4), color: "var(--line)", title: "+band", dashed: true },
      { price: row.fair * (1 - band / 1e4), color: "var(--line)", title: "−band", dashed: true },
    ] : []),
  ] : [];

  const rangePct = m && m.high > m.low && row
    ? Math.min(100, Math.max(0, ((row.quote - m.low) / (m.high - m.low)) * 100)) : null;

  return (
    <section className="panel">
      <div className="panel-head">
        <h3 style={{ fontSize: 15 }}>{row ? row.ticker : "—"}</h3>
        <span className="flag ok">r{row?.ticker ?? ""} · SPOT</span>
        <span className="spacer" />
        <div style={{ display: "flex", gap: 3 }}>
          {TFS.map(([g, l]) => (
            <button key={g} onClick={() => setTf(g)}
              className="btn ghost"
              style={{
                padding: "4px 9px", fontSize: 11, borderRadius: 6,
                ...(tf === g ? { color: "var(--lamp-ink)", borderColor: "var(--lamp)", background: "var(--lamp-wash)" } : {}),
              }}>{l}</button>
          ))}
        </div>
      </div>

      <div className="panel-body" style={{ paddingBottom: 6 }}>
        <div style={{ display: "flex", alignItems: "baseline", gap: 14, flexWrap: "wrap" }}>
          <span className="num" style={{ fontSize: 40, letterSpacing: "-.04em", lineHeight: 1 }}>
            {row ? usd(row.quote) : "—"}
          </span>
          {m && (
            <span className={`num ${m.change24h >= 0 ? "up" : "down"}`} style={{ fontSize: 15 }}>
              {m.change24h >= 0 ? "▲" : "▼"} {(m.change24h * 100).toFixed(2)}%
            </span>
          )}
          <span className="spacer" style={{ flex: 1 }} />
          {row && (
            <span className="label" style={{ fontSize: 10.5 }}>
              {win?.active ? "indicative quote · no US venue open" : "last quote of the dark window"}
            </span>
          )}
        </div>

        {m && m.high > 0 && (
          <div style={{ marginTop: 14 }}>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11 }} className="faint">
              <span className="num">24h low {usd(m.low)}</span>
              <span className="num">24h high {usd(m.high)}</span>
            </div>
            <div className="bar" style={{ marginTop: 5, position: "relative" }}>
              <i style={{ width: `${rangePct ?? 0}%`, background: "linear-gradient(90deg, var(--sea), var(--lamp))" }} />
            </div>
          </div>
        )}
      </div>

      <div style={{ padding: "0 8px" }}>
        <Chart candles={ks} lines={lines} height={330} />
      </div>

      {row && band !== null && (
        <div className="panel-body" style={{ borderTop: "1px solid var(--line-soft)" }}>
          <div className="label" style={{ marginBottom: 6 }}>Quote against fair value</div>
          <GapMeter devBps={row.devBps} band={band} />
          <div className="grid-4" style={{ marginTop: 12 }}>
            <Kv k="Session close" v={usd(row.anchor)} note="20:00 ET" />
            <Kv k="Fair value" v={usd(row.fair)} note="shrunk toward close" lamp />
            <Kv k="Quote − fair" v={`${row.devBps >= 0 ? "+" : ""}${row.devBps.toFixed(0)} bps`}
                note={row.wide ? "outside the band" : "inside the band"} bad={row.wide} />
            <Kv k="Beta to the tape" v={row.beta.toFixed(2)} note="fitted, not assumed" />
          </div>
        </div>
      )}
    </section>
  );
}

function Kv({ k, v, note, lamp, bad }: { k: string; v: string; note: string; lamp?: boolean; bad?: boolean }) {
  return (
    <div>
      <div className="label">{k}</div>
      <div className="num" style={{ fontSize: 17, marginTop: 3, color: bad ? "var(--down)" : lamp ? "var(--lamp)" : undefined }}>{v}</div>
      <div className="faint" style={{ fontSize: 11 }}>{note}</div>
    </div>
  );
}
