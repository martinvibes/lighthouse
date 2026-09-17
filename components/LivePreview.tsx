"use client";
import { useDesk } from "@/lib/desk";
import { fmtET } from "@/lib/time";

const usd = (v: number) => v.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

/** The real board, small — running on live Bitget data, not a screenshot. */
export default function LivePreview() {
  const { rows, band, win, updated, loading } = useDesk();
  const top = [...rows].sort((a, b) => Math.abs(b.devBps) - Math.abs(a.devBps)).slice(0, 5);

  return (
    <div className="glass overflow-hidden">
      <div className="flex items-center gap-3 px-5 py-3.5 border-b border-[var(--color-line)]">
        <span className="h-1.5 w-1.5 rounded-full live-dot" style={{ background: "var(--color-mint)" }} />
        <span className="label">tonight&apos;s board · live</span>
        <span className="flex-1" />
        <span className="label hidden sm:inline">
          {win ? `${win.kind} window · ${(win.elapsed * 100).toFixed(0)}% elapsed` : "connecting"}
        </span>
      </div>

      <div className="grid grid-cols-[1fr_auto_auto_auto] gap-x-3 sm:gap-x-6 px-5 py-2 border-b border-[var(--color-line)]">
        {["instrument", "quote", "fair value", "gap"].map((h, i) => (
          <span key={h} className={`label py-1 ${i ? "text-right" : ""}`}>{h}</span>
        ))}
      </div>

      <div className="px-5 divide-y divide-[var(--color-line)]">
        {top.map((r, i) => (
          <div
            key={r.symbol}
            className="grid grid-cols-[1fr_auto_auto_auto] gap-x-3 sm:gap-x-6 py-2.5 ticker-in items-baseline"
            style={{ animationDelay: `${i * 70}ms` }}
          >
            <span className="text-[13.5px] font-medium">
              {r.ticker}
              <span className="tnum text-[10.5px] text-[var(--color-faint)] ml-2">r{r.ticker}</span>
            </span>
            <span className="tnum text-[13px] text-right">{usd(r.quote)}</span>
            <span className="tnum text-[13px] text-right" style={{ color: "var(--color-cyan)" }}>{usd(r.fair)}</span>
            <span
              className="tnum text-[13px] text-right w-[74px]"
              style={{ color: r.wide ? "var(--color-danger)" : "var(--color-mint)" }}
            >
              {r.devBps >= 0 ? "+" : ""}{r.devBps.toFixed(0)} bps
            </span>
          </div>
        ))}
        {!top.length && (
          <div className="py-10 text-center label">{loading ? "reading bitget…" : "no quotes right now"}</div>
        )}
      </div>

      <div className="flex items-center gap-4 px-5 py-3 border-t border-[var(--color-line)] flex-wrap">
        <span className="label">
          tolerance tonight <span style={{ color: "var(--color-mint)" }}>±{band ?? "—"} bps</span>
        </span>
        <span className="label">
          outside it{" "}
          <span style={{ color: rows.some((r) => r.wide) ? "var(--color-danger)" : "var(--color-mint)" }}>
            {rows.filter((r) => r.wide).length} of {rows.length}
          </span>
        </span>
        <span className="flex-1" />
        {updated && <span className="label">{fmtET(updated, { hour: "2-digit", minute: "2-digit", second: "2-digit" })} ET</span>}
      </div>
    </div>
  );
}
