"use client";
import { useDesk } from "@/lib/desk";

/** How far the venue's quote can be trusted at each hour of the dark window — measured, not assumed. */
export default function TrustCurve() {
  const { cal, led, win, lam, band, factor, rows } = useDesk();
  const H = led?.summary.by_horizon ?? {};
  const pts = Object.entries(H)
    .map(([k, v]) => ({ x: +k, venue: v.venue_medae, lh: v.lighthouse_medae, base: v.last_close_medae }))
    .sort((a, b) => a.x - b.x);

  const W = 520, Hh = 152, PAD = { l: 30, r: 10, t: 10, b: 24 };
  const maxY = Math.max(40, ...pts.flatMap((p) => [p.venue, p.base]));
  const px = (x: number) => PAD.l + x * (W - PAD.l - PAD.r);
  const py = (y: number) => PAD.t + (1 - y / maxY) * (Hh - PAD.t - PAD.b);
  const path = (get: (p: (typeof pts)[0]) => number) =>
    pts.map((p, i) => `${i ? "L" : "M"}${px(p.x).toFixed(1)},${py(get(p)).toFixed(1)}`).join(" ");
  const wide = rows.filter((r) => r.wide).length;

  return (
    <div className="glass overflow-hidden flex flex-col h-full">
      <div className="flex items-center gap-3 px-5 py-3.5 border-b border-[var(--color-line)]">
        <span className="text-[14px] font-semibold">Trust across the night</span>
        <span className="flex-1" />
        <span className="label hidden sm:inline">median error vs the reopen</span>
      </div>

      <div className="px-4 pt-4">
        <svg viewBox={`0 0 ${W} ${Hh}`} width="100%" height={Hh} role="img"
             aria-label="Median absolute error against the 04:00 reopen, by how far into the dark window">
          {[0, maxY / 2, maxY].map((v) => (
            <g key={v}>
              <line x1={PAD.l} x2={W - PAD.r} y1={py(v)} y2={py(v)} stroke="rgba(255,255,255,0.06)" />
              <text x={PAD.l - 5} y={py(v) + 3} textAnchor="end" fontSize="9" fill="#5a5e68"
                    fontFamily="var(--font-mono), monospace">{v.toFixed(0)}</text>
            </g>
          ))}
          <path d={path((p) => p.base)} fill="none" stroke="rgba(255,255,255,0.22)" strokeWidth="1.4" strokeDasharray="3 3" />
          <path d={path((p) => p.venue)} fill="none" stroke="#57c7ff" strokeWidth="1.8" opacity=".8" />
          <path d={path((p) => p.lh)} fill="none" stroke="#4ee6a8" strokeWidth="2.4"
                style={{ filter: "drop-shadow(0 0 6px rgba(78,230,168,0.5))" }} />
          {pts.map((p) => <circle key={p.x} cx={px(p.x)} cy={py(p.lh)} r="2.8" fill="#4ee6a8" />)}
          {win?.active && (
            <g>
              <line x1={px(win.elapsed)} x2={px(win.elapsed)} y1={PAD.t} y2={Hh - PAD.b} stroke="#f1f2f4" strokeWidth="1" strokeDasharray="2 3" />
              <text x={px(win.elapsed)} y={Hh - PAD.b + 12} textAnchor="middle" fontSize="8.5" fill="#f1f2f4"
                    fontFamily="var(--font-mono), monospace" letterSpacing="1.5">NOW</text>
            </g>
          )}
          {["20:00", "22:00", "00:00", "02:00", "04:00"].map((l, i) => (
            <text key={l} x={px(i / 4)} y={Hh - 3} textAnchor="middle" fontSize="8.5" fill="#5a5e68"
                  fontFamily="var(--font-mono), monospace">{l}</text>
          ))}
        </svg>
        <div className="flex gap-4 flex-wrap mt-1 mb-3">
          <Key c="#4ee6a8" t="Lighthouse" />
          <Key c="#57c7ff" t="Venue quote" />
          <Key c="rgba(255,255,255,0.3)" t="Close held" dash />
        </div>
      </div>

      <div className="px-5 py-4 border-t border-[var(--color-line)] flex flex-col gap-2.5">
        <Line k="shrinkage in force" v={`${lam[0].toFixed(2)} common · ${lam[1].toFixed(2)} idio`} />
        <Line k="typical error this hour" v={band !== null ? `±${band} bps` : "—"} c="var(--color-mint)" />
        <Line k="common move priced tonight" v={`${(factor * 1e4).toFixed(0)} bps`} c="var(--color-cyan)" />
        <Line k="names outside the band" v={`${wide} of ${rows.length}`} c={wide ? "var(--color-danger)" : undefined} />
        {cal && <Line k="weekend repricing" v={`p90 ${cal.weekend_gap.p90_bps.toFixed(0)} bps`} c="var(--color-amber)" />}
      </div>
    </div>
  );
}

const Key = ({ c, t, dash }: { c: string; t: string; dash?: boolean }) => (
  <span className="label flex items-center gap-1.5" style={{ color: "var(--color-muted)" }}>
    <svg width="14" height="4"><line x1="0" y1="2" x2="14" y2="2" stroke={c} strokeWidth="2" strokeDasharray={dash ? "3 3" : undefined} /></svg>
    {t}
  </span>
);

const Line = ({ k, v, c }: { k: string; v: string; c?: string }) => (
  <div className="flex items-baseline justify-between gap-3">
    <span className="label">{k}</span>
    <span className="tnum text-[12.5px]" style={c ? { color: c } : undefined}>{v}</span>
  </div>
);
