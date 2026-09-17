"use client";
import { useEffect, useMemo, useState } from "react";
import { useDesk } from "@/lib/desk";
import { curveFor, exceedProb } from "@/lib/risk";

type Leg = { symbol: string; qty: number };
const usd = (v: number) => v.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });

export default function Collateral() {
  const { rows, tails, horizon, band, win, cal, led } = useDesk();
  const [legs, setLegs] = useState<Leg[]>([]);
  const [debt, setDebt] = useState(50_000);
  const [haircut, setHaircut] = useState(0.95);

  // Open on a realistic book rather than an empty form: the three deepest names on the board.
  useEffect(() => {
    if (legs.length || rows.length < 3) return;
    const deep = [...rows].sort((a, b) => b.volume - a.volume).slice(0, 3);
    setLegs(deep.map((r) => ({ symbol: r.symbol, qty: Math.max(1, Math.round(30_000 / r.quote)) })));
  }, [rows, legs.length]);

  const book = useMemo(() => legs.map((l) => {
    const r = rows.find((x) => x.symbol === l.symbol);
    return r ? { ...l, r, venue: l.qty * r.quote, fair: l.qty * r.fair } : null;
  }).filter(Boolean) as { symbol: string; qty: number; r: (typeof rows)[0]; venue: number; fair: number }[], [legs, rows]);

  const V = book.reduce((s, b) => s + b.venue, 0);
  const F = book.reduce((s, b) => s + b.fair, 0);
  const mirageBps = F > 0 ? ((V - F) / F) * 1e4 : 0;

  const liqValue = debt / haircut;              // portfolio mark at which collateral stops covering the debt
  const distVenue = V > 0 ? ((V - liqValue) / V) * 1e4 : 0;
  const distFair = F > 0 ? ((F - liqValue) / F) * 1e4 : 0;
  const mrVenue = debt > 0 ? (V * haircut) / debt : Infinity;
  const mrFair = debt > 0 ? (F * haircut) / debt : Infinity;

  // Blend the per-name measured error tails by position weight. Correlation between names is ignored,
  // which makes the probability below a floor rather than a ceiling.
  const blended = useMemo(() => {
    if (!tails || !book.length) return null;
    const grid = tails.grid.map(() => 0);
    let w = 0;
    for (const b of book) {
      const c = curveFor(tails, b.symbol, horizon);
      if (!c) continue;
      for (let i = 0; i < grid.length; i++) grid[i] += c[i] * b.fair;
      w += b.fair;
    }
    return w > 0 ? grid.map((g) => g / w) : null;
  }, [tails, book, horizon]);

  const pCross = !blended || !tails ? null : distFair > 0 ? exceedProb(tails, blended, distFair) / 2 : 0.5;
  const severity = pCross === null ? "unknown" : pCross > 0.10 ? "bad" : pCross > 0.03 ? "warn" : "ok";
  const set = (i: number, patch: Partial<Leg>) => setLegs((ls) => ls.map((l, j) => (j === i ? { ...l, ...patch } : l)));
  const rich = Math.abs(mirageBps) > (band ?? 30);

  return (
    <>
      <section style={{ display: "grid", gap: 10, paddingTop: 4 }}>
        <h1 className="serif" style={{ fontSize: 32, lineHeight: 1.12, maxWidth: "24ch" }}>
          Your margin is marked at a price nobody traded on.
        </h1>
        <p className="prose" style={{ maxWidth: "66ch" }}>
          Bitget accepts rTokens as collateral in the unified account at up to 95%. Between 20:00 and 04:00 ET
          no US venue is quoting, so the mark on your book is the indicative price — and we have measured, across{" "}
          {led ? led.summary.n_rows.toLocaleString() : "20,934"} graded forecasts, how far that quote tends to sit
          from where the market actually reopens. This is what that gap does to your liquidation distance.
        </p>
      </section>

      <div className="grid-2">
        <section className="panel">
          <div className="panel-head">
            <h3>Your book</h3>
            <span className="spacer" />
            <button className="btn ghost" style={{ padding: "5px 10px", fontSize: 12 }}
              onClick={() => rows[0] && setLegs((l) => [...l, { symbol: rows[0].symbol, qty: 100 }])}>
              + Add a leg
            </button>
          </div>
          <div className="tablewrap">
            <table className="grid">
              <thead>
                <tr><th>Holding</th><th>Quantity</th><th>At the venue mark</th><th>At fair value</th><th /></tr>
              </thead>
              <tbody>
                {book.map((b, i) => (
                  <tr key={i} style={{ cursor: "default" }}>
                    <td>
                      <select value={b.symbol} onChange={(e) => set(i, { symbol: e.target.value })}
                              style={{ width: 128, padding: "5px 8px", fontSize: 12.5 }}>
                        {rows.map((r) => <option key={r.symbol} value={r.symbol}>r{r.ticker}</option>)}
                      </select>
                    </td>
                    <td>
                      <input type="number" value={b.qty} min={0}
                             onChange={(e) => set(i, { qty: Math.max(0, +e.target.value) })}
                             style={{ width: 96, padding: "5px 8px", fontSize: 12.5, textAlign: "right" }} />
                    </td>
                    <td className="num">{usd(b.venue)}</td>
                    <td className="num lamp">{usd(b.fair)}</td>
                    <td>
                      <button className="btn ghost" style={{ padding: "3px 8px", fontSize: 11 }}
                              onClick={() => setLegs((l) => l.filter((_, j) => j !== i))}>Remove</button>
                    </td>
                  </tr>
                ))}
                {!book.length && <tr><td colSpan={5} className="faint" style={{ textAlign: "center", padding: 28 }}>
                  Waiting for the board…</td></tr>}
              </tbody>
              <tfoot>
                <tr>
                  <td className="label">Total</td><td />
                  <td className="num">{usd(V)}</td>
                  <td className="num lamp">{usd(F)}</td><td />
                </tr>
              </tfoot>
            </table>
          </div>
          <div className="panel-body" style={{ borderTop: "1px solid var(--line-soft)", display: "grid", gap: 14, gridTemplateColumns: "1fr 1fr" }}>
            <label className="field">
              <span>Borrowed against it (USDT)</span>
              <input type="number" value={debt} min={0} step={1000} className="num"
                     onChange={(e) => setDebt(Math.max(0, +e.target.value))} />
            </label>
            <label className="field">
              <span>Collateral haircut · {(haircut * 100).toFixed(0)}%</span>
              <input type="range" min={50} max={95} value={haircut * 100}
                     onChange={(e) => setHaircut(+e.target.value / 100)}
                     style={{ padding: 0, border: "none", background: "transparent", accentColor: "var(--lamp)" }} />
            </label>
          </div>
        </section>

        <section className="panel">
          <div className="panel-head">
            <h3>The mirage</h3>
            <span className="spacer" />
            <span className={`pill ${severity === "bad" ? "warn" : severity === "warn" ? "live" : ""}`}>
              {severity === "bad" ? "Exposed" : severity === "warn" ? "Thin" : "Comfortable"}
            </span>
          </div>
          <div className="panel-body" style={{ display: "grid", gap: 16 }}>
            <div>
              <div className="label">Chance the 04:00 reopen takes you through liquidation</div>
              <div className="num" style={{
                fontSize: 52, letterSpacing: "-.045em", lineHeight: 1.05, marginTop: 4,
                color: severity === "bad" ? "var(--down)" : severity === "warn" ? "var(--lamp)" : "var(--up)",
              }}>
                {pCross === null ? "—" : `${(pCross * 100).toFixed(1)}%`}
              </div>
              <div className="faint" style={{ fontSize: 12, marginTop: 4 }}>
                Read off the measured error distribution for the names you actually hold, at{" "}
                {win ? `${(win.elapsed * 100).toFixed(0)}%` : "this point"} through the window. Not a volatility
                model — a count of how often we have been that wrong before.
              </div>
            </div>

            <div style={{ height: 1, background: "var(--line-soft)" }} />

            <div className="grid-2" style={{ gap: 14 }}>
              <Split title="What the venue shows you" value={usd(V * haircut)}
                     rows={[["Margin ratio", mrVenue === Infinity ? "∞" : `${mrVenue.toFixed(2)}×`],
                            ["Room to liquidation", `${distVenue.toFixed(0)} bps`]]} />
              <Split title="What the reopen is likely to honour" value={usd(F * haircut)} lamp
                     rows={[["Margin ratio", mrFair === Infinity ? "∞" : `${mrFair.toFixed(2)}×`],
                            ["Room to liquidation", `${distFair.toFixed(0)} bps`]]} />
            </div>

            <div style={{
              border: "1px solid", borderRadius: "var(--r)", padding: "12px 14px",
              borderColor: rich ? "color-mix(in srgb, var(--down) 45%, transparent)" : "var(--line)",
              background: rich ? "color-mix(in srgb, var(--down) 7%, transparent)" : "var(--panel-2)",
            }}>
              <div className="label">The verdict</div>
              <p style={{ margin: "6px 0 0", fontSize: 13.5, lineHeight: 1.6 }}>
                {!book.length ? "Add a holding to see it." : (
                  <>
                    Your book is marked{" "}
                    <b className="num" style={{ color: mirageBps >= 0 ? "var(--down)" : "var(--up)" }}>
                      {Math.abs(mirageBps).toFixed(0)} bps {mirageBps >= 0 ? "richer" : "cheaper"}
                    </b>{" "}
                    than fair value — {usd(Math.abs(V - F))} of{" "}
                    {mirageBps >= 0 ? "collateral you may not actually have" : "collateral the venue is not crediting you"}.
                    {debt > 0 && <> The venue says there is {distVenue.toFixed(0)} bps of room before liquidation;
                      measured against where these names have historically reopened, it is {distFair.toFixed(0)} bps.</>}
                    {" "}This is not a trade instruction and not an order you can place. It is the size of the gap
                    between an indicative mark and a transaction price.
                  </>
                )}
              </p>
            </div>
          </div>
          <div className="panel-note">
            Simplified unified-account arithmetic: collateral = mark × haircut, liquidation when collateral stops
            covering the debt. Bitget&apos;s own maintenance rules govern your real account.
          </div>
        </section>
      </div>

      {cal && (
        <section className="panel">
          <div className="panel-head"><h3>Why the weekend is the dangerous one</h3></div>
          <div className="panel-body grid-3">
            <Big v={`${cal.weekend_gap.median_bps.toFixed(0)} bps`} k="median Friday close to Monday open" />
            <Big v={`${cal.weekend_gap.p90_bps.toFixed(0)} bps`} k="at the 90th percentile" lamp />
            <Big v={`${(cal.weekend_gap.share_over_200bps * 100).toFixed(0)}%`} k="of weekends reprice past 200 bps" bad />
          </div>
          <div className="panel-note">
            Measured across {cal.weekend_gap.n} weekend windows. A 95% haircut leaves 5% of room, and roughly one
            weekend in five moves more than 2% before anyone can trade out of it.
          </div>
        </section>
      )}
    </>
  );
}

const Split = ({ title, value, rows, lamp }: { title: string; value: string; rows: [string, string][]; lamp?: boolean }) => (
  <div style={{ border: "1px solid var(--line)", borderRadius: "var(--r)", padding: "12px 13px" }}>
    <div className="label">{title}</div>
    <div className="num" style={{ fontSize: 22, letterSpacing: "-.035em", marginTop: 4, color: lamp ? "var(--lamp)" : undefined }}>{value}</div>
    <div style={{ display: "grid", gap: 4, marginTop: 9 }}>
      {rows.map(([k, v]) => (
        <div key={k} style={{ display: "flex", justifyContent: "space-between", fontSize: 12 }}>
          <span className="faint">{k}</span><span className="num">{v}</span>
        </div>
      ))}
    </div>
  </div>
);

const Big = ({ v, k, lamp, bad }: { v: string; k: string; lamp?: boolean; bad?: boolean }) => (
  <div>
    <div className="num" style={{ fontSize: 30, letterSpacing: "-.04em", color: bad ? "var(--down)" : lamp ? "var(--lamp)" : undefined }}>{v}</div>
    <div className="dim" style={{ fontSize: 12.5, marginTop: 3 }}>{k}</div>
  </div>
);
