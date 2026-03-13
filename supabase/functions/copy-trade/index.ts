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
    const heliusKey = Deno.env.get('HELIUS_API_KEY');
    if (!heliusKey) {
      return new Response(JSON.stringify({ success: false, error: 'HELIUS_API_KEY not configured' }), {
        status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { target_wallet, last_tx } = await req.json();

    if (!target_wallet || target_wallet.length < 30) {
      return new Response(JSON.stringify({ success: false, error: 'Valid target_wallet required' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Fetch recent transactions from Helius Enhanced API
    let url = `https://api.helius.xyz/v0/addresses/${target_wallet}/transactions?api-key=${heliusKey}&type=SWAP&limit=5`;

    const response = await fetch(url);
    if (!response.ok) {
      const text = await response.text();
      throw new Error(`Helius API error [${response.status}]: ${text}`);
    }

    const transactions = await response.json();

    // Filter to only new transactions (after last_tx)
    let swaps: any[] = [];
    for (const tx of transactions) {
      if (tx.signature === last_tx) break;

      // Parse swap details from Helius enhanced transaction
      const tokenTransfers = tx.tokenTransfers || [];
      const nativeTransfers = tx.nativeTransfers || [];

      // Determine if buy or sell by checking SOL flow
      const solSent = nativeTransfers
        .filter((t: any) => t.fromUserAccount === target_wallet)
        .reduce((sum: number, t: any) => sum + (t.amount || 0), 0);

      const solReceived = nativeTransfers
        .filter((t: any) => t.toUserAccount === target_wallet)
        .reduce((sum: number, t: any) => sum + (t.amount || 0), 0);

      // Find the non-SOL token involved
      const nonSolTransfer = tokenTransfers.find((t: any) => t.mint !== SOL_MINT);
      if (!nonSolTransfer) continue;

      const isBuy = solSent > solReceived; // Spent SOL = bought token
      const solAmount = Math.abs(solSent - solReceived) / 1e9; // Convert lamports to SOL

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
