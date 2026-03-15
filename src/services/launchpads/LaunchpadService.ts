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
  { id: 'all', name: 'All Launchpads', displayName: 'All', color: 'bg-primary', icon: '🚀' },
  { id: 'pumpfun', name: 'Pump.Fun', displayName: 'Pump.Fun', color: 'bg-green-500', icon: '💎' },
  { id: 'bullme', name: 'Bullme.one', displayName: 'Bullme', color: 'bg-blue-500', icon: '🐂' },
  { id: 'moonshot', name: 'Moonshot', displayName: 'Moonshot', color: 'bg-yellow-500', icon: '🌙' },
  { id: 'raydium', name: 'Raydium', displayName: 'Raydium', color: 'bg-purple-500', icon: '⚡' },
  { id: 'jupiter', name: 'Jupiter', displayName: 'Jupiter', color: 'bg-orange-500', icon: '🪐' },
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
      switch (launchpadId) {
        case 'all':
          tokens = await this.getAllTokens(limit);
          break;
        case 'pumpfun':
          tokens = await pumpFunService.getTrendingTokens(limit);
          break;
        case 'bullme':
          const bullmeTokens = await BullmeService.getNewTokens();
          tokens = this.mapBullmeToMemeTokens(bullmeTokens.slice(0, limit));
          break;
        case 'moonshot':
          tokens = await this.fetchDexScreenerTokens('moonshot', limit);
          break;
        case 'raydium':
          tokens = await this.fetchDexScreenerTokens('raydium', limit);
          break;
        case 'jupiter':
          tokens = await this.fetchDexScreenerTokens('jupiter', limit);
          break;
        default:
          tokens = await pumpFunService.getTrendingTokens(limit);
      }

      this.cache.set(cacheKey, { data: tokens, timestamp: Date.now() });
      return tokens;
    } catch (error) {
      console.error(`Error fetching tokens from ${launchpadId}:`, error);
      return cached?.data || [];
    }
  }

  private static async getAllTokens(limit: number): Promise<MemeToken[]> {
    try {
      const [pumpFunTokens, bullmeTokens, moonshotTokens, raydiumTokens] = await Promise.allSettled([
        pumpFunService.getTrendingTokens(Math.ceil(limit * 0.3)),
        BullmeService.getNewTokens(),
        this.fetchDexScreenerTokens('moonshot', Math.ceil(limit * 0.2)),
        this.fetchDexScreenerTokens('raydium', Math.ceil(limit * 0.2)),
      ]);

      const pf = pumpFunTokens.status === 'fulfilled' ? pumpFunTokens.value : [];
      const bm = bullmeTokens.status === 'fulfilled'
        ? this.mapBullmeToMemeTokens(bullmeTokens.value.slice(0, Math.ceil(limit * 0.2)))
        : [];
      const ms = moonshotTokens.status === 'fulfilled' ? moonshotTokens.value : [];
      const ry = raydiumTokens.status === 'fulfilled' ? raydiumTokens.value : [];

      return [...pf, ...bm, ...ms, ...ry]
        .sort((a, b) => b.volume24h - a.volume24h)
        .slice(0, limit);
    } catch (error) {
      console.error('Error fetching all tokens:', error);
      return [];
    }
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
