"use client";
import Board from "@/components/Board";
import Instrument from "@/components/Instrument";
import TrustCurve from "@/components/TrustCurve";
import { useDesk } from "@/lib/desk";
import { fmtET } from "@/lib/time";
import Link from "next/link";

export default function DeskPage() {
  const { rows, band, win, cal, led, loading } = useDesk();
  const wide = rows.filter((r) => r.wide);
  const worst = rows[0];
  const medDev = rows.length
    ? [...rows].map((r) => Math.abs(r.devBps)).sort((a, b) => a - b)[Math.floor(rows.length / 2)] : 0;

  return (
    <>
      <section style={{ display: "grid", gap: 10, paddingTop: 4 }}>
        <h1 className="serif" style={{ fontSize: 34, lineHeight: 1.1, maxWidth: "20ch" }}>
          The tape is dark. The prices are not.
        </h1>
        <p className="prose" style={{ maxWidth: "62ch" }}>
          Bitget keeps quoting tokenized US equities after NYSE and Nasdaq close, and says plainly that those
          are <b>indicative quotes, not transaction prices</b>. This desk measures how much of tonight&apos;s quote
          survives to the 04:00 ET reopen, marks the names where it won&apos;t, and publishes every forecast it
          has ever graded.
        </p>
      </section>

      <div className="grid-4">
        <Kpi label="Names watched" v={String(rows.length)}
             sub={cal ? `${cal.universe_dropped_stale.length} dropped for stale books` : "…"} />
        <Kpi label="Quotes outside the band" v={String(wide.length)} bad={wide.length > 0}
             sub={worst ? `widest ${worst.ticker} at ${worst.devBps >= 0 ? "+" : ""}${worst.devBps.toFixed(0)} bps` : "—"} />
        <Kpi label="Median quote − fair" v={`${medDev.toFixed(0)} bps`}
             sub={band !== null ? `tonight's tolerance ±${band} bps` : "—"} />
        <Kpi label="Window closes" v={win ? fmtET(win.end, { hour: "2-digit", minute: "2-digit" }) : "—"}
             sub={win ? `${win.kind === "weekend" ? "weekend" : "overnight"} · ${(win.elapsed * 100).toFixed(0)}% elapsed` : "…"} lamp />
      </div>

      <div className="grid-2">
        <Instrument />
        <TrustCurve />
      </div>

      <Board />

      <section className="panel">
        <div className="panel-body" style={{ display: "flex", gap: 20, alignItems: "center", flexWrap: "wrap" }}>
          <div style={{ flex: 1, minWidth: 260 }}>
            <div className="label">What this is worth</div>
            <p className="prose" style={{ marginTop: 6, marginBottom: 0 }}>
              rTokens are accepted as collateral in Bitget&apos;s unified account at up to 95%. At night your margin
              is marked at a price nobody traded on. <Link href="/collateral" style={{ color: "var(--lamp)" }}>
              See what that does to your liquidation distance →</Link>
            </p>
          </div>
          <div style={{ display: "flex", gap: 22 }}>
            <Stat v={led ? led.summary.n_rows.toLocaleString() : "—"} k="graded forecasts" />
            <Stat v={cal ? String(cal.n_windows.overnight) : "—"} k="closed windows" />
            <Stat v={led ? `−${Math.abs(led.summary.by_horizon["0.75"].lighthouse_vs_lastclose_pct).toFixed(0)}%` : "—"} k="error vs baseline" lamp />
          </div>
        </div>
      </section>

      {loading && !rows.length && <p className="faint" style={{ textAlign: "center" }}>Reading Bitget…</p>}
    </>
  );
}

const Kpi = ({ label, v, sub, bad, lamp }: { label: string; v: string; sub: string; bad?: boolean; lamp?: boolean }) => (
  <div className="kpi">
    <div className="label">{label}</div>
    <div className="v num" style={{ color: bad ? "var(--down)" : lamp ? "var(--lamp)" : undefined }}>{v}</div>
    <div className="sub">{sub}</div>
  </div>
);

const Stat = ({ v, k, lamp }: { v: string; k: string; lamp?: boolean }) => (
  <div>
    <div className="num" style={{ fontSize: 21, letterSpacing: "-.03em", color: lamp ? "var(--lamp)" : undefined }}>{v}</div>
    <div className="label" style={{ marginTop: 2 }}>{k}</div>
  </div>
);
