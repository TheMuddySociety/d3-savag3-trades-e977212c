import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

interface NFTAsset {
  id: string;
  content?: {
    metadata?: { name?: string; symbol?: string };
    links?: { image?: string };
  };
  ownership?: { owner?: string; frozen?: boolean };
  creators?: { address: string; verified: boolean; share: number }[];
  royalty?: { percent: number };
  burnt?: boolean;
  created_at?: string;
}

interface WashTradeFlag {
  type: 'rapid_relisting' | 'circular_trading' | 'price_manipulation' | 'bot_minting' | 'no_royalties' | 'high_burn_rate' | 'single_creator' | 'fake_volume';
  severity: 'info' | 'warning' | 'danger';
  description: string;
  evidence: string[];
}

function detectRapidRelisting(assets: NFTAsset[]): WashTradeFlag | null {
  const withDates = assets.filter(a => a.created_at).sort((a, b) =>
    new Date(a.created_at!).getTime() - new Date(b.created_at!).getTime()
  );
  if (withDates.length < 3) return null;

  let rapidCount = 0;
  const pairs: string[] = [];
  for (let i = 1; i < withDates.length; i++) {
    const gap = new Date(withDates[i].created_at!).getTime() - new Date(withDates[i - 1].created_at!).getTime();
    const gapMin = gap / 60000;
    if (gapMin < 5 && gapMin >= 0) {
      rapidCount++;
      if (pairs.length < 3) {
        const nameA = withDates[i - 1].content?.metadata?.name || withDates[i - 1].id.slice(0, 8);
        const nameB = withDates[i].content?.metadata?.name || withDates[i].id.slice(0, 8);
        pairs.push(`${nameA} → ${nameB} (${Math.round(gapMin)}m apart)`);
      }
    }
  }

  if (rapidCount < 3) return null;
  return {
    type: 'bot_minting',
    severity: rapidCount >= 10 ? 'danger' : 'warning',
    description: `${rapidCount} NFTs minted within 5-minute intervals — bot minting detected`,
    evidence: pairs,
  };
}

function detectCircularTrading(transactions: any[], collectionAddress: string): WashTradeFlag | null {
  if (!Array.isArray(transactions) || transactions.length < 5) return null;

  // Track buyer/seller pairs
  const tradePairs: Record<string, number> = {};
  let totalSales = 0;

  for (const tx of transactions) {
    if (tx.type === 'NFT_SALE' || tx.type === 'COMPRESSED_NFT_SALE') {
      totalSales++;
      const buyer = tx.buyer || tx.feePayer;
      const seller = tx.seller || '';
      if (buyer && seller) {
        const pairKey = [buyer, seller].sort().join('_');
        tradePairs[pairKey] = (tradePairs[pairKey] || 0) + 1;
      }
    }
  }

  const repeatedPairs = Object.entries(tradePairs).filter(([, count]) => count >= 3);
  if (repeatedPairs.length === 0) return null;

  return {
    type: 'circular_trading',
    severity: repeatedPairs.length >= 3 ? 'danger' : 'warning',
    description: `${repeatedPairs.length} wallet pairs trading same NFTs back and forth — wash trading pattern`,
    evidence: repeatedPairs.slice(0, 3).map(([pair, count]) => {
      const [a, b] = pair.split('_');
      return `${a.slice(0, 6)}...↔${b.slice(0, 6)}... traded ${count}x`;
    }),
  };
}

function detectNoRoyalties(assets: NFTAsset[]): WashTradeFlag | null {
  const noRoyalty = assets.filter(a => !a.royalty || a.royalty.percent === 0);
  if (noRoyalty.length < assets.length * 0.8 || assets.length < 3) return null;

  return {
    type: 'no_royalties',
    severity: 'warning',
    description: `${noRoyalty.length}/${assets.length} NFTs have 0% royalties — may indicate disposable collection`,
    evidence: [`${Math.round(noRoyalty.length / assets.length * 100)}% of collection has no royalties`],
  };
}

