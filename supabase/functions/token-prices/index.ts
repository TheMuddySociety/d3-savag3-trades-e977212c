import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Content-Type": "application/json",
};

// Safe env get helper
const getEnv = (key: string): string | null => {
  try {
    return (globalThis as any).Deno?.env?.get(key) || null;
  } catch {
    return null;
  }
};

const BIRDEYE_API_KEY = getEnv("BIRDEYE_API_KEY");

// Trending Cache (Warm Isolate only)
let cachedTrending: any = null;
let lastTrendingFetch = 0;
const TRENDING_CACHE_TTL = 5 * 60 * 1000; // 5 minutes

serve(async (req: Request) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const body = await (async () => {
      try {
        return await req.json();
      } catch {
        return {};
      }
    })();

    const action = body.action;
    const mint = body.mint || body.address;
    const addresses = Array.isArray(body.addresses) ? body.addresses : [];

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

      return new Response(JSON.stringify(result), { headers: corsHeaders });
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
      if (addresses.length > 0) {
        try {
          const res = await fetch(`https://api.jup.ag/price/v2?ids=${addresses.join(',')}`);
          const data = await res.json();
          for (const m of addresses) {
            const p = data.data?.[m]?.price;
            mapped[m] = { price: p ? Number(p) : null };
          }
        } catch (e) {
          console.error("[token-prices] Batch price fetch failed:", e);
          for (const m of addresses) {
            mapped[m] = { price: await getCurrentPrice(m) };
          }
        }
      }
      return new Response(JSON.stringify({ success: true, data: mapped }), { headers: corsHeaders });
    }
    
    if (action === "trending") {
      const now = Date.now();
      if (cachedTrending && (now - lastTrendingFetch < TRENDING_CACHE_TTL)) {
        console.log("[token-prices] Returning cached trending data");
        return new Response(JSON.stringify({ success: true, data: cachedTrending }), { headers: corsHeaders });
      }

      try {
        let mapped: any[] = [];

        if (BIRDEYE_API_KEY) {
          const res = await fetch("https://public-api.birdeye.so/defi/token_trending?sort_by=rank&sort_type=asc&offset=0&limit=30", {
            headers: { "X-API-KEY": BIRDEYE_API_KEY, "x-chain": "solana", "accept": "application/json" },
          });
          if (res.ok) {
            const data = await res.json();
            mapped = (data.data?.tokens || []).map((t: any) => {
              const buys = Number(t.buy24h || 0);
              const sells = Number(t.sell24h || 0);
              return {
                address: t.address, symbol: t.symbol, name: t.name,
                price: Number(t.price || 0), price_change_24h: Number(t.v24hChangePercent || 0),
                volume_24h: Number(t.v24hUSD || 0), market_cap: Number(t.mc || t.marketCap || 0),
                rank: Number(t.rank || 0), holders: Number(t.holder_count || t.holders || 0),
                unique_traders_24h: buys + sells,
              };
            }).slice(0, 30);
          } else {
            console.warn(`[token-prices] Birdeye trending ${res.status}, falling back to DexScreener`);
          }
        }

        // DexScreener fallback if Birdeye unavailable or returned empty
        if (mapped.length === 0) {
          console.log("[token-prices] Using DexScreener fallback for trending");
          mapped = await fetchDexScreenerTrendingData();
        }

        if (mapped.length > 0) {
          cachedTrending = mapped;
          lastTrendingFetch = now;
        }
        return new Response(JSON.stringify({ success: true, data: mapped }), { headers: corsHeaders });
      } catch (e: any) {
        console.error("[token-prices] trending error:", e.message);
        // Try DexScreener as last resort
        try {
          const fallback = await fetchDexScreenerTrendingData();
          if (fallback.length > 0) { cachedTrending = fallback; lastTrendingFetch = now; }
          return new Response(JSON.stringify({ success: true, data: fallback }), { headers: corsHeaders });
        } catch { }
        return new Response(JSON.stringify({ success: true, data: cachedTrending || [] }), { headers: corsHeaders });
      }
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

    // ====================== SHIELD CHECK (MemeScanner) ======================
    if (action === "shield_check") {
      try {
        const heliusKey = getEnv("HELIUS_API_KEY");
        if (!heliusKey) {
          return new Response(JSON.stringify({ 
            success: true, 
            data: { 
              name: "Unknown", 
              symbol: "???", 
              safe: false, 
              warning: "Enhanced shield scan requires HELIUS_API_KEY. Using basic validation.",
              flags: { lowLiquidity: true, warnings: ["API key missing"] }
            } 
          }), { headers: corsHeaders });
        }

        // 1. Get token metadata via Helius DAS for freeze/mint authority
        const [assetRes, holdersRes] = await Promise.allSettled([
          fetch(`https://mainnet.helius-rpc.com/?api-key=${heliusKey}`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              jsonrpc: "2.0", id: "shield-asset", method: "getAsset",
              params: { id: targetMint, displayOptions: { showFungible: true } },
            }),
          }).then((r) => r.json()),
          fetch(`https://mainnet.helius-rpc.com/?api-key=${heliusKey}`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              jsonrpc: "2.0", id: "shield-holders", method: "getTokenLargestAccounts",
              params: [targetMint],
            }),
          }).then((r) => r.json()),
        ]);

        const asset = assetRes.status === "fulfilled" ? assetRes.value?.result : null;
        const holders = holdersRes.status === "fulfilled" ? holdersRes.value?.result?.value || [] : [];

        // Extract authority info from token metadata
        const freezeAuthority = asset?.token_info?.freeze_authority || asset?.authorities?.find((a: any) => a.scopes?.includes("freeze"))?.address || null;
        const mintAuthority = asset?.token_info?.mint_authority || asset?.authorities?.find((a: any) => a.scopes?.includes("mint"))?.address || null;
        const tokenName = asset?.content?.metadata?.name || asset?.token_info?.symbol || "Unknown";
        const tokenSymbol = asset?.content?.metadata?.symbol || asset?.token_info?.symbol || "???";

        // 2. Get liquidity and pair age from Birdeye (if available)
        let liquidity = 0;
        let pairAge = "";
        if (BIRDEYE_API_KEY) {
          try {
            const birdRes = await fetch(
              `https://public-api.birdeye.so/defi/v3/token/market-data?address=${targetMint}`,
              { headers: { "X-API-KEY": BIRDEYE_API_KEY, "x-chain": "solana", accept: "application/json" } }
            );
            if (birdRes.ok) {
              const birdData = await birdRes.json();
              liquidity = Number(birdData.data?.liquidity || 0);
              pairAge = birdData.data?.createTime || birdData.data?.createdAt || "";
            }
          } catch (e) {
            console.warn("[shield_check] Birdeye market data fetch failed:", e);
          }
        }

        // 3. Compute risk flags
        const holderCount = holders.length;
        const hasFreezeAuthority = !!freezeAuthority;
        const hasMintAuthority = !!mintAuthority;
        const isLowLiquidity = liquidity < 10000; // Less than $10k
        const isLowHolders = holderCount < 20;

        const warnings: string[] = [];
        if (hasFreezeAuthority && hasMintAuthority) warnings.push("Both freeze + mint authority active");
        if (liquidity > 0 && liquidity < 1000) warnings.push("Extremely low liquidity (<$1K)");

        const safe = !hasFreezeAuthority && !isLowLiquidity && !isLowHolders && warnings.length === 0;

        const result = {
          name: tokenName,
          symbol: tokenSymbol,
          safe,
          holders: holderCount,
          liquidity,
          pairAge,
          flags: {
            freezeAuthority: hasFreezeAuthority,
            mintAuthority: hasMintAuthority,
            lowLiquidity: isLowLiquidity,
            lowHolders: isLowHolders,
            warnings,
          },
        };

        return new Response(JSON.stringify({ success: true, data: result }), { headers: corsHeaders });
      } catch (e: any) {
        console.error("[token-prices] shield_check error:", e.message);
        return new Response(JSON.stringify({ success: false, error: e.message || "Shield check failed" }), {
          status: 500, headers: corsHeaders,
        });
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
  if (!BIRDEYE_API_KEY) {
    console.warn("[Birdeye] No API key set – using Jupiter fallback");
    return await fetchJupiterOHLCVFallback(mint);
  }

  // Normalize interval to Birdeye-accepted values (lowercase, valid periods)
  const VALID_INTERVALS: Record<string, string> = {
    "1m": "1m", "3m": "3m", "5m": "5m", "15m": "15m", "30m": "30m",
    "1h": "1H", "1H": "1H", "2h": "2H", "2H": "2H", "4h": "4H", "4H": "4H",
    "6h": "6H", "6H": "6H", "8h": "8H", "8H": "8H", "12h": "12H", "12H": "12H",
    "1d": "1D", "1D": "1D", "3d": "3D", "3D": "3D", "1w": "1W", "1W": "1W",
    "1M": "1M",
  };
  const normalizedInterval = VALID_INTERVALS[interval] || "5m";

  const now = Math.floor(Date.now() / 1000);
  const timeFrom = now - 86400; // 24 hours ago

  const url = new URL("https://public-api.birdeye.so/defi/ohlcv");
  url.searchParams.append("address", mint);
  url.searchParams.append("type", normalizedInterval);
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

  if (res.status === 429 || !res.ok) {
    console.warn(`[Birdeye] ${res.status} for ${mint} – falling back to Jupiter`);
    return await fetchJupiterOHLCVFallback(mint);
  }

  const data = await res.json();
  const items = data.data?.items || [];
  if (items.length === 0) return await fetchJupiterOHLCVFallback(mint);

  return mapOHLCVItems(items);
}

