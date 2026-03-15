import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const ADMIN_WALLETS = [
  "BQefQgbpAqPjoGKLTmAA2haZh9pEURYNefPFwsTotgem",
];

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { wallet_address } = await req.json();
    if (!wallet_address || typeof wallet_address !== "string" || wallet_address.length < 30) {
      return new Response(
        JSON.stringify({ isAdmin: false }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const isAdmin = ADMIN_WALLETS.includes(wallet_address);

    return new Response(
      JSON.stringify({ isAdmin }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch {
    return new Response(
      JSON.stringify({ isAdmin: false }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
