import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.93.3";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

const SOL_MINT = "So11111111111111111111111111111111111111112";

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const heliusKey = Deno.env.get('HELIUS_API_KEY');
  const birdeyeKey = Deno.env.get('BIRDEYE_API_KEY');
  const supabase = createClient(supabaseUrl, supabaseKey);

  try {
    const { data: configs, error } = await supabase
      .from('sim_bot_configs')
      .select('*')
      .eq('bot_type', 'auto')
      .eq('is_active', true);

    if (error) throw new Error(error.message);
    if (!configs || configs.length === 0) {
      return jsonResponse({ success: true, data: { processed: 0, reason: 'no active configs' } });
    }

    let processed = 0;
    let queued = 0;

    for (const config of configs) {
      const walletAddress = config.wallet_address;
      const strategies: string[] = (config.config as any)?.strategies || [];
      const isBeachMode = (config.config as any)?.beachMode === true;
      const maxBudget = (config.config as any)?.maxBudget || 1.0;
      const launchMinLiquidity = (config.config as any)?.launchMinLiquidity || 100;
      const launchMaxAge = (config.config as any)?.launchMaxAge || 30;
      const safeExitStopLoss = (config.config as any)?.safeExitStopLoss || 15;
      const safeExitTakeProfit = (config.config as any)?.safeExitTakeProfit || 50;
      const scalperTarget = (config.config as any)?.scalperTarget || 3;

      if (!isBeachMode) {
        console.log(`Skipping ${walletAddress} — beachMode not enabled`);
        continue;
      }

      if (strategies.length === 0) continue;

      // Filter to strategies we can handle server-side
      const supportedStrategies = strategies.filter(
        s => s === 'safe_exit' || s === 'scalper' || s === 'momentum' || s === 'dip_buy' || s === 'new_launch'
      );
      if (supportedStrategies.length === 0) continue;

      // Fetch REAL wallet holdings via Helius DAS
      const holdings = await fetchRealHoldings(walletAddress, heliusKey);
      console.log(`Found ${holdings.length} real token(s) for ${walletAddress}`);

      // Get/create entry prices
      const { data: entryPriceRows } = await supabase
        .from('auto_trade_entry_prices')
        .select('*')
        .eq('wallet_address', walletAddress);

      const entryPriceMap = new Map<string, number>();
      const peakPriceMap = new Map<string, number>();
      for (const ep of (entryPriceRows || [])) {
        entryPriceMap.set(ep.token_mint, Number(ep.entry_price));
        if (ep.peak_price) peakPriceMap.set(ep.token_mint, Number(ep.peak_price));
      }

      // Record entry prices for new tokens & update peaks
      for (const h of holdings) {
        if (h.price <= 0) continue;

        if (!entryPriceMap.has(h.mint)) {
          entryPriceMap.set(h.mint, h.price);
          await supabase.from('auto_trade_entry_prices').upsert({
            wallet_address: walletAddress,
            token_mint: h.mint,
            entry_price: h.price,
            peak_price: h.price,
          }, { onConflict: 'wallet_address,token_mint' });
        }

        // Update peak price
        const currentPeak = peakPriceMap.get(h.mint) || 0;
        if (h.price > currentPeak) {
          peakPriceMap.set(h.mint, h.price);
          await supabase.from('auto_trade_entry_prices')
            .update({ peak_price: h.price })
            .eq('wallet_address', walletAddress)
            .eq('token_mint', h.mint);
        }
      }

      // Fetch live prices
      const mints = holdings.map(h => h.mint);
      let livePrices: Record<string, number> = {};
      if (birdeyeKey && mints.length > 0) {
        livePrices = await fetchLivePrices(mints, birdeyeKey);
      }
      // Fallback to DAS prices
      for (const h of holdings) {
        if (!livePrices[h.mint] && h.price > 0) livePrices[h.mint] = h.price;
      }

      // ═══ Evaluate SELL strategies ═══
      for (const strategy of supportedStrategies) {
        if (strategy === 'dip_buy') continue; // handled separately below

        for (const h of holdings) {
          const livePrice = livePrices[h.mint];
          if (!livePrice || livePrice <= 0) continue;

          const entryPrice = entryPriceMap.get(h.mint);
          if (!entryPrice) continue;

          const pnl = ((livePrice - entryPrice) / entryPrice) * 100;
          let shouldSell = false;
          let reason = '';

          if (strategy === 'safe_exit') {
            if (pnl <= -15) { shouldSell = true; reason = `Stop-Loss: ${h.symbol} at ${pnl.toFixed(1)}%`; }
            else if (pnl >= 50) { shouldSell = true; reason = `Take-Profit: ${h.symbol} at +${pnl.toFixed(1)}%`; }
          } else if (strategy === 'scalper') {
            if (pnl >= 3) { shouldSell = true; reason = `Scalper: ${h.symbol} at +${pnl.toFixed(1)}%`; }
          } else if (strategy === 'momentum') {
            const peak = peakPriceMap.get(h.mint) || livePrice;
            const dropFromPeak = peak > 0 ? ((livePrice - peak) / peak) * 100 : 0;

            if (dropFromPeak <= -5 && pnl > 0) {
              shouldSell = true;
              reason = `Momentum Sell: ${h.symbol} ${dropFromPeak.toFixed(1)}% from peak (P&L: +${pnl.toFixed(1)}%)`;
            } else if (dropFromPeak <= -10) {
              shouldSell = true;
              reason = `Momentum Emergency: ${h.symbol} ${dropFromPeak.toFixed(1)}% crash`;
            }
          }

          if (shouldSell) {
            queued += await queueTrade(supabase, {
              walletAddress,
              tokenMint: h.mint,
              tokenSymbol: h.symbol,
              side: 'sell',
              amountRaw: Math.floor(h.amount * Math.pow(10, h.decimals)).toString(),
              decimals: h.decimals,
              strategy,
              reason,
              entryPrice,
              currentPrice: livePrice,
              pnl,
            });
          }
        }
      }

      // ═══ Evaluate DIP BUY strategy ═══
      if (supportedStrategies.includes('dip_buy') && birdeyeKey) {
        try {
          const trending = await fetchTrendingTokens(birdeyeKey);
          const ownedMints = new Set(holdings.map(h => h.mint));

          // Find tokens that dipped >20% in 1h with partial recovery
          const dipCandidates = trending.filter(t =>
            t.priceChange1h <= -20 &&
            t.priceChange1h > -25 &&
            !ownedMints.has(t.mint)
          );

          if (dipCandidates.length > 0) {
            // Best candidate = closest to recovery
            const best = dipCandidates.sort((a, b) => b.priceChange1h - a.priceChange1h)[0];
            const solLamports = Math.floor(maxBudget * 1e9).toString();

            queued += await queueTrade(supabase, {
              walletAddress,
              tokenMint: best.mint,
              tokenSymbol: best.symbol,
              side: 'buy',
              amountRaw: solLamports,
              decimals: 9, // SOL decimals for buy
              strategy: 'dip_buy',
              reason: `Dip Buy: ${best.symbol} (${best.priceChange1h.toFixed(1)}% dip)`,
              entryPrice: 0,
              currentPrice: best.price,
              pnl: best.priceChange1h,
            });
          }
        } catch (e) {
          console.error(`Dip buy eval error for ${walletAddress}:`, e);
        }
      }

      // ═══ Evaluate NEW LAUNCH HUNTER strategy ═══
      if (supportedStrategies.includes('new_launch')) {
        try {
          const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
          const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY') || Deno.env.get('SUPABASE_PUBLISHABLE_KEY') || '';
          
          const launchResp = await fetch(`${supabaseUrl}/functions/v1/pumpfun-api`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${supabaseAnonKey}`,
            },
            body: JSON.stringify({ action: 'new_launches', limit: 10 }),
          });

          if (launchResp.ok) {
            const launchData = await launchResp.json();
            const launches = launchData?.tokens || [];
            const now = Date.now();
            const ownedMints = new Set(holdings.map(h => h.mint));

            const candidates = launches.filter((t: any) => {
              const ageSeconds = t.pairCreatedAt ? Math.floor((now - t.pairCreatedAt) / 1000) : 999;
              return ageSeconds <= launchMaxAge && (t.liquidity || 0) >= launchMinLiquidity && !ownedMints.has(t.address);
            });

            if (candidates.length > 0) {
              const target = candidates[0];
              const solLamports = Math.floor(maxBudget * 1e9).toString();
              const ageSeconds = target.pairCreatedAt ? Math.floor((now - target.pairCreatedAt) / 1000) : 0;

              queued += await queueTrade(supabase, {
                walletAddress,
                tokenMint: target.address,
                tokenSymbol: target.symbol || target.address.slice(0, 6),
                side: 'buy',
                amountRaw: solLamports,
                decimals: 9,
                strategy: 'new_launch',
                reason: `Launch Snipe: ${target.symbol} (${ageSeconds}s old, $${(target.liquidity || 0).toFixed(0)} liq)`,
                entryPrice: 0,
                currentPrice: target.price || 0,
                pnl: 0,
              });
            }
          }
        } catch (e) {
          console.error(`New launch eval error for ${walletAddress}:`, e);
        }
      }

      processed++;
    }

    return jsonResponse({ success: true, data: { processed, queued } });
  } catch (error: unknown) {
    console.error('auto-trader error:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    return new Response(JSON.stringify({ success: false, error: message }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});

// ═══ Helper functions ═══

function jsonResponse(data: any, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

interface QueueTradeParams {
  walletAddress: string;
  tokenMint: string;
  tokenSymbol: string;
  side: 'buy' | 'sell';
  amountRaw: string;
  decimals: number;
  strategy: string;
  reason: string;
  entryPrice: number;
  currentPrice: number;
  pnl: number;
}

async function queueTrade(supabase: any, params: QueueTradeParams): Promise<number> {
  // Check for existing pending trade for this token + strategy
  const { data: existing } = await supabase
    .from('pending_auto_trades')
    .select('id')
    .eq('wallet_address', params.walletAddress)
    .eq('token_mint', params.tokenMint)
    .eq('strategy', params.strategy)
    .eq('status', 'pending')
    .limit(1);

  if (existing && existing.length > 0) {
    console.log(`Already pending ${params.strategy} trade for ${params.tokenSymbol} — skipping`);
    return 0;
  }

  await supabase.from('pending_auto_trades').insert({
    wallet_address: params.walletAddress,
    token_mint: params.tokenMint,
    token_symbol: params.tokenSymbol,
    side: params.side,
    amount_raw: params.amountRaw,
    decimals: params.decimals,
    strategy: params.strategy,
    reason: params.reason,
    entry_price: params.entryPrice,
    current_price: params.currentPrice,
    pnl_percent: params.pnl,
    status: 'pending',
  });

  console.log(`📋 Queued ${params.reason} for ${params.walletAddress}`);
  return 1;
}

interface RealHolding {
  mint: string;
  symbol: string;
  amount: number;
  decimals: number;
  price: number;
}

async function fetchRealHoldings(walletAddress: string, heliusKey: string | undefined): Promise<RealHolding[]> {
  if (!heliusKey) return [];

  try {
    const rpcUrl = `https://mainnet.helius-rpc.com/?api-key=${heliusKey}`;
    const tokensRes = await fetch(rpcUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 'tokens',
        method: 'searchAssets',
        params: {
          ownerAddress: walletAddress,
          tokenType: 'fungible',
          displayOptions: { showFungible: true },
        },
      }),
    });

    const tokensData = await tokensRes.json();
    const items = tokensData?.result?.items || [];
    const holdings: RealHolding[] = [];

    for (const item of items) {
      const tokenInfo = item.token_info;
      if (!tokenInfo || !item.id || item.id === SOL_MINT) continue;

      const balance = tokenInfo.balance || 0;
      const decimals = tokenInfo.decimals || 6;
      const amount = balance / Math.pow(10, decimals);
      const price = tokenInfo.price_info?.price_per_token || 0;

      if (amount <= 0) continue;
      holdings.push({ mint: item.id, symbol: tokenInfo.symbol || item.id.slice(0, 6), amount, decimals, price });
    }

    return holdings;
  } catch (e) {
    console.error('fetchRealHoldings error:', e);
    return [];
  }
}

