import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const SOL_MINT = "So11111111111111111111111111111111111111112";

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { wallet_address } = await req.json();
    if (!wallet_address) {
      return new Response(JSON.stringify({ error: "wallet_address required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const heliusKey = Deno.env.get("HELIUS_API_KEY");
    if (!heliusKey) {
      return new Response(JSON.stringify({ error: "HELIUS_API_KEY not configured" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const rpcUrl = `https://mainnet.helius-rpc.com/?api-key=${heliusKey}`;
    const heliusApi = `https://api.helius.xyz/v0`;

    // 1. Get SOL balance and fungible tokens via Helius REST API in parallel
    const [solBalanceRes, fungibleRes] = await Promise.all([
      fetch(rpcUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "getBalance", params: [wallet_address] }),
      }),
      // Helius enhanced balances API - returns fungible tokens with metadata
      fetch(`${heliusApi}/addresses/${wallet_address}/balances?api-key=${heliusKey}`),
    ]);

    const solBalanceData = await solBalanceRes.json();
    const solBalance = (solBalanceData.result?.value || 0) / 1e9;

    let tokens: any[] = [];
    let nativeBalance = 0;

    if (fungibleRes.ok) {
      const balancesData = await fungibleRes.json();
      nativeBalance = (balancesData.nativeBalance || 0) / 1e9;
      tokens = balancesData.tokens || [];
    }

    // Filter tokens with balance > 0
    const holdings = tokens
      .filter((t: any) => (t.amount || 0) > 0)
      .map((t: any) => ({
        mint: t.mint,
        amount: t.amount / Math.pow(10, t.decimals || 0),
        decimals: t.decimals || 0,
        rawAmount: t.amount,
      }));

    // 2. Get prices for all tokens + SOL
    let enrichedHoldings: any[] = [];
    let solPrice = 0;

    if (holdings.length > 0) {
      const mintAddresses = holdings.map((h: any) => h.mint);

      // Fetch metadata from DAS API and prices in parallel
      const metadataPromise = (async () => {
        const assetMap = new Map();
        const batchSize = 100;
        for (let i = 0; i < mintAddresses.length; i += batchSize) {
          const batch = mintAddresses.slice(i, i + batchSize);
          try {
            const dasRes = await fetch(rpcUrl, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ jsonrpc: "2.0", id: 4, method: "getAssetBatch", params: { ids: batch } }),
            });
            const dasData = await dasRes.json();
            for (const asset of (dasData.result || [])) {
              if (asset?.id) assetMap.set(asset.id, asset);
            }
          } catch (e) { /* skip */ }
        }
        return assetMap;
      })();

      // Use Jupiter price API with proper user-agent
      const pricePromise = (async () => {
        const priceMap: Record<string, number> = {};
        const allMints = [SOL_MINT, ...mintAddresses];

        // Try Jupiter first
        for (let i = 0; i < allMints.length; i += 100) {
          const batch = allMints.slice(i, i + 100);
          try {
            const res = await fetch(`https://api.jup.ag/price/v2?ids=${batch.join(",")}`, {
              headers: {
                "Accept": "application/json",
                "User-Agent": "SAVAG3BOT/1.0",
              },
            });
            if (res.ok) {
              const data = await res.json();
              if (data?.data) {
                for (const [mint, info] of Object.entries(data.data)) {
                  const p = (info as any)?.price;
                  if (p) priceMap[mint] = parseFloat(String(p));
                }
              }
            }
          } catch { /* skip */ }
        }

        // Birdeye fallback for missing prices
        const birdeyeKey = Deno.env.get("BIRDEYE_API_KEY");
        const missingMints = allMints.filter(m => !priceMap[m]);
        if (missingMints.length > 0 && birdeyeKey) {
          try {
            const res = await fetch(
              `https://public-api.birdeye.so/defi/multi_price?list_address=${missingMints.slice(0, 50).join(",")}`,
              { headers: { "X-API-KEY": birdeyeKey, "x-chain": "solana" } }
            );
            if (res.ok) {
              const data = await res.json();
              if (data?.data) {
                for (const [addr, info] of Object.entries(data.data)) {
                  const p = (info as any)?.value;
                  if (p) priceMap[addr] = p;
                }
              }
            }
          } catch { /* skip */ }
        }

        // CoinGecko fallback for SOL price
        if (!priceMap[SOL_MINT]) {
          try {
            const res = await fetch("https://api.coingecko.com/api/v3/simple/price?ids=solana&vs_currencies=usd");
            if (res.ok) {
              const data = await res.json();
              if (data?.solana?.usd) priceMap[SOL_MINT] = data.solana.usd;
            }
          } catch { /* skip */ }
        }

        return priceMap;
      })();

      const [assetMap, priceMap] = await Promise.all([metadataPromise, pricePromise]);

      solPrice = priceMap[SOL_MINT] || 0;

      enrichedHoldings = holdings.map((h: any) => {
        const asset = assetMap.get(h.mint);
        const price = priceMap[h.mint] || 0;
        return {
          mint: h.mint,
          symbol: asset?.content?.metadata?.symbol || h.mint.slice(0, 6),
          name: asset?.content?.metadata?.name || "Unknown",
          logoUrl: asset?.content?.links?.image || asset?.content?.files?.[0]?.uri || "",
          amount: h.amount,
          decimals: h.decimals,
          price,
          value: h.amount * price,
        };
      });

      enrichedHoldings.sort((a: any, b: any) => b.value - a.value);
    } else {
      // No tokens, just get SOL price
      try {
        const res = await fetch("https://api.coingecko.com/api/v3/simple/price?ids=solana&vs_currencies=usd");
        if (res.ok) {
          const data = await res.json();
          if (data?.solana?.usd) solPrice = data.solana.usd;
        }
      } catch { /* skip */ }
    }

    const effectiveSolBalance = nativeBalance || solBalance;
    const totalTokenValueUsd = enrichedHoldings.reduce((s: number, h: any) => s + h.value, 0);
    const solValueUsd = effectiveSolBalance * solPrice;

    return new Response(
      JSON.stringify({
        success: true,
        data: {
          solBalance: effectiveSolBalance,
          solPrice,
          solValueUsd,
          tokens: enrichedHoldings,
          totalTokenValueUsd,
          totalPortfolioUsd: solValueUsd + totalTokenValueUsd,
          tokenCount: enrichedHoldings.length,
        },
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("Portfolio fetch error:", err);
    return new Response(
      JSON.stringify({ error: err.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
