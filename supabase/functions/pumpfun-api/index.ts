import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    let action = 'trending';
    let limit = 30;

    try {
      const body = await req.json();
      if (body.action) action = body.action;
      if (body.limit) limit = body.limit;
    } catch {
      // Use defaults
    }

    let data: any[] = [];

    switch (action) {
      case 'trending':
        data = await fetchPumpFunTrending(limit);
        break;
      case 'latest':
        data = await fetchPumpFunLatest(limit);
        break;
      case 'graduated':
        data = await fetchPumpFunGraduated(limit);
        break;
      default:
        data = await fetchPumpFunTrending(limit);
    }

    return new Response(JSON.stringify({ tokens: data, source: 'dexscreener+pumpfun' }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('[PumpFun API] Error:', error);
    return new Response(JSON.stringify({ error: error.message, tokens: [] }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});

/**
 * Fetch trending Pump.Fun tokens via DexScreener token profiles + boosted
 */
async function fetchPumpFunTrending(limit: number) {
  // Use DexScreener's token boosts (trending/promoted tokens)
  const [boostsResp, profilesResp] = await Promise.allSettled([
    fetch('https://api.dexscreener.com/token-boosts/top/v1'),
    fetch('https://api.dexscreener.com/token-profiles/latest/v1'),
  ]);

  const tokens: any[] = [];
  const seen = new Set<string>();

  // Process boosted tokens first (these are trending)
  if (boostsResp.status === 'fulfilled' && boostsResp.value.ok) {
    const boosts = await boostsResp.value.json();
    for (const item of boosts) {
      if (item.chainId !== 'solana') continue;
      if (seen.has(item.tokenAddress)) continue;
      seen.add(item.tokenAddress);
      tokens.push({
        address: item.tokenAddress,
        source: 'boosted',
        amount: item.amount || 0,
        ...item,
      });
      if (tokens.length >= limit) break;
    }
  }

  // Fill with latest profiles
  if (tokens.length < limit && profilesResp.status === 'fulfilled' && profilesResp.value.ok) {
    const profiles = await profilesResp.value.json();
    for (const item of profiles) {
      if (item.chainId !== 'solana') continue;
      if (seen.has(item.tokenAddress)) continue;
      seen.add(item.tokenAddress);
      tokens.push({
        address: item.tokenAddress,
        source: 'profile',
        ...item,
      });
      if (tokens.length >= limit) break;
    }
  }

  // Enrich with pair data from DexScreener
  const addresses = tokens.map(t => t.address).slice(0, 30);
  if (addresses.length > 0) {
    const enriched = await enrichWithPairData(addresses);
    return enriched.slice(0, limit);
  }

  return tokens.slice(0, limit);
}

/**
 * Fetch latest Pump.Fun tokens
 */
async function fetchPumpFunLatest(limit: number) {
  // Search DexScreener for recent pumpfun tokens
  const resp = await fetch('https://api.dexscreener.com/latest/dex/search?q=pump.fun&chain=solana');
  if (!resp.ok) {
    console.error(`DexScreener search failed: ${resp.status}`);
    return [];
  }

  const data = await resp.json();
  const pairs = (data?.pairs || [])
    .filter((p: any) => p.chainId === 'solana')
    .sort((a: any, b: any) => (b.pairCreatedAt || 0) - (a.pairCreatedAt || 0));

  const seen = new Set<string>();
  const tokens: any[] = [];

  for (const pair of pairs) {
    const addr = pair.baseToken?.address;
    if (!addr || seen.has(addr)) continue;
    seen.add(addr);

    tokens.push(pairToToken(pair));
    if (tokens.length >= limit) break;
  }

  return tokens;
}

/**
 * Fetch graduated Pump.Fun tokens (those on Raydium)
 */
async function fetchPumpFunGraduated(limit: number) {
  const resp = await fetch('https://api.dexscreener.com/latest/dex/search?q=pumpfun%20graduated&chain=solana');
  if (!resp.ok) return [];

  const data = await resp.json();
  const pairs = (data?.pairs || [])
    .filter((p: any) => p.chainId === 'solana' && p.dexId === 'raydium')
    .sort((a: any, b: any) => (b.volume?.h24 || 0) - (a.volume?.h24 || 0));

  const seen = new Set<string>();
  const tokens: any[] = [];

  for (const pair of pairs) {
    const addr = pair.baseToken?.address;
    if (!addr || seen.has(addr)) continue;
    seen.add(addr);
    tokens.push({ ...pairToToken(pair), graduated: true });
    if (tokens.length >= limit) break;
  }

  return tokens;
}

/**
 * Enrich token addresses with DexScreener pair data
 */
async function enrichWithPairData(addresses: string[]) {
  // DexScreener allows up to 30 addresses at once
  const addrString = addresses.join(',');
  const resp = await fetch(`https://api.dexscreener.com/tokens/v1/solana/${addrString}`);

  if (!resp.ok) {
    console.error(`DexScreener tokens lookup failed: ${resp.status}`);
    return addresses.map(addr => ({
      address: addr,
      name: '',
      symbol: '',
      price: 0,
      marketCap: 0,
      volume24h: 0,
      change24h: 0,
      liquidity: 0,
      logoUrl: '',
      pairCreatedAt: 0,
    }));
  }

  const pairs = await resp.json();
  const seen = new Set<string>();
  const tokens: any[] = [];

  for (const pair of (pairs || [])) {
    const addr = pair.baseToken?.address;
    if (!addr || seen.has(addr)) continue;
    seen.add(addr);
    tokens.push(pairToToken(pair));
  }

  return tokens;
}

function pairToToken(pair: any) {
  return {
    address: pair.baseToken?.address || '',
    name: pair.baseToken?.name || '',
    symbol: pair.baseToken?.symbol || '',
    price: parseFloat(pair.priceUsd) || 0,
    marketCap: pair.marketCap || pair.fdv || 0,
    volume24h: pair.volume?.h24 || 0,
    change24h: pair.priceChange?.h24 || 0,
    change1h: pair.priceChange?.h1 || 0,
    change5m: pair.priceChange?.m5 || 0,
    liquidity: pair.liquidity?.usd || 0,
    logoUrl: pair.info?.imageUrl || '',
    pairAddress: pair.pairAddress || '',
    dexId: pair.dexId || '',
    pairCreatedAt: pair.pairCreatedAt || 0,
    txns24h: pair.txns?.h24 || {},
    websites: pair.info?.websites || [],
    socials: pair.info?.socials || [],
  };
}