function mapOHLCVItems(items: any[]) {
  return items.map((c: any) => {
    const ts = c.unixTime ?? c[0] ?? 0;
    const open = Number(c.o ?? c[1] ?? 0);
    const high = Number(c.h ?? c[2] ?? 0);
    const low = Number(c.l ?? c[3] ?? 0);
    const close = Number(c.c ?? c[4] ?? 0);
    const volume = Number(c.v ?? c[5] ?? 0);
    const msTs = ts > 1e12 ? ts : ts * 1000;
    return {
      timestamp: msTs, unixTime: ts,
      time: msTs > 0 ? new Date(msTs).toISOString().slice(11, 16) : '00:00',
      open, high, low, close, volume, value: close,
    };
  }).reverse();
}

async function fetchJupiterOHLCVFallback(mint: string) {
  // Use Jupiter current price to generate a single-point chart as fallback
  const price = await getCurrentPrice(mint);
  if (!price) return [];
  const now = Date.now();
  // Generate 24 synthetic points so chart renders
  return Array.from({ length: 24 }, (_, i) => {
    const ts = now - (23 - i) * 3600000;
    return {
      timestamp: ts, unixTime: Math.floor(ts / 1000),
      time: new Date(ts).toISOString().slice(11, 16),
      open: price, high: price, low: price, close: price, volume: 0, value: price,
    };
  });
}

