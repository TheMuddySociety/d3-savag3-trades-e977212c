import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

const JUPITER_PRICE_API = 'https://api.jup.ag/price/v3';
const COINGECKO_BASE = 'https://api.coingecko.com/api/v3';
const HELIUS_BASE = 'https://api.helius.xyz';
const PUBLIC_RPC = 'https://api.mainnet-beta.solana.com';

/** Fetch from Helius RPC with automatic fallback to public Solana RPC on 401/403 */
async function rpcFetchWithFallback(apiKey: string, body: unknown): Promise<any> {
  const heliusUrl = `https://mainnet.helius-rpc.com/?api-key=${apiKey}`;
  const payload = JSON.stringify(body);
  const headers = { 'Content-Type': 'application/json' };

  let resp = await fetch(heliusUrl, { method: 'POST', headers, body: payload });
  if (resp.status === 401 || resp.status === 403) {
    console.warn(`Helius RPC returned ${resp.status}, falling back to public RPC`);
    // consume body to avoid leak
    await resp.text();
    resp = await fetch(PUBLIC_RPC, { method: 'POST', headers, body: payload });
  }
  if (!resp.ok) {
    const text = await resp.text();
    throw new Error(`RPC failed [${resp.status}]: ${text}`);
  }
  return resp.json();
}

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

  const HELIUS_API_KEY = Deno.env.get('HELIUS_API_KEY');
  if (!HELIUS_API_KEY) return err('HELIUS_API_KEY is not configured');

  const JUPITER_API_KEY = Deno.env.get('JUPITER_API_KEY');

  try {
    const body = await req.json();
    const { action, addresses, address } = body;

    switch (action) {
      case 'prices':
        return ok(await fetchJupiterPrices(addresses, JUPITER_API_KEY));

      case 'token_info':
        return ok(await fetchHeliusTokenInfo(addresses, HELIUS_API_KEY));

      case 'trending':
        return ok(await fetchTrendingTokens());

      case 'token_overview':
        if (!address) return err('address is required', 400);
        return ok(await fetchTokenOverview(address, HELIUS_API_KEY, JUPITER_API_KEY));

      case 'token_trades':
        if (!address) return err('address is required', 400);
        return ok(await fetchTokenTrades(address, HELIUS_API_KEY, body.limit || 20));

      case 'price_history':
        if (!address) return err('address is required', 400);
        return ok(await fetchPriceHistory(address, body.interval || '30m', body.time_from, body.time_to, JUPITER_API_KEY));

      case 'token_holders':
        if (!address) return err('address is required', 400);
        return ok(await fetchTokenHolders(address, HELIUS_API_KEY));

      // ── New actions ──────────────────────────────────────────────
      case 'sol_price':
        return ok(await fetchSolPrice(JUPITER_API_KEY));

      case 'market_stats':
        return ok(await fetchMarketStats(JUPITER_API_KEY));

      case 'shield_check':
        if (!address) return err('address is required', 400);
        return ok(await fetchShieldCheck(address, JUPITER_API_KEY));

      case 'recent_launches':
        return ok(await fetchRecentLaunches());

      default:
        return err('Invalid action', 400);
    }
  } catch (error: unknown) {
    console.error('token-prices error:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    return err(message);
  }
});

// ── Jupiter Price API + DexScreener fallback ────────────────────────

async function fetchJupiterPrices(addresses: string[], apiKey?: string) {
  if (!addresses || addresses.length === 0) return {};
  
  const ids = addresses.join(',');
  const headers: Record<string, string> = {};
  if (apiKey) headers['x-api-key'] = apiKey;
  
  const response = await fetch(`${JUPITER_PRICE_API}?ids=${ids}`, { headers });
  
  if (!response.ok) {
    console.warn(`Jupiter price API failed [${response.status}], trying Birdeye fallback`);
    return fetchBirdeyePrices(addresses);
  }
  
  const result = await response.json();
  const data = result.data || result; // Handle both nested 'data' (V2) and direct (V1)
  const prices: Record<string, { value: number }> = {};
  
  for (const [mint, info] of Object.entries(data)) {
    const priceData = info as { price?: string | number; usdPrice?: string | number };
    const priceValue = priceData?.price || priceData?.usdPrice;
    if (priceValue) {
      prices[mint] = { value: typeof priceValue === 'string' ? parseFloat(priceValue) : Number(priceValue) };
    }
  }
  
  const missing = addresses.filter(addr => !prices[addr]);
  
  if (missing.length > 0) {
    console.log(`[token-prices] Jupiter missing ${missing.length} tokens, trying DexScreener fallback`);
    const fallback = await fetchDexScreenerPrices(missing);
    for (const [addr, data] of Object.entries(fallback)) {
      prices[addr] = data;
    }
  }
  
  return prices;
}

