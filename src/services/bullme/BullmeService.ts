
/**
 * Service for interacting with the Bullme.one API
 */
export interface BullmeToken {
  address: string;
  symbol: string;
  name: string;
  totalSupply: number;
  decimals: number;
  logo: string;
  creator: string;
  description: string;
  showName: boolean;
  twitter: string | null;
  telegram: string | null;
  website: string | null;
  blockNumber: number;
  hash: string;
  source: string;
  dex: string | null;
  timestamp: number;
  migrateTime: number | null;
  completeTime: number | null;
  marketCap: number;
  tradeVolume: number;
  tradeCount: number;
  top10Holder: number;
  bondingCurveProgress: number;
  status: string;
  tradeVolume24h: number;
  buyVolume24h: number;
  sellVolume24h: number;
  tradeCount24h: number;
  buyCount24h: number;
  sellCount24h: number;
  liquidity: number;
}

interface BullmeApiResponse {
  code: number;
  msg: string;
  ts: number;
  data: BullmeToken[];
  error: boolean;
}

export class BullmeService {
  private static BASE_URL = 'https://api.bullme.one';
  private static cachedTokens: BullmeToken[] | null = null;
  private static lastFetchTime: number = 0;
  private static CACHE_EXPIRY = 15 * 1000; // 15 seconds for near-real-time bonding curve prices

  /**
   * Fetch new token listings from the Bullme API
   */
  static async getNewTokens(): Promise<BullmeToken[]> {
    const now = Date.now();
    
    // Return cached data if it's fresh
    if (this.cachedTokens && (now - this.lastFetchTime < this.CACHE_EXPIRY)) {
      console.log('Using cached Bullme tokens');
      return this.cachedTokens;
    }
    
    try {
      console.log('Fetching new tokens from Bullme API');
      const response = await fetch(`${this.BASE_URL}/market/token/newTokens`);
      
      if (!response.ok) {
        throw new Error(`API error: ${response.status} ${response.statusText}`);
      }
      
      const data = await response.json() as BullmeApiResponse;
      
      if (data.error || data.code !== 0) {
        throw new Error(`API returned error: ${data.msg}`);
      }
      
      // Cache the response
      this.cachedTokens = data.data;
      this.lastFetchTime = now;
      
      return data.data;
    } catch (error) {
      console.error('Error fetching new tokens from Bullme API:', error);
      
      // Return cached data if available, even if expired
      if (this.cachedTokens) {
        console.log('Using expired cached Bullme tokens after fetch error');
        return this.cachedTokens;
      }
      
      throw error;
    }
  }

  /**
   * Map Bullme tokens to common token format
   */
  static mapToCommonTokens(tokens: BullmeToken[]) {
    return tokens.map(token => ({
      symbol: token.symbol,
      name: token.name,
      mint: token.address,
      decimals: token.decimals,
      logoURI: token.logo
    }));
  }
}
