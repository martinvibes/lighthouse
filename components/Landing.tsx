"use client";
import Link from "next/link";
import { motion } from "framer-motion";
import { Eye, ShieldCheck, Layers, ArrowRight, MoonStar } from "lucide-react";
import Spotlight from "@/components/Spotlight";
import LivePreview from "@/components/LivePreview";
import { useDesk } from "@/lib/desk";

const reveal = {
  initial: { opacity: 0, y: 24 },
  whileInView: { opacity: 1, y: 0 },
  viewport: { once: true, margin: "-80px" },
  transition: { duration: 0.7, ease: [0.16, 1, 0.3, 1] as const },
};

export default function Landing() {
  const { rows, led, cal, band } = useDesk();
  const wide = rows.filter((r) => r.wide).length;
  const late = led?.summary.by_horizon["0.75"];

  return (
    <main className="relative z-10 overflow-hidden">
      {/* ───────────────────────── HERO ───────────────────────── */}
      <section className="relative">
        <div
          className="absolute inset-x-0 top-0 h-[860px] overflow-hidden pointer-events-none"
          style={{
            maskImage: "radial-gradient(120% 78% at 50% 34%, #000 38%, transparent 82%)",
            WebkitMaskImage: "radial-gradient(120% 78% at 50% 34%, #000 38%, transparent 82%)",
          }}
        >
          <Spotlight />
        </div>

        <div className="relative max-w-[1100px] mx-auto px-5 md:px-8 pt-24 md:pt-32 pb-16 text-center">
          <div
            className="anim anim-fade inline-flex items-center gap-2 rounded-full px-3.5 py-1.5 hairline mb-8"
            style={{ background: "rgba(255,255,255,0.025)", animationDelay: "0.05s" }}
          >
            <span className="h-1.5 w-1.5 rounded-full bg-[var(--color-mint)] live-dot" />
            <span className="label">Dark-hours pricing · Bitget rTokens</span>
          </div>

          <h1 className="display text-[clamp(50px,9vw,112px)] leading-[0.88] tracking-tight">
            <span className="block anim anim-rise" style={{ animationDelay: "0.15s" }}>
              The tape goes dark.
            </span>
            <span className="block anim anim-rise -mt-1 md:-mt-2" style={{ animationDelay: "0.32s" }}>
              The prices{" "}
              <span className="italic glow-mint" style={{ color: "var(--color-mint)" }}>
                don&apos;t.
              </span>
            </span>
          </h1>

          <p
            className="anim anim-fade text-[var(--color-muted)] text-[17px] md:text-[20px] leading-relaxed mt-7 max-w-[640px] mx-auto"
            style={{ animationDelay: "0.55s" }}
          >
            For eight hours a night Bitget keeps quoting tokenized US equities with no US venue open behind
            them, and says plainly they are indicative quotes, not transaction prices. Lighthouse has graded{" "}
            {led ? led.summary.n_rows.toLocaleString() : "20,934"} of those quotes against the reopen they were
            predicting. Tonight it tells you which ones to believe.
          </p>

          <div
            className="anim anim-fade flex items-center justify-center gap-3 mt-9 flex-wrap"
            style={{ animationDelay: "0.7s" }}
          >
            <Link
              href="/desk"
              className="group inline-flex items-center gap-2 rounded-full px-6 py-3 text-[14px] font-semibold transition-transform hover:scale-[1.03] active:scale-95"
              style={{ background: "var(--color-mint)", color: "#08080b", boxShadow: "0 0 40px -8px var(--color-mint)" }}
            >
              Enter the desk
              <ArrowRight size={15} className="transition-transform group-hover:translate-x-0.5" />
            </Link>
            <Link
              href="/record"
              className="inline-flex items-center rounded-full px-6 py-3 text-[14px] hairline text-[var(--color-fg)] hover:bg-white/[0.04] transition-colors"
            >
              See the receipts
            </Link>
          </div>

          <div
            className="anim anim-fade inline-flex items-center gap-6 md:gap-9 mt-14 px-7 py-4 rounded-2xl hairline flex-wrap justify-center"
            style={{ background: "rgba(255,255,255,0.02)", animationDelay: "0.85s" }}
          >
            <Stat k="names watched" v={rows.length ? String(rows.length) : "—"} />
            <Dot />
            <Stat
              k="outside the band"
              v={rows.length ? String(wide) : "—"}
              c={wide > 0 ? "var(--color-danger)" : "var(--color-mint)"}
            />
            <Dot />
            <Stat k="tolerance tonight" v={band !== null ? `±${band} bps` : "—"} c="var(--color-cyan)" />
            <Dot />
            <Stat
              k="error vs baseline"
              v={late ? `${late.lighthouse_vs_lastclose_pct.toFixed(0)}%` : "—"}
              c="var(--color-mint)"
            />
          </div>
        </div>

        <motion.div {...reveal} className="relative max-w-[1080px] mx-auto px-5 md:px-8 pb-24">
          <div
            className="absolute -top-10 left-1/2 -translate-x-1/2 w-[80%] h-32 blur-3xl pointer-events-none"
            style={{ background: "radial-gradient(closest-side, rgba(78,230,168,0.18), transparent)" }}
          />
          <div className="relative">
            <LivePreview />
          </div>
          <p className="text-center label mt-5">live off Bitget&apos;s public API — not a screenshot</p>
        </motion.div>
      </section>

      {/* ───────────────────────── THE MEASUREMENT ───────────────────────── */}
      <section className="border-y border-[var(--color-line)] py-8">
        <div className="text-center label mb-6">what the record is built on</div>
        <div className="max-w-[1000px] mx-auto px-5 grid grid-cols-2 md:grid-cols-4 gap-4">
          <Fact v={led ? led.summary.n_rows.toLocaleString() : "20,934"} k="graded forecasts" />
          <Fact v={cal ? String(cal.n_windows.overnight) : "—"} k="closed dark windows" />
          <Fact v={cal ? String(cal.universe.length) : "—"} k="rToken names" />
          <Fact v="0" k="forecasts scored in-sample" c="var(--color-mint)" />
        </div>
      </section>

      {/* ───────────────────────── FEATURES ───────────────────────── */}
      <section className="max-w-[1180px] mx-auto px-5 md:px-8 py-24 flex flex-col gap-28">
        <Feature
          icon={Eye}
          eyebrow="Measured, not asserted"
          title="Every claim has a number behind it."
          body="Weights are refitted on a rolling window of already-closed nights, then scored against a reopen they never saw. The whole ledger ships as a CSV. Two hours into the dark window Bitget's own quote is worse than assuming the close held — we did not expect that either, and we published it."
          visual={<EvidenceVisual led={led} />}
        />
        <Feature
          reverse
          icon={ShieldCheck}
          eyebrow="The money question"
          title="Your margin is marked on a price nobody traded on."
          body="rTokens are accepted as unified-account collateral at up to 95%. Between 20:00 and 04:00 ET the mark on your book is the indicative quote. Put in a position and Lighthouse reads the gap straight off the ledger — and gives you the odds the reopen takes you through liquidation."
          visual={<MirageVisual cal={cal} />}
        />
        <Feature
          icon={Layers}
          eyebrow="An analyst that cannot bluff"
          title="Answers you can check line by line."
          body="The research model gets tonight's board, the shrinkage weights in force and the walk-forward error table — and nothing else. No browser, no memory, no prices of its own. The exact context is printed next to every answer so you can audit where each figure came from."
          visual={<ContextVisual />}
        />
      </section>

      {/* ───────────────────────── THE LINE ───────────────────────── */}
      <section className="border-y border-[var(--color-line)] py-28 relative overflow-hidden">
        <div
          className="absolute inset-0 pointer-events-none"
          style={{ background: "radial-gradient(60% 80% at 50% 50%, rgba(78,230,168,0.06), transparent)" }}
        />
        <motion.div {...reveal} className="relative max-w-[900px] mx-auto px-5 text-center">
          <div className="label mb-6 flex items-center justify-center gap-2">
            <MoonStar size={12} /> 20:00 → 04:00 ET · no US venue quoting
          </div>
          <p className="display text-[clamp(30px,5.5vw,60px)] leading-[1.05]">
            An indicative quote is not a price.
            <br />
            <span className="italic" style={{ color: "var(--color-mint)" }}>
              It is an opinion.
            </span>
          </p>
        </motion.div>
      </section>

      {/* ───────────────────────── CLOSING ───────────────────────── */}
      <section className="max-w-[1100px] mx-auto px-5 md:px-8 py-28 text-center">
        <motion.div {...reveal}>
          <h2 className="display text-[clamp(40px,7vw,84px)] leading-[0.95]">
            Trade the{" "}
            <span className="italic glow-mint" style={{ color: "var(--color-mint)" }}>
              open.
            </span>
          </h2>
          <p className="text-[var(--color-muted)] text-[17px] mt-6 max-w-[480px] mx-auto leading-relaxed">
            Charts, fair value, the band, and the names whose quote has already drifted past what the
            history supports — live, right now.
          </p>
          <Link
            href="/desk"
            className="group inline-flex items-center gap-2 rounded-full px-7 py-3.5 text-[15px] font-semibold mt-9 transition-transform hover:scale-[1.03] active:scale-95"
            style={{ background: "var(--color-mint)", color: "#08080b", boxShadow: "0 0 50px -8px var(--color-mint)" }}
          >
            Enter the desk
            <ArrowRight size={16} className="transition-transform group-hover:translate-x-0.5" />
          </Link>
        </motion.div>
      </section>

      <footer className="border-t border-[var(--color-line)]">
        <div className="max-w-[1180px] mx-auto px-5 md:px-8 py-8 flex items-center justify-between flex-wrap gap-3">
          <span className="display text-[18px]">
            Light<span className="italic" style={{ color: "var(--color-mint)" }}>house</span>
          </span>
          <span className="label">measured · walk-forward · published in full · Bitget AI Base Camp S2</span>
        </div>
      </footer>
    </main>
  );
}

