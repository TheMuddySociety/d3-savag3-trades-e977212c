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

    const addresses = Array.from(this.subscribedTokens)
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

      this.subscribedTokens.forEach(tokenId => {
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

        // Update local cache
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

      const tokens: BirdeyeToken[] = data.data;
      return tokens.map((t, i) => ({
        id: t.address,
        name: t.name || `Token ${i + 1}`,
        symbol: t.symbol || 'UNK',
        price: t.price || 0,
        marketCap: t.marketcap || t.fdv || 0,
        volume24h: t.volume24hUSD || 0,
        change24h: t.price24hChangePercent || 0,
        logoUrl: t.logoURI || '/placeholder.svg',
        tokenAddress: t.address,
        liquidity: t.liquidity || 0,
        holders: 0,
        tags: ['Trending'],
        timestamp: Date.now(),
        bondingCurveProgress: undefined,
      }));
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
