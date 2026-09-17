import { NextRequest } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Research answers are generated against the desk state the page sends, and
 * nothing else. Any OpenAI-compatible endpoint works: point LLM_BASE_URL and
 * LLM_MODEL elsewhere (the hackathon's Qwen credits drop straight in) and the
 * rest of this file is unchanged.
 */
const BASE = process.env.LLM_BASE_URL || "https://api.openai.com/v1";
const MODEL = process.env.LLM_MODEL || "gpt-4o";
const KEY = process.env.OPENAI_API_KEY || process.env.LLM_API_KEY;

const SYSTEM = `You are the analyst on Lighthouse, a dark-hours pricing desk for Bitget's tokenized US
equities (rTokens). You are speaking to someone who holds these instruments right now.

THE ONE THING TO UNDERSTAND: between 20:00 and 04:00 ET no US venue is open, so every rToken price is an
indicative market-maker quote rather than a transaction price. We have graded thousands of those quotes
against the reopen that followed. Early in the dark window the venue's own quote is LESS informative than
simply assuming the last close held, and it consistently overshoots the repricing that actually sticks.
Only in the last stretch before 04:00 does the quote start carrying real information.

RULES, IN ORDER OF IMPORTANCE
1. Every number you write must appear verbatim in the DESK STATE you were given. Never round, rescale,
   average or derive a new figure. If the state does not contain what the question needs, say that
   plainly and answer with what it does contain.
2. Name specific instruments. "Several names look rich" is worthless; "LITE at +84 bps against a ±26 bps
   band" is an answer.
3. Never say buy, sell, long, short, or give a target. Describe what the pricing evidence supports and
   where the risk sits. You are a measurement desk, not a signal service.
4. Say what would change your read. Every answer ends pointing at the thing to watch.

Reply as JSON with exactly these keys:
{
  "verdict": "one sentence, under 110 characters, the call itself — specific, with a number in it",
  "body": "3 to 5 sentences of plain prose. No headings, no bullets, no markdown.",
  "evidence": [{"label": "what this figure is", "value": "the figure, copied exactly from the state"}],
  "watch": "one sentence naming what would change this read"
}
Give two to four evidence entries. Each "value" must be copied character-for-character out of the state.`;

/** A figure the model invented is a figure the reader should never see. */
function keepOnlyCited(evidence: unknown, state: string) {
  if (!Array.isArray(evidence)) return [];
  const haystack = state.replace(/\s+/g, " ");
  return evidence
    .filter((e): e is { label: string; value: string } =>
      !!e && typeof e === "object" && typeof (e as { value?: unknown }).value === "string")
    .map((e) => ({ label: String(e.label ?? "").slice(0, 60), value: e.value.trim().slice(0, 40) }))
    .filter((e) => {
      // Accept the figure only if its numeric core is present in the context verbatim.
      const core = e.value.match(/-?\d[\d,]*\.?\d*/)?.[0];
      return core ? haystack.includes(core) : false;
    })
    .slice(0, 4);
}

export async function POST(req: NextRequest) {
  if (!KEY) {
    return Response.json(
      { error: "The research analyst is not configured on this deployment. Set OPENAI_API_KEY to enable it. The board and the measured record are unaffected." },
      { status: 503 }
    );
  }
  let body: { question?: string; state?: string };
  try { body = await req.json(); } catch { return Response.json({ error: "Bad request." }, { status: 400 }); }
  const question = (body.question || "").slice(0, 600).trim();
  const state = (body.state || "").slice(0, 24000);
  if (!question) return Response.json({ error: "Ask a question first." }, { status: 400 });

  try {
    const r = await fetch(`${BASE}/chat/completions`, {
      method: "POST",
      headers: { "content-type": "application/json", authorization: `Bearer ${KEY}` },
      body: JSON.stringify({
        model: MODEL,
        temperature: 0.15,
        max_tokens: 700,
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: SYSTEM },
          { role: "user", content: `${state}\n\nQUESTION FROM THE DESK: ${question}` },
        ],
      }),
    });
    if (!r.ok) {
      const detail = await r.text();
      return Response.json({ error: `The model endpoint returned ${r.status}.`, detail: detail.slice(0, 300) }, { status: 502 });
    }
    const d = await r.json();
    const raw = d?.choices?.[0]?.message?.content?.trim();
    if (!raw) return Response.json({ error: "The model returned an empty answer." }, { status: 502 });

    let parsed: { verdict?: string; body?: string; evidence?: unknown; watch?: string };
    try { parsed = JSON.parse(raw); } catch { return Response.json({ verdict: "", text: raw, evidence: [], watch: "" }); }

    const evidence = keepOnlyCited(parsed.evidence, state);
    const dropped = Array.isArray(parsed.evidence) ? parsed.evidence.length - evidence.length : 0;

    return Response.json({
      verdict: String(parsed.verdict ?? "").slice(0, 200),
      text: String(parsed.body ?? "").slice(0, 2000),
      evidence,
      watch: String(parsed.watch ?? "").slice(0, 300),
      dropped,
      model: MODEL,
    });
  } catch {
    return Response.json({ error: "Couldn't reach the model endpoint." }, { status: 502 });
  }
}