/* ── bits ─────────────────────────────────────────────────────────────── */
function Stat({ k, v, c }: { k: string; v: string; c?: string }) {
  return (
    <div className="text-left">
      <div className="label">{k}</div>
      <div className="tnum text-[18px] mt-1" style={c ? { color: c } : undefined}>{v}</div>
    </div>
  );
}
const Dot = () => <span className="h-8 w-px bg-[var(--color-line)] hidden sm:block" />;

function Fact({ v, k, c }: { v: string; k: string; c?: string }) {
  return (
    <div className="hairline rounded-2xl py-5 text-center" style={{ background: "rgba(255,255,255,0.02)" }}>
      <div className="tnum text-[26px]" style={c ? { color: c } : undefined}>{v}</div>
      <div className="label mt-1.5">{k}</div>
    </div>
  );
}

function Feature({
  icon: Icon, eyebrow, title, body, visual, reverse,
}: {
  icon: React.ComponentType<{ size?: number; className?: string }>;
  eyebrow: string; title: string; body: string; visual: React.ReactNode; reverse?: boolean;
}) {
  return (
    <motion.div {...reveal} className="grid grid-cols-1 lg:grid-cols-2 gap-10 lg:gap-16 items-center">
      <div className={reverse ? "lg:order-2" : ""}>
        <div className="flex items-center gap-2.5 mb-5">
          <div className="h-8 w-8 rounded-[9px] hairline flex items-center justify-center">
            <Icon size={15} className="text-[var(--color-mint)]" />
          </div>
          <span className="label">{eyebrow}</span>
        </div>
        <h3 className="display text-[clamp(28px,4.2vw,44px)] leading-[1.02]">{title}</h3>
        <p className="text-[var(--color-muted)] text-[15px] md:text-[16px] leading-relaxed mt-5 max-w-[470px]">{body}</p>
      </div>
      <div className={reverse ? "lg:order-1" : ""}>{visual}</div>
    </motion.div>
  );
}

