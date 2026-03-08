import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.93.3";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

function ok(data: unknown) {
  return new Response(JSON.stringify({ success: true, data }), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

function err(message: string, status = 500) {
  return new Response(JSON.stringify({ success: false, error: message }), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const supabase = createClient(supabaseUrl, supabaseKey);

  const birdeyeKey = Deno.env.get('BIRDEYE_API_KEY');

  try {
    const body = await req.json();
    const { action, wallet_address } = body;

    if (!wallet_address || wallet_address.length < 30) {
      return err('Valid wallet_address is required', 400);
    }

    switch (action) {
      case 'init_wallet':
        return ok(await initSimWallet(supabase, wallet_address));

      case 'get_portfolio':
        return ok(await getPortfolio(supabase, wallet_address, birdeyeKey));

      case 'sim_buy':
        return ok(await simulateBuy(supabase, wallet_address, body, birdeyeKey));

      case 'sim_sell':
        return ok(await simulateSell(supabase, wallet_address, body, birdeyeKey));

      case 'get_orders':
        return ok(await getOrders(supabase, wallet_address, body.bot_type));

      case 'save_bot_config':
        return ok(await saveBotConfig(supabase, wallet_address, body.bot_type, body.config, body.is_active));

      case 'get_bot_configs':
        return ok(await getBotConfigs(supabase, wallet_address));

      case 'reset_wallet':
        return ok(await resetWallet(supabase, wallet_address));

      default:
        return err('Invalid action', 400);
    }
  } catch (error: unknown) {
    console.error('sim-trading error:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    return err(message);
  }
});

// ── Initialize simulation wallet with 10 SOL ──
async function initSimWallet(supabase: any, wallet_address: string) {
  const { data: existing } = await supabase
    .from('sim_wallets')
    .select('*')
    .eq('wallet_address', wallet_address)
    .single();

  if (existing) return existing;

  const { data, error } = await supabase
    .from('sim_wallets')
    .insert({ wallet_address, sol_balance: 10.0 })
    .select()
    .single();

  if (error) throw new Error(`Failed to create sim wallet: ${error.message}`);
  return data;
}

// ── Get portfolio with live prices ──
async function getPortfolio(supabase: any, wallet_address: string, birdeyeKey: string | undefined) {
  const { data: wallet } = await supabase
    .from('sim_wallets')
    .select('*')
    .eq('wallet_address', wallet_address)
    .single();

  const { data: holdings } = await supabase
    .from('sim_holdings')
    .select('*')
    .eq('wallet_address', wallet_address);

  // Fetch live prices for holdings
  let updatedHoldings = holdings || [];
  if (birdeyeKey && updatedHoldings.length > 0) {
    const addresses = updatedHoldings.map((h: any) => h.token_address);
    try {
      const priceData = await fetchLivePrices(addresses, birdeyeKey);
      updatedHoldings = updatedHoldings.map((h: any) => {
        const livePrice = priceData[h.token_address]?.value;
        if (livePrice) {
          const currentValue = h.amount * livePrice;
          const pnl = h.total_invested > 0
            ? ((currentValue - h.total_invested) / h.total_invested) * 100
            : 0;
          return { ...h, current_price: livePrice, current_value: currentValue, pnl_percent: pnl };
        }
        return h;
      });
    } catch (e) {
      console.error('Failed to fetch live prices for portfolio:', e);
    }
  }

  return {
    wallet: wallet || { sol_balance: 10.0 },
    holdings: updatedHoldings,
    total_value: (wallet?.sol_balance || 10) + updatedHoldings.reduce((sum: number, h: any) => sum + (h.current_value || h.total_invested || 0), 0),
  };
}

// ── Simulate a buy ──
async function simulateBuy(supabase: any, wallet_address: string, body: any, birdeyeKey: string | undefined) {
  const { token_address, token_symbol, sol_amount, bot_type } = body;

  if (!token_address || !sol_amount || sol_amount <= 0) {
    throw new Error('token_address and positive sol_amount required');
  }

  // Get wallet balance
  const { data: wallet } = await supabase
    .from('sim_wallets')
    .select('*')
    .eq('wallet_address', wallet_address)
    .single();

  if (!wallet) throw new Error('Wallet not initialized');
  if (wallet.sol_balance < sol_amount) throw new Error('Insufficient simulation SOL balance');

  // Fetch current price
  let price = body.price_override || 0;
  if (!price && birdeyeKey) {
    const prices = await fetchLivePrices([token_address], birdeyeKey);
    price = prices[token_address]?.value || 0;
  }
  if (!price) throw new Error('Could not determine token price');

  // Apply slippage simulation (0.5-2% random slippage)
  const slippage = 1 + (Math.random() * 0.015 + 0.005);
  const executionPrice = price * slippage;
  const tokenAmount = sol_amount / executionPrice;

  // Deduct SOL
  const { error: walletError } = await supabase
    .from('sim_wallets')
    .update({ sol_balance: wallet.sol_balance - sol_amount, updated_at: new Date().toISOString() })
    .eq('wallet_address', wallet_address);

  if (walletError) throw new Error(`Wallet update failed: ${walletError.message}`);

  // Upsert holding
  const { data: existingHolding } = await supabase
    .from('sim_holdings')
    .select('*')
    .eq('wallet_address', wallet_address)
    .eq('token_address', token_address)
    .single();

  if (existingHolding) {
    const newAmount = existingHolding.amount + tokenAmount;
    const newInvested = existingHolding.total_invested + sol_amount;
    const newAvgPrice = newInvested / newAmount;
    await supabase
      .from('sim_holdings')
      .update({ amount: newAmount, avg_buy_price: newAvgPrice, total_invested: newInvested, updated_at: new Date().toISOString() })
      .eq('id', existingHolding.id);
  } else {
    await supabase
      .from('sim_holdings')
      .insert({
        wallet_address,
        token_address,
        token_symbol: token_symbol || 'UNK',
        amount: tokenAmount,
        avg_buy_price: executionPrice,
        total_invested: sol_amount,
      });
  }

  // Record order
  const { data: order, error: orderError } = await supabase
    .from('sim_orders')
    .insert({
      wallet_address,
      bot_type: bot_type || 'manual',
      token_address,
      token_symbol: token_symbol || 'UNK',
      side: 'buy',
      sol_amount,
      token_amount: tokenAmount,
      price_at_execution: executionPrice,
      status: 'filled',
    })
    .select()
    .single();

  if (orderError) throw new Error(`Order recording failed: ${orderError.message}`);

  return {
    order,
    execution_price: executionPrice,
    token_amount: tokenAmount,
    slippage_percent: ((slippage - 1) * 100).toFixed(2),
    remaining_sol: wallet.sol_balance - sol_amount,
  };
}

// ── Simulate a sell ──
async function simulateSell(supabase: any, wallet_address: string, body: any, birdeyeKey: string | undefined) {
  const { token_address, token_symbol, sell_percent, bot_type } = body;

  if (!token_address) throw new Error('token_address required');

  const { data: holding } = await supabase
    .from('sim_holdings')
    .select('*')
    .eq('wallet_address', wallet_address)
    .eq('token_address', token_address)
    .single();

  if (!holding || holding.amount <= 0) throw new Error('No holdings to sell');

  // Fetch current price
  let price = body.price_override || 0;
  if (!price && birdeyeKey) {
    const prices = await fetchLivePrices([token_address], birdeyeKey);
    price = prices[token_address]?.value || 0;
  }
  if (!price) throw new Error('Could not determine token price');

  // Slippage
  const slippage = 1 - (Math.random() * 0.015 + 0.005);
  const executionPrice = price * slippage;
  const percentToSell = Math.min(sell_percent || 100, 100) / 100;
  const tokenAmount = holding.amount * percentToSell;
  const solReceived = tokenAmount * executionPrice;

  // Update wallet
  const { data: wallet } = await supabase
    .from('sim_wallets')
    .select('*')
    .eq('wallet_address', wallet_address)
    .single();

  await supabase
    .from('sim_wallets')
    .update({ sol_balance: (wallet?.sol_balance || 0) + solReceived, updated_at: new Date().toISOString() })
    .eq('wallet_address', wallet_address);

  // Update or remove holding
  const remainingAmount = holding.amount - tokenAmount;
  const remainingInvested = holding.total_invested * (1 - percentToSell);

  if (remainingAmount < 0.000001) {
    await supabase.from('sim_holdings').delete().eq('id', holding.id);
  } else {
    await supabase
      .from('sim_holdings')
      .update({ amount: remainingAmount, total_invested: remainingInvested, updated_at: new Date().toISOString() })
      .eq('id', holding.id);
  }

  const pnl = ((solReceived - (holding.total_invested * percentToSell)) / (holding.total_invested * percentToSell)) * 100;

  const { data: order } = await supabase
    .from('sim_orders')
    .insert({
      wallet_address,
      bot_type: bot_type || 'manual',
      token_address,
      token_symbol: token_symbol || holding.token_symbol || 'UNK',
      side: 'sell',
      sol_amount: solReceived,
      token_amount: tokenAmount,
      price_at_execution: executionPrice,
      pnl_percent: pnl,
      status: 'filled',
    })
    .select()
    .single();

  return {
    order,
    execution_price: executionPrice,
    sol_received: solReceived,
    pnl_percent: pnl.toFixed(2),
    remaining_sol: (wallet?.sol_balance || 0) + solReceived,
  };
}

// ── Get order history ──
async function getOrders(supabase: any, wallet_address: string, bot_type?: string) {
  let query = supabase
    .from('sim_orders')
    .select('*')
    .eq('wallet_address', wallet_address)
    .order('created_at', { ascending: false })
    .limit(50);

  if (bot_type) {
    query = query.eq('bot_type', bot_type);
  }

  const { data, error } = await query;
  if (error) throw new Error(`Failed to fetch orders: ${error.message}`);
  return data || [];
}

// ── Save bot config ──
async function saveBotConfig(supabase: any, wallet_address: string, bot_type: string, config: any, is_active: boolean) {
  const { data: existing } = await supabase
    .from('sim_bot_configs')
    .select('*')
    .eq('wallet_address', wallet_address)
    .eq('bot_type', bot_type)
    .single();

  if (existing) {
    const { data, error } = await supabase
      .from('sim_bot_configs')
      .update({ config, is_active, updated_at: new Date().toISOString() })
      .eq('id', existing.id)
      .select()
      .single();
    if (error) throw new Error(error.message);
    return data;
  }

  const { data, error } = await supabase
    .from('sim_bot_configs')
    .insert({ wallet_address, bot_type, config, is_active })
    .select()
    .single();
  if (error) throw new Error(error.message);
  return data;
}

// ── Get all bot configs ──
async function getBotConfigs(supabase: any, wallet_address: string) {
  const { data } = await supabase
    .from('sim_bot_configs')
    .select('*')
    .eq('wallet_address', wallet_address);
  return data || [];
}

// ── Reset wallet ──
async function resetWallet(supabase: any, wallet_address: string) {
  await supabase.from('sim_orders').delete().eq('wallet_address', wallet_address);
  await supabase.from('sim_holdings').delete().eq('wallet_address', wallet_address);
  await supabase.from('sim_bot_configs').delete().eq('wallet_address', wallet_address);
  await supabase
    .from('sim_wallets')
    .update({ sol_balance: 10.0, updated_at: new Date().toISOString() })
    .eq('wallet_address', wallet_address);
  return { sol_balance: 10.0, message: 'Wallet reset to 10 SOL' };
}

// ── Helper: Fetch live prices from Birdeye ──
async function fetchLivePrices(addresses: string[], apiKey: string) {
  const list = addresses.join(',');
  const response = await fetch(
    `https://public-api.birdeye.so/defi/multi_price?list_address=${list}`,
    { headers: { 'X-API-KEY': apiKey, 'x-chain': 'solana' } }
  );
  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Birdeye price fetch failed: ${text}`);
  }
  const result = await response.json();
  return result.data || {};
}
