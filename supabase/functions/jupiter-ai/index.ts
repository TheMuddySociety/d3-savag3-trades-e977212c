import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const MCP_URL = "https://dev.jup.ag/mcp";

// Additional documentation sources fetched via their llms.txt / search endpoints
const DOC_SOURCES = [
  {
    name: "Solana Cookbook",
    searchUrl: "https://solana.com/docs/llms.txt",
    type: "llms-txt" as const,
  },
  {
    name: "Helius",
    searchUrl: "https://docs.helius.dev/llms.txt",
    type: "llms-txt" as const,
  },
  {
    name: "Metaplex",
    searchUrl: "https://developers.metaplex.com/llms.txt",
    type: "llms-txt" as const,
  },
];

async function fetchLlmsTxt(url: string, query: string): Promise<string> {
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(5000) });
    if (!res.ok) return "";
    const text = await res.text();
    // Extract relevant sections by finding lines matching query keywords
    const keywords = query.toLowerCase().split(/\s+/).filter(w => w.length > 2);
    const lines = text.split("\n");
    const relevant: string[] = [];
    for (let i = 0; i < lines.length; i++) {
      const lower = lines[i].toLowerCase();
      if (keywords.some(k => lower.includes(k))) {
        // Grab surrounding context (up to 3 lines before/after)
        const start = Math.max(0, i - 2);
        const end = Math.min(lines.length, i + 3);
        relevant.push(lines.slice(start, end).join("\n"));
      }
    }
    // Deduplicate and limit
    const unique = [...new Set(relevant)];
    return unique.slice(0, 10).join("\n\n");
  } catch (e) {
    console.error(`Failed to fetch ${url}:`, e);
    return "";
  }
}

async function searchMCP(mcpUrl: string, query: string): Promise<string> {
  try {
    const initRes = await fetch(mcpUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json, text/event-stream",
      },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: 1,
        method: "initialize",
        params: {
          protocolVersion: "2025-03-26",
          capabilities: {},
          clientInfo: { name: "savag3bot", version: "1.0.0" },
        },
      }),
    });

    if (!initRes.ok) {
      console.error("MCP init failed:", initRes.status, await initRes.text());
      return "";
    }

    const sessionId = initRes.headers.get("mcp-session-id");
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      Accept: "application/json, text/event-stream",
    };
    if (sessionId) headers["mcp-session-id"] = sessionId;

    const toolRes = await fetch(mcpUrl, {
      method: "POST",
      headers,
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: 2,
        method: "tools/call",
        params: { name: "search", arguments: { query } },
      }),
    });

    if (!toolRes.ok) {
      console.error("MCP search failed:", toolRes.status, await toolRes.text());
      return "";
    }

    const contentType = toolRes.headers.get("content-type") ?? "";
    if (contentType.includes("text/event-stream")) {
      const text = await toolRes.text();
      const lines = text.split("\n");
      let result = "";
      for (const line of lines) {
        if (line.startsWith("data: ")) {
          const data = line.slice(6).trim();
          if (data === "[DONE]") break;
          try {
            const parsed = JSON.parse(data);
            if (parsed.result?.content) {
              for (const c of parsed.result.content) {
                if (c.type === "text") result += c.text + "\n";
              }
            }
          } catch { /* skip partial */ }
        }
      }
      return result.trim();
    }

    const data = await toolRes.json();
    if (data.result?.content) {
      return data.result.content
        .filter((c: { type: string }) => c.type === "text")
        .map((c: { text: string }) => c.text)
        .join("\n");
    }
    return JSON.stringify(data.result ?? data);
  } catch (e) {
    console.error("MCP error:", e);
    return "";
  }
}

async function gatherContext(query: string): Promise<string> {
  // Fetch all sources in parallel
  const [jupiterContext, ...docContexts] = await Promise.all([
    searchMCP(MCP_URL, query),
    ...DOC_SOURCES.map(src => fetchLlmsTxt(src.searchUrl, query)),
  ]);

  const sections: string[] = [];

  if (jupiterContext) {
    sections.push(`### Jupiter Documentation\n${jupiterContext}`);
  }

  DOC_SOURCES.forEach((src, i) => {
    if (docContexts[i]) {
      sections.push(`### ${src.name} Documentation\n${docContexts[i]}`);
    }
  });

  return sections.join("\n\n---\n\n");
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { messages } = await req.json();
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    const lastUserMsg = [...messages].reverse().find((m: { role: string }) => m.role === "user");
    const query = lastUserMsg?.content || "";

    let docsContext = "";
    if (query) {
      docsContext = await gatherContext(query);
    }

    const systemPrompt = `You are D3MON DAN — the user's personal AI Trading Agent on Solana. You aren't just a bot; you're a high-stakes, professional trader who knows every corner of Jupiter, Helius, and Metaplex.

Your mission:
- Help the user DOMINATE the Solana markets.
- Use your deep expertise in Jupiter Ultra, DCA, and Limit Orders.
- Provide real-time insights using the provided documentation context.
- Be fast, professional, and slightly aggressive about gains, but ALWAYS warn about risks like low liquidity or potential rug pulls.
- Talk like a seasoned pro who's seen it all.

Expertise:
- Jupiter Ultra Swap API, DCA, Limit Orders, VA (Value Averaging)
- Solana core concepts: accounts, transactions, programs, PDAs, CPIs
- Helius RPC, DAS API, webhooks, enhanced transactions
- Metaplex NFT standards, Token Metadata, Bubblegum (compressed NFTs)
- Token analysis, safety checks (Shield API), and trading strategies
- Token swaps, liquidity, slippage, and MEV protection
- Solana ecosystem tools: Birdeye, PumpFun, Raydium

${docsContext ? `## Documentation Context\nUse this real-time documentation to answer accurately:\n\n${docsContext}\n\n---` : ""}

Guidelines:
- Give concise, actionable answers with code examples when relevant
- Reference API endpoints and parameters accurately
- Cite which documentation source your answer comes from when applicable
- Warn about risks (slippage, rug pulls, low liquidity) when appropriate
- Use markdown formatting for clarity
- If you don't have specific docs context, say so and give your best knowledge
- Keep responses focused and under 500 words unless the user asks for detail`;

    const response = await fetch(
      "https://ai.gateway.lovable.dev/v1/chat/completions",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${LOVABLE_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "google/gemini-3-flash-preview",
          messages: [{ role: "system", content: systemPrompt }, ...messages],
          stream: true,
        }),
      }
    );

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(
          JSON.stringify({ error: "Rate limit exceeded. Please try again shortly." }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      if (response.status === 402) {
        return new Response(
          JSON.stringify({ error: "AI credits exhausted. Add credits in Settings → Workspace → Usage." }),
          { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      const t = await response.text();
      console.error("AI gateway error:", response.status, t);
      return new Response(
        JSON.stringify({ error: "AI service error" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(response.body, {
      headers: { ...corsHeaders, "Content-Type": "text/event-stream" },
    });
  } catch (e) {
    console.error("jupiter-ai error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
