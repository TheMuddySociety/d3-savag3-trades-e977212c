import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.93.3";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const birdeyeKey = Deno.env.get('BIRDEYE_API_KEY');
  const supabase = createClient(supabaseUrl, supabaseKey);

  try {
    // Get all active auto strategy configs
    const { data: configs, error } = await supabase
      .from('sim_bot_configs')
      .select('*')
      .eq('bot_type', 'auto')
      .eq('is_active', true);

    if (error) throw new Error(error.message);
    if (!configs || configs.length === 0) {
      return new Response(JSON.stringify({ success: true, data: { processed: 0 } }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    let processed = 0;

    for (const config of configs) {
      const walletAddress = config.wallet_address;
      const strategies = config.config?.strategies || [];
      const maxBudget = config.config?.maxBudget || 1.0;

      // --- Budget Check ---
      const { data: budgets } = await supabase
        .from('auto_trade_budgets')
        .select('*')
        .eq('wallet_address', walletAddress)
        .eq('is_active', true);

      const activeBudget = budgets && budgets.length > 0 ? budgets[0] : null;

      if (!activeBudget) {
        console.log(`No active budget for ${walletAddress} — skipping`);
        continue;
      }

      const budgetMode = activeBudget.budget_mode;
      const remainingBudget = activeBudget.remaining_amount || 0;
      const spendingLimit = activeBudget.spending_limit || 0;

      if (budgetMode === 'deposit' && remainingBudget <= 0) {
        console.log(`Budget exhausted for ${walletAddress} — skipping`);
        continue;
      }

      // Get wallet and holdings
      const { data: wallet } = await supabase
        .from('sim_wallets')
        .select('*')
        .eq('wallet_address', walletAddress)
        .single();

      if (!wallet) continue;

      const { data: holdings } = await supabase
        .from('sim_holdings')
        .select('*')
        .eq('wallet_address', walletAddress);

      // Evaluate Safe Exit strategy
      if (strategies.includes('safe_exit') && holdings && holdings.length > 0 && birdeyeKey) {
        const addresses = holdings.map((h: any) => h.token_address);
        try {
          const prices = await fetchPrices(addresses, birdeyeKey);

          for (const h of holdings) {
            const livePrice = prices[h.token_address]?.value;
            if (!livePrice || h.total_invested <= 0) continue;

            const currentValue = h.amount * livePrice;
            const pnl = ((currentValue - h.total_invested) / h.total_invested) * 100;

            // Stop-loss at -15% or take-profit at +50%
            if (pnl <= -15 || pnl >= 50) {
              // Check budget before executing
              const tradeCost = h.total_invested;
              if (!checkBudget(activeBudget, tradeCost)) {
                console.log(`Budget insufficient for safe_exit trade on ${walletAddress}`);
                continue;
              }

              await executeSell(supabase, walletAddress, h, livePrice, 'auto');
              await deductBudget(supabase, activeBudget, tradeCost);
              processed++;
            }
          }
        } catch (e) {
          console.error(`Safe exit eval error for ${walletAddress}:`, e);
        }
      }

      // Evaluate Scalper strategy
      if (strategies.includes('scalper') && holdings && holdings.length > 0 && birdeyeKey) {
        const addresses = holdings.map((h: any) => h.token_address);
        try {
          const prices = await fetchPrices(addresses, birdeyeKey);

          for (const h of holdings) {
            const livePrice = prices[h.token_address]?.value;
            if (!livePrice || h.total_invested <= 0) continue;

            const currentValue = h.amount * livePrice;
            const pnl = ((currentValue - h.total_invested) / h.total_invested) * 100;

            // Scalper: sell on 3% gain
            if (pnl >= 3) {
              const tradeCost = h.total_invested;
              if (!checkBudget(activeBudget, tradeCost)) {
                console.log(`Budget insufficient for scalper trade on ${walletAddress}`);
                continue;
              }

              await executeSell(supabase, walletAddress, h, livePrice, 'auto');
              await deductBudget(supabase, activeBudget, tradeCost);
              processed++;
            }
          }
        } catch (e) {
          console.error(`Scalper eval error for ${walletAddress}:`, e);
        }
      }
    }

    return new Response(JSON.stringify({ success: true, data: { processed } }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error: unknown) {
    console.error('auto-trader error:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    return new Response(JSON.stringify({ success: false, error: message }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});

function checkBudget(budget: any, tradeCost: number): boolean {
  if (budget.budget_mode === 'deposit') {
    return (budget.remaining_amount || 0) >= tradeCost;
  }
  if (budget.budget_mode === 'limit') {
    return tradeCost <= (budget.spending_limit || 0);
  }
  return false;
}

async function deductBudget(supabase: any, budget: any, tradeCost: number) {
  if (budget.budget_mode === 'deposit') {
    const newSpent = (budget.spent_amount || 0) + tradeCost;
    const newRemaining = Math.max(0, (budget.remaining_amount || 0) - tradeCost);
    await supabase
      .from('auto_trade_budgets')
      .update({
        spent_amount: newSpent,
        remaining_amount: newRemaining,
        updated_at: new Date().toISOString(),
      })
      .eq('id', budget.id);
    // Update in-memory for subsequent trades in same loop
    budget.spent_amount = newSpent;
    budget.remaining_amount = newRemaining;
  }
  // For 'limit' mode, no deduction — just a per-trade cap
}

async function executeSell(supabase: any, walletAddress: string, holding: any, price: number, botType: string) {
  const slippage = 1 - (Math.random() * 0.015 + 0.005);
  const execPrice = price * slippage;
  const solReceived = holding.amount * execPrice;
  const pnl = ((solReceived - holding.total_invested) / holding.total_invested) * 100;

  // Update wallet balance
  const { data: wallet } = await supabase
    .from('sim_wallets')
    .select('sol_balance')
    .eq('wallet_address', walletAddress)
    .single();

  await supabase
    .from('sim_wallets')
    .update({ sol_balance: (wallet?.sol_balance || 0) + solReceived, updated_at: new Date().toISOString() })
    .eq('wallet_address', walletAddress);

  // Remove holding
  await supabase.from('sim_holdings').delete().eq('id', holding.id);

  // Record order
  await supabase.from('sim_orders').insert({
    wallet_address: walletAddress,
    bot_type: botType,
    token_address: holding.token_address,
    token_symbol: holding.token_symbol || 'UNK',
    side: 'sell',
    sol_amount: solReceived,
    token_amount: holding.amount,
    price_at_execution: execPrice,
    pnl_percent: pnl,
    status: 'filled',
  });
}

async function fetchPrices(addresses: string[], apiKey: string) {
  const list = addresses.join(',');
  const response = await fetch(
    `https://public-api.birdeye.so/defi/multi_price?list_address=${list}`,
    { headers: { 'X-API-KEY': apiKey, 'x-chain': 'solana' } }
  );
  if (!response.ok) throw new Error(`Birdeye price fetch failed`);
  const result = await response.json();
  return result.data || {};
}
