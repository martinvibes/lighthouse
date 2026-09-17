import type { Calibration, Ledger, Row } from "./model";
import type { DarkWindow } from "./time";

/** The exact facts the research model is allowed to reason from. Nothing else reaches it. */
export function deskState(
  cal: Calibration | null, led: Ledger | null, win: DarkWindow | null,
  rows: Row[], lam: [number, number], band: number | null
): string {
  if (!cal || !win) return "";
  const g = cal.weekend_gap;
  const H = led?.summary.by_horizon ?? {};
  const top = rows.slice(0, 16).map((r) =>
    `${r.ticker}: session close ${r.anchor.toFixed(2)}, venue quote ${r.quote.toFixed(2)} ` +
    `(${(r.quoteRet * 1e4).toFixed(0)} bps off the close), fair value ${r.fair.toFixed(2)}, ` +
    `quote minus fair ${r.devBps.toFixed(0)} bps, ${r.wide ? "OUTSIDE the band" : "inside the band"}, beta ${r.beta.toFixed(2)}`
  ).join("\n");

  return `DESK STATE — every figure below is measured. Do not invent others.
Window: ${win.kind}, ${win.active ? "currently dark" : "closed, replaying its last quotes"}, ${(win.elapsed * 100).toFixed(0)}% elapsed, reopen at 04:00 ET.
Shrinkage in force: ${lam[0].toFixed(2)} on the common move, ${lam[1].toFixed(2)} on the name-specific move.
Calibrated typical error at this hour: ${band ?? "n/a"} bps.
Weekend repricing: median ${g.median_bps.toFixed(0)} bps, p90 ${g.p90_bps.toFixed(0)} bps, ${(g.share_over_200bps * 100).toFixed(0)}% exceed 200 bps, over ${g.n} weekends.
Calibrated on ${cal.n_windows.overnight} overnight windows spanning ${cal.span[0]} to ${cal.span[1]}.

WALK-FORWARD MEDIAN ABSOLUTE ERROR against the 04:00 ET reopen (${led?.summary.n_rows ?? 0} graded forecasts):
${Object.entries(H).map(([k, v]) =>
  `  ${Math.round(+k * 100)}% into the window: assume-close-held ${v.last_close_medae.toFixed(1)} bps, ` +
  `venue quote ${v.venue_medae.toFixed(1)} bps, Lighthouse ${v.lighthouse_medae.toFixed(1)} bps ` +
  `(beats the venue on ${(v.lighthouse_beats_venue_share * 100).toFixed(0)}% of individual forecasts)`).join("\n")}

TONIGHT'S BOARD
${top}`;
}
