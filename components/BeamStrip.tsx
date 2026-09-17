"use client";
import { useEffect, useState } from "react";
import { useDesk } from "@/lib/desk";
import { fmtET } from "@/lib/time";

/**
 * The night itself, drawn: 20:00 ET on the left, the 04:00 reopen on the right,
 * the lit portion is how far the window has run, and the trust band behind it
 * narrows as the quote earns more of its credibility back.
 */
export default function BeamStrip() {
  const { win, cal, band } = useDesk();
  const [, tick] = useState(0);
  useEffect(() => {
    const id = setInterval(() => tick((n) => n + 1), 30_000);
    return () => clearInterval(id);
  }, []);
  if (!win || !cal) return null;

  const pct = Math.min(100, Math.max(0, win.elapsed * 100));
  const edges = cal.edges;
  const bands = Object.entries(cal.band_bps)
    .map(([k, v]) => ({ i: +k, v }))
    .filter((b) => b.v !== null)
    .sort((a, b) => a.i - b.i);
  const worst = Math.max(...bands.map((b) => b.v ?? 0), 1);

  return (
    <div className="glass px-5 py-4 overflow-hidden">
      <div className="flex items-baseline gap-3 flex-wrap mb-3">
        <span className="label">the night</span>
        <span className="label" style={{ color: "var(--color-mint)" }}>
          {win.active ? `${pct.toFixed(0)}% run` : "window closed"}
        </span>
        <span className="flex-1" />
        <span className="label">
          {fmtET(win.start, { weekday: "short", hour: "2-digit", minute: "2-digit" })} →{" "}
          {fmtET(win.end, { weekday: "short", hour: "2-digit", minute: "2-digit" })} ET
        </span>
      </div>

      <div className="relative h-[54px]">
        {/* the measured error band, hour by hour — it narrows toward the reopen */}
        <svg viewBox="0 0 1000 40" width="100%" height="40" preserveAspectRatio="none" className="absolute inset-x-0 top-0">
          {bands.map((b, i) => {
            const x0 = (edges[b.i] ?? 0) * 1000;
            const x1 = (edges[b.i + 1] ?? 1) * 1000;
            const h = ((b.v ?? 0) / worst) * 34;
            return (
              <rect key={i} x={x0} y={20 - h / 2} width={Math.max(1, x1 - x0 - 2)} height={h} rx="2"
                    fill="var(--color-mint)" opacity={0.1 + 0.06 * i} />
            );
          })}
        </svg>
        {/* the beam: the part of the night already run */}
        <div className="absolute inset-x-0 top-[18px] h-1 rounded-full" style={{ background: "rgba(255,255,255,0.06)" }} />
        <div className="absolute top-[18px] h-1 rounded-full"
             style={{ left: 0, width: `${pct}%`, background: "linear-gradient(90deg, rgba(78,230,168,0.15), var(--color-mint))" }} />
        {win.active && (
          <div className="absolute top-[13px] h-[11px] w-[11px] rounded-full"
               style={{ left: `${pct}%`, marginLeft: -5.5, background: "#fff", boxShadow: "0 0 16px var(--color-mint)" }} />
        )}
        <div className="absolute inset-x-0 bottom-0 flex justify-between">
          {["20:00", "22:00", "00:00", "02:00", "04:00"].map((t) => (
            <span key={t} className="label">{t}</span>
          ))}
        </div>
      </div>

      <div className="text-[11.5px] text-[var(--color-muted)] mt-3 leading-relaxed">
        The shaded blocks are the measured typical error at each stage of the night — widest just after the
        close, narrowest in the hour before the reopen.{band !== null && ` Right now it is ±${band} bps.`}
      </div>
    </div>
  );
}