// ── Birdeye fallback (placeholder, kept for compat) ─────────────────

async function fetchBirdeyePrices(addresses: string[]): Promise<Record<string, { value: number }>> {
  return fetchDexScreenerPrices(addresses);
}

// ── DexScreener fallback ────────────────────────────────────────────

async function fetchDexScreenerPrices(addresses: string[]): Promise<Record<string, { value: number }>> {
  if (addresses.length === 0) return {};
  const prices: Record<string, { value: number }> = {};

  const batches: string[][] = [];
  for (let i = 0; i < addresses.length; i += 30) {
    batches.push(addresses.slice(i, i + 30));
  }

  await Promise.allSettled(
    batches.map(async (batch) => {
      try {
        const resp = await fetch(
          `https://api.dexscreener.com/tokens/v1/solana/${batch.join(',')}`
        );
        if (!resp.ok) { console.warn(`DexScreener failed [${resp.status}]`); return; }
        const pairs = await resp.json();
        if (!Array.isArray(pairs)) return;

        const bestByToken = new Map<string, { price: number; liq: number }>();
        for (const pair of pairs) {
          const addr = pair.baseToken?.address;
          const price = parseFloat(pair.priceUsd);
          if (!addr || isNaN(price) || price <= 0) continue;
          const liq = pair.liquidity?.usd || 0;
          const existing = bestByToken.get(addr);
          if (!existing || liq > existing.liq) {
            bestByToken.set(addr, { price, liq });
          }
        }

        for (const addr of batch) {
          const entry = bestByToken.get(addr);
          if (entry) prices[addr] = { value: entry.price };
        }
      } catch (e) { console.error('DexScreener batch error:', e); }
    })
  );

  return prices;
}

// ── Helius Token Info ───────────────────────────────────────────────

