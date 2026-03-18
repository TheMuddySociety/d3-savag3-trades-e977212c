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
    const { action } = body;

    // Leaderboard is public — skip auth entirely
    if (action === 'leaderboard') {
      // handle leaderboard below without auth
    }

    const authHeader = req.headers.get('Authorization');
    let authenticatedUserId: string | null = null;
    let trustedWallet: string | null = null;

    if (action !== 'leaderboard') {
      if (!authHeader) {
        return err('Authorization header is required', 401);
      }

      const userClient = createClient(supabaseUrl, Deno.env.get('SUPABASE_ANON_KEY')!, {
        global: { headers: { Authorization: authHeader } }
      });
      const { data: { user }, error: authError } = await userClient.auth.getUser();
      
      if (authError || !user) {
        console.error('Auth error:', authError);
        return err('Invalid or expired token', 401);
      }
      authenticatedUserId = user.id;

      // Fetch trusted wallet from profiles
      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('wallet_address')
        .eq('id', authenticatedUserId)
        .single();

      if (profileError || !profile) {
        console.error('Profile fetch error:', profileError);
        return err('User profile with wallet address not found', 404);
      }
      trustedWallet = profile.wallet_address;
    }

    // body and action already parsed above
    // We ignore wallet_address from body for shared/private actions, 
    // unless it's a public read action like leaderboard
    
    // Leaderboard doesn't require wallet
    if (action === 'leaderboard') {
      return ok(await getLeaderboard(supabase, body.limit || 20));
    }

    // All other actions require a trusted wallet from auth
    if (!trustedWallet) {
      return err('Authentication required for this action', 401);
    }

    const wallet_address = trustedWallet;

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

// ── Leaderboard: aggregate P&L per wallet ──
async function getLeaderboard(supabase: any, limit: number) {
  // Get all wallets
  const { data: wallets } = await supabase
    .from('sim_wallets')
    .select('wallet_address, sol_balance, created_at');

  if (!wallets || wallets.length === 0) return [];

  // Get all orders per wallet to compute stats
  const { data: allOrders } = await supabase
    .from('sim_orders')
    .select('wallet_address, side, sol_amount, pnl_percent, bot_type, created_at')
    .order('created_at', { ascending: false });

  const ordersByWallet = new Map<string, any[]>();
  (allOrders || []).forEach((o: any) => {
    const list = ordersByWallet.get(o.wallet_address) || [];
    list.push(o);
    ordersByWallet.set(o.wallet_address, list);
  });

  // Fetch holdings for unrealized gains
  const { data: allHoldings } = await supabase
    .from('sim_holdings')
    .select('wallet_address, total_invested');

  const holdingsByWallet = new Map<string, number>();
  (allHoldings || []).forEach((h: any) => {
    const current = holdingsByWallet.get(h.wallet_address) || 0;
    holdingsByWallet.set(h.wallet_address, current + (h.total_invested || 0));
  });

  // Fetch live trades for combined stats
  const { data: liveTrades } = await supabase
    .from('live_trades')
    .select('wallet_address, trade_type, input_usd_value, output_usd_value, bot_type, created_at');

  const liveTradesByWallet = new Map<string, any[]>();
  (liveTrades || []).forEach((t: any) => {
    const list = liveTradesByWallet.get(t.wallet_address) || [];
    list.push(t);
    liveTradesByWallet.set(t.wallet_address, list);
  });

  const leaderboard = wallets.map((w: any) => {
    const orders = ordersByWallet.get(w.wallet_address) || [];
    const lTrades = liveTradesByWallet.get(w.wallet_address) || [];
    const totalTrades = orders.length + lTrades.length;
    
    // Sim stats
    const sells = orders.filter((o: any) => o.side === 'sell');
    const buys = orders.filter((o: any) => o.side === 'buy');
    const unrealizedInvested = holdingsByWallet.get(w.wallet_address) || 0;
    const simPnl = (w.sol_balance || 0) + unrealizedInvested - 10;

    // Live stats (Realized P&L in USD converted to SOL roughly)
    // For simplicity, we aggregate the USD difference of completed trades
    let livePnlUsd = 0;
    lTrades.forEach((t: any) => {
      if (t.trade_type === 'sell' && t.output_usd_value && t.input_usd_value) {
        livePnlUsd += (t.output_usd_value - t.input_usd_value);
      }
    });
    const solPrice = 150; // Fallback or fetch live
    const livePnlSol = livePnlUsd / solPrice;

    const totalPnl = simPnl + livePnlSol;

    const simWinningTrades = sells.filter((o: any) => (o.pnl_percent || 0) > 0).length;
    const avgPnlPercent = sells.length > 0
      ? sells.reduce((sum: number, o: any) => sum + (o.pnl_percent || 0), 0) / sells.length
      : 0;

    const liveWinningTrades = lTrades.filter((t: any) => t.trade_type === 'sell' && (t.output_usd_value || 0) > (t.input_usd_value || 0)).length;
    const totalSells = sells.length + lTrades.filter((t: any) => t.trade_type === 'sell').length;
    
    const winRate = totalSells > 0 ? ((simWinningTrades + liveWinningTrades) / totalSells) * 100 : 0;

    // Get unique bot types used
    const botTypes = [...new Set([...orders.map((o: any) => o.bot_type), ...lTrades.map((t: any) => t.bot_type)])];

    return {
      wallet_address: w.wallet_address,
      display_address: `${w.wallet_address.slice(0, 4)}...${w.wallet_address.slice(-4)}`,
      sol_balance: w.sol_balance,
      pnl_sol: totalPnl,
      pnl_percent: 10 > 0 ? (totalPnl / 10) * 100 : 0,
      avg_trade_pnl: avgPnlPercent,
      total_trades: totalTrades,
      win_rate: winRate,
      bot_types: botTypes,
      joined: w.created_at,
    };
  });

  // Sort by P&L descending
  leaderboard.sort((a: any, b: any) => b.pnl_sol - a.pnl_sol);

  return leaderboard.slice(0, limit);
}
