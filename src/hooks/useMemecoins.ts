
import { useState, useEffect } from 'react';
import { mockMemecoins } from "@/lib/mock-data";
import { SolanaService } from '@/services/SolanaService';
import { toast } from 'sonner';
import { MemeToken } from '@/types/memeToken';

export function useMemecoins() {
  const [memecoins, setMemecoins] = useState<MemeToken[]>([]);
  const [loading, setLoading] = useState(true);
  const [sortBy, setSortBy] = useState('change24h');
  const [sortDirection, setSortDirection] = useState('desc');
  const [isRefreshing, setIsRefreshing] = useState(false);

  const enrichWithOnChainData = async (coins: MemeToken[]) => {
    const enrichedCoins = [...coins];
    
    enrichedCoins.forEach((coin, index) => {
      if (!coin.tokenAddress) {
        coin.tokenAddress = `So1ana${index}MemeToken${coin.id.slice(0, 8)}111111111111111`;
      }
    });
    
    for (const coin of enrichedCoins) {
      if (coin.tokenAddress) {
        try {
          const liquidity = await SolanaService.getTokenLiquidity(coin.tokenAddress);
          if (liquidity !== null) {
            coin.onChainLiquidity = liquidity;
          }
          coin.onChainHolders = Math.floor(Math.random() * 10000) + 100;
        } catch (error) {
          console.error(`Error fetching on-chain data for ${coin.symbol}:`, error);
        }
      }
    }
    
    return enrichedCoins;
  };

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      
      SolanaService.initConnection();
      
      try {
        setTimeout(async () => {
          const enrichedCoins = await enrichWithOnChainData(mockMemecoins);
          setMemecoins(enrichedCoins);
          setLoading(false);
          console.log('Enriched memecoins with on-chain data:', enrichedCoins);
        }, 1500);
      } catch (error) {
        console.error('Error fetching data:', error);
        toast.error('Failed to fetch token data');
        setLoading(false);
      }
    };

    fetchData();
    
    const tokenAddresses = mockMemecoins
      .filter(coin => coin.tokenAddress)
      .map(coin => coin.tokenAddress as string);
      
    const stopMonitoring = SolanaService.startPriceMonitoring(tokenAddresses, (updates) => {
      console.log('Price updates:', updates);
    });
    
    return () => {
      stopMonitoring();
    };
  }, []);

  const refreshData = async () => {
    setIsRefreshing(true);
    try {
      const enrichedCoins = await enrichWithOnChainData(memecoins);
      setMemecoins([...enrichedCoins]);
      toast.success('On-chain data refreshed');
    } catch (error) {
      console.error('Error refreshing data:', error);
      toast.error('Failed to refresh data');
    } finally {
      setIsRefreshing(false);
    }
  };

  const sortedMemecoins = [...memecoins].sort((a, b) => {
    const direction = sortDirection === 'asc' ? 1 : -1;
    
    // Get the values to compare
    const valueA = a[sortBy as keyof MemeToken];
    const valueB = b[sortBy as keyof MemeToken];
    
    // Handle different data types appropriately
    if (typeof valueA === 'number' && typeof valueB === 'number') {
      return direction * (valueA - valueB);
    } else if (typeof valueA === 'string' && typeof valueB === 'string') {
      return direction * valueA.localeCompare(valueB);
    } else {
      // Fallback for other types or mixed types
      return direction * ((valueA as any) > (valueB as any) ? 1 : -1);
    }
  });

  const handleSort = (field: string) => {
    if (field === sortBy) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(field);
      setSortDirection('desc');
    }
  };

  return {
    memecoins: sortedMemecoins,
    loading,
    sortBy,
    sortDirection,
    isRefreshing,
    handleSort,
    refreshData
  };
}
