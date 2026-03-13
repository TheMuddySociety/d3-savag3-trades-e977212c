## Jupiter MCP AI Auto-Training Assistant Use Jup site to understand it more: [https://dev.jup.ag/ai](https://dev.jup.ag/ai)

### What We're Building

An AI-powered trading assistant on the dashboard that uses Jupiter's MCP endpoint (`https://dev.jup.ag/mcp`) as a knowledge source. The assistant will be able to answer questions about Jupiter APIs, Solana DeFi strategies, token analysis, and trading — trained on Jupiter's full documentation and API specs.

Since Jupiter MCP is an HTTP MCP server, we'll build a backend function that proxies MCP requests to fetch Jupiter documentation context, then feeds that context to Lovable AI (already configured with `LOVABLE_API_KEY`) to generate informed responses.

### Architecture

```text
User Chat UI  →  Edge Function (jupiter-ai)  →  Jupiter MCP (docs context)
                                              →  Lovable AI Gateway (response generation)
```

### Implementation Plan

#### 1. Create `jupiter-ai` Edge Function

- Accepts user messages + conversation history
- Calls `https://dev.jup.ag/mcp` via MCP Streamable HTTP protocol to fetch relevant Jupiter documentation context (using `searchDocs` tool)
- Constructs a system prompt with Jupiter context + SAVAG3BOT trading personality
- Streams response from Lovable AI Gateway (`google/gemini-3-flash-preview`) back to client
- Handles 429/402 rate limit errors

#### 2. Create `JupiterAIChat` Dashboard Component

- Chat interface with message history, streaming token-by-token rendering
- Renders AI responses with markdown support (install `react-markdown`)
- Pre-loaded suggested prompts: "How do I use Ultra Swap API?", "Analyze token safety", "Best DCA strategy on Solana"
- Compact card design matching existing dashboard style
- Positioned in the main column of the dashboard

#### 3. Add to Dashboard Layout

- Add `JupiterAIChat` component to `Index.tsx` in the main column, after `PortfolioTracker`

### Technical Details

**MCP Integration**: The edge function will call Jupiter's MCP endpoint with the required headers (`Accept: application/json, text/event-stream`, `Content-Type: application/json`) using JSON-RPC to invoke the `searchDocs` tool, retrieving relevant documentation pages based on the user's query. This context is then injected into the system prompt for the AI model.

**Streaming**: Uses SSE streaming from Lovable AI Gateway with token-by-token rendering on the frontend following the established pattern.

**Dependencies**: Add `react-markdown` for rendering AI responses with proper formatting.

**Files to create/edit**:

- `supabase/functions/jupiter-ai/index.ts` — new edge function
- `src/components/dashboard/JupiterAIChat.tsx` — new chat component
- `src/pages/Index.tsx` — add component to layout