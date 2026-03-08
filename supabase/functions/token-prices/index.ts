import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

const BIRDEYE_BASE = 'https://public-api.birdeye.so';
const HELIUS_BASE = 'https://api.helius.xyz';

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const BIRDEYE_API_KEY = Deno.env.get('BIRDEYE_API_KEY');
  if (!BIRDEYE_API_KEY) {
    return new Response(JSON.stringify({ error: 'BIRDEYE_API_KEY is not configured' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const HELIUS_API_KEY = Deno.env.get('HELIUS_API_KEY');
  if (!HELIUS_API_KEY) {
    return new Response(JSON.stringify({ error: 'HELIUS_API_KEY is not configured' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  try {
    const { action, addresses } = await req.json();

    if (action === 'prices') {
      // Fetch multi-token prices from Birdeye
      const priceData = await fetchBirdeyePrices(addresses, BIRDEYE_API_KEY);
      return new Response(JSON.stringify({ success: true, data: priceData }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (action === 'token_info') {
      // Fetch token metadata from Helius DAS API
      const tokenInfo = await fetchHeliusTokenInfo(addresses, HELIUS_API_KEY);
      return new Response(JSON.stringify({ success: true, data: tokenInfo }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (action === 'trending') {
      // Fetch trending tokens from Birdeye
      const trending = await fetchBirdeyeTrending(BIRDEYE_API_KEY);
      return new Response(JSON.stringify({ success: true, data: trending }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify({ error: 'Invalid action' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error: unknown) {
    console.error('token-prices error:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});

async function fetchBirdeyePrices(addresses: string[], apiKey: string) {
  if (!addresses || addresses.length === 0) return {};

  // Birdeye multi-price endpoint
  const addressList = addresses.join(',');
  const response = await fetch(
    `${BIRDEYE_BASE}/defi/multi_price?list_address=${addressList}`,
    {
      headers: {
        'X-API-KEY': apiKey,
        'x-chain': 'solana',
      },
    }
  );

  if (!response.ok) {
    throw new Error(`Birdeye price API failed [${response.status}]: ${await response.text()}`);
  }

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

  if (!response.ok) {
    throw new Error(`Helius token info API failed [${response.status}]: ${await response.text()}`);
  }

  return await response.json();
}

async function fetchBirdeyeTrending(apiKey: string) {
  const response = await fetch(
    `${BIRDEYE_BASE}/defi/token_trending?sort_by=rank&sort_type=asc&offset=0&limit=20`,
    {
      headers: {
        'X-API-KEY': apiKey,
        'x-chain': 'solana',
      },
    }
  );

  if (!response.ok) {
    throw new Error(`Birdeye trending API failed [${response.status}]: ${await response.text()}`);
  }

  const result = await response.json();
  return result.data?.tokens || [];
}