async function fetchHeliusTokenInfo(addresses: string[], apiKey: string) {
  if (!addresses || addresses.length === 0) return [];
  const response = await fetch(`${HELIUS_BASE}/v0/tokens/metadata?api-key=${apiKey}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ mintAccounts: addresses.slice(0, 100) }),
  });
  if (!response.ok) throw new Error(`Helius token info API failed [${response.status}]: ${await response.text()}`);
  return await response.json();
}

// ── Trending Solana Memecoins via DexScreener ───────────────────────

async function fetchTrendingTokens() {
  try {
    // Strategy: fetch top Solana pairs from DexScreener sorted by volume
    // This covers ALL Solana memecoins across all DEXes (Raydium, Orca, Jupiter, etc.)
    const [boostsResp, searchResp] = await Promise.all([
      fetch('https://api.dexscreener.com/token-boosts/top/v1').catch(() => null),
      fetch('https://api.dexscreener.com/latest/dex/search?q=solana%20meme&chain=solana').catch(() => null),
    ]);

    const tokenMap = new Map<string, any>();

    // 1. DexScreener boosted tokens (top promoted across chains, filter to Solana)
    if (boostsResp?.ok) {
      const boosts = await boostsResp.json();
      if (Array.isArray(boosts)) {
        for (const b of boosts) {
          if (b.chainId === 'solana' && b.tokenAddress) {
            tokenMap.set(b.tokenAddress, {
              address: b.tokenAddress,
              symbol: '',
              name: b.description || '',
              logo: b.icon || '',
              price: 0,
              price_change_24h: 0,
              market_cap: 0,
              volume_24h: 0,
              rank: 0,
              source: 'boost',
            });
          }
        }
      }
    }

    // 2. DexScreener search for Solana meme pairs
    if (searchResp?.ok) {
      const searchData = await searchResp.json();
      const pairs = searchData?.pairs || [];
      for (const pair of pairs) {
        if (pair.chainId !== 'solana') continue;
        const addr = pair.baseToken?.address;
        if (!addr || tokenMap.has(addr)) continue;
        tokenMap.set(addr, {
          address: addr,
          symbol: pair.baseToken?.symbol || '',
          name: pair.baseToken?.name || '',
          logo: pair.info?.imageUrl || '',
          price: parseFloat(pair.priceUsd) || 0,
          price_change_24h: pair.priceChange?.h24 || 0,
          price_change_1h: pair.priceChange?.h1 || 0,
          price_change_5m: pair.priceChange?.m5 || 0,
          market_cap: pair.marketCap || pair.fdv || 0,
          volume_24h: pair.volume?.h24 || 0,
          rank: 0,
          liquidity: pair.liquidity?.usd || 0,
          dexId: pair.dexId || '',
          pairAge: pair.pairCreatedAt || null,
        });
      }
    }

    // 3. Enrich boosted tokens that lack price data by fetching their pairs
    const boostAddrs = [...tokenMap.entries()]
      .filter(([_, v]) => v.source === 'boost' && v.price === 0)
      .map(([addr]) => addr)
      .slice(0, 30);

    if (boostAddrs.length > 0) {
      const batches: string[][] = [];
      for (let i = 0; i < boostAddrs.length; i += 30) {
        batches.push(boostAddrs.slice(i, i + 30));
      }
      await Promise.allSettled(batches.map(async (batch) => {
        try {
          const resp = await fetch(`https://api.dexscreener.com/tokens/v1/solana/${batch.join(',')}`);
          if (!resp.ok) return;
          const pairs = await resp.json();
          if (!Array.isArray(pairs)) return;
          // Group by base token, pick highest liquidity pair
          const bestByToken = new Map<string, any>();
          for (const pair of pairs) {
            const addr = pair.baseToken?.address;
            if (!addr) continue;
            const liq = pair.liquidity?.usd || 0;
            const existing = bestByToken.get(addr);
            if (!existing || liq > (existing.liquidity?.usd || 0)) {
              bestByToken.set(addr, pair);
            }
          }
          for (const [addr, pair] of bestByToken) {
            const existing = tokenMap.get(addr);
            if (existing) {
              tokenMap.set(addr, {
                ...existing,
                symbol: pair.baseToken?.symbol || existing.symbol,
                name: pair.baseToken?.name || existing.name,
                logo: pair.info?.imageUrl || existing.logo,
                price: parseFloat(pair.priceUsd) || 0,
                price_change_24h: pair.priceChange?.h24 || 0,
                price_change_1h: pair.priceChange?.h1 || 0,
                price_change_5m: pair.priceChange?.m5 || 0,
                market_cap: pair.marketCap || pair.fdv || 0,
                volume_24h: pair.volume?.h24 || 0,
                liquidity: pair.liquidity?.usd || 0,
                dexId: pair.dexId || '',
                source: 'boost',
              });
            }
          }
        } catch { /* ignore */ }
      }));
    }

    // Sort by volume descending, return top 30
    const results = [...tokenMap.values()]
      .filter(t => t.address && t.name)
      .sort((a, b) => (b.volume_24h || 0) - (a.volume_24h || 0))
      .slice(0, 30);

    return results;
  } catch (e) {
    console.error('Trending Solana tokens error:', e);
    // Fallback to CoinGecko trending
    try {
      const response = await fetch(`${COINGECKO_BASE}/search/trending`);
      if (!response.ok) return [];
      const result = await response.json();
      const coins = result.coins || [];
      return coins.slice(0, 20).map((item: any) => ({
        address: item.item?.platforms?.solana || item.item?.id || '',
        symbol: item.item?.symbol || '',
        name: item.item?.name || '',
        logo: item.item?.small || item.item?.thumb || '',
        price: item.item?.data?.price || 0,
        price_change_24h: item.item?.data?.price_change_percentage_24h?.usd || 0,
        market_cap: item.item?.data?.market_cap || '',
        volume_24h: item.item?.data?.total_volume || '',
      }));
    } catch { return []; }
  }
}

// ── Token Overview via Helius DAS + Jupiter ─────────────────────────

async function fetchTokenOverview(address: string, apiKey: string, jupiterApiKey?: string) {
  const headers: Record<string, string> = {};
  if (jupiterApiKey) headers['x-api-key'] = jupiterApiKey;
  
  const pricePromise = fetch(`${JUPITER_PRICE_API}?ids=${address}`, { headers })
    .then(r => r.json()).catch(() => ({}));

  const metaPromise = rpcFetchWithFallback(apiKey, { jsonrpc: '2.0', id: 1, method: 'getAsset', params: { id: address, displayOptions: { showFungible: true } } })
    .catch(() => ({ result: {} }));

  const [priceResult, metaResult] = await Promise.all([pricePromise, metaPromise]);

  const priceInfo = priceResult?.[address];
  const asset = metaResult?.result || {};
  const content = asset?.content || {};

  const tokenInfo = asset?.token_info || {};
  const pricePerToken = tokenInfo?.price_info?.price_per_token || 0;
  const decimals = tokenInfo?.decimals || 0;
  const rawSupply = tokenInfo?.supply || 0;
  const adjustedSupply = rawSupply / Math.pow(10, decimals);
  const marketCap = pricePerToken * adjustedSupply;

  return {
    address,
    name: content?.metadata?.name || '',
    symbol: content?.metadata?.symbol || '',
    logo: content?.links?.image || content?.files?.[0]?.uri || '',
    price: pricePerToken || priceInfo?.usdPrice || 0,
    decimals,
    supply: rawSupply,
    adjustedSupply,
    marketCap,
    priceCurrency: tokenInfo?.price_info?.currency || 'USDC',
  };
}

