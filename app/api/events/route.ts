import { connect, listTools, pickTool, callTool, MCP_URL } from "@/lib/mcp";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * The earnings calendar for every US name, read from Bitget's own agent server
 * over MCP (keyless, and the tool catalogue is discovered at runtime).
 *
 * Why the desk needs it: a quote sitting far from fair value the night before
 * earnings is not a mispricing, it is information arriving. Without a calendar
 * the model scores both the same way, and the loudest name on the board on any
 * given night is usually the one with a report due.
 *
 * Observed contract (verified against the live server, not assumed):
 *   guide()                    -> { categories: [...] }
 *   guide({category:"equity"}) -> { entries: [{ id, params_summary, ... }] }
 *   do_query({ entry_id: "equity_calendar_earnings",
 *              params: { start_date, end_date } })
 *     -> { data: { results: [{ report_date, symbol, eps_consensus, time }] } }
 * One call covers the whole market, so the board is filtered locally.
 */

export type Earnings = { symbol: string; date: string; days: number; eps: number | null };

const TTL = 30 * 60_000;
let cache: { at: number; payload: unknown } | null = null;

const iso = (d: Date) => d.toISOString().slice(0, 10);

export async function GET() {
  if (cache && Date.now() - cache.at < TTL) {
    return Response.json({ ...(cache.payload as object), cached: true });
  }
  const fail = (reason: string, extra: object = {}) =>
    Response.json({ ok: false, reason, endpoint: MCP_URL, ...extra });

  try {
    const conn = await connect();
    if (!conn) return fail("Bitget's agent server did not answer the MCP handshake.");

    const tools = await listTools(conn.session);
    const guide = pickTool(tools, /^guide$/);
    const query = pickTool(tools, /^do_query$/);
    if (!query) return fail("The server publishes no query tool.", { tools: tools.map((t) => t.name) });

    // Confirm the catalogue entry still exists before calling it.
    let entry = "equity_calendar_earnings";
    if (guide) {
      const cat = await callTool(conn.session, guide.name, { category: "equity" });
      const entries = ((cat.ok && (cat.data as { entries?: { id: string }[] })?.entries) || []);
      const found = entries.find((e) => /calendar.*earning|earning.*calendar/i.test(e.id));
      if (found) entry = found.id;
      else if (entries.length) return fail("The equity catalogue no longer lists an earnings calendar.");
    }

    const today = new Date();

    // The catalogue caps a response at 1500 rows, and a wide date range silently
    // truncates — AAPL fell off a 70-day pull. Ask a week at a time instead.
    const CHUNK = 7, WEEKS = 10;
    const chunks = Array.from({ length: WEEKS }, (_, i) => ({
      start_date: iso(new Date(+today + i * CHUNK * 864e5)),
      end_date: iso(new Date(+today + ((i + 1) * CHUNK - 1) * 864e5)),
    }));

    const replies = await Promise.all(chunks.map((params) =>
      callTool(conn.session, query.name, { entry_id: entry, params })
        .catch(() => ({ ok: false as const, error: "call failed" }))
    ));
    if (!replies.some((r) => r.ok)) return fail("Every calendar query failed.");

    const rows = replies.flatMap((r) =>
      r.ok ? (((r.data as { data?: { results?: unknown[] } })?.data?.results ?? []) as {
        report_date?: string; symbol?: string; eps_consensus?: number | null;
      }[]) : []
    );

    const midnight = +new Date(iso(today));
    const byTicker: Record<string, Earnings> = {};
    for (const row of rows) {
      const sym = String(row.symbol ?? "").toUpperCase();
      const date = String(row.report_date ?? "");
      if (!sym || !/^\d{4}-\d{2}-\d{2}$/.test(date)) continue;
      // Earliest upcoming report per name.
      if (byTicker[sym] && byTicker[sym].date <= date) continue;
      byTicker[sym] = {
        symbol: sym,
        date,
        days: Math.round((+new Date(date) - midnight) / 864e5),
        eps: typeof row.eps_consensus === "number" ? row.eps_consensus : null,
      };
    }

    const payload = {
      ok: true, endpoint: MCP_URL, tool: query.name, entry,
      n_rows: rows.length, n_names: Object.keys(byTicker).length, calendar: byTicker,
    };
    cache = { at: Date.now(), payload };
    return Response.json(payload);
  } catch {
    return fail("Bitget's agent server is unreachable from this deployment.");
  }
}
