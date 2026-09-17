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
    { price: row.anchor, color: "#8b8f99", title: "session close", dashed: true },
    { price: row.fair, color: "#4ee6a8", title: "fair value" },
    ...(band !== null ? [
      { price: row.fair * (1 + band / 1e4), color: "rgba(255,255,255,0.18)", title: "+band", dashed: true },
      { price: row.fair * (1 - band / 1e4), color: "rgba(255,255,255,0.18)", title: "−band", dashed: true },
    ] : []),
  ] : [];
  const rangePct = m && m.high > m.low && row
    ? Math.min(100, Math.max(0, ((row.quote - m.low) / (m.high - m.low)) * 100)) : null;

  return (
    <div className="glass overflow-hidden flex flex-col h-full">
      <div className="flex items-center gap-3 px-5 py-3.5 border-b border-[var(--color-line)] flex-wrap">
        <span className="text-[16px] font-semibold tracking-[-0.01em]">{row ? row.ticker : "—"}</span>
        <span className="label rounded px-1.5 py-0.5" style={{ background: "rgba(255,255,255,0.04)" }}>
          r{row?.ticker ?? ""} · spot
        </span>
        <span className="flex-1" />
        <div className="flex gap-1 rounded-full p-1 hairline" style={{ background: "rgba(255,255,255,0.025)" }}>
          {TFS.map(([g, l]) => (
            <button
              key={g}
              onClick={() => setTf(g)}
              className="px-2.5 py-1 rounded-full text-[11.5px] transition-colors"
              style={tf === g
                ? { background: "var(--color-mint)", color: "#08080b", fontWeight: 600 }
                : { color: "var(--color-muted)" }}
            >
              {l}
            </button>
          ))}
        </div>
      </div>

      <div className="px-5 pt-4">
        <div className="flex items-baseline gap-4 flex-wrap">
          <span className="tnum text-[42px] leading-none">{row ? usd(row.quote) : "—"}</span>
          {m && (
            <span className="tnum text-[15px]" style={{ color: m.change24h >= 0 ? "var(--color-mint)" : "var(--color-danger)" }}>
              {m.change24h >= 0 ? "▲" : "▼"} {(m.change24h * 100).toFixed(2)}%
            </span>
          )}
          <span className="flex-1" />
          <span className="label">{win?.active ? "indicative · no us venue open" : "last quote of the dark window"}</span>
        </div>

        {m && m.high > 0 && (
          <div className="mt-4">
            <div className="flex justify-between">
              <span className="label">24h low {usd(m.low)}</span>
              <span className="label">24h high {usd(m.high)}</span>
            </div>
            <div className="h-1 rounded-full mt-1.5 relative" style={{ background: "rgba(255,255,255,0.07)" }}>
              <div className="h-full rounded-full" style={{ width: `${rangePct ?? 0}%`, background: "linear-gradient(90deg, var(--color-cyan), var(--color-mint))" }} />
              <span
                className="absolute top-1/2 -translate-y-1/2 h-2.5 w-2.5 rounded-full"
                style={{ left: `${rangePct ?? 0}%`, marginLeft: -5, background: "#fff", boxShadow: "0 0 10px var(--color-mint)" }}
              />
            </div>
          </div>
        )}
      </div>

      <div className="px-2 pt-2 flex-1 min-h-[300px]">
        <Chart candles={ks} lines={lines} height={330} />
      </div>

      {row && band !== null && (
        <div className="px-5 py-4 border-t border-[var(--color-line)]">
          <div className="label mb-2">quote against fair value</div>
          <GapMeter devBps={row.devBps} band={band} />
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-4">
            <Kv k="session close" v={usd(row.anchor)} note="20:00 ET" />
            <Kv k="fair value" v={usd(row.fair)} note="shrunk toward close" c="var(--color-cyan)" />
            <Kv k="quote − fair" v={`${row.devBps >= 0 ? "+" : ""}${row.devBps.toFixed(0)} bps`}
                note={row.wide ? "outside the band" : "inside the band"}
                c={row.wide ? "var(--color-danger)" : "var(--color-mint)"} />
            <Kv k="beta to the tape" v={row.beta.toFixed(2)} note="fitted, not assumed" />
          </div>
        </div>
      )}
    </div>
  );
}

function Kv({ k, v, note, c }: { k: string; v: string; note: string; c?: string }) {
  return (
    <div className="panel px-3.5 py-3">
      <div className="label">{k}</div>
      <div className="tnum text-[17px] mt-1" style={c ? { color: c } : undefined}>{v}</div>
      <div className="text-[11px] text-[var(--color-faint)] mt-0.5">{note}</div>
    </div>
  );
}
