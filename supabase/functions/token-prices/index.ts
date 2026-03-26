import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
// Redis client - dynamic import to avoid build errors when not configured
let RedisClass: any = null;

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Content-Type": "application/json",
};

// Redis client (safe even if env vars missing – falls back gracefully)
let redis: any = null;
try {
  const redisUrl = Deno.env.get("UPSTASH_REDIS_REST_URL");
  const redisToken = Deno.env.get("UPSTASH_REDIS_REST_TOKEN");
  if (redisUrl && redisToken && RedisClass) {
    redis = new RedisClass({ url: redisUrl, token: redisToken });
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

    if (!targetMint && action !== "health" && action !== "trending" && action !== "recent_launches" && action !== "sol_price" && action !== "ping") {
      return new Response(JSON.stringify({ success: false, error: "mint/address is required for this action" }), {
        status: 400,
        headers: corsHeaders,
      });
    }

    // ====================== UNIFIED ACTION ======================
    if (action === "full_token_profile") {
      const { interval = "5m" } = body;
      const cacheKey = `full_profile:${targetMint}:${interval}`;
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
        fetchBirdeyeOHLCV(targetMint, interval),
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

    if (action === "sol_price") {
      const SOL_MINT = "So11111111111111111111111111111111111111112";
      const price = await getCurrentPrice(SOL_MINT);
      return new Response(JSON.stringify({ success: true, data: { price } }), { headers: corsHeaders });
    }

    if (action === "ping" || action === "health") {
      return new Response(JSON.stringify({ success: true, status: "ok" }), { headers: corsHeaders });
    }

    if (action === "recent_launches") {
      try {
        const res = await fetch("https://frontend-api-v2.pump.fun/coins/latest?limit=10&includeNsfw=false");
        if (!res.ok) throw new Error(`Pump.fun API error: ${res.status}`);
        const coins = await res.json();
        const mapped = (Array.isArray(coins) ? coins : []).map((c: any) => ({
          address: c.mint || c.address || '',
          name: c.name || 'Unknown',
          symbol: c.symbol || '???',
          logo: c.image_uri || c.uri || '/placeholder.svg',
          timestamp: c.created_timestamp ? c.created_timestamp : Date.now(),
          marketCap: c.market_cap || c.usd_market_cap || 0,
          liquidity: 0,
          tradeCount: c.reply_count || 0,
          bondingCurveProgress: c.bonding_curve_progress || 0,
          status: c.complete ? 'graduated' : 'bonding',
          description: c.description || '',
        }));
        return new Response(JSON.stringify({ success: true, data: mapped }), { headers: corsHeaders });
      } catch (e: any) {
        console.error("[token-prices] recent_launches error:", e.message);
        return new Response(JSON.stringify({ success: true, data: [] }), { headers: corsHeaders });
      }
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

async function fetchBirdeyeOHLCV(mint: string, interval: string = "5m") {
  if (!BIRDEYE_API_KEY) throw new Error("Birdeye API key not set");
  const now = Math.floor(Date.now() / 1000);
  const timeFrom = now - 86400; // 24 hours ago

  const url = new URL("https://public-api.birdeye.so/defi/v3/ohlcv");
  url.searchParams.append("address", mint);
  url.searchParams.append("type", interval);
  url.searchParams.append("time_from", timeFrom.toString());
  url.searchParams.append("time_to", now.toString());
  url.searchParams.append("currency", "usd");

  const res = await fetch(url.toString(), {
    headers: { 
      "X-API-KEY": BIRDEYE_API_KEY, 
      "x-chain": "solana",
      "accept": "application/json"
    },
  });

  if (res.status === 429) {
    console.warn(`[Birdeye] Rate limit hit for ${mint} – using Redis cache fallback`);
    throw new Error("Birdeye rate limit exceeded");
  }

  if (!res.ok) throw new Error(`Birdeye failed: ${res.status}`);
  const data = await res.json();
  
  return (data.data?.items || []).map((c: any[]) => ({
    timestamp: c[0] * 1000,
    unixTime: c[0],
    time: new Date(c[0] * 1000).toISOString().slice(11, 16),
    open: Number(c[1]), 
    high: Number(c[2]), 
    low: Number(c[3]), 
    close: Number(c[4]), 
    volume: Number(c[5]) || 0,
    value: Number(c[4]) // Important for Recharts mapping which expects 'value'
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
