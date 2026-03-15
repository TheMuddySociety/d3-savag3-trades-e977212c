import { PumpFunCoin, PumpFunApiResponse, PumpFunToken } from './types';
import { MemeToken } from '@/types/memeToken';
import { supabase } from '@/integrations/supabase/client';

class PumpFunService {
  private bullmeBaseUrl = 'https://api.bullme.one';

  /**
   * Fetch coins from the official Pump.Fun API via edge function proxy
   */
  private async fetchFromPumpFun(endpoint: string, params?: Record<string, string | number>): Promise<PumpFunCoin[]> {
    const { data, error } = await supabase.functions.invoke('pumpfun-api', {
      body: { endpoint, params },
    });

    if (error) {
      console.error('[PumpFun] Edge function error:', error);
      throw new Error(`Pump.Fun API error: ${error.message}`);
    }

    // The API returns an array of coins directly
    if (Array.isArray(data)) {
      return data;
    }

    // Sometimes wrapped in a response object
    if (data?.coins) return data.coins;
    if (data?.data) return data.data;

    console.warn('[PumpFun] Unexpected response format:', data);
    return [];
  }

  /**
   * Get trending tokens from King of the Hill (official Pump.Fun API)
   */
  async getTrendingTokens(limit: number = 10): Promise<MemeToken[]> {
    try {
      // Try official API first
      const coins = await this.fetchFromPumpFun('/coins/king-of-the-hill', {
        includeNsfw: 'false',
      });

      if (coins.length > 0) {
        return coins.slice(0, limit).map(this.transformCoinToMemeToken);
      }

      // Fallback to BullMe proxy
      console.warn('[PumpFun] Official API returned no data, falling back to BullMe');
      return this.getTrendingTokensLegacy(limit);
    } catch (error) {
      console.warn('[PumpFun] Official API failed, falling back to BullMe:', error);
      return this.getTrendingTokensLegacy(limit);
    }
  }

  /**
   * Get latest/newest tokens from official Pump.Fun API
   */
  async getLatestTokens(limit: number = 10): Promise<MemeToken[]> {
    try {
      const coins = await this.fetchFromPumpFun('/coins/latest', {
        includeNsfw: 'false',
      });

      if (coins.length > 0) {
        return coins.slice(0, limit).map(this.transformCoinToMemeToken);
      }

      return this.getNewTokensLegacy(limit);
    } catch (error) {
      console.warn('[PumpFun] Latest tokens fallback to BullMe:', error);
      return this.getNewTokensLegacy(limit);
    }
  }

  /**
   * Get currently live tokens from official Pump.Fun API
   */
  async getCurrentlyLiveTokens(limit: number = 10): Promise<MemeToken[]> {
    try {
      const coins = await this.fetchFromPumpFun('/coins/currently-live', {
        includeNsfw: 'false',
      });

      return coins.slice(0, limit).map(this.transformCoinToMemeToken);
    } catch (error) {
      console.warn('[PumpFun] Currently live tokens error:', error);
      return [];
    }
  }

  /**
   * Transform official Pump.Fun coin to MemeToken
   */
  private transformCoinToMemeToken(coin: PumpFunCoin): MemeToken {
    const solReserves = coin.virtual_sol_reserves / 1e9; // lamports to SOL
    const tokenReserves = coin.virtual_token_reserves / 1e6; // adjust decimals
    const price = tokenReserves > 0 ? solReserves / tokenReserves : 0;
    const bondingProgress = coin.complete ? 100 : Math.min(
      ((coin.virtual_sol_reserves / 1e9) / 85) * 100, // ~85 SOL to graduate
      99
    );

    return {
      id: coin.mint,
      name: coin.name || coin.symbol,
      symbol: coin.symbol,
      price: coin.usd_market_cap > 0 && coin.total_supply > 0
        ? coin.usd_market_cap / (coin.total_supply / 1e6)
        : price,
      marketCap: coin.usd_market_cap || coin.market_cap || 0,
      volume24h: 0, // Not provided directly by this endpoint
      change24h: 0, // Not provided directly
      logoUrl: coin.image_uri || '/placeholder.svg',
      tokenAddress: coin.mint,
      liquidity: solReserves * 2, // Approximate liquidity from reserves
      holders: coin.reply_count || 0,
      tags: [
        'Pump.Fun',
        coin.complete ? 'Graduated' : 'Bonding',
        coin.is_currently_live ? 'Live' : '',
      ].filter(Boolean),
      timestamp: coin.created_timestamp || Date.now(),
      status: coin.complete ? 'graduated' : 'active',
      bondingCurveProgress: bondingProgress,
    };
  }

  // ─── Legacy BullMe Proxy Methods ───────────────────────────────

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
      .filter(token => token.tradeVolume24h > 0)
      .sort((a, b) => b.tradeVolume24h - a.tradeVolume24h || b.marketCap - a.marketCap)
      .slice(0, limit)
      .map(this.transformLegacyToMemeToken);
  }

  private async getNewTokensLegacy(limit: number): Promise<MemeToken[]> {
    const tokens = await this.getNewTokens();
    return tokens.slice(0, limit).map(this.transformLegacyToMemeToken);
  }

  private transformLegacyToMemeToken(token: PumpFunToken): MemeToken {
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
      change24h: isNaN(change24h) ? Math.random() * 20 - 10 : change24h,
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
