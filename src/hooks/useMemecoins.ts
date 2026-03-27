
import { useState, useEffect, useCallback } from 'react';
import { MemeToken } from '@/types/memeToken';
import { BullmeService } from '@/services/bullme/BullmeService';
import { toast } from '@/hooks/use-toast';

// Time units for display
const getAgeDisplay = (timestamp: number): string => {
  const now = Date.now();
  const diffMs = now - timestamp;
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 60) return `${diffMins}m`;
  if (diffHours < 24) return `${diffHours}h`;
  return `${diffDays}d`;
};

import { supabase } from '@/integrations/supabase/client';

export const useMemecoins = () => {
  const [memecoins, setMemecoins] = useState<MemeToken[]>([]);
  const [loading, setLoading] = useState(true);
  const [sortField, setSortField] = useState<string>('timestamp');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');
  const [isRefreshing, setIsRefreshing] = useState(false);

  const fetchMemecoins = useCallback(async (silent = false) => {
    try {
      if (!silent) setLoading(true);
      
      console.log('[useMemecoins] Fetching trending tokens from Edge Function...');
      const { data, error } = await supabase.functions.invoke('token-prices', {
        body: { action: 'trending' }
      });

      if (error) throw error;
      
      const trendingData = data.data || [];
      
      // Map to MemeToken format
      const transformedTokens: MemeToken[] = trendingData.map((t: any, index: number) => ({
        id: t.address || `t-${index}`,
        name: t.name || 'Unknown',
        symbol: t.symbol || '???',
        price: Number(t.price || 0),
        marketCap: Number(t.market_cap || 0),
        volume24h: Number(t.volume_24h || 0),
        change24h: Number(t.price_change_24h || 0),
        change1h: 0, // Not provided by this endpoint
        logoUrl: `https://raw.githubusercontent.com/solana-labs/token-list/main/assets/mainnet/${t.address}/logo.png`, // Placeholder logo logic
        tokenAddress: t.address,
        liquidity: 0, // Not provided by trending endpoint
        holders: Number(t.holders || t.unique_traders_24h || 0),
        age: '—',
        onChainHolders: Number(t.holders || 0),
        onChainLiquidity: 0,
        tags: ["Trending", t.address.endsWith('pump') ? "Pump.Fun" : "Solana"],
        timestamp: Date.now() - (index * 60000), // Mock timestamp for sorting
        status: "LISTED"
      }));

      // Fallback to Bullme if Edge Function is empty
      if (transformedTokens.length === 0) {
        console.log('[useMemecoins] Edge Function returned no tokens, falling back to Bullme...');
        const bullmeTokens = await BullmeService.getNewTokens();
        // ... (Keep existing Bullme mapping if needed, or just set to empty if Bullme is also failing)
        const bullmeMapped = bullmeTokens
          .filter(token => token.address.endsWith('pump'))
          .map((token) => ({
            id: token.address,
            name: token.name,
            symbol: token.symbol,
            price: token.marketCap / token.totalSupply,
            marketCap: token.marketCap,
            volume24h: token.tradeVolume24h,
            change24h: (token.buyVolume24h + token.sellVolume24h) > 0
              ? ((token.buyVolume24h - token.sellVolume24h) / (token.buyVolume24h + token.sellVolume24h)) * 100
              : 0,
            change1h: (token.buyCount24h + token.sellCount24h) > 0
              ? ((token.buyCount24h - token.sellCount24h) / (token.buyCount24h + token.sellCount24h)) * 50
              : 0,
            logoUrl: token.logo,
            tokenAddress: token.address,
            liquidity: token.liquidity,
            holders: token.tradeCount,
            age: getAgeDisplay(token.timestamp),
            onChainHolders: token.tradeCount,
            onChainLiquidity: token.liquidity,
            tags: ["Pump.Fun", token.status === "NEW" ? "New" : "Listed"],
            timestamp: token.timestamp,
            status: token.status
          }));
        setMemecoins(bullmeMapped.slice(0, 30));
      } else {
        setMemecoins(transformedTokens.slice(0, 30));
      }

    } catch (error) {
      console.error('Error fetching memecoins:', error);
      toast({
        title: "Failed to fetch tokens",
        description: "Please try again later",
        variant: "destructive"
      });
      
      // No fallback mock data — show empty state
      setMemecoins([]);
    } finally {
      setLoading(false);
      setIsRefreshing(false);
    }
  }, []);

  const refreshData = useCallback(() => {
    setIsRefreshing(true);
    fetchMemecoins(false);
  }, [fetchMemecoins]);

  const handleSort = useCallback((field: string) => {
    setSortField(field);
    setSortDirection(current => 
      sortField === field ? (current === 'asc' ? 'desc' : 'asc') : 'desc'
    );
  }, [sortField]);

  useEffect(() => {
    fetchMemecoins();
    
    // Poll Bullme API every 15 seconds for bonding curve price updates
    const pollInterval = setInterval(() => {
      fetchMemecoins(true); // silent refresh — no loading spinner
    }, 15000);
    
    return () => clearInterval(pollInterval);
  }, [fetchMemecoins]);

  useEffect(() => {
    // Sort memecoins based on sortField and sortDirection
    setMemecoins(currentMemecoins => {
      const sortedCoins = [...currentMemecoins].sort((a, b) => {
        const fieldA = a[sortField as keyof MemeToken];
        const fieldB = b[sortField as keyof MemeToken];
        
        if (fieldA === undefined || fieldB === undefined) return 0;
        
        if (typeof fieldA === 'string' && typeof fieldB === 'string') {
          return sortDirection === 'asc' 
            ? fieldA.localeCompare(fieldB) 
            : fieldB.localeCompare(fieldA);
        }
        
        return sortDirection === 'asc'
          ? Number(fieldA) - Number(fieldB)
          : Number(fieldB) - Number(fieldA);
      });
      
      return sortedCoins;
    });
  }, [sortField, sortDirection]);

  return {
    memecoins,
    loading,
    isRefreshing,
    refreshData,
    handleSort
  };
};
