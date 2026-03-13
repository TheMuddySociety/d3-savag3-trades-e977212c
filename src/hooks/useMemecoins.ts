
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

export const useMemecoins = () => {
  const [memecoins, setMemecoins] = useState<MemeToken[]>([]);
  const [loading, setLoading] = useState(true);
  const [sortField, setSortField] = useState<string>('timestamp');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');
  const [isRefreshing, setIsRefreshing] = useState(false);

  const fetchMemecoins = useCallback(async (silent = false) => {
    try {
      if (!silent) setLoading(true);
      const bullmeTokens = await BullmeService.getNewTokens();
      
      // Transform Bullme tokens to our MemeToken format
      const transformedTokens = bullmeTokens.map((token, index) => ({
        id: token.address,
        name: token.name,
        symbol: token.symbol,
        price: token.marketCap / token.totalSupply,
        marketCap: token.marketCap,
        volume24h: token.tradeVolume24h,
        change24h: token.buyVolume24h > token.sellVolume24h ? 7.8 : -1.3, // Simplified calculation
        change1h: token.buyVolume24h > token.sellVolume24h ? 0.7 : -0.5, // Simplified calculation
        logoUrl: token.logo,
        tokenAddress: token.address,
        liquidity: token.liquidity,
        holders: token.tradeCount,
        age: getAgeDisplay(token.timestamp),
        onChainHolders: token.tradeCount,
        onChainLiquidity: token.liquidity,
        tags: token.status === "NEW" ? ["New"] : ["Listed"],
        timestamp: token.timestamp,
        status: token.status
      }));

      setMemecoins(transformedTokens);
    } catch (error) {
      console.error('Error fetching memecoins:', error);
      toast({
        title: "Failed to fetch tokens",
        description: "Please try again later",
        variant: "destructive"
      });
      
      // Fallback to mock data if API fails
      setMemecoins([
        {
          id: "coin1",
          name: "CATTTT",
          symbol: "CATTTT",
          price: 0.001,
          marketCap: 11600000,
          volume24h: 2300000,
          change24h: 7.8,
          change1h: 0.7,
          logoUrl: "https://picsum.photos/200",
          tokenAddress: "So11111111111111111111111111111111111111112",
          liquidity: 1000000,
          holders: 2400,
          age: "50m",
          onChainHolders: 2400,
          onChainLiquidity: 1000000,
          tags: ["New", "Meme"],
          timestamp: Date.now() - 50 * 60 * 1000,
          status: "NEW"
        },
        {
          id: "coin2",
          name: "RMC",
          symbol: "RMC",
          price: 0.0001,
          marketCap: 538500,
          volume24h: 168400,
          change24h: 13.7,
          change1h: 5.1,
          logoUrl: "https://picsum.photos/201",
          tokenAddress: "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v",
          liquidity: 44400,
          holders: 1000,
          age: "4h",
          onChainHolders: 1000,
          onChainLiquidity: 44400,
          tags: ["Listed", "Meme"],
          timestamp: Date.now() - 4 * 60 * 60 * 1000,
          status: "LISTED"
        }
      ]);
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
