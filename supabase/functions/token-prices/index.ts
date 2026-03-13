import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

const JUPITER_PRICE_API = 'https://api.jup.ag/price/v3';
const COINGECKO_BASE = 'https://api.coingecko.com/api/v3';
const HELIUS_BASE = 'https://api.helius.xyz';

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
  const prices: Record<string, { value: number }> = {};
  
  for (const [mint, info] of Object.entries(result)) {
    const priceData = info as { usdPrice?: number };
    if (priceData?.usdPrice) {
      prices[mint] = { value: priceData.usdPrice };
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

// ── Trending via CoinGecko (free) ───────────────────────────────────

async function fetchTrendingTokens() {
  try {
    const response = await fetch(`${COINGECKO_BASE}/search/trending`);
    if (!response.ok) throw new Error(`CoinGecko trending failed [${response.status}]`);
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
      rank: item.item?.market_cap_rank || 0,
    }));
  } catch (e) {
    console.error('CoinGecko trending fallback error:', e);
    return [];
  }
}

// ── Token Overview via Helius DAS + Jupiter ─────────────────────────

async function fetchTokenOverview(address: string, apiKey: string, jupiterApiKey?: string) {
  const headers: Record<string, string> = {};
  if (jupiterApiKey) headers['x-api-key'] = jupiterApiKey;
  
  const pricePromise = fetch(`${JUPITER_PRICE_API}?ids=${address}`, { headers })
    .then(r => r.json()).catch(() => ({}));

  const rpcUrl = `https://mainnet.helius-rpc.com/?api-key=${apiKey}`;
  const metaPromise = fetch(rpcUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'getAsset', params: { id: address, displayOptions: { showFungible: true } } }),
  }).then(r => r.json()).catch(() => ({ result: {} }));

  const [priceResult, metaResult] = await Promise.all([pricePromise, metaPromise]);

  const priceInfo = priceResult?.[address];
  const asset = metaResult?.result || {};
  const content = asset?.content || {};

  return {
    address,
    name: content?.metadata?.name || '',
    symbol: content?.metadata?.symbol || '',
    logo: content?.links?.image || content?.files?.[0]?.uri || '',
    price: priceInfo?.usdPrice || 0,
    decimals: asset?.token_info?.decimals || 0,
    supply: asset?.token_info?.supply || 0,
  };
}

// ── Token Trades via Helius ─────────────────────────────────────────

async function fetchTokenTrades(address: string, apiKey: string, limit: number) {
  const rpcUrl = `https://mainnet.helius-rpc.com/?api-key=${apiKey}`;
  
  const sigResponse = await fetch(rpcUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      jsonrpc: '2.0', id: 1,
      method: 'getSignaturesForAddress',
      params: [address, { limit: Math.min(limit, 20) }],
    }),
  });

  if (!sigResponse.ok) throw new Error(`Helius RPC failed [${sigResponse.status}]`);
  const sigResult = await sigResponse.json();
  const signatures = (sigResult?.result || []).map((s: any) => s.signature);

  if (signatures.length === 0) return [];

  const parseResponse = await fetch(`${HELIUS_BASE}/v0/transactions/?api-key=${apiKey}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ transactions: signatures }),
  });

  if (!parseResponse.ok) return [];
  const parsed = await parseResponse.json();

  return (parsed || []).slice(0, limit).map((tx: any) => ({
    txHash: tx.signature || '',
    type: tx.type || 'UNKNOWN',
    source: tx.source || '',
    timestamp: tx.timestamp || 0,
    description: tx.description || '',
  }));
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
  const rpcUrl = `https://mainnet.helius-rpc.com/?api-key=${apiKey}`;
  const rpcResponse = await fetch(rpcUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'getTokenLargestAccounts', params: [address] }),
  });

  if (!rpcResponse.ok) throw new Error(`Helius RPC failed [${rpcResponse.status}]: ${await rpcResponse.text()}`);

  const rpcResult = await rpcResponse.json();
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
  const data = await resp.json();
  const solData = data?.[SOL_MINT];

  return {
    price: solData?.usdPrice || 0,
    change24h: solData?.priceChange24h || 0,
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

    // 2. Jupiter Strict List check
    const strictListPromise = fetch('https://token.jup.ag/strict')
      .then(r => r.ok ? r.json() : []).catch(() => []);

    // 3. Helius DAS getAsset (mint/freeze authority + metadata)
    const rpcUrl = HELIUS_API_KEY ? `https://mainnet.helius-rpc.com/?api-key=${HELIUS_API_KEY}` : '';
    const metaPromise = rpcUrl
      ? fetch(rpcUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'getAsset', params: { id: address } }),
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

    const [shieldData, strictList, metaResult, holdersResult, dexPairs, quoteData] = await Promise.all([
      shieldPromise, strictListPromise, metaPromise, holdersPromise, dexPromise, quotePromise,
    ]);

    // ── Parse results ──────────────────────────────────────────────

    // Shield API
    const shieldMint = shieldData?.[address] || {};
    const shieldWarnings: string[] = shieldMint?.warnings || [];

    // Strict list
    const isOnStrictList = Array.isArray(strictList) && strictList.some((t: any) => t.address === address);

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
