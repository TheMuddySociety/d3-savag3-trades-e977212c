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
        userWallet,
        userTradeStats: tradeStats,
        timestamp: new Date().toISOString(),
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
