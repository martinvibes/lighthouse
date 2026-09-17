import { NextRequest } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Research answers are generated against the desk state the page sends, and
 * nothing else. Works with any OpenAI-compatible endpoint; the hackathon's Qwen
 * credits (https://hackathon.bitgetops.com/v1, qwen3.8-max) drop straight in.
 */
const BASE = process.env.LLM_BASE_URL || "https://hackathon.bitgetops.com/v1";
const MODEL = process.env.LLM_MODEL || "qwen3.8-max";
const KEY = process.env.LLM_API_KEY;

const SYSTEM = `You are the analyst on Lighthouse, a dark-hours pricing desk for tokenized US equities (Bitget rTokens).

Answer using ONLY the desk state given. Quote the real figures from it. If the state does not contain
what is needed, say so plainly rather than estimating. About 130 words, plain prose, no headings or
bullet lists. Never tell anyone to buy or sell: describe what the pricing evidence supports and what
the risk is.

The central finding to keep in mind: early in the dark window the venue's own quote is LESS informative
than assuming the last close held, and it overshoots the repricing that actually sticks.`;

export async function POST(req: NextRequest) {
  if (!KEY) {
    return Response.json(
      { error: "The research assistant is not configured on this deployment. Set LLM_API_KEY to enable it. The board and the measured record are unaffected." },
      { status: 503 }
    );
  }
  let body: { question?: string; state?: string };
  try { body = await req.json(); } catch { return Response.json({ error: "Bad request." }, { status: 400 }); }
  const question = (body.question || "").slice(0, 600).trim();
  const state = (body.state || "").slice(0, 12000);
  if (!question) return Response.json({ error: "Ask a question first." }, { status: 400 });

  try {
    const r = await fetch(`${BASE}/chat/completions`, {
      method: "POST",
      headers: { "content-type": "application/json", authorization: `Bearer ${KEY}` },
      body: JSON.stringify({
        model: MODEL,
        temperature: 0.2,
        max_tokens: 400,
        messages: [
          { role: "system", content: SYSTEM },
          { role: "user", content: `${state}\n\nTRADER'S QUESTION: ${question}` },
        ],
      }),
    });
    if (!r.ok) {
      const detail = await r.text();
      return Response.json({ error: `Upstream model returned ${r.status}.`, detail: detail.slice(0, 300) }, { status: 502 });
    }
    const d = await r.json();
    const text = d?.choices?.[0]?.message?.content?.trim();
    if (!text) return Response.json({ error: "The model returned an empty answer." }, { status: 502 });
    return Response.json({ text });
  } catch {
    return Response.json({ error: "Couldn't reach the model endpoint." }, { status: 502 });
  }
}
