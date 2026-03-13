import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

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
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Helius sends an array of enhanced transactions
    const transactions = await req.json();

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
      // Determine the fee payer / source wallet
      const feePayer = tx.feePayer;
      if (!feePayer) continue;

      // Check if this transaction is from a monitored wallet
      const configs = targetMap.get(feePayer);
      if (!configs) continue;

      // Parse swap details
      const tokenTransfers = tx.tokenTransfers || [];
      const nativeTransfers = tx.nativeTransfers || [];

      // Determine buy or sell by SOL flow
      const solSent = nativeTransfers
        .filter((t: any) => t.fromUserAccount === feePayer)
        .reduce((sum: number, t: any) => sum + (t.amount || 0), 0);
      const solReceived = nativeTransfers
        .filter((t: any) => t.toUserAccount === feePayer)
        .reduce((sum: number, t: any) => sum + (t.amount || 0), 0);

      // Find the non-SOL token involved
      const nonSolTransfer = tokenTransfers.find((t: any) => t.mint !== SOL_MINT);
      if (!nonSolTransfer) continue;

      const isBuy = solSent > solReceived;
      const solAmount = Math.abs(solSent - solReceived) / 1e9;

      // Create event for each subscriber of this target wallet
      for (const config of configs) {
        // Skip sell events if auto_sell is off
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

      // Update last_checked_tx for all configs watching this wallet
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
