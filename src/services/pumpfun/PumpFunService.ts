import { PumpFunApiResponse, PumpFunToken } from './types';
import { MemeToken } from '@/types/memeToken';
import { supabase } from '@/integrations/supabase/client';

interface PumpFunApiToken {
  address: string;
  name: string;
  symbol: string;
  price: number;
  marketCap: number;
  volume24h: number;
  change24h: number;
  change1h?: number;
  change5m?: number;
  liquidity: number;
  logoUrl: string;
  pairAddress?: string;
  dexId?: string;
  pairCreatedAt?: number;
  txns24h?: { buys?: number; sells?: number };
  websites?: { label: string; url: string }[];
  socials?: { type: string; url: string }[];
  graduated?: boolean;
}

class PumpFunService {
  private bullmeBaseUrl = 'https://api.bullme.one';

  /**
   * Fetch from official Pump.Fun edge function proxy
   */
  private async fetchFromProxy(action: string, limit: number = 30): Promise<PumpFunApiToken[]> {
    const { data, error } = await supabase.functions.invoke('pumpfun-api', {
      body: { action, limit },
    });

    if (error) {
      console.error('[PumpFun] Edge function error:', error);
      throw error;
    }

    return data?.tokens || [];
  }

  /**
   * Get trending Pump.Fun tokens (official API via DexScreener)
   */
  async getTrendingTokens(limit: number = 10): Promise<MemeToken[]> {
    try {
      const tokens = await this.fetchFromProxy('trending', limit);
      if (tokens.length > 0) {
        return tokens.slice(0, limit).map(this.transformApiToken);
      }
      // Fallback to BullMe
      return this.getTrendingTokensLegacy(limit);
    } catch (error) {
      console.warn('[PumpFun] Official API failed, falling back:', error);
      return this.getTrendingTokensLegacy(limit);
    }
  }

  /**
   * Get latest Pump.Fun tokens
   */
  async getLatestTokens(limit: number = 10): Promise<MemeToken[]> {
    try {
      const tokens = await this.fetchFromProxy('latest', limit);
      if (tokens.length > 0) {
        return tokens.slice(0, limit).map(this.transformApiToken);
      }
      return this.getNewTokensLegacy(limit);
    } catch (error) {
      console.warn('[PumpFun] Latest tokens fallback:', error);
      return this.getNewTokensLegacy(limit);
    }
  }

  /**
   * Get graduated Pump.Fun tokens
   */
  async getGraduatedTokens(limit: number = 10): Promise<MemeToken[]> {
    try {
      const tokens = await this.fetchFromProxy('graduated', limit);
      return tokens.slice(0, limit).map(this.transformApiToken);
    } catch (error) {
      console.warn('[PumpFun] Graduated tokens error:', error);
      return [];
    }
  }

  /**
   * Transform API token response to MemeToken
   */
  private transformApiToken(token: PumpFunApiToken): MemeToken {
    return {
      id: token.address,
      name: token.name || token.symbol,
      symbol: token.symbol,
      price: token.price || 0,
      marketCap: token.marketCap || 0,
      volume24h: token.volume24h || 0,
      change24h: token.change24h || 0,
      change1h: token.change1h,
      logoUrl: token.logoUrl || '/placeholder.svg',
      tokenAddress: token.address,
      liquidity: token.liquidity || 0,
      holders: (token.txns24h?.buys || 0) + (token.txns24h?.sells || 0),
      tags: [
        'Pump.Fun',
        token.dexId === 'pumpswap' ? 'PumpSwap' : token.dexId || '',
        token.graduated ? 'Graduated' : '',
      ].filter(Boolean),
      timestamp: token.pairCreatedAt || Date.now(),
      status: token.graduated ? 'graduated' : 'active',
      bondingCurveProgress: token.graduated ? 100 : undefined,
    };
  }

  // ─── Legacy BullMe Methods ───────────────────────────────

  async getNewTokens(): Promise<PumpFunToken[]> {
    try {
      const response = await fetch(`${this.bullmeBaseUrl}/market/token/newTokens`);
      if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
      const data: PumpFunApiResponse = await response.json();
      if (data.code !== 0) throw new Error(`API error: ${data.msg}`);
      return data.data;
    } catch (error) {
      console.error('Error fetching new tokens (BullMe):', error);
      throw error;
    }
  }

  private async getTrendingTokensLegacy(limit: number): Promise<MemeToken[]> {
    const tokens = await this.getNewTokens();
    return tokens
      .filter(t => t.tradeVolume24h > 0)
      .sort((a, b) => b.tradeVolume24h - a.tradeVolume24h || b.marketCap - a.marketCap)
      .slice(0, limit)
      .map(this.transformLegacyToken);
  }

  private async getNewTokensLegacy(limit: number): Promise<MemeToken[]> {
    const tokens = await this.getNewTokens();
    return tokens.slice(0, limit).map(this.transformLegacyToken);
  }

  private transformLegacyToken(token: PumpFunToken): MemeToken {
    const change24h = token.buyVolume24h > token.sellVolume24h
      ? Math.min(((token.buyVolume24h - token.sellVolume24h) / token.sellVolume24h) * 100, 999)
      : -Math.min(((token.sellVolume24h - token.buyVolume24h) / token.buyVolume24h) * 100, 999);

    return {
      id: token.address,
      name: token.name || token.symbol,
      symbol: token.symbol,
      price: token.marketCap / token.totalSupply,
      marketCap: token.marketCap,
      volume24h: token.tradeVolume24h,
      change24h: isNaN(change24h) ? 0 : change24h,
      logoUrl: token.logo,
      tokenAddress: token.address,
      liquidity: token.liquidity,
      holders: Math.floor(token.tradeCount * 10),
      tags: [token.source, token.status].filter(Boolean),
      timestamp: token.timestamp,
      status: token.status,
      bondingCurveProgress: token.bondingCurveProgress,
    };
  }
}

export const pumpFunService = new PumpFunService();
