"use client";
import { useEffect, useMemo, useState } from "react";
import Chart from "./Chart";
import { candles, type Candle } from "@/lib/bitget";
import { useDesk } from "@/lib/desk";

const TFS: [string, string][] = [["15min", "15m"], ["1h", "1H"], ["4h", "4H"], ["1day", "1D"]];
const usd = (v: number) => v.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export default function Instrument() {
  const { rows, sel, meta, band, candles: hourly } = useDesk();
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
    { price: row.anchor, color: "#8b8f99", title: "close", dashed: true },
    { price: row.fair, color: "#4ee6a8", title: "fair value" },
    ...(band !== null ? [
      { price: row.fair * (1 + band / 1e4), color: "rgba(140,150,165,0.35)", title: "band", dashed: true },
      { price: row.fair * (1 - band / 1e4), color: "rgba(140,150,165,0.35)", title: "band", dashed: true },
    ] : []),
  ] : [];

  return (
    <div className="glass overflow-hidden flex flex-col h-full">
      <div className="flex items-center gap-4 px-5 py-4 flex-wrap">
        <div>
          <div className="flex items-baseline gap-2.5">
            <span className="text-[19px] font-semibold tracking-[-0.02em]">{row ? row.ticker : "—"}</span>
            <span className="label">r{row?.ticker ?? ""}</span>
          </div>
          <div className="flex items-baseline gap-3 mt-1.5">
            <span className="tnum text-[30px] leading-none">{row ? usd(row.quote) : "—"}</span>
            {m && (
              <span className="tnum text-[13px]" style={{ color: m.change24h >= 0 ? "var(--color-mint)" : "var(--color-danger)" }}>
                {m.change24h >= 0 ? "+" : ""}{(m.change24h * 100).toFixed(2)}%
              </span>
            )}
          </div>
        </div>
        <span className="flex-1" />
        <div className="flex gap-1 rounded-full p-1 hairline self-start" style={{ background: "rgba(255,255,255,0.025)" }}>
          {TFS.map(([g, l]) => (
            <button key={g} onClick={() => setTf(g)}
              className="px-2.5 py-1 rounded-full text-[11.5px] transition-colors"
              style={tf === g ? { background: "var(--color-mint)", color: "#08080b", fontWeight: 600 } : { color: "var(--color-muted)" }}>
              {l}
            </button>
          ))}
        </div>
      </div>

      <div className="px-1 pb-1 flex-1">
        <Chart candles={ks} lines={lines} height={344} />
      </div>

      <div className="px-5 py-2.5 border-t border-[var(--color-line)] flex gap-5 flex-wrap">
        <Key c="#4ee6a8" t="fair value" />
        <Key c="#8b8f99" t="20:00 close" dash />
        <Key c="rgba(140,150,165,0.5)" t="tolerance band" dash />
      </div>
    </div>
  );
}

const Key = ({ c, t, dash }: { c: string; t: string; dash?: boolean }) => (
  <span className="label flex items-center gap-1.5">
    <svg width="13" height="4"><line x1="0" y1="2" x2="13" y2="2" stroke={c} strokeWidth="2" strokeDasharray={dash ? "3 2" : undefined} /></svg>
    {t}
  </span>
);