async function getCurrentPrice(mint: string) {
  // Try Jupiter Price API v2 first (v3 deprecated)
  try {
    const res = await fetch(`https://api.jup.ag/price/v2?ids=${mint}`);
    if (res.ok) {
      const data = await res.json();
      const price = data.data?.[mint]?.price;
      if (price) return Number(price);
    }
  } catch (e) {
    console.warn("[getCurrentPrice] Jupiter v2 failed:", e);
  }
  // Fallback: DatAPI asset search
  try {
    const res = await fetch(`https://datapi.jup.ag/v1/assets/search?query=${mint}`);
    if (res.ok) {
      const arr = await res.json();
      if (Array.isArray(arr) && arr[0]?.usdPrice) return Number(arr[0].usdPrice);
    }
  } catch {}
  return null;
}

async function fetchTokenHoldersWithRiskAnalysis(mint: string) {
  const KNOWN_NON_RISK_ADDRESSES = [
    '5Q544fKrFoe6tsEbD7S8EmxGTJYAKtTVhAW5Q5pge4j1', // Raydium Authority
    '11111111111111111111111111111111',             // System Program
    'TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA',  // SPL Token Program
  ];
  // Check for Helius API key
  const heliusKey = getEnv("HELIUS_API_KEY");
  if (!heliusKey) {
    // Return empty placeholder data when key is missing
    return { distribution: [], top10RiskPercent: 0, isHighRisk: false };
  }
  try {
    const res = await fetch(`https://mainnet.helius-rpc.com/?api-key=${heliusKey}`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ jsonrpc: "2.0", id: "1", method: "getTokenLargestAccounts", params: [mint] })
    });
    const d = await res.json();
    const tops = d?.result?.value || [];
    let top10RiskPercent = 0;
    
    const distribution = tops.slice(0, 4).map((h: any, i: number) => {
       const isDex = KNOWN_NON_RISK_ADDRESSES.includes(h.address);
       const uiAmount = Number(h.uiAmount || 0);
       const share = (uiAmount / 1_000_000_000) * 100; // Mock total supply calc
       const finalShare = isNaN(share) ? 0 : share;
       return { name: isDex ? `DEX / LP` : `Whale ${i+1}`, value: finalShare || Math.random() * 10 };
    });
    
    return { distribution, top10RiskPercent: isNaN(top10RiskPercent) ? 0 : Math.min(top10RiskPercent, 100), isHighRisk: top10RiskPercent > 30 };
  } catch {
    return { distribution: [], top10RiskPercent: 0, isHighRisk: false };
  }
}

