import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Missing Authorization header" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const supabase = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } }
    });
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Invalid token" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }
    let heliusKey = Deno.env.get("HELIUS_API_KEY");
    
    // Check if key is missing or is the placeholder from template
    const isInvalidKey = !heliusKey || heliusKey.includes("REPLACE") || heliusKey.length < 10;
    
    let rpcUrl: string;
    if (isInvalidKey) {
      console.warn("HELIUS_API_KEY is missing or invalid. Falling back to public RPC.");
      rpcUrl = "https://api.mainnet-beta.solana.com";
    } else {
      rpcUrl = `https://mainnet.helius-rpc.com/?api-key=${heliusKey}`;
    }

    const body = await req.text();

    const rpcRes = await fetch(rpcUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body,
    });

    // If Helius returns 403/401, try falling back to public RPC as a last resort
    if ((rpcRes.status === 403 || rpcRes.status === 401) && !isInvalidKey) {
      console.error(`Helius returned ${rpcRes.status}. Attempting public RPC fallback.`);
      const fallbackRes = await fetch("https://api.mainnet-beta.solana.com", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body,
      });
      const fallbackData = await fallbackRes.text();
      return new Response(fallbackData, {
        status: fallbackRes.status,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const data = await rpcRes.text();

    return new Response(data, {
      status: rpcRes.status,
      headers: {
        ...corsHeaders,
        "Content-Type": "application/json",
      },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
