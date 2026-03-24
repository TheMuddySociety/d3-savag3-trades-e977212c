import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const SOL_MINT = "So11111111111111111111111111111111111111112";
const TOKEN_PROGRAM = "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA";
const TOKEN_2022_PROGRAM = "TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb";

// In-memory cache for edge function isolate (reduces RPC latency)
const portfolioCache = new Map<string, { data: string; expiry: number }>();
const CACHE_TTL = 30_000; // 30 seconds

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('Authorization');
    const body = await req.json().catch(() => ({}));
    let { wallet_address, network = 'mainnet-beta' } = body;

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!;

    if (authHeader) {
      const userClient = createClient(supabaseUrl, anonKey, {
        global: { headers: { Authorization: authHeader } }
      });
      const { data: { user } } = await userClient.auth.getUser();
      
      if (user && !wallet_address) {
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

    if (!wallet_address) {
      return new Response(JSON.stringify({ error: "wallet_address required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ── Check Isolate Cache ─────────────────────────────────────
    const cacheKey = `${wallet_address}-${network}`;
    const cached = portfolioCache.get(cacheKey);
    if (cached && Date.now() < cached.expiry) {
      console.log(`[Cache HIT] Portfolio for ${wallet_address.substring(0, 6)}... (${network})`);
      return new Response(cached.data, {
        headers: { ...corsHeaders, "Content-Type": "application/json", "X-Cache": "HIT" },
      });
    }
    console.log(`[Cache MISS] Fetching fresh portfolio for ${wallet_address.substring(0, 6)}... (${network})`);

    const heliusKey = Deno.env.get("HELIUS_API_KEY");
    const isInvalidHelius = !heliusKey || heliusKey.includes("REPLACE") || heliusKey.length < 10;
    
    // Helius Cluster Mapping
    const cluster = network === 'devnet' ? 'devnet' : 'mainnet';
    const heliusUrl = !isInvalidHelius 
      ? `https://mainnet.helius-rpc.com/?api-key=${heliusKey}` 
      : `https://api.${cluster}-beta.solana.com`;

    if (network === 'devnet' && !isInvalidHelius) {
        // Helius devnet requires different URL usually, but for standard RPC we can fallback
    }

    // 1. Fetch SOL Balance + Token Assets (Universal DAS API)
    const fetchWithFallback = async (method: string, params: any, id: string | number) => {
      let res = await fetch(heliusUrl, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ jsonrpc: "2.0", id, method, params }),
      });

      // Fallback if Helius key is invalid/unauthorized
      if ((res.status === 401 || res.status === 403) && !isInvalidHelius) {
        console.error(`Helius ${res.status} Unauthorized. Falling back to public RPC.`);
        const fallbackUrl = `https://api.${cluster}-beta.solana.com`;
        res = await fetch(fallbackUrl, {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ jsonrpc: "2.0", id, method, params }),
        });
      }
      
      const data = await res.json();
      if (data.error) throw new Error(`RPC Error (${method}): ${data.error.message}`);
      return data.result;
    };

    const fetchSolBalance = async () => {
      const result = await fetchWithFallback("getBalance", [wallet_address], 1);
      return (result?.value || 0) / 1e9;
    };

    const fetchAssets = async () => {
      if (isInvalidHelius) {
        console.warn("No Helius API key — using standard RPC fallback (expect rate limits)");
        const [tokenRes, token2022Res] = await Promise.all([
          fetch(heliusUrl, {
            method: "POST", headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ jsonrpc: "2.0", id: 2, method: "getTokenAccountsByOwner", params: [wallet_address, { programId: TOKEN_PROGRAM }, { encoding: "jsonParsed" }] }),
          }),
          fetch(heliusUrl, {
            method: "POST", headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ jsonrpc: "2.0", id: 3, method: "getTokenAccountsByOwner", params: [wallet_address, { programId: TOKEN_2022_PROGRAM }, { encoding: "jsonParsed" }] }),
          })
        ]);
        
        const [tokenData, token2022Data] = await Promise.all([tokenRes.json(), token2022Res.json()]);
        if (tokenData.error) throw new Error(`RPC Error (Tokens): ${tokenData.error.message}`);
        
        const parse = (data: any) => (data?.result?.value || []).map((acc: any) => {
          const info = acc.account?.data?.parsed?.info;
          if (!info) return null;
          const amount = parseFloat(info.tokenAmount?.uiAmountString || "0");
          if (amount <= 0) return null;
          return { mint: info.mint, amount, decimals: info.tokenAmount?.decimals || 0 };
        }).filter(Boolean);

        return [...parse(tokenData), ...parse(token2022Data)];
      }

      // Use Helius DAS API (Fast & Robust)
      const res = await fetch(heliusUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          jsonrpc: "2.0", id: "assets", method: "getAssetsByOwner",
          params: { ownerAddress: wallet_address, page: 1, limit: 100, displayOptions: { showFungible: true } },
        }),
      });

      // Special fallback for DAS if key is invalid
      if ((res.status === 401 || res.status === 403)) {
         console.error("DAS API Unauthorized. Falling back to standard RPC.");
         // Re-trigger the same logic as isInvalidHelius
         const [tokenRes, token2022Res] = await Promise.all([
          fetch(`https://api.${cluster}-beta.solana.com`, {
            method: "POST", headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ jsonrpc: "2.0", id: 2, method: "getTokenAccountsByOwner", params: [wallet_address, { programId: TOKEN_PROGRAM }, { encoding: "jsonParsed" }] }),
          }),
          fetch(`https://api.${cluster}-beta.solana.com`, {
            method: "POST", headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ jsonrpc: "2.0", id: 3, method: "getTokenAccountsByOwner", params: [wallet_address, { programId: TOKEN_2022_PROGRAM }, { encoding: "jsonParsed" }] }),
          })
        ]);
        const [tokenData, token2022Data] = await Promise.all([tokenRes.json(), token2022Res.json()]);
        const parse = (data: any) => (data?.result?.value || []).map((acc: any) => {
          const info = acc.account?.data?.parsed?.info;
          if (!info) return null;
          const amount = parseFloat(info.tokenAmount?.uiAmountString || "0");
          if (amount <= 0) return null;
          return { mint: info.mint, amount, decimals: info.tokenAmount?.decimals || 0 };
        }).filter(Boolean);
        return [...parse(tokenData), ...parse(token2022Data)];
      }

      const data = await res.json();
      if (data.error) throw new Error(`Helius DAS Error: ${data.error.message}`);
      
      return (data.result?.items || [])
        .filter((item: any) => item.interface === 'FungibleToken' || item.interface === 'FungibleAsset')
        .map((item: any) => ({
          mint: item.id,
          symbol: item.content?.metadata?.symbol || item.id.slice(0, 6),
          name: item.content?.metadata?.name || "Unknown Token",
          logoUrl: item.content?.links?.image || "",
          amount: (item.token_info?.balance || 0) / Math.pow(10, item.token_info?.decimals || 0),
          decimals: item.token_info?.decimals || 0,
          price: item.token_info?.price_info?.price_per_token || 0,
        }))
        .filter((h: any) => h.amount > 0);
    };

    const [solBalance, assets] = await Promise.all([fetchSolBalance(), fetchAssets()]);

    // 2. Fetch/Enrich Metadata and Prices for missing items
    let solPrice = 0;
    const enrichedHoldings = assets;

    // Jupiter Price API for all mainnet tokens
    if (network === 'mainnet-beta' && assets.length > 0) {
      const mintsToPrice = assets.filter((a: any) => !a.price).map((a: any) => a.mint);
      if (mintsToPrice.length > 0 || !solPrice) {
        const allMints = [SOL_MINT, ...mintsToPrice];
        try {
          const pRes = await fetch(`https://api.jup.ag/price/v2?ids=${allMints.slice(0, 100).join(",")}`);
          if (pRes.ok) {
            const pData = await pRes.json();
            if (pData?.data) {
              solPrice = pData.data[SOL_MINT]?.price ? parseFloat(pData.data[SOL_MINT].price) : 0;
              for (const asset of enrichedHoldings) {
                if (!asset.price && pData.data[asset.mint]) {
                  asset.price = parseFloat(pData.data[asset.mint].price);
                }
              }
            }
          }
        } catch (e: any) { console.warn("Jupiter price fetch failed:", e.message); }
      }
    }

    // CoinGecko fallback for SOL price
    if (solPrice === 0) {
      try {
        const cgRes = await fetch("https://api.coingecko.com/api/v3/simple/price?ids=solana&vs_currencies=usd");
        if (cgRes.ok) {
          const cgData = await cgRes.json();
          solPrice = cgData?.solana?.usd || 0;
        }
      } catch { /* ignore */ }
    }

    // Finalize values
    for (const h of enrichedHoldings) {
      h.value = h.amount * (h.price || 0);
    }
    enrichedHoldings.sort((a: any, b: any) => (b.value || 0) - (a.value || 0));

    const totalTokenValueUsd = enrichedHoldings.reduce((s: number, h: any) => s + (h.value || 0), 0);
    const solValueUsd = solBalance * solPrice;

    const responseData = JSON.stringify({
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
    });

    // Save to Cache
    portfolioCache.set(cacheKey, { data: responseData, expiry: Date.now() + CACHE_TTL });

    return new Response(responseData, {
      headers: { ...corsHeaders, "Content-Type": "application/json", "X-Cache": "MISS" },
    });

  } catch (err: any) {
    console.error("Portfolio fetch critical error:", err);
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: err instanceof Error ? err.message : 'Unknown error',
        diagnostics: "Ensure HELIUS_API_KEY is set in Supabase secrets for reliable portfolio fetching."
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
