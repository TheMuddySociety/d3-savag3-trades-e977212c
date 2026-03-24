import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const supabase = createClient(supabaseUrl, supabaseKey);

serve(async (req: Request) => {
  try {
    const newLaunches = await fetchNewLaunches(10); // get top 10 newest
    let broadcastCount = 0;

    if (newLaunches.length > 0) {
      const channel = supabase.channel("new-launches");

      for (const launch of newLaunches) {
        await channel.send({
          type: "broadcast",
          event: "new_launch",
          payload: {
            mint: launch.address,
            name: launch.name,
            symbol: launch.symbol,
            price: launch.price,
            marketCap: launch.marketCap,
            liquidity: launch.liquidity,
            ageSeconds: launch.pairCreatedAt ? Math.floor((Date.now() - launch.pairCreatedAt) / 1000) : 999,
            timestamp: Date.now(),
          },
        });
        broadcastCount++;
      }
    }

    return new Response(JSON.stringify({ success: true, broadcastCount, launches: newLaunches }), {
      headers: { "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("[Launch Detector] Error:", error);
    return new Response(JSON.stringify({ error: "Launch detection failed" }), { status: 500 });
  }
});

/**
 * Below maps the exact same logic from pumpfun-api to stay DRY
 */
async function fetchNewLaunches(limit: number) {
  const now = Date.now();
  const cutoff = now - 60_000; // Last 60 seconds

  try {
    const profilesResp = await fetch('https://api.dexscreener.com/token-profiles/latest/v1');
    if (!profilesResp.ok) return [];

    const profiles = await profilesResp.json();
    const solanaProfiles = (profiles || []).filter((p: any) => p.chainId === 'solana' && p.tokenAddress);
    if (solanaProfiles.length === 0) return [];

    const addresses = solanaProfiles.map((p: any) => p.tokenAddress).slice(0, 30);
    const enriched = await enrichWithPairData(addresses);

    const newLaunches = enriched.filter((t: any) => {
      if (t.pairCreatedAt && t.pairCreatedAt > cutoff) return true;
      if (!t.pairCreatedAt && t.marketCap > 0 && t.marketCap < 50000) return true;
      return false;
    });

    newLaunches.sort((a: any, b: any) => (b.pairCreatedAt || now) - (a.pairCreatedAt || now));

    if (newLaunches.length === 0) {
      const latest = enriched
        .filter((t: any) => t.pairCreatedAt && t.pairCreatedAt > now - 300_000)
        .sort((a: any, b: any) => (b.pairCreatedAt || 0) - (a.pairCreatedAt || 0));
      return latest.slice(0, limit);
    }

    return newLaunches.slice(0, limit);
  } catch (e) {
    console.error('fetchNewLaunches error:', e);
    return [];
  }
}

async function enrichWithPairData(addresses: string[]) {
  const addrString = addresses.join(',');
  const resp = await fetch(`https://api.dexscreener.com/tokens/v1/solana/${addrString}`);

  if (!resp.ok) {
    return addresses.map(addr => ({
      address: addr, name: '', symbol: '', price: 0, marketCap: 0,
      volume24h: 0, change24h: 0, liquidity: 0, logoUrl: '', pairCreatedAt: 0,
    }));
  }

  const pairs = await resp.json();
  const seen = new Set<string>();
  const tokens: any[] = [];

  for (const pair of (pairs || [])) {
    const addr = pair.baseToken?.address;
    if (!addr || seen.has(addr)) continue;
    seen.add(addr);
    tokens.push({
      address: addr,
      name: pair.baseToken?.name || '',
      symbol: pair.baseToken?.symbol || '',
      price: parseFloat(pair.priceUsd) || 0,
      marketCap: pair.marketCap || pair.fdv || 0,
      liquidity: pair.liquidity?.usd || 0,
      pairCreatedAt: pair.pairCreatedAt || 0,
    });
  }

  return tokens;
}
