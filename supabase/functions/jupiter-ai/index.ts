import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const MCP_URL = "https://dev.jup.ag/mcp";

async function searchJupiterDocs(query: string): Promise<string> {
  try {
    // Initialize MCP session
    const initRes = await fetch(MCP_URL, {
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

    // Get session ID from response
    const sessionId = initRes.headers.get("mcp-session-id");
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      Accept: "application/json, text/event-stream",
    };
    if (sessionId) headers["mcp-session-id"] = sessionId;

    // Call searchDocs tool
    const toolRes = await fetch(MCP_URL, {
      method: "POST",
      headers,
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: 2,
        method: "tools/call",
        params: {
          name: "search",
          arguments: { query },
        },
      }),
    });

    if (!toolRes.ok) {
      console.error("MCP search failed:", toolRes.status, await toolRes.text());
      return "";
    }

    const contentType = toolRes.headers.get("content-type") ?? "";

    if (contentType.includes("text/event-stream")) {
      // Parse SSE response
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
          } catch {
            // skip partial
          }
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

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { messages } = await req.json();
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    // Extract the latest user message for MCP context search
    const lastUserMsg = [...messages].reverse().find((m: { role: string }) => m.role === "user");
    const query = lastUserMsg?.content || "";

    // Fetch Jupiter documentation context via MCP
    let jupiterContext = "";
    if (query) {
      jupiterContext = await searchJupiterDocs(query);
    }

    const systemPrompt = `You are SAVAG3BOT AI — a Solana DeFi trading assistant powered by Jupiter Protocol knowledge.

You have deep expertise in:
- Jupiter Ultra Swap API, DCA, Limit Orders, VA (Value Averaging)
- Solana token analysis, safety checks (Shield API), and trading strategies
- Token swaps, liquidity, slippage, and MEV protection
- Solana ecosystem tools: Helius, Birdeye, Metaplex, PumpFun

${jupiterContext ? `## Jupiter Documentation Context\nUse this real-time documentation to answer accurately:\n\n${jupiterContext}\n\n---` : ""}

Guidelines:
- Give concise, actionable answers with code examples when relevant
- Reference Jupiter API endpoints and parameters accurately
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
