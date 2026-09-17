"use client";
import { useDesk } from "@/lib/desk";

/** How far the venue's quote can be trusted at each hour of the dark window — measured, not assumed. */
export default function TrustCurve() {
  const { cal, led, win, lam, band, factor, rows } = useDesk();
  if (!cal || !win) return <section className="panel" style={{ minHeight: 260 }} />;

  const H = led?.summary.by_horizon ?? {};
  const pts = Object.entries(H).map(([k, v]) => ({ x: +k, venue: v.venue_medae, lh: v.lighthouse_medae, base: v.last_close_medae }));
  pts.sort((a, b) => a.x - b.x);

  const W = 520, Hh = 150, PAD = { l: 34, r: 12, t: 12, b: 24 };
  const maxY = Math.max(40, ...pts.flatMap((p) => [p.venue, p.base]));
  const px = (x: number) => PAD.l + x * (W - PAD.l - PAD.r);
  const py = (y: number) => PAD.t + (1 - y / maxY) * (Hh - PAD.t - PAD.b);
  const path = (get: (p: typeof pts[0]) => number) =>
    pts.map((p, i) => `${i ? "L" : "M"}${px(p.x).toFixed(1)},${py(get(p)).toFixed(1)}`).join(" ");

  const wide = rows.filter((r) => r.wide).length;

  return (
    <section className="panel">
      <div className="panel-head">
        <h3>Trust across the night</h3>
        <span className="spacer" />
        <span className="label">median abs error vs the 04:00 reopen</span>
      </div>
      <div className="panel-body">
        <svg viewBox={`0 0 ${W} ${Hh}`} width="100%" height={Hh} role="img"
             aria-label="Median absolute error against the reopen, by how far into the dark window">
          {[0, maxY / 2, maxY].map((v) => (
            <g key={v}>
              <line x1={PAD.l} x2={W - PAD.r} y1={py(v)} y2={py(v)} stroke="var(--line-soft)" />
              <text x={PAD.l - 6} y={py(v) + 3} textAnchor="end" fontSize="9" fill="var(--faint)"
                    fontFamily="var(--font-mono), monospace">{v.toFixed(0)}</text>
            </g>
          ))}
          <path d={path((p) => p.base)} fill="none" stroke="var(--faint)" strokeWidth="1.4" strokeDasharray="3 3" />
          <path d={path((p) => p.venue)} fill="none" stroke="var(--sea)" strokeWidth="1.8" />
          <path d={path((p) => p.lh)} fill="none" stroke="var(--lamp)" strokeWidth="2.4" />
          {pts.map((p) => <circle key={p.x} cx={px(p.x)} cy={py(p.lh)} r="2.8" fill="var(--lamp)" />)}
          {win.active && (
            <g>
              <line x1={px(win.elapsed)} x2={px(win.elapsed)} y1={PAD.t} y2={Hh - PAD.b} stroke="var(--text)" strokeWidth="1" strokeDasharray="2 3" />
              <text x={px(win.elapsed)} y={Hh - PAD.b + 13} textAnchor="middle" fontSize="9" fill="var(--text)"
                    fontFamily="var(--font-mono), monospace">NOW</text>
            </g>
          )}
          {["20:00", "22:00", "00:00", "02:00", "04:00"].map((l, i) => (
            <text key={l} x={px(i / 4)} y={Hh - 4} textAnchor="middle" fontSize="9" fill="var(--faint)"
                  fontFamily="var(--font-mono), monospace">{l}</text>
          ))}
        </svg>
        <div style={{ display: "flex", gap: 16, flexWrap: "wrap", marginTop: 4 }}>
          <Key c="var(--lamp)" t="Lighthouse" />
          <Key c="var(--sea)" t="Venue quote" />
          <Key c="var(--faint)" t="Assume the close held" dash />
        </div>
      </div>
      <div className="panel-body" style={{ borderTop: "1px solid var(--line-soft)", display: "grid", gap: 11 }}>
        <Line k="Shrinkage in force now" v={`${lam[0].toFixed(2)} common · ${lam[1].toFixed(2)} idiosyncratic`} />
        <Line k="Typical error at this hour" v={band !== null ? `±${band} bps` : "—"} />
        <Line k="Common move priced tonight" v={`${(factor * 1e4).toFixed(0)} bps across the tape`} />
        <Line k="Names outside the band" v={`${wide} of ${rows.length}`} bad={wide > 0} />
        <Line k="Weekend repricing" v={`median ${cal.weekend_gap.median_bps.toFixed(0)} bps · p90 ${cal.weekend_gap.p90_bps.toFixed(0)} bps`} />
      </div>
    </section>
  );
}

const Key = ({ c, t, dash }: { c: string; t: string; dash?: boolean }) => (
  <span style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 11.5, color: "var(--dim)" }}>
    <svg width="16" height="4"><line x1="0" y1="2" x2="16" y2="2" stroke={c} strokeWidth="2" strokeDasharray={dash ? "3 3" : undefined} /></svg>
    {t}
  </span>
);

const Line = ({ k, v, bad }: { k: string; v: string; bad?: boolean }) => (
  <div style={{ display: "flex", justifyContent: "space-between", gap: 12, fontSize: 12.5 }}>
    <span className="dim">{k}</span>
    <span className="num" style={{ color: bad ? "var(--down)" : "var(--text)" }}>{v}</span>
  </div>
);
