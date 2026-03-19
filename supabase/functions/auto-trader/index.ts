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

      // 1. Fetch live prices for all holdings
      const mints = holdings.map(h => h.mint);
      let livePrices: Record<string, number> = {};
      if (birdeyeKey && mints.length > 0) {
        livePrices = await fetchLivePrices(mints, birdeyeKey);
      }
      
      // Update holdings with prices
      for (const h of holdings) {
        if (livePrices[h.mint]) h.price = livePrices[h.mint];
      }

      // 2. Record entry prices for new tokens & update peaks
      for (const h of holdings) {
        // If we still have no price, we can't track P&L, but we can still track the token exists
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
            if (pnl >= scalperTarget) { shouldSell = true; reason = `Scalper: ${h.symbol} at +${pnl.toFixed(1)}% (target: +${scalperTarget}%)`; }
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

    // ═══ Execution Phase (Processing Pending Trades) ═══
    const platformPrivateKey = Deno.env.get('PLATFORM_WALLET_PRIVATE_KEY');
    if (platformPrivateKey) {
      console.log('--- Starting Autonomous Execution Phase ---');
      const { data: pendingTrades } = await supabase
        .from('pending_auto_trades')
        .select('*')
        .eq('status', 'pending')
        .limit(10); // Process a few at a time

      if (pendingTrades && pendingTrades.length > 0) {
        // Load Solana tools dynamically for execution
        const { Connection, Keypair, VersionedTransaction } = await import("npm:@solana/web3.js@1.95.3");
        const bs58 = (await import("npm:bs58@5.0.0")).default;
        
        const platformKeypair = Keypair.fromSecretKey(bs58.decode(platformPrivateKey));
        const jupiterApiKey = Deno.env.get("JUPITER_API_KEY");
        const heliusKey = Deno.env.get("HELIUS_API_KEY");

        for (const trade of pendingTrades) {
          try {
            // Check user budget
            const { data: budget } = await supabase
              .from('auto_trade_budgets')
              .select('*')
              .eq('wallet_address', trade.wallet_address)
              .eq('budget_mode', 'deposit')
              .eq('is_active', true)
              .single();

            if (!budget) {
              console.log(`Skipping trade for ${trade.wallet_address} — No active deposit budget`);
              continue;
            }

            // Estimate trade value in SOL/USDC
            const tradeValue = trade.side === 'buy' ? parseFloat(trade.amount_raw) / 1e9 : (trade.current_price * parseFloat(trade.amount_raw) / Math.pow(10, trade.decimals));
            
            if (budget.remaining_amount < tradeValue) {
               console.log(`Insufficient budget for ${trade.wallet_address}: need ${tradeValue}, have ${budget.remaining_amount}`);
               continue;
            }

            console.log(`Executing ${trade.side} ${trade.token_symbol} for ${trade.wallet_address}...`);

            // 1. Get Order from Jupiter Ultra
            const inputMint = trade.side === 'buy' ? SOL_MINT : trade.token_mint;
            const outputMint = trade.side === 'buy' ? trade.token_mint : SOL_MINT;
            const orderUrl = `https://api.jup.ag/ultra/v1/order?inputMint=${inputMint}&outputMint=${outputMint}&amount=${trade.amount_raw}&taker=${platformKeypair.publicKey.toString()}&swapMode=ExactIn`;
            
            const orderRes = await fetch(orderUrl, {
              headers: jupiterApiKey ? { 'x-api-key': jupiterApiKey } : {}
            });

            if (!orderRes.ok) {
              console.error(`Jupiter Order failed: ${await orderRes.text()}`);
              continue;
            }

            const order = await orderRes.json();
            if (!order.transaction) continue;

            // 2. Sign Transaction
            const transactionBuf = Uint8Array.from(atob(order.transaction), c => c.charCodeAt(0));
            const transaction = VersionedTransaction.deserialize(transactionBuf);
            transaction.sign([platformKeypair]);
            const signedTxBase64 = btoa(String.fromCharCode.apply(null, Array.from(transaction.serialize())));

            // 3. Execute Transaction (Prefer Helius if available)
            let signature = '';
            if (heliusKey) {
              const heliusRes = await fetch(`https://sender.helius-rpc.com/fast?api-key=${heliusKey}`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  jsonrpc: "2.0",
                  id: order.requestId,
                  method: "sendTransaction",
                  params: [signedTxBase64, { encoding: "base64", skipPreflight: true }]
                }),
              });
              const heliusData = await heliusRes.json();
              signature = heliusData.result;
            } else {
              const execRes = await fetch("https://api.jup.ag/ultra/v1/execute", {
                method: "POST",
                headers: { 
                  "Content-Type": "application/json",
                  ...(jupiterApiKey ? { 'x-api-key': jupiterApiKey } : {})
                },
                body: JSON.stringify({ signedTransaction: signedTxBase64, requestId: order.requestId }),
              });
              const execData = await execRes.json();
              signature = execData.signature;
            }

            if (signature) {
              console.log(`Trade executed! Signature: ${signature}`);
              
              // 4. Update Database
              const newSpent = budget.spent_amount + tradeValue;
              const newRemaining = budget.remaining_amount - tradeValue;

              await supabase.from('auto_trade_budgets')
                .update({ spent_amount: newSpent, remaining_amount: newRemaining, updated_at: new Date().toISOString() })
                .eq('id', budget.id);

              await supabase.from('pending_auto_trades')
                .update({ status: 'executed', tx_signature: signature, executed_at: new Date().toISOString() })
                .eq('id', trade.id);

              // Log to live_trades
              await supabase.from('live_trades').insert({
                wallet_address: trade.wallet_address,
                tx_signature: signature,
                input_mint: inputMint,
                output_mint: outputMint,
                input_amount: trade.side === 'buy' ? tradeValue : parseFloat(trade.amount_raw) / Math.pow(10, trade.decimals),
                output_amount: trade.side === 'buy' ? 0 : tradeValue, // Approx for output
                status: 'success',
                trade_type: 'auto',
                bot_type: trade.strategy,
              });
            }
          } catch (tradeErr) {
            console.error(`Failed to execute trade ${trade.id}:`, tradeErr);
          }
        }
      }
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

  const rpcUrl = `https://mainnet.helius-rpc.com/?api-key=${heliusKey}`;
  const TOKEN_PROGRAM = "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA";
  const TOKEN_2022_PROGRAM = "TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb";

  try {
    const [tokenRes, token2022Res] = await Promise.all([
      fetch(rpcUrl, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          jsonrpc: "2.0", id: 1, method: "getTokenAccountsByOwner",
          params: [walletAddress, { programId: TOKEN_PROGRAM }, { encoding: "jsonParsed" }],
        }),
      }),
      fetch(rpcUrl, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          jsonrpc: "2.0", id: 2, method: "getTokenAccountsByOwner",
          params: [walletAddress, { programId: TOKEN_2022_PROGRAM }, { encoding: "jsonParsed" }],
        }),
      }),
    ]);

    const t1 = await tokenRes.json();
    const t2 = await token2022Res.json();

    const parse = (data: any) => {
      const accounts = data.result?.value || [];
      return accounts.map((acc: any) => {
        const info = acc.account?.data?.parsed?.info;
        if (!info) return null;
        const amount = parseFloat(info.tokenAmount?.uiAmountString || "0");
        if (amount <= 0.000001) return null; // Filter dust
        return {
          mint: info.mint,
          symbol: info.mint.slice(0, 6),
          amount,
          decimals: info.tokenAmount?.decimals || 0,
          price: 0,
        };
      }).filter(Boolean);
    };

    const holdings = [...parse(t1), ...parse(t2)];
    
    // Deduplicate
    const map = new Map<string, RealHolding>();
    for (const h of holdings) {
      if (map.has(h.mint)) {
        map.get(h.mint)!.amount += h.amount;
      } else {
        map.set(h.mint, h);
      }
    }
    return Array.from(map.values());
  } catch (e) {
    console.error('fetchRealHoldings error:', e);
    return [];
  }
}

