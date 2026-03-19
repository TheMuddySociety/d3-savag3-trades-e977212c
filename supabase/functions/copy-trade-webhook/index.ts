import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

const SOL_MINT = "So11111111111111111111111111111111111111112";

async function verifyHeliusSignature(body: string, authHeader: string | null, secret: string): Promise<boolean> {
  if (!authHeader) return false;
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const signature = await crypto.subtle.sign("HMAC", key, encoder.encode(body));
  const expected = Array.from(new Uint8Array(signature))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
  // Constant-time comparison
  if (expected.length !== authHeader.length) return false;
  let mismatch = 0;
  for (let i = 0; i < expected.length; i++) {
    mismatch |= expected.charCodeAt(i) ^ authHeader.charCodeAt(i);
  }
  return mismatch === 0;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // ── Webhook signature verification ──
    const webhookSecret = Deno.env.get('HELIUS_WEBHOOK_SECRET');
    const rawBody = await req.text();

    if (webhookSecret) {
      const authHeader = req.headers.get('authorization');
      const isValid = await verifyHeliusSignature(rawBody, authHeader, webhookSecret);
      if (!isValid) {
        console.error('Webhook signature verification failed');
        return new Response(JSON.stringify({ error: 'Unauthorized' }), {
          status: 401,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
    } else {
      console.warn('HELIUS_WEBHOOK_SECRET not set — webhook signature verification skipped. Set it to secure this endpoint.');
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Helius sends an array of enhanced transactions
    const transactions = JSON.parse(rawBody);

    if (!Array.isArray(transactions) || transactions.length === 0) {
      return new Response(JSON.stringify({ success: true, processed: 0 }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Look up which wallets are being monitored
    const { data: activeConfigs } = await supabase
      .from('copy_trade_configs')
      .select('wallet_address, target_wallet, auto_sell')
      .eq('is_active', true);

    if (!activeConfigs || activeConfigs.length === 0) {
      return new Response(JSON.stringify({ success: true, processed: 0, reason: 'no active configs' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Build a map of target_wallet -> [configs]
    const targetMap = new Map<string, typeof activeConfigs>();
    for (const config of activeConfigs) {
      const existing = targetMap.get(config.target_wallet) || [];
      existing.push(config);
      targetMap.set(config.target_wallet, existing);
    }

    const eventsToInsert: any[] = [];

    for (const tx of transactions) {
      const feePayer = tx.feePayer;
      if (!feePayer) continue;

      const configs = targetMap.get(feePayer);
      if (!configs) continue;

      const tokenTransfers = tx.tokenTransfers || [];
      const nativeTransfers = tx.nativeTransfers || [];

      const solSent = nativeTransfers
        .filter((t: any) => t.fromUserAccount === feePayer)
        .reduce((sum: number, t: any) => sum + (t.amount || 0), 0);
      const solReceived = nativeTransfers
        .filter((t: any) => t.toUserAccount === feePayer)
        .reduce((sum: number, t: any) => sum + (t.amount || 0), 0);

      const nonSolTransfer = tokenTransfers.find((t: any) => t.mint !== SOL_MINT);
      if (!nonSolTransfer) continue;

      const isBuy = solSent > solReceived;
      const solAmount = Math.abs(solSent - solReceived) / 1e9;

      for (const config of configs) {
        if (!isBuy && !config.auto_sell) continue;

        eventsToInsert.push({
          wallet_address: config.wallet_address,
          target_wallet: feePayer,
          signature: tx.signature,
          swap_type: isBuy ? 'buy' : 'sell',
          token_mint: nonSolTransfer.mint,
          sol_amount: solAmount,
          timestamp: tx.timestamp || Math.floor(Date.now() / 1000),
          processed: false,
        });
      }

      await supabase
        .from('copy_trade_configs')
        .update({ last_checked_tx: tx.signature, updated_at: new Date().toISOString() })
        .eq('target_wallet', feePayer)
        .eq('is_active', true);
    }

    if (eventsToInsert.length > 0) {
      const { error: insertError } = await supabase
        .from('copy_trade_events')
        .upsert(eventsToInsert, { onConflict: 'signature,wallet_address' });

      if (insertError) {
        console.error('Insert error:', insertError);
      }
    }

    return new Response(JSON.stringify({ success: true, processed: eventsToInsert.length }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error: unknown) {
    console.error('Webhook error:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    return new Response(JSON.stringify({ success: false, error: message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
