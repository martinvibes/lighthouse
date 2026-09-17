"use client";
import { motion } from "framer-motion";
import Link from "next/link";
import { useEffect, useState } from "react";
import Board from "@/components/Board";
import Instrument from "@/components/Instrument";
import TrustCurve from "@/components/TrustCurve";
import { useDesk } from "@/lib/desk";
import { fmtET } from "@/lib/time";

function Countdown() {
  const { win } = useDesk();
  const [now, setNow] = useState<Date | null>(null);
  useEffect(() => {
    setNow(new Date());
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);
  if (!win || !now) return <>--:--:--</>;
  const ms = Math.max(0, +win.end - +now);
  const p = (n: number) => String(n).padStart(2, "0");
  return <>{p(Math.floor(ms / 3.6e6))}:{p(Math.floor((ms % 3.6e6) / 6e4))}:{p(Math.floor((ms % 6e4) / 1000))}</>;
}

export default function DeskPage() {
  const { rows, band, win, cal, updated, err } = useDesk();
  const wide = rows.filter((r) => r.wide);
  const worst = [...rows].sort((a, b) => Math.abs(b.devBps) - Math.abs(a.devBps))[0];
  const medDev = rows.length
    ? [...rows].map((r) => Math.abs(r.devBps)).sort((a, b) => a - b)[Math.floor(rows.length / 2)] : 0;

  return (
    <main className="relative min-h-screen px-4 md:px-6 py-5 max-w-[1480px] mx-auto z-10">
      <div className="grid-atmos fixed inset-0 -z-10 opacity-25" />

      <motion.header
        initial={{ opacity: 0, y: -16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, ease: "easeOut" }}
        className="flex items-end justify-between gap-4 flex-wrap"
      >
        <div>
          <h1 className="text-[27px] font-semibold tracking-[-0.02em] leading-none">Live Desk</h1>
          <p className="text-[13px] text-[var(--color-muted)] mt-2">
            Tokenized US equities · {win?.kind === "weekend" ? "weekend" : "overnight"} window · reopen 04:00 ET
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <div
            className="inline-flex items-center gap-2.5 rounded-full px-3.5 py-1.5 hairline"
            style={{ background: "rgba(255,255,255,0.02)" }}
          >
            <span
              className="h-2 w-2 rounded-full live-dot"
              style={{ background: win?.active ? "var(--color-mint)" : "var(--color-faint)",
                       boxShadow: win?.active ? "0 0 10px var(--color-mint)" : undefined }}
            />
            <span className="label" style={{ color: win?.active ? "var(--color-mint)" : undefined }}>
              {win?.active ? "MARKET DARK" : "US OPEN"}
            </span>
            <span className="text-[11px] text-[var(--color-faint)] hidden sm:inline">
              {win?.active ? "indicative quotes only" : "replaying last window"}
            </span>
          </div>
          <Chip label="reopen in" value={<Countdown />} accent="var(--color-mint)" />
          {updated && <Chip label="updated" value={fmtET(updated, { hour: "2-digit", minute: "2-digit", second: "2-digit" })} />}
        </div>
      </motion.header>

      {err && (
        <div className="mt-4 hairline rounded-xl px-4 py-2.5 text-[12.5px]"
             style={{ background: "rgba(255,93,108,0.08)", color: "var(--color-danger)" }}>{err}</div>
      )}

      <section className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 mt-5">
        <Ribbon label="names watched" value={rows.length ? String(rows.length) : "—"}
                sub={cal ? `${cal.universe_dropped_stale.length} dropped, stale` : "…"} delay={0.04} />
        <Ribbon label="outside the band" value={String(wide.length)}
                sub={worst ? `widest ${worst.ticker}` : "—"}
                accent={wide.length ? "var(--color-danger)" : "var(--color-mint)"} delay={0.08} />
        <Ribbon label="median quote − fair" value={`${medDev.toFixed(0)} bps`}
                sub="across the tape" accent="var(--color-cyan)" delay={0.12} />
        <Ribbon label="tolerance now" value={band !== null ? `±${band}` : "—"}
                sub="measured, this hour" accent="var(--color-mint)" delay={0.16} />
        <Ribbon label="window elapsed" value={win ? `${(win.elapsed * 100).toFixed(0)}%` : "—"}
                sub={win ? `${fmtET(win.start, { hour: "2-digit", minute: "2-digit" })} → 04:00 ET` : "…"} delay={0.2} />
        <Ribbon label="weekend p90" value={cal ? `${cal.weekend_gap.p90_bps.toFixed(0)} bps` : "—"}
                sub="friday close → monday open" accent="var(--color-amber)" delay={0.24} />
      </section>

      <section className="grid grid-cols-1 lg:grid-cols-12 gap-4 mt-4">
        <Cell className="lg:col-span-8" delay={0.1}><Instrument /></Cell>
        <Cell className="lg:col-span-4" delay={0.16}><TrustCurve /></Cell>
      </section>

      <section className="mt-4">
        <Cell delay={0.2}><Board /></Cell>
      </section>

      <motion.section
        initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.26, duration: 0.5 }}
        className="glass mt-4 px-5 py-5 flex items-center gap-6 flex-wrap"
      >
        <div className="flex-1 min-w-[280px]">
          <div className="label mb-2">what this is worth</div>
          <p className="text-[14px] text-[var(--color-muted)] leading-relaxed max-w-[560px]">
            rTokens are accepted as collateral in the unified account at up to 95%. At night your margin is
            marked at a price nobody traded on.
          </p>
        </div>
        <Link
          href="/collateral"
          className="inline-flex items-center gap-2 rounded-full px-5 py-2.5 text-[13.5px] font-semibold transition-transform hover:scale-[1.03] active:scale-95"
          style={{ background: "var(--color-mint)", color: "#08080b", boxShadow: "0 0 34px -10px var(--color-mint)" }}
        >
          Price your liquidation distance →
        </Link>
      </motion.section>
    </main>
  );
}

function Chip({ label, value, accent }: { label: string; value: React.ReactNode; accent?: string }) {
  return (
    <div className="inline-flex items-center gap-2 rounded-full px-3.5 py-1.5 hairline" style={{ background: "rgba(255,255,255,0.02)" }}>
      <span className="label">{label}</span>
      <span className="tnum text-[12.5px]" style={accent ? { color: accent } : undefined}>{value}</span>
    </div>
  );
}

function Ribbon({ label, value, sub, accent, delay = 0 }: {
  label: string; value: React.ReactNode; sub?: string; accent?: string; delay?: number;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
      transition={{ delay, duration: 0.5, ease: "easeOut" }}
      className="glass px-5 py-4 flex flex-col justify-between min-h-[104px]"
    >
      <div className="label">{label}</div>
      <div className="tnum text-[26px] mt-2 leading-none" style={accent ? { color: accent } : undefined}>{value}</div>
      {sub && <div className="text-[11px] text-[var(--color-muted)] mt-1.5">{sub}</div>}
    </motion.div>
  );
}

function Cell({ children, className = "", delay = 0 }: { children: React.ReactNode; className?: string; delay?: number }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }}
      transition={{ delay, duration: 0.55, ease: "easeOut" }}
      className={className}
    >
      {children}
    </motion.div>
  );
}
