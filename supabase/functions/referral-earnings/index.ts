import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const REFERRAL_WALLET = "89MakU1zuaQKBrtFXXMgGxf8nKZ9Pbq52KtUwgNhCiBS";

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const heliusKey = Deno.env.get("HELIUS_API_KEY");
    const rpcUrl = heliusKey
      ? `https://mainnet.helius-rpc.com/?api-key=${heliusKey}`
      : "https://api.mainnet-beta.solana.com";

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "No authorization header" }), {
        status: 401,
        headers: corsHeaders,
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const supabaseClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: { user }, error: userError } = await supabaseClient.auth.getUser();
    if (userError || !user) {
      return new Response(JSON.stringify({ error: "Invalid token" }), {
        status: 401,
        headers: corsHeaders,
      });
    }

    // Get the user's wallet address from their profile
    const adminClient = createClient(supabaseUrl, supabaseServiceKey);
    const { data: profile, error: profileError } = await adminClient
      .from("profiles")
      .select("wallet_address")
      .eq("id", user.id)
      .single();

    if (profileError || !profile?.wallet_address) {
      return new Response(JSON.stringify({ error: "User profile or wallet not found" }), {
        status: 404,
        headers: corsHeaders,
      });
    }

    const userWallet = profile.wallet_address;

    // Fetch token accounts for the referral wallet (this is shared/public info about the platform's referral vault)
    const tokenAccountsRes = await fetch(rpcUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: 1,
        method: "getTokenAccountsByOwner",
        params: [
          REFERRAL_WALLET,
          { programId: "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA" },
          { encoding: "jsonParsed" },
        ],
      }),
    });

    const tokenAccountsData = await tokenAccountsRes.json();
    const accounts = tokenAccountsData?.result?.value || [];

    // Fetch SOL balance
    const solBalanceRes = await fetch(rpcUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: 2,
        method: "getBalance",
        params: [REFERRAL_WALLET],
      }),
    });

    const solBalanceData = await solBalanceRes.json();
    const solBalance = (solBalanceData?.result?.value || 0) / 1e9;

    // Parse token balances
    const tokenBalances = accounts
      .map((acc: any) => {
        const info = acc.account.data.parsed.info;
        return {
          mint: info.mint,
          amount: parseFloat(info.tokenAmount.uiAmountString || "0"),
          decimals: info.tokenAmount.decimals,
        };
      })
      .filter((t: any) => t.amount > 0);

    // Try to get token metadata from Jupiter token list
    let tokenMeta: Record<string, { symbol: string; name: string; logoURI?: string }> = {};

    // Add well-known tokens manually
    tokenMeta["So11111111111111111111111111111111111111112"] = {
      symbol: "SOL",
      name: "Wrapped SOL",
      logoURI: "https://raw.githubusercontent.com/solana-labs/token-list/main/assets/mainnet/So11111111111111111111111111111111111111112/logo.png",
    };
    tokenMeta["EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v"] = {
      symbol: "USDC",
      name: "USD Coin",
      logoURI: "https://raw.githubusercontent.com/solana-labs/token-list/main/assets/mainnet/EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v/logo.png",
    };

    try {
      const unknownMints = tokenBalances
        .map((t: any) => t.mint)
        .filter((m: string) => !tokenMeta[m]);
      if (unknownMints.length > 0) {
        const metaRes = await fetch(
          `https://tokens.jup.ag/tokens?ids=${unknownMints.join(",")}`
        );
        if (metaRes.ok) {
          const metaList = await metaRes.json();
          for (const token of metaList) {
            tokenMeta[token.address] = {
              symbol: token.symbol,
              name: token.name,
              logoURI: token.logoURI,
            };
          }
        }
      }
    } catch {
      // Token metadata is optional
    }

    const enrichedBalances = tokenBalances.map((t: any) => ({
      ...t,
      symbol: tokenMeta[t.mint]?.symbol || "Unknown",
      name: tokenMeta[t.mint]?.name || t.mint.slice(0, 8) + "...",
      logoURI: tokenMeta[t.mint]?.logoURI || null,
    }));

    // Fetch user-specific trade stats using service role (filtered by user wallet)
    let tradeStats = { totalTrades: 0, totalInputUsd: 0, totalOutputUsd: 0, estimatedFeesReferral: 0 };
    try {
      const { data: trades, count } = await adminClient
        .from("live_trades")
        .select("input_usd_value, output_usd_value", { count: "exact" })
        .eq("wallet_address", userWallet);

      if (trades) {
        const totalInputUsd = trades.reduce((s: number, t: any) => s + (t.input_usd_value || 0), 0);
        const totalOutputUsd = trades.reduce((s: number, t: any) => s + (t.output_usd_value || 0), 0);
        tradeStats = {
          totalTrades: count || trades.length,
          totalInputUsd,
          totalOutputUsd,
          estimatedFeesReferral: totalOutputUsd * 0.001, // 0.1% referral share
        };
      }
    } catch (e) {
      console.error("Failed to fetch user trade stats:", e);
    }

    return new Response(
      JSON.stringify({
        referralWallet: REFERRAL_WALLET,
        userWallet,
        solBalance,
        tokenBalances: enrichedBalances,
        totalTokenAccounts: accounts.length,
        userTradeStats: tradeStats,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: any) {
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