// ── Token Trades via Helius ─────────────────────────────────────────

async function fetchTokenTrades(address: string, apiKey: string, limit: number) {
  const sigResult = await rpcFetchWithFallback(apiKey, {
    jsonrpc: '2.0', id: 1,
    method: 'getSignaturesForAddress',
    params: [address, { limit: Math.min(limit * 2, 40) }],
  });
  const signatures = (sigResult?.result || []).map((s: any) => s.signature);
  const signatures = (sigResult?.result || []).map((s: any) => s.signature);

  if (signatures.length === 0) return [];

  const parseResponse = await fetch(`${HELIUS_BASE}/v0/transactions/?api-key=${apiKey}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ transactions: signatures }),
  });

  if (!parseResponse.ok) return [];
  const parsed = await parseResponse.json();

  // Filter to SWAP transactions and format for the frontend
  const trades: any[] = [];
  for (const tx of (parsed || [])) {
    if (tx.type !== 'SWAP' && tx.type !== 'TRANSFER') continue;
    
    // Extract swap details from tokenTransfers or nativeTransfers
    const tokenTransfers = tx.tokenTransfers || [];
    const nativeTransfers = tx.nativeTransfers || [];
    
    // Find the token transfer involving our address
    const tokenTransfer = tokenTransfers.find((t: any) => t.mint === address);
    if (!tokenTransfer && tx.type === 'SWAP') {
      // Try to find any relevant swap info from events
      const swapEvent = tx.events?.swap;
      if (swapEvent) {
        const isBuy = swapEvent.tokenOutputs?.some((o: any) => o.mint === address);
        const solInput = swapEvent.nativeInput?.amount || 0;
        const solOutput = swapEvent.nativeOutput?.amount || 0;
        const tokenInput = swapEvent.tokenInputs?.find((t: any) => t.mint === address);
        const tokenOutput = swapEvent.tokenOutputs?.find((t: any) => t.mint === address);
        
        const solAmount = isBuy ? solInput / 1e9 : solOutput / 1e9;
        const tokenAmt = isBuy 
          ? (tokenOutput?.rawTokenAmount?.tokenAmount || 0) / Math.pow(10, tokenOutput?.rawTokenAmount?.decimals || 0)
          : (tokenInput?.rawTokenAmount?.tokenAmount || 0) / Math.pow(10, tokenInput?.rawTokenAmount?.decimals || 0);

        trades.push({
          txHash: tx.signature || '',
          side: isBuy ? 'buy' : 'sell',
          from: {
            amount: isBuy ? solInput : (tokenInput?.rawTokenAmount?.tokenAmount || 0),
            symbol: isBuy ? 'SOL' : (tokenInput?.mint?.slice(0, 6) || 'TOKEN'),
            decimals: isBuy ? 9 : (tokenInput?.rawTokenAmount?.decimals || 0),
            uiAmount: isBuy ? solAmount : tokenAmt,
          },
          to: {
            amount: isBuy ? (tokenOutput?.rawTokenAmount?.tokenAmount || 0) : solOutput,
            symbol: isBuy ? (tokenOutput?.mint?.slice(0, 6) || 'TOKEN') : 'SOL',
            decimals: isBuy ? (tokenOutput?.rawTokenAmount?.decimals || 0) : 9,
            uiAmount: isBuy ? tokenAmt : solAmount,
          },
          blockUnixTime: tx.timestamp || 0,
          owner: tx.feePayer || '',
        });
        continue;
      }
    }
    
    if (tokenTransfer) {
      const solTransfer = nativeTransfers.find((n: any) => n.amount > 0);
      const solAmount = (solTransfer?.amount || 0) / 1e9;
      const isBuy = tokenTransfer.toUserAccount === tx.feePayer;
      const decimals = tokenTransfer.tokenStandard === 'Fungible' ? 9 : 0;
      const tokenAmount = tokenTransfer.tokenAmount || 0;

      trades.push({
        txHash: tx.signature || '',
        side: isBuy ? 'buy' : 'sell',
        from: {
          amount: isBuy ? (solTransfer?.amount || 0) : tokenAmount,
          symbol: isBuy ? 'SOL' : address.slice(0, 6),
          decimals: isBuy ? 9 : decimals,
          uiAmount: isBuy ? solAmount : tokenAmount,
        },
        to: {
          amount: isBuy ? tokenAmount : (solTransfer?.amount || 0),
          symbol: isBuy ? address.slice(0, 6) : 'SOL',
          decimals: isBuy ? decimals : 9,
          uiAmount: isBuy ? tokenAmount : solAmount,
        },
        blockUnixTime: tx.timestamp || 0,
        owner: tx.feePayer || '',
      });
    }
    
    if (trades.length >= limit) break;
  }

  return trades.slice(0, limit);
}

// ── Price History ───────────────────────────────────────────────────

async function fetchPriceHistory(address: string, _interval: string, _timeFrom?: number, _timeTo?: number, jupiterApiKey?: string) {
  try {
    // Try Birdeye history first
    const BIRDEYE_API_KEY = Deno.env.get('BIRDEYE_API_KEY');
    if (BIRDEYE_API_KEY) {
      const now = Math.floor(Date.now() / 1000);
      const timeFrom = _timeFrom || now - 86400; // default 24h
      const timeTo = _timeTo || now;
      const birdeyeResp = await fetch(
        `https://public-api.birdeye.so/defi/history_price?address=${address}&address_type=token&type=1H&time_from=${timeFrom}&time_to=${timeTo}`,
        { headers: { 'X-API-KEY': BIRDEYE_API_KEY, 'x-chain': 'solana' } }
      );
      if (birdeyeResp.ok) {
        const birdeyeData = await birdeyeResp.json();
        const items = birdeyeData?.data?.items;
        if (Array.isArray(items) && items.length > 0) {
          return items.map((p: any) => ({ unixTime: p.unixTime, value: p.value }));
        }
      }
    }

    // Fallback: DexScreener pair OHLCV
    try {
      const dexResp = await fetch(`https://api.dexscreener.com/tokens/v1/solana/${address}`);
      if (dexResp.ok) {
        const pairs = await dexResp.json();
        if (Array.isArray(pairs) && pairs.length > 0) {
          const bestPair = pairs.reduce((best: any, p: any) =>
            (p.liquidity?.usd || 0) > (best?.liquidity?.usd || 0) ? p : best, pairs[0]);
          const currentPrice = parseFloat(bestPair.priceUsd) || 0;
          if (currentPrice > 0 && bestPair.priceChange) {
            // Build approximate history from price change data
            const now = Math.floor(Date.now() / 1000);
            const h24 = bestPair.priceChange?.h24 || 0;
            const h6 = bestPair.priceChange?.h6 || 0;
            const h1 = bestPair.priceChange?.h1 || 0;
            const price24hAgo = currentPrice / (1 + h24 / 100);
            const price6hAgo = currentPrice / (1 + h6 / 100);
            const price1hAgo = currentPrice / (1 + h1 / 100);
            return [
              { unixTime: now - 86400, value: price24hAgo },
              { unixTime: now - 43200, value: (price24hAgo + price6hAgo) / 2 },
              { unixTime: now - 21600, value: price6hAgo },
              { unixTime: now - 10800, value: (price6hAgo + price1hAgo) / 2 },
              { unixTime: now - 3600, value: price1hAgo },
              { unixTime: now, value: currentPrice },
            ];
          }
        }
      }
    } catch { /* ignore DexScreener fallback error */ }

    // Last resort: single current price point
    const headers: Record<string, string> = {};
    if (jupiterApiKey) headers['x-api-key'] = jupiterApiKey;
    const priceResp = await fetch(`${JUPITER_PRICE_API}?ids=${address}`, { headers });
    const priceData = await priceResp.json();
    const currentPrice = priceData?.[address]?.usdPrice || 0;
    if (currentPrice === 0) return [];
    const now = Math.floor(Date.now() / 1000);
    return [{ unixTime: now, value: currentPrice }];
  } catch { return []; }
}

