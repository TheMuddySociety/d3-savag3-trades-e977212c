import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const SOL_MINT = "So11111111111111111111111111111111111111112";
const TOKEN_PROGRAM = "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA";
const TOKEN_2022_PROGRAM = "TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb";

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('Authorization');
    const body = await req.json().catch(() => ({}));
    let { wallet_address } = body;

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!;

    // If authenticated, we can resolve the trusted wallet address
    if (authHeader) {
      const userClient = createClient(supabaseUrl, anonKey, {
        global: { headers: { Authorization: authHeader } }
      });
      const { data: { user } } = await userClient.auth.getUser();
      
      if (user) {
        // If no wallet_address provided, use the user's primary wallet
        if (!wallet_address) {
          const supabase = createClient(supabaseUrl, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
          const { data: profile } = await supabase
            .from('profiles')
            .select('wallet_address')
            .eq('id', user.id)
            .single();
          
          if (profile) {
            wallet_address = profile.wallet_address;
          }
        }
      }
    }

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

    // 1. Fetch SOL balance + all token accounts (both Token and Token-2022 programs) in parallel
    const [solBalanceRes, tokenAccountsRes, token2022AccountsRes] = await Promise.all([
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
          params: [wallet_address, { programId: TOKEN_PROGRAM }, { encoding: "jsonParsed" }],
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

    const solBalanceData = await solBalanceRes.json();
    const solBalance = (solBalanceData.result?.value || 0) / 1e9;

    // Parse token accounts from both programs
    const parseTokenAccounts = (data: any) => {
      const accounts = data.result?.value || [];
      return accounts
        .map((acc: any) => {
          const info = acc.account?.data?.parsed?.info;
          if (!info) return null;
          const amount = parseFloat(info.tokenAmount?.uiAmountString || "0");
          if (amount <= 0) return null;
          return {
            mint: info.mint,
            amount,
            decimals: info.tokenAmount?.decimals || 0,
          };
        })
        .filter(Boolean);
    };

    const tokenAccountsData = await tokenAccountsRes.json();
    const token2022Data = await token2022AccountsRes.json();

    const holdings = [
      ...parseTokenAccounts(tokenAccountsData),
      ...parseTokenAccounts(token2022Data),
    ];

    // Deduplicate by mint (in case of multiple accounts for same token)
    const holdingMap = new Map<string, any>();
    for (const h of holdings) {
      const existing = holdingMap.get(h.mint);
      if (existing) {
        existing.amount += h.amount;
      } else {
        holdingMap.set(h.mint, { ...h });
      }
    }
    const uniqueHoldings = Array.from(holdingMap.values());

    // 2. Get metadata + prices
    let enrichedHoldings: any[] = [];
    let solPrice = 0;

    if (uniqueHoldings.length > 0) {
      const mintAddresses = uniqueHoldings.map((h: any) => h.mint);

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

      const pricePromise = (async () => {
        const priceMap: Record<string, number> = {};
        const allMints = [SOL_MINT, ...mintAddresses];

        // Jupiter price API
        for (let i = 0; i < allMints.length; i += 100) {
          const batch = allMints.slice(i, i + 100);
          try {
            const res = await fetch(`https://api.jup.ag/price/v2?ids=${batch.join(",")}`, {
              headers: { "Accept": "application/json", "User-Agent": "SAVAG3BOT/1.0" },
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

      enrichedHoldings = uniqueHoldings.map((h: any) => {
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
      JSON.stringify({ error: err instanceof Error ? err.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