async function fetchLivePrices(mints: string[], apiKey: string): Promise<Record<string, number>> {
  const prices: Record<string, number> = {};
  if (mints.length === 0) return prices;

  // 1. Try Birdeye if API key provided
  if (apiKey) {
    try {
      const list = mints.join(',');
      const response = await fetch(
        `https://public-api.birdeye.so/defi/multi_price?list_address=${list}`,
        { headers: { 'X-API-KEY': apiKey, 'x-chain': 'solana' } }
      );
      if (response.ok) {
        const result = await response.json();
        for (const [mint, data] of Object.entries(result.data || {})) {
          const val = (data as any)?.value;
          if (val) prices[mint] = val;
        }
      }
    } catch (e) { console.error('Birdeye fetch error:', e); }
  }

  // 2. Jupiter Price API Fallback for missing prices
  const remainingMints = mints.filter(m => !prices[m]);
  if (remainingMints.length > 0) {
    try {
      // Process in batches of 50
      for (let i = 0; i < remainingMints.length; i += 50) {
        const batch = remainingMints.slice(i, i + 50);
        const res = await fetch(`https://api.jup.ag/price/v2?ids=${batch.join(',')}`);
        if (res.ok) {
          const data = await res.json();
          if (data?.data) {
            for (const [mint, info] of Object.entries(data.data)) {
              const p = (info as any)?.price;
              if (p) prices[mint] = parseFloat(String(p));
            }
          }
        }
      }
    } catch (e) { console.error('Jupiter price fallback error:', e); }
  }

  return prices;
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
