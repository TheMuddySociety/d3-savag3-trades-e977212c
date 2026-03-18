import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

const SOL_MINT = "So11111111111111111111111111111111111111112";

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('Authorization');
    const heliusKey = Deno.env.get('HELIUS_API_KEY');
    if (!heliusKey) {
      return new Response(JSON.stringify({ success: false, error: 'HELIUS_API_KEY not configured' }), {
        status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const body = await req.json();
    const { action } = body;

    // Management actions require authentication
    if (action === 'register_webhook' || action === 'delete_webhook') {
      if (!authHeader) {
        return new Response(JSON.stringify({ success: false, error: 'Authorization header required for this action' }), {
          status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      
      const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
      const userClient = createClient(supabaseUrl, Deno.env.get('SUPABASE_ANON_KEY')!, {
        global: { headers: { Authorization: authHeader } }
      });
      const { data: { user }, error: authError } = await userClient.auth.getUser();
      
      if (authError || !user) {
        return new Response(JSON.stringify({ success: false, error: 'Invalid or expired token' }), {
          status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
    }

    // === WEBHOOK REGISTRATION ===
    if (action === 'register_webhook') {
      const { target_wallet, webhook_id_existing } = body;

      if (!target_wallet || target_wallet.length < 30) {
        return new Response(JSON.stringify({ success: false, error: 'Valid target_wallet required' }), {
          status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
      const webhookURL = `${supabaseUrl}/functions/v1/copy-trade-webhook`;

      // If updating an existing webhook, use PUT
      if (webhook_id_existing) {
        const response = await fetch(
          `https://api.helius.xyz/v0/webhooks/${webhook_id_existing}?api-key=${heliusKey}`,
          {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              webhookURL,
              accountAddresses: [target_wallet],
              transactionTypes: ['SWAP'],
              webhookType: 'enhanced',
            }),
          }
        );
        const data = await response.json();
        if (!response.ok) throw new Error(`Helius webhook update failed: ${JSON.stringify(data)}`);
        return new Response(JSON.stringify({ success: true, data: { webhookId: data.webhookID } }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      // Create new webhook
      const response = await fetch(
        `https://api.helius.xyz/v0/webhooks?api-key=${heliusKey}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            webhookURL,
            accountAddresses: [target_wallet],
            transactionTypes: ['SWAP'],
            webhookType: 'enhanced',
          }),
        }
      );

      const data = await response.json();
      if (!response.ok) throw new Error(`Helius webhook creation failed: ${JSON.stringify(data)}`);

      return new Response(JSON.stringify({ success: true, data: { webhookId: data.webhookID } }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // === WEBHOOK DELETION ===
    if (action === 'delete_webhook') {
      const { webhook_id } = body;
      if (!webhook_id) {
        return new Response(JSON.stringify({ success: false, error: 'webhook_id required' }), {
          status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const response = await fetch(
        `https://api.helius.xyz/v0/webhooks/${webhook_id}?api-key=${heliusKey}`,
        { method: 'DELETE' }
      );

      if (!response.ok) {
        const text = await response.text();
        console.error(`Webhook delete failed [${response.status}]: ${text}`);
      }

      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // === LEGACY POLLING (fallback) ===
    const { target_wallet, last_tx } = body;

    if (!target_wallet || target_wallet.length < 30) {
      return new Response(JSON.stringify({ success: false, error: 'Valid target_wallet required' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const url = `https://api.helius.xyz/v0/addresses/${target_wallet}/transactions?api-key=${heliusKey}&type=SWAP&limit=5`;
    const response = await fetch(url);
    if (!response.ok) {
      const text = await response.text();
      throw new Error(`Helius API error [${response.status}]: ${text}`);
    }

    const transactions = await response.json();
    let swaps: any[] = [];
    for (const tx of transactions) {
      if (tx.signature === last_tx) break;

      const tokenTransfers = tx.tokenTransfers || [];
      const nativeTransfers = tx.nativeTransfers || [];

      const solSent = nativeTransfers
        .filter((t: any) => t.fromUserAccount === target_wallet)
        .reduce((sum: number, t: any) => sum + (t.amount || 0), 0);
      const solReceived = nativeTransfers
        .filter((t: any) => t.toUserAccount === target_wallet)
        .reduce((sum: number, t: any) => sum + (t.amount || 0), 0);

      const nonSolTransfer = tokenTransfers.find((t: any) => t.mint !== SOL_MINT);
      if (!nonSolTransfer) continue;

      const isBuy = solSent > solReceived;
      const solAmount = Math.abs(solSent - solReceived) / 1e9;

      swaps.push({
        signature: tx.signature,
        type: isBuy ? "buy" : "sell",
        tokenMint: nonSolTransfer.mint,
        solAmount,
        timestamp: tx.timestamp,
      });
    }

    return new Response(JSON.stringify({ success: true, data: { swaps } }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error: unknown) {
    console.error('copy-trade error:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    return new Response(JSON.stringify({ success: false, error: message }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
