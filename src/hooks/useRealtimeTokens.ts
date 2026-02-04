import { useState, useEffect, useCallback, useRef } from 'react';
import { MemeToken } from '@/types/memeToken';
import { LaunchpadService } from '@/services/launchpads/LaunchpadService';
import { tokenWebSocketService } from '@/services/websocket/TokenWebSocketService';

export function useRealtimeTokens(launchpadId: string, limit: number = 10) {
  const [tokens, setTokens] = useState<MemeToken[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);
  
  const unsubscribeRef = useRef<(() => void) | null>(null);
  const tokensRef = useRef<MemeToken[]>([]);
  
  // Keep tokensRef in sync
  useEffect(() => {
    tokensRef.current = tokens;
  }, [tokens]);

  // Handle real-time price updates
  const handlePriceUpdates = useCallback((updates: Map<string, Partial<MemeToken>>) => {
    setTokens(currentTokens => {
      const updatedTokens = currentTokens.map(token => {
        const update = updates.get(token.id);
        if (update) {
          return { ...token, ...update };
        }
        return token;
      });
      return updatedTokens;
    });
    setLastUpdate(new Date());
  }, []);

  // Initial fetch and WebSocket setup
  useEffect(() => {
    let isMounted = true;

    const initializeTokens = async () => {
      try {
        setLoading(true);
        setError(null);
        
        // Fetch initial token data
        const fetchedTokens = await LaunchpadService.getTokensByLaunchpad(launchpadId, limit);
        
        if (!isMounted) return;
        
        setTokens(fetchedTokens);
        
        // Connect to WebSocket and subscribe to tokens
        await tokenWebSocketService.connect();
        tokenWebSocketService.subscribeToTokens(fetchedTokens);
        
        // Set up price update listener
        unsubscribeRef.current = tokenWebSocketService.onPriceUpdate(handlePriceUpdates);
        
        setIsConnected(tokenWebSocketService.getConnectionStatus());
        setLastUpdate(new Date());
        
      } catch (err) {
        if (isMounted) {
          setError(err instanceof Error ? err.message : 'Failed to fetch tokens');
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    };

    initializeTokens();

    // Periodic full refresh every 60 seconds to sync with API
    const refreshInterval = setInterval(async () => {
      if (!isMounted) return;
      
      try {
        const freshTokens = await LaunchpadService.getTokensByLaunchpad(launchpadId, limit);
        if (isMounted) {
          setTokens(freshTokens);
          tokenWebSocketService.subscribeToTokens(freshTokens);
        }
      } catch (err) {
        console.error('Error refreshing tokens:', err);
      }
    }, 60000);

    return () => {
      isMounted = false;
      clearInterval(refreshInterval);
      
      if (unsubscribeRef.current) {
        unsubscribeRef.current();
      }
      
      // Unsubscribe from current tokens
      tokenWebSocketService.unsubscribeFromTokens(tokensRef.current.map(t => t.id));
    };
  }, [launchpadId, limit, handlePriceUpdates]);

  // Check connection status periodically
  useEffect(() => {
    const statusInterval = setInterval(() => {
      setIsConnected(tokenWebSocketService.getConnectionStatus());
    }, 5000);

    return () => clearInterval(statusInterval);
  }, []);

  return { 
    tokens, 
    loading, 
    error, 
    isConnected,
    lastUpdate 
  };
}
