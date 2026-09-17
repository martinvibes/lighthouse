"use client";
import { useMemo } from "react";
import { useDesk } from "@/lib/desk";

const usd = (v: number) => v.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

/** One name, one judgement. Three numbers and a sentence. */
export default function Verdict() {
  const { rows, sel, band, led } = useDesk();
  const row = useMemo(() => rows.find((r) => r.symbol === sel) ?? null, [rows, sel]);
  const track = led?.per_symbol.find((p) => p.symbol === sel);
  if (!row || band === null) return <div className="glass h-full min-h-[200px]" />;

  const wide = row.wide;
  const c = wide ? "var(--color-danger)" : "var(--color-mint)";
  const ratio = Math.min(1, Math.abs(row.devBps) / Math.max(band, 1));

  return (
    <div className="glass overflow-hidden flex flex-col h-full">
      <div className="px-5 py-4">
        <div className="label">the read on {row.ticker}</div>
        <p className="text-[17px] leading-snug mt-2 font-medium" style={{ color: c }}>
          {wide
            ? `Quote is ${Math.abs(row.devBps).toFixed(0)} bps ${row.devBps > 0 ? "above" : "below"} what the history supports.`
            : `Quote is within the ±${band} bps we normally miss by.`}
        </p>
      </div>

      <div className="px-5 pb-4">
        <div className="flex justify-between items-baseline mb-1.5">
          <span className="label">how far past tolerance</span>
          <span className="tnum text-[12px]" style={{ color: c }}>
            {Math.abs(row.devBps).toFixed(0)} / {band} bps
          </span>
        </div>
        <div className="h-1.5 rounded-full overflow-hidden" style={{ background: "rgba(255,255,255,0.07)" }}>
          <div className="h-full rounded-full transition-all duration-500"
               style={{ width: `${ratio * 100}%`, background: c }} />
        </div>
      </div>

      <div className="grid grid-cols-2 border-t border-[var(--color-line)]">
        <Box k="20:00 close" v={usd(row.anchor)} />
        <Box k="fair value" v={usd(row.fair)} c="var(--color-mint)" left />
      </div>

      {track && (
        <div className="px-5 py-3.5 border-t border-[var(--color-line)] mt-auto">
          <div className="label mb-1.5">our record on this name</div>
          <p className="text-[12.5px] text-[var(--color-muted)] leading-relaxed">
            Over <span className="tnum text-[var(--color-fg)]">{track.n}</span> graded nights we miss the reopen by{" "}
            <span className="tnum" style={{ color: "var(--color-mint)" }}>{track.lighthouse.toFixed(0)} bps</span>; the
            venue&apos;s own quote misses by{" "}
            <span className="tnum" style={{ color: "var(--color-cyan)" }}>{track.venue.toFixed(0)} bps</span>.
          </p>
        </div>
      )}
    </div>
  );
}

const Box = ({ k, v, c, left }: { k: string; v: string; c?: string; left?: boolean }) => (
  <div className={`px-5 py-3.5 ${left ? "border-l border-[var(--color-line)]" : ""}`}>
    <div className="label">{k}</div>
    <div className="tnum text-[18px] mt-1" style={c ? { color: c } : undefined}>{v}</div>
  </div>
);
