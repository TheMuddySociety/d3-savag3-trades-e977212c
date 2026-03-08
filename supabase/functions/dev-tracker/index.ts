import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const HELIUS_API_KEY = Deno.env.get('HELIUS_API_KEY');
    if (!HELIUS_API_KEY) {
      throw new Error('HELIUS_API_KEY is not configured');
    }

    const { walletAddress } = await req.json();
    if (!walletAddress) {
      throw new Error('walletAddress is required');
    }

    const HELIUS_RPC = `https://mainnet.helius-rpc.com/?api-key=${HELIUS_API_KEY}`;
    const HELIUS_API = `https://api.helius.xyz/v0`;

    // 1. Get all fungible tokens created by this wallet using DAS API
    const assetsResponse = await fetch(HELIUS_RPC, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 'assets',
        method: 'getAssetsByCreator',
        params: {
          creatorAddress: walletAddress,
          onlyVerified: false,
          page: 1,
          limit: 1000,
        },
      }),
    });

    const assetsData = await assetsResponse.json();
    const assets = assetsData?.result?.items || [];

    // Filter to fungible tokens (SPL tokens, not NFTs with supply 1)
    const fungibleTokens = assets.filter((a: any) => {
      const isFungible = a.interface === 'FungibleToken' || a.interface === 'FungibleAsset';
      const isToken = a.token_info?.supply > 1;
      return isFungible || isToken;
    });

    // 2. Get recent transaction history for pattern analysis
    const txResponse = await fetch(
      `${HELIUS_API}/addresses/${walletAddress}/transactions?api-key=${HELIUS_API_KEY}&limit=100&type=SWAP`
    );
    const transactions = await txResponse.json();

    // 3. Analyze patterns
    const tokenMints = new Set<string>();
    const tokenDetails: any[] = [];
    let quickDumps = 0; // tokens sold within hours of creation
    let suspiciousPatterns = 0;

    // Process assets for token launches
    for (const asset of fungibleTokens) {
      const mint = asset.id;
      tokenMints.add(mint);

      const meta = asset.content?.metadata || {};
      const supply = asset.token_info?.supply || 0;
      const decimals = asset.token_info?.decimals || 0;

      tokenDetails.push({
        mint,
        name: meta.name || 'Unknown',
        symbol: meta.symbol || '???',
        supply: supply / Math.pow(10, decimals),
        frozen: asset.ownership?.frozen || false,
        burnt: asset.burnt || false,
      });
    }

    // Analyze transaction patterns
    const swapTimestamps: number[] = [];
    let totalVolume = 0;

    if (Array.isArray(transactions)) {
      for (const tx of transactions) {
        if (tx.timestamp) {
          swapTimestamps.push(tx.timestamp);
        }

        // Check for rapid sell-offs (rug pattern)
        if (tx.type === 'SWAP' && tx.tokenTransfers) {
          for (const transfer of tx.tokenTransfers) {
            if (transfer.fromUserAccount === walletAddress) {
              totalVolume += Math.abs(transfer.tokenAmount || 0);
            }
          }
        }
      }
    }

    // Pattern detection
    if (swapTimestamps.length > 2) {
      // Check for burst trading (many swaps in short time)
      swapTimestamps.sort((a, b) => a - b);
      for (let i = 1; i < swapTimestamps.length; i++) {
        const gap = swapTimestamps[i] - swapTimestamps[i - 1];
        if (gap < 60) { // less than 60 seconds between swaps
          suspiciousPatterns++;
        }
      }
    }

    // Detect quick dumps: tokens where creator holds 0% (fully sold)
    const burntOrFrozen = tokenDetails.filter((t) => t.burnt || t.frozen).length;
    quickDumps = tokenDetails.filter((t) => t.burnt).length;

    // Calculate risk level
    const tokensLaunched = fungibleTokens.length;
    let riskScore = 0;

    if (tokensLaunched > 10) riskScore += 2;
    else if (tokensLaunched > 5) riskScore += 1;

    if (quickDumps > 3) riskScore += 3;
    else if (quickDumps > 0) riskScore += 1;

    if (suspiciousPatterns > 5) riskScore += 2;
    else if (suspiciousPatterns > 0) riskScore += 1;

    if (burntOrFrozen > 2) riskScore += 2;

    let riskLevel: string;
    if (riskScore >= 6) riskLevel = 'critical';
    else if (riskScore >= 4) riskLevel = 'high';
    else if (riskScore >= 2) riskLevel = 'medium';
    else riskLevel = 'low';

    // Calculate average lifespan from transaction gaps
    let avgLifespan = 'N/A';
    if (swapTimestamps.length >= 2) {
      const totalSpan = swapTimestamps[swapTimestamps.length - 1] - swapTimestamps[0];
      const avgHours = Math.round(totalSpan / 3600 / Math.max(tokensLaunched, 1));
      avgLifespan = avgHours > 24 ? `${Math.round(avgHours / 24)}d` : `${avgHours}h`;
    }

    const result = {
      walletAddress,
      tokensLaunched,
      rugPulls: quickDumps,
      honeypots: burntOrFrozen,
      suspiciousPatterns,
      avgLifespan,
      riskLevel,
      totalVolume,
      tokens: tokenDetails.slice(0, 20), // top 20 tokens
      transactionCount: Array.isArray(transactions) ? transactions.length : 0,
    };

    return new Response(JSON.stringify({ success: true, data: result }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error: unknown) {
    console.error('Dev tracker error:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    return new Response(JSON.stringify({ success: false, error: message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
