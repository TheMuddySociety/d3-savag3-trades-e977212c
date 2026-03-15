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
    // Get all active auto configs with beachMode enabled
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

      // Only process Beach Mode configs (background execution)
      if (!isBeachMode) {
        console.log(`Skipping ${walletAddress} — beachMode not enabled`);
        continue;
      }

      if (strategies.length === 0) continue;

      // Only process sell strategies (safe_exit, scalper) — these are the ones that work server-side
      const sellStrategies = strategies.filter(s => s === 'safe_exit' || s === 'scalper');
      if (sellStrategies.length === 0) {
        console.log(`Skipping ${walletAddress} — no sell strategies active`);
        continue;
      }

      // Fetch REAL wallet holdings via Helius DAS
      const holdings = await fetchRealHoldings(walletAddress, heliusKey);
      if (holdings.length === 0) {
        console.log(`No token holdings for ${walletAddress}`);
        continue;
      }

      console.log(`Found ${holdings.length} real token(s) for ${walletAddress}`);

      // Get or create entry prices
      const { data: entryPriceRows } = await supabase
        .from('auto_trade_entry_prices')
        .select('*')
        .eq('wallet_address', walletAddress);

      const entryPriceMap = new Map<string, number>();
      for (const ep of (entryPriceRows || [])) {
        entryPriceMap.set(ep.token_mint, Number(ep.entry_price));
      }

      // Record entry prices for new tokens
      for (const h of holdings) {
        if (!entryPriceMap.has(h.mint) && h.price > 0) {
          entryPriceMap.set(h.mint, h.price);
          await supabase.from('auto_trade_entry_prices').upsert({
            wallet_address: walletAddress,
            token_mint: h.mint,
            entry_price: h.price,
          }, { onConflict: 'wallet_address,token_mint' });
          console.log(`📌 Recorded entry for ${h.symbol}: $${h.price}`);
        }
      }

      // Fetch live prices via Birdeye
      const mints = holdings.map(h => h.mint);
      let livePrices: Record<string, number> = {};
      if (birdeyeKey) {
        livePrices = await fetchLivePrices(mints, birdeyeKey);
      } else {
        // Fallback to DAS prices
        for (const h of holdings) {
          if (h.price > 0) livePrices[h.mint] = h.price;
        }
      }

      // Evaluate strategies
      for (const strategy of sellStrategies) {
        for (const h of holdings) {
          const entryPrice = entryPriceMap.get(h.mint);
          const livePrice = livePrices[h.mint];
          if (!entryPrice || !livePrice || livePrice <= 0) continue;

          const pnl = ((livePrice - entryPrice) / entryPrice) * 100;
          let shouldSell = false;
          let reason = '';

          if (strategy === 'safe_exit') {
            if (pnl <= -15) {
              shouldSell = true;
              reason = `Stop-Loss: ${h.symbol} at ${pnl.toFixed(1)}%`;
            } else if (pnl >= 50) {
              shouldSell = true;
              reason = `Take-Profit: ${h.symbol} at +${pnl.toFixed(1)}%`;
            }
          } else if (strategy === 'scalper') {
            if (pnl >= 3) {
              shouldSell = true;
              reason = `Scalper: ${h.symbol} at +${pnl.toFixed(1)}%`;
            }
          }

          if (shouldSell) {
            // Check for existing pending trade for this token
            const { data: existing } = await supabase
              .from('pending_auto_trades')
              .select('id')
              .eq('wallet_address', walletAddress)
              .eq('token_mint', h.mint)
              .eq('status', 'pending')
              .limit(1);

            if (existing && existing.length > 0) {
              console.log(`Already pending trade for ${h.symbol} — skipping`);
              continue;
            }

            // Calculate raw amount for full sell
            const rawAmount = Math.floor(h.amount * Math.pow(10, h.decimals)).toString();

            // Queue the trade
            await supabase.from('pending_auto_trades').insert({
              wallet_address: walletAddress,
              token_mint: h.mint,
              token_symbol: h.symbol,
              side: 'sell',
              amount_raw: rawAmount,
              decimals: h.decimals,
              strategy,
              reason,
              entry_price: entryPrice,
              current_price: livePrice,
              pnl_percent: pnl,
              status: 'pending',
            });

            console.log(`📋 Queued ${reason} for ${walletAddress}`);
            queued++;
          }
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

function jsonResponse(data: any, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

interface RealHolding {
  mint: string;
  symbol: string;
  amount: number;
  decimals: number;
  price: number;
}

async function fetchRealHoldings(walletAddress: string, heliusKey: string | undefined): Promise<RealHolding[]> {
  if (!heliusKey) {
    console.warn('No HELIUS_API_KEY — cannot fetch real holdings');
    return [];
  }

  try {
    const rpcUrl = `https://mainnet.helius-rpc.com/?api-key=${heliusKey}`;

    // Get all token accounts
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
      if (!tokenInfo || !item.id) continue;
      if (item.id === SOL_MINT) continue; // Skip native SOL

      const balance = tokenInfo.balance || 0;
      const decimals = tokenInfo.decimals || 6;
      const amount = balance / Math.pow(10, decimals);
      const pricePerToken = tokenInfo.price_info?.price_per_token || 0;

      if (amount <= 0) continue;

      holdings.push({
        mint: item.id,
        symbol: tokenInfo.symbol || item.id.slice(0, 6),
        amount,
        decimals,
        price: pricePerToken,
      });
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
    if (!response.ok) throw new Error(`Birdeye price fetch failed: ${response.status}`);
    const result = await response.json();
    const prices: Record<string, number> = {};
    for (const [mint, data] of Object.entries(result.data || {})) {
      prices[mint] = (data as any)?.value || 0;
    }
    return prices;
  } catch (e) {
    console.error('fetchLivePrices error:', e);
    return {};
  }
}