function detectHighBurnRate(assets: NFTAsset[]): WashTradeFlag | null {
  const burnt = assets.filter(a => a.burnt);
  if (burnt.length < 3 || burnt.length / assets.length < 0.1) return null;

  return {
    type: 'high_burn_rate',
    severity: burnt.length / assets.length > 0.3 ? 'danger' : 'warning',
    description: `${burnt.length} NFTs burnt (${Math.round(burnt.length / assets.length * 100)}%) — potential rug indicator`,
    evidence: [`${burnt.length} of ${assets.length} total NFTs burnt`],
  };
}

function detectSingleCreator(assets: NFTAsset[]): WashTradeFlag | null {
  const creatorCounts: Record<string, number> = {};
  for (const a of assets) {
    if (a.creators) {
      for (const c of a.creators) {
        creatorCounts[c.address] = (creatorCounts[c.address] || 0) + 1;
      }
    }
  }

  const unverified = assets.filter(a => a.creators && a.creators.every(c => !c.verified));
  if (unverified.length > assets.length * 0.8 && assets.length >= 5) {
    return {
      type: 'single_creator',
      severity: 'warning',
      description: `${unverified.length}/${assets.length} NFTs have unverified creators`,
      evidence: Object.entries(creatorCounts)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 3)
        .map(([addr, count]) => `${addr.slice(0, 8)}... created ${count} NFTs`),
    };
  }
  return null;
}

