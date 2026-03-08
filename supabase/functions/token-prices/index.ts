import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

const BIRDEYE_BASE = 'https://public-api.birdeye.so';
const HELIUS_BASE = 'https://api.helius.xyz';

function birdeyeHeaders(apiKey: string) {
  return { 'X-API-KEY': apiKey, 'x-chain': 'solana' };
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

  const BIRDEYE_API_KEY = Deno.env.get('BIRDEYE_API_KEY');
  if (!BIRDEYE_API_KEY) return err('BIRDEYE_API_KEY is not configured');

  const HELIUS_API_KEY = Deno.env.get('HELIUS_API_KEY');
  if (!HELIUS_API_KEY) return err('HELIUS_API_KEY is not configured');

  try {
    const body = await req.json();
    const { action, addresses, address } = body;

    switch (action) {
      case 'prices':
        return ok(await fetchBirdeyePrices(addresses, BIRDEYE_API_KEY));

      case 'token_info':
        return ok(await fetchHeliusTokenInfo(addresses, HELIUS_API_KEY));

      case 'trending':
        return ok(await fetchBirdeyeTrending(BIRDEYE_API_KEY));

      case 'token_overview':
        if (!address) return err('address is required', 400);
        return ok(await fetchTokenOverview(address, BIRDEYE_API_KEY));

      case 'token_trades':
        if (!address) return err('address is required', 400);
        return ok(await fetchTokenTrades(address, BIRDEYE_API_KEY, body.limit || 20));

      case 'price_history':
        if (!address) return err('address is required', 400);
        return ok(await fetchPriceHistory(address, BIRDEYE_API_KEY, body.interval || '30m', body.time_from, body.time_to));

      case 'token_holders':
        if (!address) return err('address is required', 400);
        return ok(await fetchTokenHolders(address, HELIUS_API_KEY));

      default:
        return err('Invalid action', 400);
    }
  } catch (error: unknown) {
    console.error('token-prices error:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    return err(message);
  }
});

// ── Existing endpoints ──────────────────────────────────────────────

async function fetchBirdeyePrices(addresses: string[], apiKey: string) {
  if (!addresses || addresses.length === 0) return {};
  const addressList = addresses.join(',');
  const response = await fetch(
    `${BIRDEYE_BASE}/defi/multi_price?list_address=${addressList}`,
    { headers: birdeyeHeaders(apiKey) }
  );
  if (!response.ok) throw new Error(`Birdeye price API failed [${response.status}]: ${await response.text()}`);
  const result = await response.json();
  return result.data || {};
}

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

async function fetchBirdeyeTrending(apiKey: string) {
  const response = await fetch(
    `${BIRDEYE_BASE}/defi/token_trending?sort_by=rank&sort_type=asc&offset=0&limit=20`,
    { headers: birdeyeHeaders(apiKey) }
  );
  if (!response.ok) throw new Error(`Birdeye trending API failed [${response.status}]: ${await response.text()}`);
  const result = await response.json();
  return result.data?.tokens || [];
}

// ── New endpoints for Token Detail Modal ────────────────────────────

async function fetchTokenOverview(address: string, apiKey: string) {
  const response = await fetch(
    `${BIRDEYE_BASE}/defi/token_overview?address=${address}`,
    { headers: birdeyeHeaders(apiKey) }
  );
  if (!response.ok) throw new Error(`Birdeye token overview failed [${response.status}]: ${await response.text()}`);
  const result = await response.json();
  return result.data || {};
}

async function fetchTokenTrades(address: string, apiKey: string, limit: number) {
  const response = await fetch(
    `${BIRDEYE_BASE}/defi/txs/token?address=${address}&tx_type=swap&sort_type=desc&offset=0&limit=${limit}`,
    { headers: birdeyeHeaders(apiKey) }
  );
  if (!response.ok) throw new Error(`Birdeye token trades failed [${response.status}]: ${await response.text()}`);
  const result = await response.json();
  return result.data?.items || [];
}

async function fetchPriceHistory(address: string, apiKey: string, interval: string, timeFrom?: number, timeTo?: number) {
  const now = Math.floor(Date.now() / 1000);
  const from = timeFrom || now - 86400; // default 24h
  const to = timeTo || now;
  const response = await fetch(
    `${BIRDEYE_BASE}/defi/history_price?address=${address}&address_type=token&type=${interval}&time_from=${from}&time_to=${to}`,
    { headers: birdeyeHeaders(apiKey) }
  );
  if (!response.ok) throw new Error(`Birdeye price history failed [${response.status}]: ${await response.text()}`);
  const result = await response.json();
  return result.data?.items || [];
}

async function fetchTokenHolders(address: string, apiKey: string) {
  // Use Helius DAS API to get top holders
  const response = await fetch(`${HELIUS_BASE}/v0/addresses/${address}/balances?api-key=${apiKey}`);

  // Fallback: use Helius getTokenLargestAccounts via RPC
  const rpcUrl = `https://mainnet.helius-rpc.com/?api-key=${apiKey}`;
  const rpcResponse = await fetch(rpcUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      jsonrpc: '2.0',
      id: 1,
      method: 'getTokenLargestAccounts',
      params: [address],
    }),
  });

  if (!rpcResponse.ok) {
    const text = await rpcResponse.text();
    // Consume first response body to prevent leak
    if (response) try { await response.text(); } catch { /* ignore */ }
    throw new Error(`Helius RPC failed [${rpcResponse.status}]: ${text}`);
  }

  // Consume the first response body
  if (response) try { await response.text(); } catch { /* ignore */ }

  const rpcResult = await rpcResponse.json();
  const accounts = rpcResult?.result?.value || [];

  // Calculate distribution from top holders
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