function EvidenceVisual({ led }: { led: ReturnType<typeof useDesk>["led"] }) {
  const H = led?.summary.by_horizon;
  const rows: [string, number, number, number][] = H
    ? [["22:00 ET", H["0.25"].last_close_medae, H["0.25"].venue_medae, H["0.25"].lighthouse_medae],
       ["00:00 ET", H["0.50"].last_close_medae, H["0.50"].venue_medae, H["0.50"].lighthouse_medae],
       ["02:00 ET", H["0.75"].last_close_medae, H["0.75"].venue_medae, H["0.75"].lighthouse_medae],
       ["03:10 ET", H["0.90"].last_close_medae, H["0.90"].venue_medae, H["0.90"].lighthouse_medae]]
    : [];
  const max = Math.max(40, ...rows.flatMap((r) => [r[1], r[2]]));
  return (
    <div className="glass p-5">
      <div className="flex items-center justify-between mb-4">
        <span className="label">median error vs the 04:00 reopen</span>
        <span className="label" style={{ color: "var(--color-mint)" }}>walk-forward ✓</span>
      </div>
      <div className="flex flex-col gap-3.5">
        {rows.map(([when, base, venue, lh]) => (
          <div key={when}>
            <div className="flex items-baseline justify-between mb-1.5">
              <span className="label">{when}</span>
              <span className="tnum text-[11px]">
                <span className="text-[var(--color-faint)]">{base.toFixed(1)}</span>
                <span className="text-[var(--color-faint)] mx-1.5">·</span>
                <span style={{ color: "var(--color-cyan)" }}>{venue.toFixed(1)}</span>
                <span className="text-[var(--color-faint)] mx-1.5">·</span>
                <span style={{ color: "var(--color-mint)" }}>{lh.toFixed(1)}</span>
              </span>
            </div>
            <div className="h-1.5 rounded-full overflow-hidden relative" style={{ background: "rgba(255,255,255,0.05)" }}>
              <div className="absolute inset-y-0 rounded-full" style={{ width: `${(base / max) * 100}%`, background: "rgba(255,255,255,0.12)" }} />
              <div className="absolute inset-y-0 rounded-full" style={{ width: `${(venue / max) * 100}%`, background: "var(--color-cyan)", opacity: 0.55 }} />
              <div className="absolute inset-y-0 rounded-full" style={{ width: `${(lh / max) * 100}%`, background: "var(--color-mint)" }} />
            </div>
          </div>
        ))}
        {!rows.length && <div className="label py-6 text-center">loading the record…</div>}
      </div>
      <div className="label mt-4">close held · venue quote · lighthouse — lower is better</div>
    </div>
  );
}

