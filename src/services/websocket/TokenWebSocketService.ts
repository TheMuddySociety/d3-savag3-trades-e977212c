import { MemeToken } from '@/types/memeToken';
import { supabase } from '@/integrations/supabase/client';

type PriceUpdateCallback = (updates: Map<string, Partial<MemeToken>>) => void;

interface BirdeyeToken {
  address: string;
  name: string;
  symbol: string;
  price: number;
  marketcap: number;
  fdv: number;
  liquidity: number;
  volume24hUSD: number;
  price24hChangePercent: number;
  logoURI: string;
  rank?: number;
}

class TokenWebSocketService {
  private callbacks: Set<PriceUpdateCallback> = new Set();
  private isConnected = false;
  private subscribedTokens: Set<string> = new Set();
  private tokenData: Map<string, MemeToken> = new Map();
  private pollInterval: NodeJS.Timeout | null = null;
  private readonly POLL_INTERVAL_MS = 5000; // Poll every 5 seconds

  async connect(): Promise<void> {
    if (this.isConnected) return;
    console.log('[TokenWS] Connecting to live Birdeye + Helius feeds');
    this.isConnected = true;
    this.startPolling();
  }

  private startPolling() {
    // Immediate first poll
    this.pollPrices();

    this.pollInterval = setInterval(() => {
      this.pollPrices();
    }, this.POLL_INTERVAL_MS);
  }

  private async pollPrices() {
    if (this.subscribedTokens.size === 0) return;

    // Separate tokens: bonding curve tokens (no DEX) vs migrated tokens
    const bondingCurveTokens: string[] = [];
    const dexTokens: string[] = [];

    this.subscribedTokens.forEach(id => {
      const token = this.tokenData.get(id);
      if (!token?.tokenAddress) return;
      // Tokens still on bonding curve have very low liquidity and no DEX pair
      // Jupiter/DexScreener won't have prices for them — skip the API call
      if (token.bondingCurveProgress !== undefined && token.bondingCurveProgress < 100) {
        bondingCurveTokens.push(id);
      } else {
        dexTokens.push(id);
      }
    });

    // For bonding curve tokens, price is already derived from Bullme data (marketCap/supply)
    // No update needed — they refresh via the main data polling

    // For DEX-listed tokens, fetch live prices from Jupiter
    const addresses = dexTokens
      .map(id => this.tokenData.get(id)?.tokenAddress)
      .filter(Boolean) as string[];

    if (addresses.length === 0) return;

    try {
      const { data, error } = await supabase.functions.invoke('token-prices', {
        body: { action: 'prices', addresses },
      });

      if (error) {
        console.error('[TokenWS] Price fetch error:', error);
        return;
      }

      if (!data?.success || !data?.data) return;

      const priceData = data.data as Record<string, { value: number; updateUnixTime: number; priceChange24h?: number }>;
      const updates = new Map<string, Partial<MemeToken>>();

      dexTokens.forEach(tokenId => {
        const token = this.tokenData.get(tokenId);
        if (!token?.tokenAddress) return;

        const live = priceData[token.tokenAddress];
        if (!live) return;

        const newPrice = live.value;
        const priceRatio = token.price > 0 ? newPrice / token.price : 1;

        const update: Partial<MemeToken> = {
          price: newPrice,
          marketCap: token.marketCap * priceRatio,
          change24h: live.priceChange24h ?? token.change24h,
        };

        updates.set(tokenId, update);
        this.tokenData.set(tokenId, { ...token, ...update });
      });

      if (updates.size > 0) {
        this.callbacks.forEach(cb => cb(updates));
      }
    } catch (err) {
      console.error('[TokenWS] Poll error:', err);
    }
  }

  async fetchTrendingTokens(): Promise<MemeToken[]> {
    try {
      const { data, error } = await supabase.functions.invoke('token-prices', {
        body: { action: 'trending' },
      });

      if (error || !data?.success) {
        console.error('[TokenWS] Trending fetch error:', error);
        return [];
      }

      const tokens = data.data as any[];
      return tokens
        .filter((t: any) => t.address && t.name)
        .map((t: any, i: number) => {
          const parseCurrencyString = (val: any): number => {
            if (typeof val === 'number') return val;
            if (typeof val !== 'string') return 0;
            const cleaned = val.replace(/[$,]/g, '');
            const multipliers: Record<string, number> = { T: 1e12, B: 1e9, M: 1e6, K: 1e3 };
            const match = cleaned.match(/^([\d.]+)\s*([TBMK])?$/i);
            if (!match) return parseFloat(cleaned) || 0;
            const num = parseFloat(match[1]);
            const mult = match[2] ? multipliers[match[2].toUpperCase()] || 1 : 1;
            return num * mult;
          };

          const isSolanaAddress = t.address.length >= 32 && t.address.length <= 44;

          // Derive tags from source data
          const tags: string[] = ['Solana'];
          if (t.source === 'boost') tags.push('Promoted');
          if (t.dexId) tags.push(t.dexId.charAt(0).toUpperCase() + t.dexId.slice(1));

          return {
            id: t.address,
            name: t.name || `Token ${i + 1}`,
            symbol: t.symbol || 'UNK',
            price: t.price || 0,
            marketCap: parseCurrencyString(t.market_cap),
            volume24h: parseCurrencyString(t.volume_24h),
            change24h: t.price_change_24h || 0,
            change1h: t.price_change_1h || 0,
            change5m: t.price_change_5m || 0,
            logoUrl: t.logo || '/placeholder.svg',
            tokenAddress: isSolanaAddress ? t.address : undefined,
            liquidity: t.liquidity || 0,
            holders: (t.txns_buys_24h || 0) + (t.txns_sells_24h || 0),
            tags,
            timestamp: t.pairAge ? t.pairAge : Date.now(),
            bondingCurveProgress: t.bonding_curve_progress ?? undefined,
          };
        });
    } catch (err) {
      console.error('[TokenWS] Trending error:', err);
      return [];
    }
  }

  subscribeToTokens(tokens: MemeToken[]) {
    tokens.forEach(token => {
      this.subscribedTokens.add(token.id);
      this.tokenData.set(token.id, token);
    });
    console.log(`[TokenWS] Subscribed to ${tokens.length} tokens for live prices`);
  }

  unsubscribeFromTokens(tokenIds: string[]) {
    tokenIds.forEach(id => {
      this.subscribedTokens.delete(id);
      this.tokenData.delete(id);
    });
  }

  onPriceUpdate(callback: PriceUpdateCallback): () => void {
    this.callbacks.add(callback);
    return () => { this.callbacks.delete(callback); };
  }

  disconnect() {
    this.isConnected = false;
    if (this.pollInterval) {
      clearInterval(this.pollInterval);
      this.pollInterval = null;
    }
    this.subscribedTokens.clear();
    this.tokenData.clear();
    this.callbacks.clear();
    console.log('[TokenWS] Disconnected');
  }

  getConnectionStatus(): boolean {
    return this.isConnected;
  }
}

export const tokenWebSocketService = new TokenWebSocketService();
