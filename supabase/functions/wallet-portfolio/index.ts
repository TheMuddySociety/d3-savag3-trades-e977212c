import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

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

    // 1. Get SOL balance
    const solBalanceRes = await fetch(rpcUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: 1,
        method: "getBalance",
        params: [wallet_address],
      }),
    });
    const solBalanceData = await solBalanceRes.json();
    const solBalance = (solBalanceData.result?.value || 0) / 1e9;

    // 2. Get all token accounts
    const tokenAccountsRes = await fetch(rpcUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: 2,
        method: "getTokenAccountsByOwner",
        params: [
          wallet_address,
          { programId: "TokenkegQfeN2tWRY9knR7VYHg4sGszs3kc157Y" },
          { encoding: "jsonParsed" },
        ],
      }),
    });
    const tokenAccountsData = await tokenAccountsRes.json();
    const tokenAccounts = tokenAccountsData.result?.value || [];

    // Filter tokens with balance > 0
    const holdings = tokenAccounts
      .map((account: any) => {
        const info = account.account.data.parsed.info;
        return {
          mint: info.mint,
          amount: info.tokenAmount.uiAmount || 0,
          decimals: info.tokenAmount.decimals,
          rawAmount: info.tokenAmount.amount,
        };
      })
      .filter((t: any) => t.amount > 0);

    // 3. Fetch token metadata from Helius DAS API for all mints
    let enrichedHoldings = [];
    if (holdings.length > 0) {
      const mintAddresses = holdings.map((h: any) => h.mint);
      
      // Use Helius DAS getAssetBatch for metadata
      const dasRes = await fetch(`https://mainnet.helius-rpc.com/?api-key=${heliusKey}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          jsonrpc: "2.0",
          id: 3,
          method: "getAssetBatch",
          params: { ids: mintAddresses.slice(0, 50) }, // Limit to 50
        }),
      });
      const dasData = await dasRes.json();
      const assets = dasData.result || [];

      // Build lookup
      const assetMap = new Map();
      for (const asset of assets) {
        if (asset?.id) {
          assetMap.set(asset.id, asset);
        }
      }

      // 4. Get prices from Jupiter Price API
      const priceIds = mintAddresses.slice(0, 50).join(",");
      let priceMap: Record<string, number> = {};
      try {
        const priceRes = await fetch(`https://api.jup.ag/price/v2?ids=${priceIds}`);
        const priceData = await priceRes.json();
        if (priceData.data) {
          for (const [mint, info] of Object.entries(priceData.data)) {
            priceMap[mint] = (info as any)?.price ? parseFloat((info as any).price) : 0;
          }
        }
      } catch (e) {
        console.error("Price fetch error:", e);
      }

      enrichedHoldings = holdings.map((h: any) => {
        const asset = assetMap.get(h.mint);
        const price = priceMap[h.mint] || 0;
        const value = h.amount * price;

        return {
          mint: h.mint,
          symbol: asset?.content?.metadata?.symbol || h.mint.slice(0, 6),
          name: asset?.content?.metadata?.name || "Unknown",
          logoUrl: asset?.content?.links?.image || asset?.content?.files?.[0]?.uri || "",
          amount: h.amount,
          decimals: h.decimals,
          price,
          value,
        };
      });

      // Sort by value descending
      enrichedHoldings.sort((a: any, b: any) => b.value - a.value);
    }

    // 5. Get SOL price
    let solPrice = 0;
    try {
      const solPriceRes = await fetch(
        "https://api.jup.ag/price/v2?ids=So11111111111111111111111111111111111111112"
      );
      const solPriceData = await solPriceRes.json();
      solPrice = parseFloat(solPriceData.data?.["So11111111111111111111111111111111111111112"]?.price || "0");
    } catch (e) {
      console.error("SOL price fetch error:", e);
    }

    const totalTokenValueUsd = enrichedHoldings.reduce((s: number, h: any) => s + h.value, 0);
    const solValueUsd = solBalance * solPrice;

    return new Response(
      JSON.stringify({
        success: true,
        data: {
          solBalance,
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