function MirageVisual({ cal }: { cal: ReturnType<typeof useDesk>["cal"] }) {
  const g = cal?.weekend_gap;
  return (
    <div className="glass p-5">
      <div className="flex items-center justify-between mb-4">
        <span className="label">collateral marked at 95%</span>
        <span className="label" style={{ color: "var(--color-danger)" }}>exposed</span>
      </div>
      <div className="panel px-4 py-3.5 mb-3">
        <div className="label mb-1.5">chance the reopen crosses your liquidation</div>
        <div className="tnum text-[34px] leading-none" style={{ color: "var(--color-danger)" }}>11.4%</div>
        <div className="text-[11.5px] text-[var(--color-muted)] mt-1.5">
          read off the measured error tails for the names actually held
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="panel px-3.5 py-3">
          <div className="label">venue says</div>
          <div className="tnum text-[17px] mt-1">412 bps of room</div>
        </div>
        <div className="panel px-3.5 py-3">
          <div className="label">history says</div>
          <div className="tnum text-[17px] mt-1" style={{ color: "var(--color-amber)" }}>287 bps</div>
        </div>
      </div>
      {g && (
        <div className="flex items-center justify-between mt-4">
          <span className="label">weekends repricing past 200 bps</span>
          <span className="tnum text-[13px]" style={{ color: "var(--color-danger)" }}>
            {(g.share_over_200bps * 100).toFixed(0)}%
          </span>
        </div>
      )}
      <div className="label mt-3">illustrative figures · your own book is priced live on the collateral page</div>
    </div>
  );
}

function ContextVisual() {
  const lines = [
    "Window: overnight, 62% elapsed, reopen 04:00 ET",
    "Shrinkage: 0.90 common · 0.85 idiosyncratic",
    "Typical error at this hour: 23 bps",
    "NVDA: close 178.22, quote 179.90, fair 179.31, +33 bps OUTSIDE",
  ];
  return (
    <div className="glass p-5">
      <div className="flex items-center justify-between mb-4">
        <span className="label">everything the model is given</span>
        <span className="label" style={{ color: "var(--color-cyan)" }}>no browser · no memory</span>
      </div>
      <div className="panel px-4 py-3.5 flex flex-col gap-2">
        {lines.map((l) => (
          <div key={l} className="tnum text-[11px] text-[var(--color-muted)] leading-snug">{l}</div>
        ))}
      </div>
      <div className="mt-3.5 px-4 py-3.5 rounded-xl" style={{ background: "rgba(78,230,168,0.06)", border: "1px solid rgba(78,230,168,0.18)" }}>
        <p className="text-[12.5px] leading-relaxed text-[var(--color-fg)]">
          &ldquo;If the state does not contain what is needed, say so plainly rather than estimating.&rdquo;
        </p>
        <div className="label mt-2">— the system prompt, in full, on the research page</div>
      </div>
    </div>
  );
}
