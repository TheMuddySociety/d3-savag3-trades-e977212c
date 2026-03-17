import { pumpFunService } from '../pumpfun';
import { BullmeService, BullmeToken } from '../bullme/BullmeService';
import { MemeToken } from '@/types/memeToken';

export interface LaunchpadConfig {
  id: string;
  name: string;
  displayName: string;
  color: string;
  icon: string;
}

export const LAUNCHPADS: LaunchpadConfig[] = [
  { id: 'pumpfun', name: 'Pump.Fun', displayName: 'Pump.Fun', color: 'bg-green-500', icon: '💎' },
];

export class LaunchpadService {
  private static cache = new Map<string, { data: MemeToken[], timestamp: number }>();
  private static readonly CACHE_DURATION = 30000;

  static async getTokensByLaunchpad(launchpadId: string, limit: number = 10): Promise<MemeToken[]> {
    const cacheKey = `${launchpadId}-${limit}`;
    const cached = this.cache.get(cacheKey);
    
    if (cached && Date.now() - cached.timestamp < this.CACHE_DURATION) {
      return cached.data;
    }

    let tokens: MemeToken[] = [];

    try {
      tokens = await pumpFunService.getTrendingTokens(limit);
      
      // Safety filter for Pump.Fun tokens
      tokens = tokens.filter(t => t.tokenAddress?.endsWith('pump'));

      this.cache.set(cacheKey, { data: tokens, timestamp: Date.now() });
      return tokens;
    } catch (error) {
      console.error(`Error fetching tokens from ${launchpadId}:`, error);
      return cached?.data || [];
    }
  }

  private static async getAllTokens(limit: number): Promise<MemeToken[]> {
    return pumpFunService.getTrendingTokens(limit);
  }

  private static mapBullmeToMemeTokens(bullmeTokens: BullmeToken[]): MemeToken[] {
    return bullmeTokens.map((token, index) => {
      const supply = token.totalSupply || 1;
      const price = token.marketCap > 0 && supply > 0 ? token.marketCap / supply : 0;
      const buyVol = token.buyVolume24h || 0;
      const sellVol = token.sellVolume24h || 0;
      const totalVol = buyVol + sellVol;
      const change24h = totalVol > 0 ? ((buyVol - sellVol) / totalVol) * 100 : 0;

      return {
        id: token.address || `bullme-${index}`,
        name: token.name || `Token ${index + 1}`,
        symbol: token.symbol || 'UNK',
        price,
        marketCap: token.marketCap || 0,
        volume24h: token.tradeVolume24h || 0,
        change24h,
        logoUrl: token.logo || '/placeholder.svg',
        tokenAddress: token.address,
        liquidity: token.liquidity || 0,
        holders: token.tradeCount || 0,
        tags: ['Bullme', token.status === 'active' ? 'Active' : 'New'],
        timestamp: token.timestamp || Date.now(),
        bondingCurveProgress: token.bondingCurveProgress || 0,
      };
    });
  }

  /**
   * Fetch real token data from DexScreener filtered by dexId
   */
  private static async fetchDexScreenerTokens(dexId: string, limit: number): Promise<MemeToken[]> {
    try {
      const resp = await fetch(
        `https://api.dexscreener.com/latest/dex/search?q=${dexId}&chain=solana`
      );
      if (!resp.ok) {
        console.warn(`DexScreener search failed for ${dexId}: ${resp.status}`);
        return [];
      }
      const data = await resp.json();
      const pairs = (data?.pairs || []).filter(
        (p: any) => p.chainId === 'solana' && (dexId === 'moonshot' || p.dexId?.toLowerCase().includes(dexId))
      );

      const seen = new Set<string>();
      const tokens: MemeToken[] = [];

      for (const pair of pairs) {
        const addr = pair.baseToken?.address;
        if (!addr || seen.has(addr)) continue;
        seen.add(addr);

        tokens.push({
          id: addr,
          name: pair.baseToken?.name || '',
          symbol: pair.baseToken?.symbol || '',
          price: parseFloat(pair.priceUsd) || 0,
          marketCap: pair.marketCap || pair.fdv || 0,
          volume24h: pair.volume?.h24 || 0,
          change24h: pair.priceChange?.h24 || 0,
          logoUrl: pair.info?.imageUrl || '/placeholder.svg',
          tokenAddress: addr,
          liquidity: pair.liquidity?.usd || 0,
          holders: 0,
          tags: [dexId.charAt(0).toUpperCase() + dexId.slice(1), 'DEX'],
          timestamp: pair.pairCreatedAt || Date.now(),
          bondingCurveProgress: undefined,
        });

        if (tokens.length >= limit) break;
      }

      return tokens;
    } catch (error) {
      console.error(`DexScreener fetch error for ${dexId}:`, error);
      return [];
    }
  }
}