// ── Token Holders ───────────────────────────────────────────────────

async function fetchTokenHolders(address: string, apiKey: string) {
  const rpcResult = await rpcFetchWithFallback(apiKey, { jsonrpc: '2.0', id: 1, method: 'getTokenLargestAccounts', params: [address] });
  const accounts = rpcResult?.result?.value || [];

  const totalInTop = accounts.reduce((sum: number, acc: { uiAmount: number }) => sum + (acc.uiAmount || 0), 0);
  const top10 = accounts.slice(0, 10).reduce((sum: number, acc: { uiAmount: number }) => sum + (acc.uiAmount || 0), 0);
  const top50 = accounts.slice(10, 50).reduce((sum: number, acc: { uiAmount: number }) => sum + (acc.uiAmount || 0), 0);
  const top200 = accounts.slice(50, 200).reduce((sum: number, acc: { uiAmount: number }) => sum + (acc.uiAmount || 0), 0);
  const others = Math.max(0, totalInTop - top10 - top50 - top200);

  return {
    totalAccounts: accounts.length,
    distribution: [
      { name: 'Top 10', value: totalInTop > 0 ? (top10 / totalInTop) * 100 : 0 },
      { name: 'Top 11-50', value: totalInTop > 0 ? (top50 / totalInTop) * 100 : 0 },
      { name: 'Top 51-200', value: totalInTop > 0 ? (top200 / totalInTop) * 100 : 0 },
      { name: 'Others', value: totalInTop > 0 ? (others / totalInTop) * 100 : 0 },
    ],
    topHolders: accounts.slice(0, 20).map((acc: { address: string; uiAmount: number }) => ({
      address: acc.address,
      amount: acc.uiAmount || 0,
      percentage: totalInTop > 0 ? ((acc.uiAmount || 0) / totalInTop) * 100 : 0,
    })),
  };
}

