"use client";
import { useMemo, useRef, useState } from "react";
import { motion } from "framer-motion";
import { useDesk } from "@/lib/desk";
import { deskState } from "@/lib/state";

type Turn = { q: string; a?: string; err?: string };

const SEEDS = [
  "Which quote on tonight's board is least trustworthy, and why?",
  "Should I trust the venue quote more or less than the close right now?",
  "What is the risk of holding rTokens as collateral over a weekend?",
  "Explain the trust curve to someone who has never traded overnight.",
];

export default function Research() {
  const { cal, led, win, rows, lam, band } = useDesk();
  const [turns, setTurns] = useState<Turn[]>([]);
  const [q, setQ] = useState("");
  const [busy, setBusy] = useState(false);
  const end = useRef<HTMLDivElement>(null);
  const state = useMemo(() => deskState(cal, led, win, rows, lam, band), [cal, led, win, rows, lam, band]);

  const ask = async (question: string) => {
    if (!question.trim() || busy) return;
    setQ(""); setBusy(true);
    setTurns((t) => [...t, { q: question }]);
    try {
      const r = await fetch("/api/ask", {
        method: "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify({ question, state }),
      });
      const d = await r.json();
      setTurns((t) => t.map((x, i) => (i === t.length - 1 ? { ...x, a: d.text, err: d.error } : x)));
    } catch {
      setTurns((t) => t.map((x, i) => (i === t.length - 1 ? { ...x, err: "Network error." } : x)));
    } finally {
      setBusy(false);
      requestAnimationFrame(() => end.current?.scrollIntoView({ behavior: "smooth" }));
    }
  };

  return (
    <main className="relative min-h-screen px-4 md:px-6 py-8 max-w-[1480px] mx-auto z-10">
      <div className="grid-atmos fixed inset-0 -z-10 opacity-25" />

      <motion.header initial={{ opacity: 0, y: -14 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.55 }}>
        <div className="label mb-4">an analyst that cannot bluff</div>
        <h1 className="display text-[clamp(32px,5.2vw,54px)] leading-[1.02] max-w-[20ch]">
          Ask the desk. It can only answer{" "}
          <span className="italic" style={{ color: "var(--color-mint)" }}>with what it measured.</span>
        </h1>
        <p className="text-[15px] text-[var(--color-muted)] leading-relaxed mt-5 max-w-[620px]">
          The model receives tonight&apos;s board, the shrinkage weights in force, and the walk-forward error
          table — and nothing else. No browser, no memory, no prices of its own. If the answer is not in those
          numbers it is instructed to say so rather than fill the gap.
        </p>
      </motion.header>

      <section className="grid grid-cols-1 lg:grid-cols-12 gap-4 mt-8">
        <motion.div initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.08, duration: 0.5 }}
                    className="lg:col-span-7 glass flex flex-col min-h-[560px] overflow-hidden">
          <div className="flex items-center gap-3 px-5 py-3.5 border-b border-[var(--color-line)]">
            <span className="h-1.5 w-1.5 rounded-full live-dot" style={{ background: "var(--color-mint)" }} />
            <span className="text-[14px] font-semibold">Research</span>
            <span className="flex-1" />
            <span className="label">{rows.length} names in context</span>
          </div>

          <div className="flex-1 overflow-y-auto px-5 py-5 flex flex-col gap-5">
            {!turns.length && (
              <div className="flex flex-col gap-2.5">
                <div className="label">try one of these</div>
                {SEEDS.map((s) => (
                  <button key={s} onClick={() => ask(s)}
                          className="panel text-left px-4 py-3 text-[13px] text-[var(--color-muted)] hover:text-[var(--color-fg)] hover:border-[var(--color-mint)] transition-colors">
                    {s}
                  </button>
                ))}
              </div>
            )}
            {turns.map((t, i) => (
              <div key={i} className="flex flex-col gap-2.5 ticker-in">
                <div className="self-end max-w-[85%] rounded-2xl rounded-br-sm px-4 py-2.5 text-[13.5px]"
                     style={{ background: "rgba(78,230,168,0.1)", border: "1px solid rgba(78,230,168,0.24)" }}>
                  {t.q}
                </div>
                {t.a && (
                  <div className="panel max-w-[94%] px-4 py-3.5 text-[13.5px] leading-relaxed">{t.a}</div>
                )}
                {t.err && <div className="text-[12.5px]" style={{ color: "var(--color-danger)" }}>{t.err}</div>}
                {!t.a && !t.err && <div className="loadbar rounded-full max-w-[200px]" />}
              </div>
            ))}
            <div ref={end} />
          </div>

          <form onSubmit={(e) => { e.preventDefault(); ask(q); }}
                className="flex gap-2 px-5 py-4 border-t border-[var(--color-line)]">
            <input
              value={q} onChange={(e) => setQ(e.target.value)} disabled={busy}
              placeholder="Ask about tonight's board…"
              className="flex-1 hairline rounded-full px-4 py-2.5 text-[13.5px] outline-none focus:border-[var(--color-mint)] transition-colors"
              style={{ background: "rgba(255,255,255,0.03)", color: "var(--color-fg)" }}
            />
            <button disabled={busy || !q.trim()}
                    className="rounded-full px-5 py-2.5 text-[13.5px] font-semibold disabled:opacity-40 transition-transform hover:scale-[1.03] active:scale-95"
                    style={{ background: "var(--color-mint)", color: "#08080b" }}>
              {busy ? "…" : "Ask"}
            </button>
          </form>
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.14, duration: 0.5 }}
                    className="lg:col-span-5 glass overflow-hidden flex flex-col">
          <div className="flex items-center gap-3 px-5 py-3.5 border-b border-[var(--color-line)]">
            <span className="text-[14px] font-semibold">Exactly what the model sees</span>
            <span className="flex-1" />
            <span className="label">{state.length.toLocaleString()} chars</span>
          </div>
          <pre className="tnum text-[10.5px] leading-[1.7] text-[var(--color-muted)] px-5 py-4 whitespace-pre-wrap overflow-y-auto max-h-[560px]">
            {state || "waiting for the board…"}
          </pre>
          <div className="px-5 py-3 border-t border-[var(--color-line)] text-[11px] text-[var(--color-faint)] leading-relaxed">
            Published in full so any answer can be checked against its inputs. The model fetches no prices and
            generates no numbers of its own.
          </div>
        </motion.div>
      </section>
    </main>
  );
}
