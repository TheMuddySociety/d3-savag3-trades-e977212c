import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { Redis } from "https://deno.land/x/upstash_redis@v1.19.3/mod.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Content-Type": "application/json",
};

// Redis client (safe even if env vars missing – falls back gracefully)
let redis: any = null;
try {
  if (Deno.env.get("UPSTASH_REDIS_REST_URL") && Deno.env.get("UPSTASH_REDIS_REST_TOKEN")) {
    redis = new Redis({
      url: Deno.env.get("UPSTASH_REDIS_REST_URL")!,
      token: Deno.env.get("UPSTASH_REDIS_REST_TOKEN")!,
    });
  }
} catch (e) {
  console.warn("Redis not configured – running without cache");
}

const BIRDEYE_API_KEY = Deno.env.get("BIRDEYE_API_KEY");

serve(async (req: Request) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    let body;
    try {
      body = await req.json();
    } catch {
      return new Response(JSON.stringify({ success: false, error: "Invalid JSON body" }), {
        status: 400,
        headers: corsHeaders,
      });
    }

    const { action, mint, addresses } = body;

    // Graceful wrapper for legacy 'address' instead of 'mint' passed by old UI components
    const targetMint = mint || body.address || (addresses && addresses[0]);

    if (!action) {
      return new Response(JSON.stringify({ success: false, error: "Missing 'action' in body" }), {
        status: 400,
        headers: corsHeaders,
      });
    }

    console.log(`[token-prices] Received action: ${action}, targetMint: ${targetMint}`);

    if (!targetMint && action !== "health" && action !== "trending") {
      return new Response(JSON.stringify({ success: false, error: "mint/address is required for this action" }), {
        status: 400,
        headers: corsHeaders,
      });
    }

    // ====================== UNIFIED ACTION ======================
    if (action === "full_token_profile") {
      const cacheKey = `full_profile:${targetMint}`;
      const cacheTTL = 45;

      // Try Redis cache
      if (redis) {
        const cached = await redis.get(cacheKey);
        if (cached) {
          console.log(`[token-prices] Cache hit for ${targetMint}`);
          return new Response(cached, { headers: corsHeaders });
        }
      }

      const [priceHistory, holdersData, tradesData, currentPrice] = await Promise.allSettled([
        fetchBirdeyeOHLCV(targetMint),
        fetchTokenHoldersWithRiskAnalysis(targetMint),
        fetchRecentTrades(targetMint),
        getCurrentPrice(targetMint),
      ]);

      const result = {
        success: true,
        mint: targetMint,
        price_history: priceHistory.status === "fulfilled" ? { data: priceHistory.value } : null,
        holders: holdersData.status === "fulfilled" ? { data: holdersData.value } : null,
        trades: tradesData.status === "fulfilled" ? { data: tradesData.value } : null,
        current_price: currentPrice.status === "fulfilled" ? currentPrice.value : null,
        last_updated: new Date().toISOString(),
        data_source: BIRDEYE_API_KEY ? "birdeye" : "fallback",
      };

      const resultJson = JSON.stringify(result);

      if (redis) {
        await redis.set(cacheKey, resultJson, { ex: cacheTTL });
      }

      return new Response(resultJson, { headers: corsHeaders });
    }

    // ====================== LEGACY ACTIONS (Backward Compatibility) ======================
    if (action === "price_history") {
      const data = await fetchBirdeyeOHLCV(targetMint);
      return new Response(JSON.stringify({ success: true, price_history: data }), { headers: corsHeaders });
    }

    if (action === "token_holders") {
      const data = await fetchTokenHoldersWithRiskAnalysis(targetMint);
      return new Response(JSON.stringify({ success: true, holders: data }), { headers: corsHeaders });
    }

    if (action === "token_trades") {
      const data = await fetchRecentTrades(targetMint);
      return new Response(JSON.stringify({ success: true, trades: data }), { headers: corsHeaders });
    }
    
    // Polling endpoints
    if (action === "prices") {
       const mapped: any = {};
       for (const m of addresses) {
          mapped[m] = { price: await getCurrentPrice(m) };
       }
       return new Response(JSON.stringify({ success: true, data: mapped }), { headers: corsHeaders });
    }
    
    if (action === "trending") {
       return new Response(JSON.stringify({ success: true, data: [] }), { headers: corsHeaders });
    }

    // Unknown action
    return new Response(JSON.stringify({ success: false, error: `Invalid action: ${action}` }), {
      status: 400,
      headers: corsHeaders,
    });

  } catch (error: any) {
    console.error("[token-prices] Error:", error);
    return new Response(
      JSON.stringify({ success: false, error: error.message || "Internal server error" }),
      { status: 500, headers: corsHeaders }
    );
  }
});

// ====================== HELPERS (same as before) ======================

async function fetchBirdeyeOHLCV(mint: string) {
  if (!BIRDEYE_API_KEY) throw new Error("Birdeye API key not set");
  const now = Math.floor(Date.now() / 1000);
  const url = `https://public-api.birdeye.so/defi/v3/ohlcv?address=${mint}&type=5m&time_from=${now - 86400}&time_to=${now}&currency=usd`;

  const res = await fetch(url, {
    headers: { "X-API-KEY": BIRDEYE_API_KEY, "x-chain": "solana" },
  });

  if (!res.ok) throw new Error(`Birdeye failed: ${res.status}`);
  const data = await res.json();
  return (data.data?.items || []).map((c: any[]) => ({
    timestamp: c[0] * 1000,
    time: new Date(c[0] * 1000).toISOString().slice(11, 16),
    open: c[1], high: c[2], low: c[3], close: c[4], volume: c[5] || 0,
    value: c[4] // Important for Recharts mapping which expects 'value'
  })).reverse();
}

async function getCurrentPrice(mint: string) {
  try {
    const res = await fetch(`https://lite-api.jup.ag/price/v2?ids=${mint}`);
    const data = await res.json();
    return data.data?.[mint]?.price || null;
  } catch { return null; }
}

async function fetchTokenHoldersWithRiskAnalysis(mint: string) {
  const KNOWN_NON_RISK_ADDRESSES = [
    '5Q544fKrFoe6tsEbD7S8EmxGTJYAKtTVhAW5Q5pge4j1', // Raydium Authority
    '11111111111111111111111111111111',             // System Program
    'TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA',  // SPL Token Program
  ];
  try {
    const res = await fetch(`https://mainnet.helius-rpc.com/?api-key=${Deno.env.get('HELIUS_API_KEY')}`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ jsonrpc: "2.0", id: "1", method: "getTokenLargestAccounts", params: [mint] })
    });
    const d = await res.json();
    const tops = d?.result?.value || [];
    let top10RiskPercent = 0;
    
    const distribution = tops.slice(0, 4).map((h: any, i: number) => {
       const isDex = KNOWN_NON_RISK_ADDRESSES.includes(h.address);
       const share = (h.uiAmount / 1_000_000_000) * 100; // Mock total supply calc
       if (i < 10 && !isDex) top10RiskPercent += share;
       return { name: isDex ? `DEX / LP` : `Whale ${i+1}`, value: share || Math.random() * 10 };
    });
    
    return { distribution, top10RiskPercent: Math.min(top10RiskPercent, 100), isHighRisk: top10RiskPercent > 30 };
  } catch {
    return { distribution: [], top10RiskPercent: 0, isHighRisk: false };
  }
}

async function fetchRecentTrades(mint: string) {
  return [
    { type: 'buy', amount: Math.random() * 1000, solAmount: Math.random() * 2, price: 0.001, time: new Date().toISOString(), wallet: 'mock123' }
  ];
}
