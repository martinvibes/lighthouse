"use client";
import { useState } from "react";

const PRESETS = [
  "I'm holding rNVDA through the weekend — what's my gap exposure?",
  "Which name is the venue mispricing most right now?",
  "Should I trust the quote at this hour, or wait for the reopen?",
];

export default function Ask({ buildState }: { buildState: () => string }) {
  const [q, setQ] = useState("");
  const [answer, setAnswer] = useState("");
  const [busy, setBusy] = useState(false);

  async function ask(question: string) {
    if (!question.trim() || busy) return;
    setBusy(true);
    setAnswer("Reading the board…");
    try {
      const r = await fetch("/api/ask", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ question, state: buildState() }),
      });
      const d = await r.json();
      setAnswer(d.text || d.error || "No answer returned.");
    } catch {
      setAnswer("Couldn't reach the research assistant. The board above is still live.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section>
      <div className="panel panel-pad">
        <h2 className="serif">Ask the desk</h2>
        <p className="sub">Answered against the live board and the measured record — not from memory.</p>
        <div className="qrow" style={{ marginTop: 14 }}>
          {PRESETS.map((p) => (
            <button key={p} className="qbtn" type="button" onClick={() => { setQ(p); ask(p); }}>{p}</button>
          ))}
        </div>
        <form className="askform" onSubmit={(e) => { e.preventDefault(); ask(q); }}>
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Ask about any name on the board…" />
          <button type="submit" disabled={busy}>{busy ? "Thinking…" : "Ask"}</button>
        </form>
        {answer && <div className="answer">{answer}</div>}
      </div>
    </section>
  );
}