function detectFakeVolume(transactions: any[]): WashTradeFlag | null {
  if (!Array.isArray(transactions) || transactions.length < 5) return null;

  // Check for sales with suspiciously uniform prices
  const salePrices: number[] = [];
  for (const tx of transactions) {
    if ((tx.type === 'NFT_SALE' || tx.type === 'COMPRESSED_NFT_SALE') && tx.nativeTransfers) {
      for (const nt of tx.nativeTransfers) {
        if (nt.amount > 0) {
          salePrices.push(nt.amount / 1e9); // lamports to SOL
        }
      }
    }
  }

  if (salePrices.length < 5) return null;

  // Check price clustering
  const priceCounts: Record<string, number> = {};
  for (const p of salePrices) {
    const rounded = p.toFixed(2);
    priceCounts[rounded] = (priceCounts[rounded] || 0) + 1;
  }

  const suspicious = Object.entries(priceCounts).filter(([, count]) => count >= 3);
  if (suspicious.length === 0) return null;

  return {
    type: 'fake_volume',
    severity: suspicious.length >= 2 ? 'danger' : 'warning',
    description: `${suspicious.length} price points repeated 3+ times — artificial volume suspected`,
    evidence: suspicious.slice(0, 3).map(([price, count]) => `${price} SOL appears in ${count} sales`),
  };
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const HELIUS_API_KEY = Deno.env.get('HELIUS_API_KEY');
    if (!HELIUS_API_KEY) throw new Error('HELIUS_API_KEY not configured');

    const { collectionAddress } = await req.json();
    if (!collectionAddress) throw new Error('collectionAddress is required');

    const HELIUS_RPC = `https://mainnet.helius-rpc.com/?api-key=${HELIUS_API_KEY}`;
    const HELIUS_API = `https://api.helius.xyz/v0`;

    // 1. Get NFTs by collection/creator
    const assetsResponse = await fetch(HELIUS_RPC, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 'nft-assets',
        method: 'getAssetsByCreator',
        params: {
          creatorAddress: collectionAddress,
          onlyVerified: false,
          page: 1,
          limit: 500,
        },
      }),
    });

    const assetsData = await assetsResponse.json();
    const allAssets = assetsData?.result?.items || [];

    // Filter for NFTs only (not fungible)
    const nftAssets: NFTAsset[] = allAssets.filter((a: any) => {
      const iface = a.interface;
      return iface === 'V1_NFT' || iface === 'V2_NFT' || iface === 'ProgrammableNFT' ||
             iface === 'V1_PRINT' || iface === 'MplCoreAsset' || !iface;
    });

    // 2. Get transaction history for wash trade detection
    const txResponse = await fetch(
      `${HELIUS_API}/addresses/${collectionAddress}/transactions?api-key=${HELIUS_API_KEY}&limit=100`
    );
    const transactions = await txResponse.json();

    // 3. Extract collection metadata
    const collectionName = nftAssets[0]?.content?.metadata?.name?.replace(/#\d+$/, '').trim() || `Collection-${collectionAddress.slice(0, 8)}`;
    const collectionImage = nftAssets[0]?.content?.links?.image || null;

    // 4. Compute stats
    const uniqueOwners = new Set(nftAssets.map((a: NFTAsset) => a.ownership?.owner).filter(Boolean));
    const frozenCount = nftAssets.filter((a: NFTAsset) => a.ownership?.frozen).length;
    const burntCount = nftAssets.filter((a: NFTAsset) => a.burnt).length;

    // Dev wallet = most common creator
    const creatorMap: Record<string, number> = {};
    for (const a of nftAssets) {
      if (a.creators) {
        for (const c of a.creators) {
          creatorMap[c.address] = (creatorMap[c.address] || 0) + 1;
        }
      }
    }
    const devWallet = Object.entries(creatorMap).sort((a, b) => b[1] - a[1])[0]?.[0] || collectionAddress;

    // Count NFT sales from transactions
    let salesCount = 0;
    if (Array.isArray(transactions)) {
      salesCount = transactions.filter((tx: any) =>
        tx.type === 'NFT_SALE' || tx.type === 'COMPRESSED_NFT_SALE' || tx.type === 'NFT_LISTING'
      ).length;
    }

    // 5. Run pattern detection
    const flags: WashTradeFlag[] = [];
    const detectors = [
      () => detectRapidRelisting(nftAssets),
      () => detectCircularTrading(Array.isArray(transactions) ? transactions : [], collectionAddress),
      () => detectNoRoyalties(nftAssets),
      () => detectHighBurnRate(nftAssets),
      () => detectSingleCreator(nftAssets),
      () => detectFakeVolume(Array.isArray(transactions) ? transactions : []),
    ];

    for (const detect of detectors) {
      const flag = detect();
      if (flag) flags.push(flag);
    }

    // 6. Risk scoring
    let riskScore = 0;
    if (nftAssets.length > 0 && uniqueOwners.size / nftAssets.length < 0.3) riskScore += 2; // low unique ownership
    if (burntCount > nftAssets.length * 0.2) riskScore += 2;
    if (frozenCount > 5) riskScore += 1;
    for (const flag of flags) {
      if (flag.severity === 'danger') riskScore += 2;
      else if (flag.severity === 'warning') riskScore += 1;
    }

    let riskLevel: string;
    if (riskScore >= 7) riskLevel = 'critical';
    else if (riskScore >= 4) riskLevel = 'high';
    else if (riskScore >= 2) riskLevel = 'medium';
    else riskLevel = 'low';

    const result = {
      collectionAddress,
      name: collectionName,
      image: collectionImage,
      devWallet,
      mintCount: nftAssets.length,
      uniqueOwners: uniqueOwners.size,
      burntCount,
      frozenCount,
      salesCount,
      riskLevel,
      washTradeFlags: flags,
      transactionCount: Array.isArray(transactions) ? transactions.length : 0,
      sampleNFTs: nftAssets.slice(0, 10).map((a: NFTAsset) => ({
        id: a.id,
        name: a.content?.metadata?.name || 'Unknown',
        image: a.content?.links?.image || null,
        owner: a.ownership?.owner || 'unknown',
        burnt: a.burnt || false,
      })),
    };

    return new Response(JSON.stringify({ success: true, data: result }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error: unknown) {
    console.error('NFT tracker error:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    return new Response(JSON.stringify({ success: false, error: message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
