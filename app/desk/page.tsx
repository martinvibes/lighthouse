"use client";
import { motion } from "framer-motion";
import Link from "next/link";
import { useEffect, useState } from "react";
import Board from "@/components/Board";
import Instrument from "@/components/Instrument";
import Verdict from "@/components/Verdict";
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

const rise = (d: number) => ({
  initial: { opacity: 0, y: 12 },
  animate: { opacity: 1, y: 0 },
  transition: { delay: d, duration: 0.5, ease: "easeOut" as const },
});

export default function DeskPage() {
  const { rows, band, win, err } = useDesk();
  const wide = rows.filter((r) => r.wide).length;

  return (
    <main className="relative min-h-screen px-4 md:px-6 py-7 max-w-[1320px] mx-auto z-10">
      <motion.header {...rise(0)} className="flex items-end justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-[26px] font-semibold tracking-[-0.02em] leading-none">Desk</h1>
          <p className="text-[13.5px] text-[var(--color-muted)] mt-2">
            Which rToken prices to believe before the 04:00 ET open.
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <span className="inline-flex items-center gap-2.5 rounded-full px-3.5 py-1.5 hairline"
                style={{ background: "rgba(255,255,255,0.025)" }}>
            <span className="h-1.5 w-1.5 rounded-full live-dot"
                  style={{ background: win?.active ? "var(--color-mint)" : "var(--color-faint)" }} />
            <span className="label" style={{ color: win?.active ? "var(--color-mint)" : undefined }}>
              {win?.active ? "market dark" : "us open"}
            </span>
          </span>
          <span className="inline-flex items-center gap-2 rounded-full px-3.5 py-1.5 hairline"
                style={{ background: "rgba(255,255,255,0.025)" }}>
            <span className="label">opens in</span>
            <span className="tnum text-[12.5px]" style={{ color: "var(--color-mint)" }}><Countdown /></span>
          </span>
        </div>
      </motion.header>

      {win && !win.active && (
        <div className="mt-4 hairline rounded-xl px-4 py-2.5 text-[12.5px] text-[var(--color-muted)]"
             style={{ background: "rgba(255,255,255,0.025)" }}>
          US markets are open right now, so these prices are real. Below is the board as it stood at the close
          of the last dark window — {fmtET(win.end, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })} ET.
        </div>
      )}

      {err && (
        <div className="mt-4 hairline rounded-xl px-4 py-2.5 text-[12.5px]"
             style={{ background: "rgba(255,93,108,0.08)", color: "var(--color-danger)" }}>{err}</div>
      )}

      <motion.section {...rise(0.05)} className="grid grid-cols-1 sm:grid-cols-3 gap-3 mt-6">
        <Tile label="prices to question tonight"
              value={rows.length ? `${wide}` : "—"}
              sub={rows.length ? `of ${rows.length} names watched` : "reading the venue…"}
              accent={wide ? "var(--color-danger)" : "var(--color-mint)"} />
        <Tile label="how far off we normally are"
              value={band !== null ? `±${band} bps` : "—"} sub="at this hour of the night" />
        <Tile label="through the window"
              value={win ? `${(win.elapsed * 100).toFixed(0)}%` : "—"} sub="20:00 → 04:00 ET" />
      </motion.section>

      <motion.section {...rise(0.1)} className="grid grid-cols-1 lg:grid-cols-12 gap-4 mt-4">
        <div className="lg:col-span-8"><Instrument /></div>
        <div className="lg:col-span-4"><Verdict /></div>
      </motion.section>

      <motion.section {...rise(0.16)} className="mt-4"><Board /></motion.section>

      <motion.section {...rise(0.2)}
        className="glass mt-4 px-5 py-4 flex items-center gap-5 flex-wrap">
        <p className="text-[13.5px] text-[var(--color-muted)] flex-1 min-w-[260px]">
          Holding these as collateral? At night your margin is marked on a price nobody traded on.
        </p>
        <Link href="/collateral"
              className="rounded-full px-5 py-2 text-[13px] font-semibold transition-transform hover:scale-[1.03] active:scale-95 shrink-0"
              style={{ background: "var(--color-mint)", color: "#08080b" }}>
          Check your liquidation distance →
        </Link>
      </motion.section>
    </main>
  );
}

function Tile({ label, value, sub, accent }: { label: string; value: string; sub: string; accent?: string }) {
  return (
    <div className="glass px-5 py-4">
      <div className="label">{label}</div>
      <div className="tnum text-[28px] mt-2 leading-none" style={accent ? { color: accent } : undefined}>{value}</div>
      <div className="text-[11.5px] text-[var(--color-muted)] mt-1.5">{sub}</div>
    </div>
  );
}