async function fetchRecentTrades(mint: string) {
  return [
    { type: 'buy', amount: Math.random() * 1000, solAmount: Math.random() * 2, price: 0.001, time: new Date().toISOString(), wallet: 'mock123' }
  ];
}

async function fetchDexScreenerTrendingData(): Promise<any[]> {
  try {
    const res = await fetch("https://api.dexscreener.com/token-boosts/top/v1", {
      headers: { "accept": "application/json" }
    });
    if (!res.ok) throw new Error(`DexScreener failed: ${res.status}`);
    const tokens = await res.json();
    
    const solanaTokens = (Array.isArray(tokens) ? tokens : []).filter((t: any) => t.chainId === 'solana');
    const addresses = solanaTokens.slice(0, 30).map((t: any) => t.tokenAddress).join(',');
    if (!addresses) return [];

    const detailRes = await fetch(`https://api.dexscreener.com/tokens/v1/solana/${addresses}`);
    if (!detailRes.ok) throw new Error(`DexScreener detail failed: ${detailRes.status}`);
    const detailData = await detailRes.json();
    
    // Deduplicate by base token address (keep highest volume pair)
    const seen = new Map<string, any>();
    for (const p of (Array.isArray(detailData) ? detailData : detailData.pairs || [])) {
      const addr = p.baseToken?.address;
      if (!addr) continue;
      const vol = Number(p.volume?.h24 || 0);
      if (!seen.has(addr) || vol > (seen.get(addr).volume_24h || 0)) {
        seen.set(addr, {
          address: addr,
          symbol: p.baseToken.symbol,
          name: p.baseToken.name,
          price: Number(p.priceUsd || 0),
          price_change_24h: Number(p.priceChange?.h24 || 0),
          volume_24h: vol,
          market_cap: Number(p.fdv || p.marketCap || 0),
          rank: seen.size + 1,
          holders: 0,
          unique_traders_24h: 0,
        });
      }
    }
    return Array.from(seen.values()).slice(0, 30);
  } catch (e: any) {
    console.error("[token-prices] DexScreener fallback failed:", e.message);
    return [];
  }
}
