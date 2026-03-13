import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const SPL_TOKEN_PROGRAM = "TokenkegQfeN2tWRY9knR7VYHg4sGszs3kc157Y";
const TOKEN_2022_PROGRAM = "TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb";
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

    // 2. Get all token accounts from BOTH programs in parallel
    const [splRes, t22Res] = await Promise.all([
      fetch(rpcUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          jsonrpc: "2.0",
          id: 2,
          method: "getTokenAccountsByOwner",
          params: [
            wallet_address,
            { programId: SPL_TOKEN_PROGRAM },
            { encoding: "jsonParsed" },
          ],
        }),
      }),
      fetch(rpcUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          jsonrpc: "2.0",
          id: 3,
          method: "getTokenAccountsByOwner",
          params: [
            wallet_address,
            { programId: TOKEN_2022_PROGRAM },
            { encoding: "jsonParsed" },
          ],
        }),
      }),
    ]);

    const splData = await splRes.json();
    const t22Data = await t22Res.json();

    const allTokenAccounts = [
      ...(splData.result?.value || []),
      ...(t22Data.result?.value || []),
    ];

    console.log(`Found ${splData.result?.value?.length || 0} SPL + ${t22Data.result?.value?.length || 0} Token-2022 accounts`);

    // Filter tokens with balance > 0
    const holdings = allTokenAccounts
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

    console.log(`${holdings.length} tokens with balance > 0`);

    // 3. Fetch token metadata from Helius DAS API for all mints
    let enrichedHoldings: any[] = [];
    if (holdings.length > 0) {
      const mintAddresses = holdings.map((h: any) => h.mint);

      // Use Helius DAS getAssetBatch for metadata (max 1000)
      const batchSize = 100;
      const assetMap = new Map();

      for (let i = 0; i < mintAddresses.length; i += batchSize) {
        const batch = mintAddresses.slice(i, i + batchSize);
        try {
          const dasRes = await fetch(rpcUrl, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              jsonrpc: "2.0",
              id: 4,
              method: "getAssetBatch",
              params: { ids: batch },
            }),
          });
          const dasData = await dasRes.json();
          const assets = dasData.result || [];
          for (const asset of assets) {
            if (asset?.id) {
              assetMap.set(asset.id, asset);
            }
          }
        } catch (e) {
          console.error("DAS batch error:", e);
        }
      }

      // 4. Get prices from Jupiter Price API (batch in groups of 100)
      const priceMap: Record<string, number> = {};
      for (let i = 0; i < mintAddresses.length; i += 100) {
        const batch = mintAddresses.slice(i, i + 100);
        const priceIds = batch.join(",");
        try {
          const priceRes = await fetch(`https://api.jup.ag/price/v2?ids=${priceIds}`, {
            headers: { "Accept": "application/json" },
          });
          if (priceRes.ok) {
            const priceData = await priceRes.json();
            if (priceData.data) {
              for (const [mint, info] of Object.entries(priceData.data)) {
                const p = (info as any)?.price;
                if (p) priceMap[mint] = parseFloat(p);
              }
            }
          } else {
            console.error("Jupiter price API error:", priceRes.status, await priceRes.text());
          }
        } catch (e) {
          console.error("Price fetch error:", e);
        }
      }

      console.log(`Got prices for ${Object.keys(priceMap).length} tokens`);

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
        `https://api.jup.ag/price/v2?ids=${SOL_MINT}`,
        { headers: { "Accept": "application/json" } }
      );
      if (solPriceRes.ok) {
        const solPriceData = await solPriceRes.json();
        solPrice = parseFloat(solPriceData.data?.[SOL_MINT]?.price || "0");
      } else {
        console.error("SOL price error:", solPriceRes.status);
      }
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
