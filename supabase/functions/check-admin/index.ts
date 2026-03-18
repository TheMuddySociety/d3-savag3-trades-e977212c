import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.93.3";

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
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ isAdmin: false, error: "Missing Authorization header" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

    // Create a user client to verify the JWT
    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } }
    });
    const { data: { user }, error: authError } = await userClient.auth.getUser();

    if (authError || !user) {
      return new Response(JSON.stringify({ isAdmin: false, error: "Invalid token" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    const supabase = createClient(supabaseUrl, supabaseKey);

    // Get the trusted wallet address from profiles
    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("wallet_address")
      .eq("id", user.id)
      .single();

    if (profileError || !profile || !profile.wallet_address) {
      return new Response(JSON.stringify({ isAdmin: false, error: "Profile or wallet not found" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    const isAdmin = ADMIN_WALLETS.includes(profile.wallet_address);
    if (isAdmin) {
      console.log(`✅ Admin access granted for: ${profile.wallet_address}`);
    }

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
