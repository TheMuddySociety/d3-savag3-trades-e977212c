import { MemeToken } from '@/types/memeToken';

type PriceUpdateCallback = (updates: Map<string, Partial<MemeToken>>) => void;

interface WebSocketMessage {
  type: 'price_update' | 'token_update' | 'heartbeat';
  data?: {
    address: string;
    price?: number;
    marketCap?: number;
    volume24h?: number;
    change24h?: number;
    change1h?: number;
    holders?: number;
  }[];
}

class TokenWebSocketService {
  private ws: WebSocket | null = null;
  private callbacks: Set<PriceUpdateCallback> = new Set();
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private reconnectTimeout: NodeJS.Timeout | null = null;
  private heartbeatInterval: NodeJS.Timeout | null = null;
  private isConnected = false;
  private subscribedTokens: Set<string> = new Set();
  
  // Simulated price updates for demo (since we don't have a real WS endpoint)
  private simulationInterval: NodeJS.Timeout | null = null;
  private tokenData: Map<string, MemeToken> = new Map();

  connect(): Promise<void> {
    return new Promise((resolve) => {
      // For now, simulate WebSocket with interval-based updates
      // In production, replace with actual WebSocket connection
      console.log('[WebSocket] Starting real-time price simulation');
      this.isConnected = true;
      this.startSimulation();
      resolve();
    });
  }

  private startSimulation() {
    // Simulate real-time price updates every 2 seconds
    this.simulationInterval = setInterval(() => {
      if (this.subscribedTokens.size === 0) return;
      
      const updates = new Map<string, Partial<MemeToken>>();
      
      this.subscribedTokens.forEach(tokenId => {
        const existingToken = this.tokenData.get(tokenId);
        if (!existingToken) return;
        
        // Simulate small price fluctuations (-2% to +2%)
        const priceChange = 1 + (Math.random() - 0.5) * 0.04;
        const newPrice = existingToken.price * priceChange;
        const newMarketCap = existingToken.marketCap * priceChange;
        
        // Simulate volume changes
        const volumeChange = 1 + (Math.random() - 0.5) * 0.1;
        const newVolume = existingToken.volume24h * volumeChange;
        
        // Calculate new 24h change based on price movement
        const change24hDelta = (priceChange - 1) * 100;
        const newChange24h = existingToken.change24h + change24hDelta * 0.1;
        
        // Simulate 1h change
        const newChange1h = (existingToken.change1h || 0) + change24hDelta * 0.3;
        
        updates.set(tokenId, {
          price: newPrice,
          marketCap: newMarketCap,
          volume24h: newVolume,
          change24h: newChange24h,
          change1h: newChange1h,
        });
        
        // Update local cache
        this.tokenData.set(tokenId, {
          ...existingToken,
          price: newPrice,
          marketCap: newMarketCap,
          volume24h: newVolume,
          change24h: newChange24h,
          change1h: newChange1h,
        });
      });
      
      // Notify all callbacks
      if (updates.size > 0) {
        this.callbacks.forEach(callback => callback(updates));
      }
    }, 2000);
  }

  subscribeToTokens(tokens: MemeToken[]) {
    tokens.forEach(token => {
      this.subscribedTokens.add(token.id);
      this.tokenData.set(token.id, token);
    });
    
    console.log(`[WebSocket] Subscribed to ${tokens.length} tokens`);
  }

  unsubscribeFromTokens(tokenIds: string[]) {
    tokenIds.forEach(id => {
      this.subscribedTokens.delete(id);
      this.tokenData.delete(id);
    });
  }

  onPriceUpdate(callback: PriceUpdateCallback): () => void {
    this.callbacks.add(callback);
    return () => {
      this.callbacks.delete(callback);
    };
  }

  disconnect() {
    this.isConnected = false;
    
    if (this.simulationInterval) {
      clearInterval(this.simulationInterval);
      this.simulationInterval = null;
    }
    
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
    
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
    }
    
    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
      this.reconnectTimeout = null;
    }
    
    this.subscribedTokens.clear();
    this.tokenData.clear();
    this.callbacks.clear();
    
    console.log('[WebSocket] Disconnected');
  }

  getConnectionStatus(): boolean {
    return this.isConnected;
  }
}

export const tokenWebSocketService = new TokenWebSocketService();
