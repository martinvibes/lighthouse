"use client";
import { useMemo, useState } from "react";
import { useDesk } from "@/lib/desk";

const HORIZONS: [string, string][] = [["0.25", "≈22:00 ET"], ["0.50", "≈00:00 ET"], ["0.75", "≈02:00 ET"], ["0.90", "≈03:10 ET"]];

export default function RecordPage() {
  const { cal, led } = useDesk();
  const [only, setOnly] = useState<"all" | "win" | "lose">("all");

  const per = useMemo(() => {
    const rows = led?.per_symbol ?? [];
    const f = only === "all" ? rows : rows.filter((r) => (only === "win" ? r.lighthouse < r.venue : r.lighthouse >= r.venue));
    return [...f].sort((a, b) => a.vs_lastclose_pct - b.vs_lastclose_pct);
  }, [led, only]);

  if (!cal || !led) return <p className="faint">Loading the record…</p>;
  const H = led.summary.by_horizon;

  return (
    <>
      <section style={{ display: "grid", gap: 10, paddingTop: 4 }}>
        <h1 className="serif" style={{ fontSize: 32, lineHeight: 1.12, maxWidth: "22ch" }}>
          Every forecast, graded against what actually happened.
        </h1>
        <p className="prose" style={{ maxWidth: "66ch" }}>
          Each row below was produced by weights fitted only on windows that had already closed, then scored
          against the 04:00 ET reopen it never saw. The full {led.summary.n_rows.toLocaleString()}-row ledger is
          published as a CSV so the numbers on this page can be recomputed from scratch.
        </p>
      </section>

      <div className="grid-4">
        <Kpi label="Graded forecasts" v={led.summary.n_rows.toLocaleString()} sub="walk-forward, never in-sample" />
        <Kpi label="Closed windows" v={String(cal.n_windows.overnight)} sub={`${cal.span[0].slice(0, 10)} → ${cal.span[1].slice(0, 10)}`} />
        <Kpi label="Names in the universe" v={String(cal.universe.length)} sub={`${cal.universe_dropped_stale.length} dropped for stale books`} />
        <Kpi label="Best improvement" v={`−${Math.abs(H["0.90"].lighthouse_vs_lastclose_pct).toFixed(0)}%`} lamp sub="late-window error vs the baseline" />
      </div>

      <section className="panel">
        <div className="panel-head">
          <h3>Median absolute error against the reopen</h3>
          <span className="spacer" />
          <span className="label">basis points · lower is better</span>
        </div>
        <div className="tablewrap">
          <table className="grid">
            <thead>
              <tr>
                <th>Into the dark window</th><th>Forecasts</th><th>Assume the close held</th>
                <th>Bitget&apos;s quote</th><th>Lighthouse</th><th>vs baseline</th><th>Beats the venue</th>
              </tr>
            </thead>
            <tbody>
              {HORIZONS.map(([k, when]) => {
                const v = H[k];
                if (!v) return null;
                return (
                  <tr key={k} style={{ cursor: "default" }}>
                    <td><b>{Math.round(+k * 100)}%</b> <span className="faint">{when}</span></td>
                    <td className="num faint">{v.n.toLocaleString()}</td>
                    <td className="num dim">{v.last_close_medae.toFixed(1)}</td>
                    <td className="num" style={{ color: "var(--sea)" }}>{v.venue_medae.toFixed(1)}</td>
                    <td className="num lamp"><b>{v.lighthouse_medae.toFixed(1)}</b></td>
                    <td className="num up">{v.lighthouse_vs_lastclose_pct.toFixed(1)}%</td>
                    <td className="num">{(v.lighthouse_beats_venue_share * 100).toFixed(1)}%</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <div className="panel-note">
          The first row is the finding that surprised us: two hours into the dark window Bitget&apos;s own quote is
          <b> worse</b> than assuming the close held (33.4 vs 32.5 bps). The quote only starts carrying real
          information in the last stretch before the reopen.
        </div>
      </section>

      <section className="panel">
        <div className="panel-head">
          <h3>Name by name</h3>
          <span className="spacer" />
          <div style={{ display: "flex", gap: 4 }}>
            {(["all", "win", "lose"] as const).map((k) => (
              <button key={k} className="btn ghost" style={{
                padding: "4px 10px", fontSize: 11.5,
                ...(only === k ? { color: "var(--lamp-ink)", borderColor: "var(--lamp)", background: "var(--lamp-wash)" } : {}),
              }} onClick={() => setOnly(k)}>
                {k === "all" ? "All" : k === "win" ? "We beat the venue" : "The venue beats us"}
              </button>
            ))}
          </div>
        </div>
        <div className="tablewrap">
          <table className="grid">
            <thead>
              <tr><th>Name</th><th>Forecasts</th><th>Close held</th><th>Venue</th><th>Lighthouse</th>
                  <th>vs baseline</th><th>Beat rate</th><th>Typical overnight move</th></tr>
            </thead>
            <tbody>
              {per.map((r) => (
                <tr key={r.symbol} style={{ cursor: "default" }}>
                  <td><span className="tick">{r.ticker}</span></td>
                  <td className="num faint">{r.n}</td>
                  <td className="num dim">{r.last_close.toFixed(1)}</td>
                  <td className="num" style={{ color: "var(--sea)" }}>{r.venue.toFixed(1)}</td>
                  <td className="num" style={{ color: r.lighthouse < r.venue ? "var(--lamp)" : "var(--text)" }}>
                    {r.lighthouse.toFixed(1)}
                  </td>
                  <td className={`num ${r.vs_lastclose_pct < 0 ? "up" : "down"}`}>{r.vs_lastclose_pct.toFixed(1)}%</td>
                  <td className="num">{(r.beat_venue_share * 100).toFixed(0)}%</td>
                  <td className="num faint">{r.median_realised_bps.toFixed(0)} bps</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="panel-note">
          Published in both directions. LITE, MU and TQQQ are where the model earns its keep; JPM and EWZ are
          names where the venue&apos;s quote is simply better than ours, and we have not hidden them.
        </div>
      </section>

      <section className="panel">
        <div className="panel-head"><h3>Check it yourself</h3></div>
        <div className="panel-body" style={{ display: "flex", gap: 24, flexWrap: "wrap", alignItems: "center" }}>
          <p className="prose" style={{ flex: 1, minWidth: 260, margin: 0 }}>
            Every graded forecast, with its anchor close, the venue quote at the time, our fair value, the
            realised reopen, and the shrinkage weights that were in force — one row each.
          </p>
          <div style={{ display: "flex", gap: 8 }}>
            <a className="btn" href="/ledger.csv" download>Download the ledger (CSV)</a>
            <a className="btn ghost" href="/calibration.json" target="_blank" rel="noreferrer">Frozen calibration</a>
          </div>
        </div>
      </section>
    </>
  );
}

const Kpi = ({ label, v, sub, lamp }: { label: string; v: string; sub: string; lamp?: boolean }) => (
  <div className="kpi">
    <div className="label">{label}</div>
    <div className="v num" style={{ color: lamp ? "var(--lamp)" : undefined }}>{v}</div>
    <div className="sub">{sub}</div>
  </div>
);
