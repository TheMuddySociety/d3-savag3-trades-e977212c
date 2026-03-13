import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const SPL_TOKEN_PROGRAM = "TokenkegQfeN2tWRY9knR7VYHg4sGszs3kc157Y";
const TOKEN_2022_PROGRAM = "TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb";
const SOL_MINT = "So11111111111111111111111111111111111111112";

async function fetchPrices(mintAddresses: string[]): Promise<Record<string, number>> {
  const priceMap: Record<string, number> = {};

  // Try Jupiter Price API v2
  for (let i = 0; i < mintAddresses.length; i += 100) {
    const batch = mintAddresses.slice(i, i + 100);
    const ids = batch.join(",");
    try {
      const res = await fetch(`https://api.jup.ag/price/v2?ids=${ids}`);
      if (res.ok) {
        const data = await res.json();
        if (data?.data) {
          for (const [mint, info] of Object.entries(data.data)) {
            const p = (info as any)?.price;
            if (p) priceMap[mint] = parseFloat(String(p));
          }
        }
      }
    } catch (e) {
      console.error("Jupiter v2 error:", e);
    }
  }

  // Fallback: use Birdeye for any tokens that still have no price
  const birdeyeKey = Deno.env.get("BIRDEYE_API_KEY");
  const missing = mintAddresses.filter(m => !priceMap[m]);
  if (missing.length > 0 && birdeyeKey) {
    try {
      const list = missing.slice(0, 50).join(",");
      const res = await fetch(
        `https://public-api.birdeye.so/defi/multi_price?list_address=${list}`,
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
    } catch (e) {
      console.error("Birdeye fallback error:", e);
    }
  }

  return priceMap;
}

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

    // 1. Get SOL balance + token accounts from both programs in parallel
    const [solBalanceRes, splRes, t22Res] = await Promise.all([
      fetch(rpcUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "getBalance", params: [wallet_address] }),
      }),
      fetch(rpcUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          jsonrpc: "2.0", id: 2, method: "getTokenAccountsByOwner",
          params: [wallet_address, { programId: SPL_TOKEN_PROGRAM }, { encoding: "jsonParsed" }],
        }),
      }),
      fetch(rpcUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          jsonrpc: "2.0", id: 3, method: "getTokenAccountsByOwner",
          params: [wallet_address, { programId: TOKEN_2022_PROGRAM }, { encoding: "jsonParsed" }],
        }),
      }),
    ]);

    const [solBalanceData, splData, t22Data] = await Promise.all([
      solBalanceRes.json(), splRes.json(), t22Res.json(),
    ]);

    const solBalance = (solBalanceData.result?.value || 0) / 1e9;

    const allTokenAccounts = [
      ...(splData.result?.value || []),
      ...(t22Data.result?.value || []),
    ];

    // Filter tokens with balance > 0
    const holdings = allTokenAccounts
      .map((account: any) => {
        const info = account.account.data.parsed.info;
        return {
          mint: info.mint,
          amount: info.tokenAmount.uiAmount || 0,
          decimals: info.tokenAmount.decimals,
        };
      })
      .filter((t: any) => t.amount > 0);

    let enrichedHoldings: any[] = [];
    if (holdings.length > 0) {
      const mintAddresses = holdings.map((h: any) => h.mint);

      // Fetch metadata and prices in parallel
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
          } catch (e) {
            console.error("DAS batch error:", e);
          }
        }
        return assetMap;
      })();

      // Include SOL mint in price request
      const allPriceMints = [SOL_MINT, ...mintAddresses];
      const [assetMap, priceMap] = await Promise.all([
        metadataPromise,
        fetchPrices(allPriceMints),
      ]);

      const solPrice = priceMap[SOL_MINT] || 0;

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

      const totalTokenValueUsd = enrichedHoldings.reduce((s: number, h: any) => s + h.value, 0);
      const solValueUsd = solBalance * solPrice;

      return new Response(
        JSON.stringify({
          success: true,
          data: {
            solBalance, solPrice, solValueUsd,
            tokens: enrichedHoldings,
            totalTokenValueUsd,
            totalPortfolioUsd: solValueUsd + totalTokenValueUsd,
            tokenCount: enrichedHoldings.length,
          },
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // No token holdings - still get SOL price
    const priceMap = await fetchPrices([SOL_MINT]);
    const solPrice = priceMap[SOL_MINT] || 0;
    const solValueUsd = solBalance * solPrice;

    return new Response(
      JSON.stringify({
        success: true,
        data: {
          solBalance, solPrice, solValueUsd,
          tokens: [],
          totalTokenValueUsd: 0,
          totalPortfolioUsd: solValueUsd,
          tokenCount: 0,
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