async function fetchLivePrices(mints: string[], apiKey: string): Promise<Record<string, number>> {
  try {
    const list = mints.join(',');
    const response = await fetch(
      `https://public-api.birdeye.so/defi/multi_price?list_address=${list}`,
      { headers: { 'X-API-KEY': apiKey, 'x-chain': 'solana' } }
    );
    if (!response.ok) return {};
    const result = await response.json();
    const prices: Record<string, number> = {};
    for (const [mint, data] of Object.entries(result.data || {})) {
      prices[mint] = (data as any)?.value || 0;
    }
    return prices;
  } catch {
    return {};
  }
}

interface TrendingToken {
  mint: string;
  symbol: string;
  price: number;
  priceChange1h: number;
}

async function fetchTrendingTokens(apiKey: string): Promise<TrendingToken[]> {
  try {
    // Use Birdeye token list sorted by 1h price change
    const response = await fetch(
      'https://public-api.birdeye.so/defi/token_trending?sort_by=price_change_1h_percent&sort_type=asc&offset=0&limit=20',
      { headers: { 'X-API-KEY': apiKey, 'x-chain': 'solana' } }
    );
    if (!response.ok) return [];
    const result = await response.json();
    const tokens = result.data?.tokens || result.data?.items || [];

    return tokens
      .filter((t: any) => t.address && t.price > 0)
      .map((t: any) => ({
        mint: t.address,
        symbol: t.symbol || t.address.slice(0, 6),
        price: t.price || 0,
        priceChange1h: t.price_change_1h_percent || t.priceChange1h || 0,
      }));
  } catch (e) {
    console.error('fetchTrendingTokens error:', e);
    return [];
  }
}
