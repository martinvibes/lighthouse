"use client";
import { useMemo, useRef, useState } from "react";
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
      setTurns((t) => t.map((x, i) => i === t.length - 1 ? { ...x, a: d.text, err: d.error } : x));
    } catch {
      setTurns((t) => t.map((x, i) => i === t.length - 1 ? { ...x, err: "Network error." } : x));
    } finally {
      setBusy(false);
      requestAnimationFrame(() => end.current?.scrollIntoView({ behavior: "smooth" }));
    }
  };

  return (
    <>
      <section style={{ display: "grid", gap: 10, paddingTop: 4 }}>
        <h1 className="serif" style={{ fontSize: 32, lineHeight: 1.12, maxWidth: "22ch" }}>
          Ask the desk. It can only answer with what it measured.
        </h1>
        <p className="prose" style={{ maxWidth: "64ch" }}>
          The model receives tonight&apos;s board, the shrinkage weights in force, and the walk-forward error
          table — and nothing else. It has no browser and no memory. If the answer is not in those numbers,
          it is instructed to say so rather than fill the gap.
        </p>
      </section>

      <div className="grid-2">
        <section className="panel" style={{ display: "flex", flexDirection: "column", minHeight: 520 }}>
          <div className="panel-head">
            <h3>Research</h3>
            <span className="spacer" />
            <span className="label">{rows.length} names in context</span>
          </div>

          <div className="panel-body" style={{ flex: 1, overflowY: "auto", display: "grid", gap: 16, alignContent: "start" }}>
            {!turns.length && (
              <div style={{ display: "grid", gap: 8 }}>
                <div className="label">Try one of these</div>
                {SEEDS.map((s) => (
                  <button key={s} className="btn ghost" style={{ textAlign: "left", padding: "10px 12px", fontSize: 13 }}
                          onClick={() => ask(s)}>{s}</button>
                ))}
              </div>
            )}
            {turns.map((t, i) => (
              <div key={i} style={{ display: "grid", gap: 8 }}>
                <div style={{
                  justifySelf: "end", maxWidth: "88%", background: "var(--lamp-wash)",
                  border: "1px solid color-mix(in srgb, var(--lamp) 28%, transparent)",
                  borderRadius: "12px 12px 3px 12px", padding: "9px 13px", fontSize: 13.5,
                }}>{t.q}</div>
                {t.a && (
                  <div style={{
                    maxWidth: "94%", background: "var(--panel-2)", border: "1px solid var(--line)",
                    borderRadius: "12px 12px 12px 3px", padding: "12px 14px", fontSize: 13.5, lineHeight: 1.65,
                  }}>{t.a}</div>
                )}
                {t.err && <div className="down" style={{ fontSize: 12.5 }}>{t.err}</div>}
                {!t.a && !t.err && <div className="faint" style={{ fontSize: 12.5 }}>Reading the board…</div>}
              </div>
            ))}
            <div ref={end} />
          </div>

          <form className="panel-body" style={{ borderTop: "1px solid var(--line-soft)", display: "flex", gap: 8 }}
                onSubmit={(e) => { e.preventDefault(); ask(q); }}>
            <input value={q} onChange={(e) => setQ(e.target.value)} disabled={busy}
                   placeholder="Ask about tonight's board…" />
            <button className="btn" disabled={busy || !q.trim()}>{busy ? "…" : "Ask"}</button>
          </form>
        </section>

        <section className="panel">
          <div className="panel-head">
            <h3>Exactly what the model sees</h3>
            <span className="spacer" />
            <span className="label">{state.length.toLocaleString()} chars</span>
          </div>
          <pre className="mono" style={{
            margin: 0, padding: 16, fontSize: 11, lineHeight: 1.65, color: "var(--dim)",
            whiteSpace: "pre-wrap", maxHeight: 560, overflowY: "auto",
          }}>{state || "Waiting for the board…"}</pre>
          <div className="panel-note">
            Published in full so an answer can be checked against its inputs. No prices are fetched by the
            model and no numbers are generated by it.
          </div>
        </section>
      </div>
    </>
  );
}
