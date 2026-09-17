import type { Calibration, Ledger, Row } from "./model";
import type { DarkWindow } from "./time";
import type { Earnings } from "@/app/api/events/route";

/** The exact facts the research analyst is allowed to reason from. Nothing else reaches it. */
export function deskState(
  cal: Calibration | null, led: Ledger | null, win: DarkWindow | null,
  rows: Row[], lam: [number, number], band: number | null,
  events: Record<string, Earnings> = {}
): string {
  if (!cal || !win) return "";
  const g = cal.weekend_gap;
  const H = led?.summary.by_horizon ?? {};
  const track = new Map((led?.per_symbol ?? []).map((p) => [p.symbol, p]));

  const board = rows.map((r) => {
    const t = track.get(r.symbol);
    const o = cal.overshoot[r.symbol];
    return [
      `${r.ticker} (r${r.ticker}): session close ${r.anchor.toFixed(2)}, venue quote ${r.quote.toFixed(2)}`,
      `moved ${(r.quoteRet * 1e4).toFixed(0)} bps off the close, fair value ${r.fair.toFixed(2)},`,
      `quote minus fair ${r.devBps.toFixed(0)} bps, ${r.wide ? "OUTSIDE the band" : "inside the band"},`,
      `beta to the tape ${r.beta.toFixed(2)}, 24h turnover $${(r.volume / 1e6).toFixed(1)}M`,
      t ? `| track record over ${t.n} graded forecasts: our error ${t.lighthouse.toFixed(1)} bps, venue ${t.venue.toFixed(1)} bps, close-held ${t.last_close.toFixed(1)} bps, we beat the venue ${(t.beat_venue_share * 100).toFixed(0)}% of the time, typical overnight move ${t.median_realised_bps.toFixed(0)} bps` : "",
      events[r.ticker] ? `| reports earnings ${events[r.ticker].date} (${events[r.ticker].days} days away)` : "",
      o ? `| this name's quote historically moves ${o.median_quote_move_bps.toFixed(0)} bps for every ${o.median_realised_bps.toFixed(0)} bps that actually sticks (overshoot ${o.ratio.toFixed(2)}x)` : "",
    ].join(" ");
  }).join("\n");

  return `DESK STATE — every figure below is measured. Copy figures from here verbatim; never derive new ones.

THE WINDOW
Kind: ${win.kind}. ${win.active ? "Currently dark — no US venue is quoting." : "Closed; the board is replaying the last dark window's final quotes."}
Elapsed: ${(win.elapsed * 100).toFixed(0)}% of the way to the 04:00 ET reopen.
Shrinkage in force right now: ${lam[0].toFixed(2)} on the common move, ${lam[1].toFixed(2)} on the name-specific move.
(Shrinkage of 1.00 means we take the quote's move at face value; 0.70 means we keep only 70% of it and pull the rest back toward the close.)
Calibrated typical error at this hour: ${band ?? "n/a"} bps. A quote further than that from fair value is flagged.
Common move priced across the whole tape tonight: the median name has moved ${rows.length ? ((rows.reduce((s, r) => s + r.quoteRet, 0) / rows.length) * 1e4).toFixed(0) : "0"} bps off its close.

HOW GOOD ANY OF THIS IS — walk-forward median absolute error against the 04:00 ET reopen,
over ${led?.summary.n_rows.toLocaleString() ?? 0} graded forecasts on ${cal.n_windows.overnight} closed windows (${cal.span[0].slice(0, 10)} to ${cal.span[1].slice(0, 10)}):
${Object.entries(H).map(([k, v]) =>
  `  At ${Math.round(+k * 100)}% into the window: assuming the close held ${v.last_close_medae.toFixed(1)} bps, ` +
  `the venue's quote ${v.venue_medae.toFixed(1)} bps, Lighthouse ${v.lighthouse_medae.toFixed(1)} bps. ` +
  `We beat the venue on ${(v.lighthouse_beats_venue_share * 100).toFixed(0)}% of individual forecasts.`).join("\n")}

WEEKENDS (Friday 20:00 ET to Monday 04:00 ET, ${g.n} of them measured)
Median repricing ${g.median_bps.toFixed(0)} bps, 90th percentile ${g.p90_bps.toFixed(0)} bps, ${(g.share_over_200bps * 100).toFixed(0)}% of weekends move more than 200 bps.
rTokens are accepted as unified-account collateral at up to 95%, which leaves 5% of room.

COLLATERAL ARITHMETIC (for questions about margin)
Collateral = mark x haircut. Liquidation when collateral stops covering the debt. At night the mark is the
indicative quote, so the room to liquidation the venue shows is computed on a price nobody traded on.

EARNINGS CALENDAR (from Bitget's own agent server, MCP entry equity_calendar_earnings)
A name quoted far from fair value within a day or two of its report is pricing news, not drifting on a
stale mark. Say so when it applies rather than calling it a mispricing.

TONIGHT'S BOARD — ${rows.length} names, most drifted first
${board}`;
}
