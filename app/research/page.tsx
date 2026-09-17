"use client";
import { useMemo, useRef, useState } from "react";
import { motion } from "framer-motion";
import { ShieldCheck, ScanLine } from "lucide-react";
import { useDesk } from "@/lib/desk";
import { deskState } from "@/lib/state";

type Answer = {
  verdict?: string; text?: string; watch?: string; dropped?: number; model?: string;
  evidence?: { label: string; value: string }[];
};
type Turn = { q: string; a?: Answer; err?: string };

const SEEDS = [
  { q: "Which quote on tonight's board is least trustworthy, and why?", t: "the board" },
  { q: "I hold rNVDA as collateral. What is my real risk before the reopen?", t: "collateral" },
  { q: "Is the venue quote worth more or less than the close right now?", t: "the model" },
  { q: "Which names does this desk actually lose money on?", t: "honesty" },
];

export default function Research() {
  const { cal, led, win, rows, lam, band } = useDesk();
  const [turns, setTurns] = useState<Turn[]>([]);
  const [q, setQ] = useState("");
  const [busy, setBusy] = useState(false);
  const [showCtx, setShowCtx] = useState(false);
  const end = useRef<HTMLDivElement>(null);
  const state = useMemo(() => deskState(cal, led, win, rows, lam, band), [cal, led, win, rows, lam, band]);

  const ask = async (question: string) => {
    if (!question.trim() || busy || !state) return;
    setQ(""); setBusy(true);
    setTurns((t) => [...t, { q: question }]);
    requestAnimationFrame(() => end.current?.scrollIntoView({ behavior: "smooth" }));
    try {
      const r = await fetch("/api/ask", {
        method: "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify({ question, state }),
      });
      const d = await r.json();
      setTurns((t) => t.map((x, i) => (i === t.length - 1 ? (d.error ? { ...x, err: d.error } : { ...x, a: d }) : x)));
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
          Every figure it quotes is{" "}
          <span className="italic" style={{ color: "var(--color-mint)" }}>checked against its own context.</span>
        </h1>
        <p className="text-[15px] text-[var(--color-muted)] leading-relaxed mt-5 max-w-[660px]">
          The analyst receives tonight&apos;s full board, each name&apos;s historical accuracy, the shrinkage weights in
          force and the walk-forward error table — and nothing else. No browser, no memory, no prices of its
          own. Then every number it cites is matched back against that context before it renders. A figure the
          model invented is a figure you never see.
        </p>
      </motion.header>

      <section className="grid grid-cols-1 lg:grid-cols-12 gap-4 mt-8">
        <motion.div initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.08, duration: 0.5 }}
                    className="lg:col-span-8 glass flex flex-col min-h-[620px] overflow-hidden">
          <div className="flex items-center gap-3 px-5 py-3.5 border-b border-[var(--color-line)]">
            <span className="h-1.5 w-1.5 rounded-full live-dot" style={{ background: "var(--color-mint)" }} />
            <span className="text-[14px] font-semibold">Research</span>
            <span className="flex-1" />
            <span className="label">{rows.length} names · {state ? `${(state.length / 1000).toFixed(1)}k chars` : "—"} of context</span>
          </div>

          <div className="flex-1 overflow-y-auto px-5 py-5 flex flex-col gap-6">
            {!turns.length && (
              <div className="flex flex-col gap-2.5">
                <div className="label">start here</div>
                {SEEDS.map((s) => (
                  <button key={s.q} onClick={() => ask(s.q)} disabled={!state}
                          className="panel text-left px-4 py-3.5 flex items-center gap-3 hover:border-[var(--color-mint)] transition-colors disabled:opacity-40 group">
                    <span className="label shrink-0 w-[68px]" style={{ color: "var(--color-mint)" }}>{s.t}</span>
                    <span className="text-[13px] text-[var(--color-muted)] group-hover:text-[var(--color-fg)] transition-colors">{s.q}</span>
                  </button>
                ))}
                {!state && <div className="label mt-2">waiting for the board before it can answer anything…</div>}
              </div>
            )}

            {turns.map((t, i) => (
              <div key={i} className="flex flex-col gap-3 ticker-in">
                <div className="self-end max-w-[85%] rounded-2xl rounded-br-sm px-4 py-2.5 text-[13.5px]"
                     style={{ background: "rgba(78,230,168,0.1)", border: "1px solid rgba(78,230,168,0.24)" }}>
                  {t.q}
                </div>

                {t.a && (
                  <div className="panel overflow-hidden">
                    {t.a.verdict && (
                      <div className="px-4 py-3.5 border-b border-[var(--color-line)]"
                           style={{ background: "rgba(78,230,168,0.05)" }}>
                        <div className="label mb-1.5">the read</div>
                        <p className="text-[15px] leading-snug font-medium">{t.a.verdict}</p>
                      </div>
                    )}
                    {t.a.text && <p className="px-4 py-3.5 text-[13.5px] leading-relaxed text-[var(--color-muted)]">{t.a.text}</p>}

                    {!!t.a.evidence?.length && (
                      <div className="px-4 pb-3.5 flex flex-wrap gap-2">
                        {t.a.evidence.map((e, j) => (
                          <span key={j} className="inline-flex items-baseline gap-2 rounded-lg px-2.5 py-1.5 hairline"
                                style={{ background: "rgba(255,255,255,0.025)" }}>
                            <span className="label">{e.label}</span>
                            <span className="tnum text-[12.5px]" style={{ color: "var(--color-cyan)" }}>{e.value}</span>
                          </span>
                        ))}
                      </div>
                    )}

                    {t.a.watch && (
                      <div className="px-4 py-3 border-t border-[var(--color-line)] flex items-start gap-2.5">
                        <ScanLine size={13} className="mt-0.5 shrink-0" style={{ color: "var(--color-amber)" }} />
                        <p className="text-[12.5px] leading-relaxed text-[var(--color-muted)]">
                          <span className="label mr-1.5">what would change this</span>{t.a.watch}
                        </p>
                      </div>
                    )}

                    <div className="px-4 py-2.5 border-t border-[var(--color-line)] flex items-center gap-3 flex-wrap">
                      <span className="label flex items-center gap-1.5" style={{ color: "var(--color-mint)" }}>
                        <ShieldCheck size={11} />
                        {t.a.evidence?.length ?? 0} figure{(t.a.evidence?.length ?? 0) === 1 ? "" : "s"} verified against the context
                      </span>
                      {!!t.a.dropped && (
                        <span className="label" style={{ color: "var(--color-danger)" }}>
                          {t.a.dropped} uncited figure{t.a.dropped === 1 ? "" : "s"} stripped
                        </span>
                      )}
                      <span className="flex-1" />
                      {t.a.model && <span className="label">{t.a.model}</span>}
                    </div>
                  </div>
                )}

                {t.err && (
                  <div className="panel px-4 py-3 text-[12.5px]" style={{ color: "var(--color-danger)" }}>{t.err}</div>
                )}
                {!t.a && !t.err && (
                  <div className="panel px-4 py-4">
                    <div className="loadbar rounded-full" />
                    <div className="label mt-3">reading {rows.length} names and {led?.summary.n_rows.toLocaleString() ?? "the"} graded forecasts…</div>
                  </div>
                )}
              </div>
            ))}
            <div ref={end} />
          </div>

          <form onSubmit={(e) => { e.preventDefault(); ask(q); }}
                className="flex gap-2 px-5 py-4 border-t border-[var(--color-line)]">
            <input
              value={q} onChange={(e) => setQ(e.target.value)} disabled={busy || !state}
              placeholder={state ? "Ask about tonight's board, a name, or your collateral…" : "waiting for the board…"}
              className="flex-1 hairline rounded-full px-4 py-2.5 text-[13.5px] outline-none focus:border-[var(--color-mint)] transition-colors"
              style={{ background: "rgba(255,255,255,0.03)", color: "var(--color-fg)" }}
            />
            <button disabled={busy || !q.trim() || !state}
                    className="rounded-full px-5 py-2.5 text-[13.5px] font-semibold disabled:opacity-40 transition-transform hover:scale-[1.03] active:scale-95"
                    style={{ background: "var(--color-mint)", color: "#08080b" }}>
              {busy ? "…" : "Ask"}
            </button>
          </form>
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.14, duration: 0.5 }}
                    className="lg:col-span-4 flex flex-col gap-4">
          <div className="glass overflow-hidden">
            <div className="px-5 py-3.5 border-b border-[var(--color-line)]">
              <span className="text-[14px] font-semibold">How an answer is built</span>
            </div>
            <ol className="px-5 py-4 flex flex-col gap-4">
              {[
                ["01", "The board is assembled", "Live quotes from Bitget, the session close for each name, and the fair value our frozen calibration produces at this hour."],
                ["02", "History is attached", "Each name carries its own track record — how wrong we have been on it, how wrong the venue has been, and how much its quote typically overshoots."],
                ["03", "The model is given that and nothing else", "No browser, no memory, no prices of its own, and an instruction to say so when the context does not answer the question."],
                ["04", "Its figures are checked", "Every number it cites is matched back against the context. Anything it could not have read there is stripped before you see it."],
              ].map(([n, h, b]) => (
                <li key={n} className="flex gap-3.5">
                  <span className="tnum text-[11px] shrink-0 mt-0.5" style={{ color: "var(--color-mint)" }}>{n}</span>
                  <div>
                    <div className="text-[13px] font-medium">{h}</div>
                    <p className="text-[12px] text-[var(--color-muted)] leading-relaxed mt-1">{b}</p>
                  </div>
                </li>
              ))}
            </ol>
          </div>

          <div className="glass overflow-hidden flex-1 flex flex-col">
            <button onClick={() => setShowCtx(!showCtx)}
                    className="px-5 py-3.5 border-b border-[var(--color-line)] flex items-center gap-3 text-left w-full">
              <span className="text-[14px] font-semibold">Read the context yourself</span>
              <span className="flex-1" />
              <span className="label">{showCtx ? "hide" : "show"}</span>
            </button>
            {showCtx ? (
              <pre className="tnum text-[10px] leading-[1.7] text-[var(--color-muted)] px-5 py-4 whitespace-pre-wrap overflow-y-auto max-h-[420px]">
                {state || "waiting for the board…"}
              </pre>
            ) : (
              <p className="px-5 py-4 text-[12.5px] text-[var(--color-muted)] leading-relaxed">
                The complete prompt context is published, not summarised — {state ? state.length.toLocaleString() : "—"} characters
                of it. Open it and you can check any figure in any answer above against the line it came from.
              </p>
            )}
          </div>
        </motion.div>
      </section>
    </main>
  );
}
