"use client";
import type { Calibration } from "@/lib/model";
import { fmtET, type DarkWindow } from "@/lib/time";

/** The night, drawn to scale, with how much of the venue's quote survives it. */
export default function NightBand({ cal, win, lam, band }: {
  cal: Calibration; win: DarkWindow; lam: [number, number]; band: number | null;
}) {
  const W = 1020, H = 250, L = 62, R = 24, T = 30, B = 44;
  const x = (v: number) => L + v * (W - L - R);
  const y = (v: number) => H - B - v * (H - T - B);
  const E = cal.edges;
  const hours = (+win.end - +win.start) / 3600e3;
  const steps = win.kind === "weekend" ? 6 : 4;

  const segs = E.slice(0, -1).map((lo, i) => {
    const hi = Math.min(E[i + 1], 1);
    const l = cal.lambda[String(i)]?.[0] ?? 0;
    return { x0: x(lo), x1: x(hi), lam: l, mid: (x(lo) + x(hi)) / 2 };
  });
  const path = segs.map((s, i) => `${i ? "L" : "M"}${s.x0.toFixed(1)},${y(s.lam).toFixed(1)} L${s.x1.toFixed(1)},${y(s.lam).toFixed(1)}`).join(" ");
  const nx = x(win.elapsed);
  const nearEnd = win.elapsed > 0.82;

  return (
    <div className="panel panel-pad">
      <div className="bandtop">
        <div>
          <h2 className="serif">The night, and how much of it to believe</h2>
          <p className="sub">
            US venues of every kind — regular session and extended hours — are shut from 20:00 to
            04:00 ET. Shrinkage below is fitted walk-forward on closed windows only.
          </p>
        </div>
        <div className="trustnow">
          <div className="big">{Math.round(lam[0] * 100)}%</div>
          <div className="cap">
            of the common move survives
            <br />± {band ? band.toFixed(0) : "—"} bps typical error
          </div>
        </div>
      </div>
      <div className="chartbox">
        <svg viewBox={`0 0 ${W} ${H}`} width={W} height={H} role="img"
          aria-label="Share of the venue quote that survives to the reopen, across the dark window">
          <rect x={L} y={T} width={W - L - R} height={H - T - B} fill="var(--sunk)" rx="6" />
          {[0, 0.25, 0.5, 0.75, 1].map((v) => (
            <g key={v}>
              <line x1={L} y1={y(v)} x2={W - R} y2={y(v)} stroke="var(--grid)" strokeWidth="1" />
              <text x={L - 10} y={y(v) + 4} textAnchor="end" fontSize="11" fill="var(--faint)"
                fontFamily="IBM Plex Mono, monospace">{Math.round(v * 100)}%</text>
            </g>
          ))}
          {segs.map((s, i) => (
            <g key={i}>
              <rect x={s.x0} y={y(s.lam)} width={s.x1 - s.x0} height={H - B - y(s.lam)}
                fill="var(--lamp)" opacity=".13" />
              <text x={s.mid} y={y(s.lam) - 9} textAnchor="middle" fontSize="12"
                fontFamily="IBM Plex Mono, monospace" fill="var(--lamp)">{s.lam.toFixed(2)}</text>
            </g>
          ))}
          <path d={path} fill="none" stroke="var(--lamp)" strokeWidth="2.5" strokeLinejoin="round" />
          {Array.from({ length: steps + 1 }, (_, i) => {
            const frac = i / steps;
            const t = new Date(+win.start + frac * hours * 3600e3);
            return (
              <g key={i}>
                <line x1={x(frac)} y1={H - B} x2={x(frac)} y2={H - B + 5} stroke="var(--line)" />
                <text x={x(frac)} y={H - B + 20} textAnchor="middle" fontSize="11"
                  fontFamily="IBM Plex Mono, monospace" fill="var(--faint)">
                  {fmtET(t, { hour: "2-digit" })}:00
                </text>
              </g>
            );
          })}
          <text x={L} y={H - 8} fontSize="11" fill="var(--faint)" fontFamily="IBM Plex Mono, monospace">US CLOSE</text>
          <text x={W - R} y={H - 8} textAnchor="end" fontSize="11" fill="var(--faint)"
            fontFamily="IBM Plex Mono, monospace">PRE-MARKET REOPEN</text>
          <line x1={nx} y1={T} x2={nx} y2={H - B} stroke="var(--sea)" strokeWidth="2" strokeDasharray="4 3" />
          <circle cx={nx} cy={T} r="4" fill="var(--sea)" />
          <text x={nearEnd ? nx - 9 : nx + 9} y={T + 14} textAnchor={nearEnd ? "end" : "start"}
            fontSize="11.5" fontFamily="IBM Plex Mono, monospace" fill="var(--sea)">
            {win.active ? "NOW" : "WINDOW CLOSE"}
          </text>
          <text x={L} y={T - 11} fontSize="11" fill="var(--faint)" fontFamily="IBM Plex Mono, monospace">
            SHARE OF THE QUOTE&apos;S MOVE THAT SURVIVES TO THE REOPEN
          </text>
        </svg>
      </div>
    </div>
  );
}