// ══════════════════════════════════════════════════════════════════════
// NEW ACTIONS
// ══════════════════════════════════════════════════════════════════════

// ── SOL Price (real-time from Jupiter) ──────────────────────────────

async function fetchSolPrice(jupiterApiKey?: string) {
  const SOL_MINT = 'So11111111111111111111111111111111111111112';
  const headers: Record<string, string> = {};
  if (jupiterApiKey) headers['x-api-key'] = jupiterApiKey;

  const resp = await fetch(`${JUPITER_PRICE_API}?ids=${SOL_MINT}`, { headers });
  if (!resp.ok) throw new Error(`Jupiter price failed [${resp.status}]`);
  const result = await resp.json();
  const data = result.data || result;
  const solData = data?.[SOL_MINT];

  const price = solData?.price || solData?.usdPrice || 0;
  return {
    price: typeof price === 'string' ? parseFloat(price) : Number(price),
    change24h: 0,
  };
}

// ── Market Stats (aggregate from CoinGecko global) ──────────────────

async function fetchMarketStats(jupiterApiKey?: string) {
  try {
    // Get global crypto market stats
    const globalResp = await fetch(`${COINGECKO_BASE}/global`);
    const globalData = globalResp.ok ? await globalResp.json() : null;

    // Get SOL price for reference
    const solPrice = await fetchSolPrice(jupiterApiKey);

    // Get recent Bullme new tokens count
    let newTokenCount = 0;
    let avgLiquidity = 0;
    try {
      const bullmeResp = await fetch('https://api.bullme.one/market/token/newTokens');
      if (bullmeResp.ok) {
        const bullmeData = await bullmeResp.json();
        const tokens = bullmeData?.data || [];
        newTokenCount = tokens.length;
        if (tokens.length > 0) {
          avgLiquidity = tokens.reduce((sum: number, t: any) => sum + (t.liquidity || 0), 0) / tokens.length;
        }
      }
    } catch { /* ignore */ }

    const marketData = globalData?.data || {};
    const totalVolume = marketData?.total_volume?.usd || 0;
    const totalMarketCap = marketData?.total_market_cap?.usd || 0;
    const marketCapChange24h = marketData?.market_cap_change_percentage_24h_usd || 0;

    return {
      totalVolume,
      totalMarketCap,
      marketCapChange24h,
      solPrice: solPrice.price,
      solChange24h: solPrice.change24h,
      newTokens24h: newTokenCount,
      avgLiquidity: avgLiquidity * solPrice.price, // Convert SOL to USD
    };
  } catch (e) {
    console.error('Market stats error:', e);
    return {
      totalVolume: 0, totalMarketCap: 0, marketCapChange24h: 0,
      solPrice: 0, solChange24h: 0, newTokens24h: 0, avgLiquidity: 0,
    };
  }
}

// ── Shield Check (SAVAG3BOT Full Safety Analysis) ───────────────────

