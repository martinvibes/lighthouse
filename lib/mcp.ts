/**
 * A minimal MCP client for Bitget's own agent server (keyless, built for this
 * hackathon). Server-side only.
 *
 * Nothing about the server's tools is hardcoded. We ask it what it has
 * (`tools/list`), then build each call's arguments out of that tool's declared
 * inputSchema — so a renamed parameter degrades to "no data" rather than to a
 * wrong request. If the host is unreachable the desk says so and carries on;
 * the measured record never depends on it.
 */
export const MCP_URL = process.env.BITGET_MCP_URL || "https://agent.bitget.com/mcp";

type Json = Record<string, unknown>;
export type McpTool = { name: string; description?: string; inputSchema?: Json };

const TIMEOUT = 9000;

/** Streamable HTTP speaks either plain JSON or SSE. Accept both. */
async function readBody(r: Response): Promise<Json | null> {
  const ct = r.headers.get("content-type") || "";
  const text = await r.text();
  if (!text) return null;
  if (ct.includes("text/event-stream")) {
    let last: Json | null = null;
    for (const line of text.split("\n")) {
      if (!line.startsWith("data:")) continue;
      try { last = JSON.parse(line.slice(5).trim()); } catch { /* keep scanning */ }
    }
    return last;
  }
  try { return JSON.parse(text); } catch { return null; }
}

let seq = 1;

async function rpc(method: string, params: Json | undefined, session: string | null) {
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), TIMEOUT);
  try {
    const r = await fetch(MCP_URL, {
      method: "POST",
      signal: ctl.signal,
      headers: {
        "content-type": "application/json",
        accept: "application/json, text/event-stream",
        ...(session ? { "mcp-session-id": session } : {}),
      },
      body: JSON.stringify({ jsonrpc: "2.0", id: seq++, method, ...(params ? { params } : {}) }),
    });
    const body = await readBody(r);
    return { ok: r.ok, status: r.status, body, session: r.headers.get("mcp-session-id") || session };
  } finally {
    clearTimeout(timer);
  }
}

export async function connect() {
  const init = await rpc("initialize", {
    protocolVersion: "2025-06-18",
    capabilities: {},
    clientInfo: { name: "lighthouse", version: "1.0.0" },
  }, null);
  if (!init.ok || !init.body) return null;
  const id = init.session;
  // Handshake completion is a notification: fire it, ignore the empty reply.
  await rpc("notifications/initialized", {}, id).catch(() => {});
  const server = (init.body.result as Json | undefined)?.serverInfo as Json | undefined;
  return { session: id, server: (server?.name as string) || "bitget" };
}

export async function listTools(session: string | null): Promise<McpTool[]> {
  const r = await rpc("tools/list", {}, session);
  const tools = (r.body?.result as Json | undefined)?.tools;
  return Array.isArray(tools) ? (tools as McpTool[]) : [];
}

/** First tool whose name or description matches — checked against what the server actually published. */
export function pickTool(tools: McpTool[], re: RegExp): McpTool | null {
  return tools.find((t) => re.test(t.name)) ?? tools.find((t) => re.test(t.description ?? "")) ?? null;
}

/**
 * Fill a tool's arguments from its own schema. `roles` maps a regex over the
 * declared property name to the value we want to pass. Properties we have no
 * value for are left out, which is why required-field failures surface as the
 * server's own error rather than as a silently wrong call.
 */
export function argsFor(tool: McpTool, roles: { match: RegExp; value: unknown }[]): Json {
  const props = (tool.inputSchema?.properties ?? {}) as Record<string, Json>;
  const out: Json = {};
  for (const key of Object.keys(props)) {
    const hit = roles.find((r) => r.match.test(key));
    if (hit !== undefined && hit.value !== undefined && hit.value !== null) out[key] = hit.value;
  }
  return out;
}

export async function callTool(session: string | null, name: string, args: Json) {
  const r = await rpc("tools/call", { name, arguments: args }, session);
  const result = r.body?.result as Json | undefined;
  if (!result) return { ok: false as const, error: (r.body?.error as Json)?.message ?? `status ${r.status}` };
  if (result.isError) return { ok: false as const, error: "tool reported an error" };

  // Content is a list of blocks; text blocks often carry JSON.
  const blocks = Array.isArray(result.content) ? (result.content as Json[]) : [];
  const texts = blocks.filter((b) => b.type === "text").map((b) => String(b.text ?? ""));
  let data: unknown = result.structuredContent ?? null;
  if (data === null && texts.length) {
    try { data = JSON.parse(texts.join("\n")); } catch { data = texts.join("\n"); }
  }
  return { ok: true as const, data, text: texts.join("\n") };
}
