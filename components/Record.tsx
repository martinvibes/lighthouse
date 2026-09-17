"use client";
import type { Calibration, Ledger } from "@/lib/model";

const LABELS: Record<string, string> = { "0.25": "22:00 ET", "0.50": "00:00 ET", "0.75": "02:00 ET", "0.90": "03:10 ET" };

export default function Record({ cal, led }: { cal: Calibration; led: Ledger | null }) {
  const H = led?.summary.by_horizon ?? null;
  const g = cal.weekend_gap;
  const os = cal.overshoot["0.90"];
  const P = led?.per_symbol ?? [];
  const show = P.length > 12 ? [...P.slice(0, 8), null, ...P.slice(-4)] : P;

  return (
    <>
      <section>
        <div className="sechead">
          <div>
            <h2 className="serif">The record</h2>
            <p className="sub">
              Walk-forward: at every dark window the model is calibrated only on windows that had already
              closed, then asked to predict the next. Median absolute error against the 04:00 ET reopen,
              in basis points. Lower is better.
            </p>
          </div>
        </div>
        <div className="grid2">
          {H && Object.entries(H).map(([k, d]) => {
            const vpct = (d.venue_medae / d.last_close_medae - 1) * 100;
            const cls = (v: number) => (v < 0 ? "win" : "lose");
            return (
              <div className="stat" key={k}>
                <div className="k">{LABELS[k] ?? k} · {Math.round(+k * 100)}% into the night</div>
                <div className="v">{d.lighthouse_medae.toFixed(1)}<span style={{ fontSize: 14, color: "var(--faint)" }}> bps</span></div>
                <div className="n">
                  Lighthouse <b className={cls(d.lighthouse_vs_lastclose_pct)}>
                    {d.lighthouse_vs_lastclose_pct > 0 ? "+" : ""}{d.lighthouse_vs_lastclose_pct.toFixed(0)}%</b>{" "}
                  vs assuming the close held ({d.last_close_medae.toFixed(1)} bps).<br />
                  Raw venue quote <b className={cls(vpct)}>{vpct > 0 ? "+" : ""}{vpct.toFixed(0)}%</b> ({d.venue_medae.toFixed(1)} bps).<br />
                  <span style={{ color: "var(--faint)" }}>
                    {d.n.toLocaleString()} graded forecasts, beats the venue on {Math.round(d.lighthouse_beats_venue_share * 100)}%.
                  </span>
                </div>
              </div>
            );
          })}
          <div className="stat">
            <div className="k">Weekend repricing</div>
            <div className="v">{g.median_bps.toFixed(0)}<span style={{ fontSize: 14, color: "var(--faint)" }}> bps</span></div>
            <div className="n">
              Median Friday close → Monday reopen across {g.n} name-weekends. 90th percentile {g.p90_bps.toFixed(0)} bps;{" "}
              <b>{(g.share_over_200bps * 100).toFixed(0)}%</b> exceed 200 bps. rTokens are accepted as collateral at up to 95%.
            </div>
          </div>
          <div className="stat">
            <div className="k">Quote overshoot at 03:00 ET</div>
            <div className="v">{os.ratio.toFixed(2)}<span style={{ fontSize: 14, color: "var(--faint)" }}>×</span></div>
            <div className="n">
              The venue quote moves {os.median_quote_move_bps.toFixed(0)} bps while the repricing that actually
              sticks is {os.median_realised_bps.toFixed(0)} bps.
            </div>
          </div>
        </div>
      </section>

      <section>
        <div className="sechead">
          <div>
            <h2 className="serif">Where it helps, and where it doesn&apos;t</h2>
            <p className="sub">
              Median absolute error per name across the whole ledger. The model earns its keep where there is
              something to explain; on quiet mega-caps it is a rounding error either way, and occasionally
              slightly worse. Both ends shown.
            </p>
          </div>
        </div>
        <div className="tablewrap">
          <table>
            <thead><tr><th>Instrument</th><th>Rows</th><th>Typical reopen move</th><th>Assume close held</th><th>Lighthouse</th><th>Change</th></tr></thead>
            <tbody>
              {show.map((d, i) =>
                d === null ? (
                  <tr key="gap"><td colSpan={6} style={{ textAlign: "center", color: "var(--faint)", fontFamily: "IBM Plex Mono, monospace", fontSize: 11, letterSpacing: ".1em", padding: 9 }}>
                    {P.length - 12} MORE NAMES IN THE LEDGER
                  </td></tr>
                ) : (
                  <tr key={d.symbol} className={`stripe ${d.vs_lastclose_pct < 0 ? "" : "wide"}`} style={{ cursor: "default" }}>
                    <td className="tkr">{d.ticker}<span>{d.symbol}</span></td>
                    <td className="num">{d.n}</td>
                    <td className="num">{d.median_realised_bps.toFixed(0)} bps</td>
                    <td className="num">{d.last_close.toFixed(1)}</td>
                    <td className="num">{d.lighthouse.toFixed(1)}</td>
                    <td className={`num ${d.vs_lastclose_pct < 0 ? "win" : "lose"}`}>
                      {d.vs_lastclose_pct > 0 ? "+" : ""}{d.vs_lastclose_pct.toFixed(0)}%
                    </td>
                  </tr>
                )
              )}
            </tbody>
          </table>
        </div>
        <p className="note">
          Ground truth is the 04:00 ET pre-market reopen. The dark window is <code>20:00 → 04:00 ET</code>,
          not 16:00 → 09:30: US extended-hours sessions cover the rest, and treating them as dark inflates
          every result. {cal.universe_dropped_stale.length} names were dropped as stale — their price is
          identical at the close and the reopen, so there is nothing to price. Every forecast is in{" "}
          <a href="/ledger.csv">ledger.csv</a> — {led?.summary.n_rows.toLocaleString() ?? "~21,000"} rows,
          each written before its own answer was known.
        </p>
      </section>
    </>
  );
}
