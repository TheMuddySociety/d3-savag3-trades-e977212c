import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// Safe env get helper
const getEnv = (key: string): string | null => {
  try {
    return (globalThis as any).Deno?.env?.get(key) || null;
  } catch {
    return null;
  }
};


const ULTRA_API_BASE = getEnv("CUSTOM_JUPITER_ULTRA_URL") || "https://api.jup.ag/ultra/v1";
const SWAP_API_BASE = getEnv("CUSTOM_JUPITER_SWAP_URL") || "https://api.jup.ag/swap/v2";

serve(async (req: Request) => {
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

    const supabaseUrl = getEnv("SUPABASE_URL")!;
    const serviceRoleKey = getEnv("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceRoleKey, {
      global: { headers: { Authorization: authHeader } }
    });
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Invalid token" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }
    const jupiterApiKey = getEnv("JUPITER_API_KEY");
    const body = await req.json();
    const { action } = body;

    const authHeaders: Record<string, string> = {
      "Content-Type": "application/json",
    };
    if (jupiterApiKey) {
      authHeaders["x-api-key"] = jupiterApiKey;
    }

    const customSolanaRpc = getEnv("CUSTOM_SOLANA_RPC_URL");

    if (action === "order") {
      const { inputMint, outputMint, amount, taker, swapMode, slippageBps = 300 } = body;
      if (!inputMint || !outputMint || !amount || !taker) {
        return new Response(JSON.stringify({ error: "Missing required params" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const queryParams = new URLSearchParams({
        inputMint,
        outputMint,
        amount,
        taker,
        swapMode: swapMode || "ExactIn",
        slippageBps: String(slippageBps),
      });

      const url = `${SWAP_API_BASE}/order?${queryParams.toString()}`;
      
      console.log("Fetching Swap V2 order:", url);
      const res = await fetch(url, { headers: authHeaders });
      
      if (!res.ok) {
        const errorText = await res.text();
        console.error("Swap V2 order error:", res.status, errorText);
        return new Response(JSON.stringify({ error: `Jupiter Swap V2: ${res.status} ${errorText}` }), {
          status: res.status,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const data = await res.json();
      return new Response(JSON.stringify({ success: true, data }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "execute") {
      const { signedTransaction, requestId, useHelius } = body;
      if (!signedTransaction || !requestId) {
        return new Response(JSON.stringify({ error: "Missing signedTransaction or requestId" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      if (useHelius) {
        console.log("Executing via Helius Sender, requestId:", requestId);
        let heliusKey = getEnv("HELIUS_API_KEY");
        const res = await fetch(`https://sender.helius-rpc.com/fast?api-key=${heliusKey}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            jsonrpc: "2.0",
            id: requestId,
            method: "sendTransaction",
            params: [
              signedTransaction,
              { encoding: "base64", skipPreflight: true, maxRetries: 0 }
            ]
          }),
        });

        if (!res.ok) {
          const errorText = await res.text();
          console.error("Helius Sender error:", res.status, errorText);
          return new Response(JSON.stringify({ error: `Helius Sender failed: ${res.status}` }), {
            status: res.status,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        const data = await res.json();
        return new Response(JSON.stringify({ success: true, data: { status: 'Success', signature: data.result } }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      console.log("Executing Swap V2 swap, requestId:", requestId);
      const res = await fetch(`${SWAP_API_BASE}/execute`, {
        method: "POST",
        headers: authHeaders,
        body: JSON.stringify({ signedTransaction, requestId }),
      });

      if (!res.ok) {
        const errorText = await res.text();
        console.error("Swap V2 execute error:", res.status, errorText);
        let userMessage = errorText;
        if (errorText.includes("Your RPC is not responding")) {
          userMessage = "Swap simulation failed: The Solana RPC is not responding. Please check your Helius or Custom RPC settings in Supabase secrets.";
        }
        return new Response(JSON.stringify({ error: `Execute failed: ${res.status} ${userMessage}` }), {
          status: res.status,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const data = await res.json();
      return new Response(JSON.stringify({ success: true, data }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "balances") {
      const { wallet_address } = body;
      if (!wallet_address) {
        return new Response(JSON.stringify({ error: "Missing wallet_address" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const res = await fetch(`${ULTRA_API_BASE}/balances/${wallet_address}`, {
        headers: authHeaders,
      });

      if (!res.ok) {
        const errorText = await res.text();
        return new Response(JSON.stringify({ error: `Balances failed: ${res.status}` }), {
          status: res.status,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const data = await res.json();
      return new Response(JSON.stringify({ success: true, data }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ error: "Unknown action. Use: order, execute, balances" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err: any) {
    console.error("jupiter-ultra error:", err);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
