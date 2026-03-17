import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const ULTRA_API_BASE = "https://api.jup.ag/ultra/v1";

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const jupiterApiKey = Deno.env.get("JUPITER_API_KEY");
    const body = await req.json();
    const { action } = body;

    const authHeaders: Record<string, string> = {
      "Content-Type": "application/json",
    };
    if (jupiterApiKey) {
      authHeaders["x-api-key"] = jupiterApiKey;
    }

    if (action === "order") {
      const { inputMint, outputMint, amount, taker, swapMode } = body;
      if (!inputMint || !outputMint || !amount || !taker) {
        return new Response(JSON.stringify({ error: "Missing required params" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const url = `${ULTRA_API_BASE}/order?inputMint=${inputMint}&outputMint=${outputMint}&amount=${amount}&taker=${taker}&swapMode=${swapMode || "ExactIn"}`;
      
      console.log("Fetching Ultra order:", url);
      const res = await fetch(url, { headers: authHeaders });
      
      if (!res.ok) {
        const errorText = await res.text();
        console.error("Ultra order error:", res.status, errorText);
        return new Response(JSON.stringify({ error: `Jupiter Ultra: ${res.status} ${errorText}` }), {
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
        const heliusKey = Deno.env.get("HELIUS_API_KEY") || "251ce93e-be5b-4d6e-9c96-a9805fae66de";
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

      console.log("Executing Ultra swap, requestId:", requestId);
      const res = await fetch(`${ULTRA_API_BASE}/execute`, {
        method: "POST",
        headers: authHeaders,
        body: JSON.stringify({ signedTransaction, requestId }),
      });

      if (!res.ok) {
        const errorText = await res.text();
        console.error("Ultra execute error:", res.status, errorText);
        return new Response(JSON.stringify({ error: `Execute failed: ${res.status} ${errorText}` }), {
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
  } catch (err) {
    console.error("jupiter-ultra error:", err);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