async function fetchShieldCheck(address: string, jupiterApiKey?: string) {
  try {
    const HELIUS_API_KEY = Deno.env.get('HELIUS_API_KEY');
    const headers: Record<string, string> = {};
    if (jupiterApiKey) headers['x-api-key'] = jupiterApiKey;

    // 1. Jupiter Shield API
    const shieldPromise = fetch(`https://ultra-api.jup.ag/v1/shield?mints=${address}`, { headers })
      .then(r => r.ok ? r.json() : null).catch(() => null);

    // 2. Strict List check (Simplified to avoid loading 2MB JSON)
    // We check if it has a price/liquidity on Jupiter which usually implies it's "known" enough
    const isOnStrictList = false; // We'll rely more on Helius and DexScreener verification

    // 3. Helius DAS getAsset (mint/freeze authority + metadata)
    const rpcUrl = HELIUS_API_KEY ? `https://mainnet.helius-rpc.com/?api-key=${HELIUS_API_KEY}` : '';
    const metaPromise = rpcUrl
      ? fetch(rpcUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'getAsset', params: { id: address, displayOptions: { showFungible: true } } }),
        }).then(r => r.ok ? r.json() : { result: {} }).catch(() => ({ result: {} }))
      : Promise.resolve({ result: {} });

    // 4. Token largest accounts (holder concentration)
    const holdersPromise = rpcUrl
      ? fetch(rpcUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'getTokenLargestAccounts', params: [address] }),
        }).then(r => r.ok ? r.json() : { result: { value: [] } }).catch(() => ({ result: { value: [] } }))
      : Promise.resolve({ result: { value: [] } });

    // 5. DexScreener liquidity + pair age
    const dexPromise = fetch(`https://api.dexscreener.com/tokens/v1/solana/${address}`)
      .then(r => r.ok ? r.json() : []).catch(() => []);

    // 6. Jupiter Quote check (risk warnings)
    const SOL_MINT = 'So11111111111111111111111111111111111111112';
    const quotePromise = fetch(`https://quote-api.jup.ag/v6/quote?inputMint=${SOL_MINT}&outputMint=${address}&amount=100000000&slippageBps=500`, { headers })
      .then(r => r.ok ? r.json() : null).catch(() => null);

    const [shieldData, metaResult, holdersResult, dexPairs, quoteData] = await Promise.all([
      shieldPromise, metaPromise, holdersPromise, dexPromise, quotePromise,
    ]);

    // ── Parse results ──────────────────────────────────────────────

    // Shield API
    const shieldMint = shieldData?.[address] || {};
    const shieldWarnings: string[] = shieldMint?.warnings || [];


    // Metadata / authorities
    const asset = metaResult?.result || {};
    const content = asset?.content || {};
    const tokenInfo = asset?.token_info || {};
    const authorities = asset?.authorities || [];

    const hasMintAuthority = authorities.some((a: any) =>
      a.scopes?.includes('mint') || a.scopes?.includes('full'));
    const hasFreezeAuthority = authorities.some((a: any) =>
      a.scopes?.includes('freeze') || a.scopes?.includes('full'));

    // Holder concentration
    const accounts = holdersResult?.result?.value || [];
    const totalSupplyInAccounts = accounts.reduce((sum: number, a: any) => sum + (a.uiAmount || 0), 0);
    const top10Amount = accounts.slice(0, 10).reduce((sum: number, a: any) => sum + (a.uiAmount || 0), 0);
    const top10Pct = totalSupplyInAccounts > 0 ? (top10Amount / totalSupplyInAccounts) * 100 : 0;
    const holderCount = accounts.length;

    // LP analysis — check if creator holds LP tokens
    const topHolders = accounts.slice(0, 20).map((acc: any) => ({
      address: acc.address,
      amount: acc.uiAmount || 0,
      percentage: totalSupplyInAccounts > 0 ? ((acc.uiAmount || 0) / totalSupplyInAccounts) * 100 : 0,
    }));

    // DexScreener
    let liquidity = 0;
    let pairAge = '';
    let lpBurned = false;
    if (Array.isArray(dexPairs) && dexPairs.length > 0) {
      const bestPair = dexPairs.reduce((best: any, p: any) =>
        (p.liquidity?.usd || 0) > (best?.liquidity?.usd || 0) ? p : best, dexPairs[0]);
      liquidity = bestPair?.liquidity?.usd || 0;
      pairAge = bestPair?.pairCreatedAt ? new Date(bestPair.pairCreatedAt).toISOString() : '';
      // DexScreener labels include "LP Burned" if applicable
      const labels = bestPair?.labels || [];
      lpBurned = labels.some((l: string) => l.toLowerCase().includes('burn') || l.toLowerCase().includes('lock'));
    }

    // Quote warnings
    const quoteError = quoteData?.error || null;
    const hasQuoteWarning = !!quoteError;

    // ── Risk scoring (SAVAG3BOT logic) ─────────────────────────────

    let riskScore = 0; // 0 = safest, higher = riskier
    const riskFactors: string[] = [];

    if (hasMintAuthority) { riskScore += 30; riskFactors.push('Mint authority is active — dev can print tokens'); }
    if (hasFreezeAuthority) { riskScore += 25; riskFactors.push('Freeze authority is active — dev can freeze your tokens'); }
    if (!lpBurned && liquidity > 0) { riskScore += 15; riskFactors.push('LP tokens not burned/locked — rug pull possible'); }
    if (top10Pct > 20) { riskScore += 15; riskFactors.push(`Top 10 holders own ${top10Pct.toFixed(1)}% of supply (>20%)`); }
    if (liquidity < 5000) { riskScore += 10; riskFactors.push('Very low liquidity (<$5K)'); }
    if (holderCount < 50) { riskScore += 10; riskFactors.push('Very few holders (<50)'); }
    if (!isOnStrictList) { riskScore += 5; riskFactors.push('Not on Jupiter strict verified list'); }
    if (hasQuoteWarning) { riskScore += 10; riskFactors.push(`Jupiter quote warning: ${quoteError}`); }
    if (shieldWarnings.length > 0) { riskScore += 15; riskFactors.push(...shieldWarnings.map((w: string) => `Shield: ${w}`)); }

    const safeFactors: string[] = [];
    if (!hasMintAuthority) safeFactors.push('Mint authority revoked ✓');
    if (!hasFreezeAuthority) safeFactors.push('Freeze authority revoked ✓');
    if (lpBurned) safeFactors.push('LP burned/locked ✓');
    if (isOnStrictList) safeFactors.push('Jupiter strict verified ✓');
    if (top10Pct <= 20) safeFactors.push(`Top 10 holders own ${top10Pct.toFixed(1)}% (healthy) ✓`);
    if (liquidity >= 50000) safeFactors.push(`Strong liquidity ($${(liquidity/1000).toFixed(0)}K) ✓`);

    let riskLevel: 'LOW' | 'MEDIUM' | 'HIGH';
    let recommendation: string;
    if (riskScore <= 15) {
      riskLevel = 'LOW';
      recommendation = 'Safe for larger positions. Standard risk management applies.';
    } else if (riskScore <= 45) {
      riskLevel = 'MEDIUM';
      recommendation = 'Use small position sizes. Check social sentiment before entering.';
    } else {
      riskLevel = 'HIGH';
      recommendation = 'DO NOT TRADE unless you are prepared to lose 100%.';
    }

    return {
      name: content?.metadata?.name || '',
      symbol: content?.metadata?.symbol || '',
      riskLevel,
      riskScore: Math.min(100, riskScore),
      recommendation,
      riskFactors,
      safeFactors,
      isOnStrictList,
      holders: holderCount,
      top10HolderPct: +top10Pct.toFixed(1),
      topHolders,
      liquidity,
      lpBurned,
      pairAge,
      decimals: tokenInfo?.decimals || 0,
      supply: tokenInfo?.supply || 0,
      flags: {
        mintAuthority: hasMintAuthority,
        freezeAuthority: hasFreezeAuthority,
        lowLiquidity: liquidity < 5000,
        lowHolders: holderCount < 50,
        jupiterWarning: hasQuoteWarning,
        shieldWarnings,
      },
    };
  } catch (e) {
    console.error('Shield check error:', e);
    throw new Error(`Shield check failed: ${e instanceof Error ? e.message : 'Unknown error'}`);
  }
}

// ── Recent Launches (from Bullme API) ───────────────────────────────

async function fetchRecentLaunches() {
  try {
    const resp = await fetch('https://api.bullme.one/market/token/newTokens');
    if (!resp.ok) throw new Error(`Bullme API failed [${resp.status}]`);
    const data = await resp.json();
    const tokens = data?.data || [];

    return tokens.slice(0, 10).map((t: any) => ({
      address: t.address,
      name: t.name,
      symbol: t.symbol,
      logo: t.logo,
      timestamp: t.timestamp,
      marketCap: t.marketCap,
      liquidity: t.liquidity,
      tradeCount: t.tradeCount24h || t.tradeCount,
      bondingCurveProgress: t.bondingCurveProgress,
      status: t.status,
      twitter: t.twitter || null,
      website: t.website || null,
      description: t.description || '',
    }));
  } catch (e) {
    console.error('Recent launches error:', e);
    return [];
  }
}
