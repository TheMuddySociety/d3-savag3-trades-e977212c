import React, { useState, useMemo, useEffect } from 'react';
import { Loader2, Wifi, WifiOff, Bird, Rocket } from 'lucide-react';
import { useRealtimeTokens } from '@/hooks/useRealtimeTokens';
import { TrendingCarousel, FilterTabs, TokenTable, FilterType } from './pumpfun';
import { MemeToken } from '@/types/memeToken';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { tokenWebSocketService } from '@/services/websocket/TokenWebSocketService';
import { TokenDetailModal } from './TokenDetailModal';

type DataSource = 'birdeye' | 'launchpad';

export function TopMemecoins() {
  const [activeFilter, setActiveFilter] = useState<FilterType>('movers');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('list');
  const [sortField, setSortField] = useState<string>('volume24h');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');
  const [dataSource, setDataSource] = useState<DataSource>('birdeye');
  const [birdeyeTokens, setBirdeyeTokens] = useState<MemeToken[]>([]);
  const [birdeyeLoading, setBirdeyeLoading] = useState(false);
  const [birdeyeError, setBirdeyeError] = useState<string | null>(null);
  const [selectedToken, setSelectedToken] = useState<MemeToken | null>(null);
  const [modalOpen, setModalOpen] = useState(false);

  const handleTokenClick = (token: MemeToken) => {
    setSelectedToken(token);
    setModalOpen(true);
  };
  
  const { tokens: launchpadTokens, loading: launchpadLoading, error: launchpadError, isConnected, lastUpdate } = useRealtimeTokens('pumpfun', 20);

  // Fetch Birdeye trending tokens
  useEffect(() => {
    if (dataSource !== 'birdeye') return;

    let cancelled = false;
    const fetchBirdeye = async () => {
      setBirdeyeLoading(true);
      setBirdeyeError(null);
      try {
        const tokens = await tokenWebSocketService.fetchTrendingTokens();
        if (!cancelled) setBirdeyeTokens(tokens);
      } catch (err) {
        if (!cancelled) setBirdeyeError(err instanceof Error ? err.message : 'Failed to fetch trending');
      } finally {
        if (!cancelled) setBirdeyeLoading(false);
      }
    };
    fetchBirdeye();
    const interval = setInterval(fetchBirdeye, 30000);
    return () => { cancelled = true; clearInterval(interval); };
  }, [dataSource]);

  const tokens = dataSource === 'birdeye' ? birdeyeTokens : launchpadTokens;
  const loading = dataSource === 'birdeye' ? birdeyeLoading : launchpadLoading;
  const error = dataSource === 'birdeye' ? birdeyeError : launchpadError;

  const handleSort = (field: string) => {
    if (sortField === field) {
      setSortDirection(prev => prev === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('desc');
    }
  };

  const filteredTokens = useMemo(() => {
    let filtered = [...tokens];
    
    switch (activeFilter) {
      case 'movers':
        filtered = filtered.sort((a, b) => Math.abs(b.change24h) - Math.abs(a.change24h));
        break;
      case 'live':
        filtered = filtered.sort((a, b) => b.timestamp - a.timestamp);
        break;
      case 'new':
        filtered = filtered.filter(t => Date.now() - t.timestamp < 86400000);
        break;
      case 'marketcap':
        filtered = filtered.sort((a, b) => b.marketCap - a.marketCap);
        break;
    }
    
    return filtered;
  }, [tokens, activeFilter]);

  const sortedTokens = useMemo(() => {
    return [...filteredTokens].sort((a, b) => {
      let aVal = a[sortField as keyof MemeToken] as number || 0;
      let bVal = b[sortField as keyof MemeToken] as number || 0;
      
      if (sortDirection === 'asc') {
        return aVal - bVal;
      }
      return bVal - aVal;
    });
  }, [filteredTokens, sortField, sortDirection]);

  if (loading && tokens.length === 0) {
    return (
      <div className="rounded-2xl border border-border bg-card/50 backdrop-blur-sm p-8">
        <div className="flex flex-col items-center justify-center gap-4">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p className="text-muted-foreground">Loading {dataSource === 'birdeye' ? 'trending' : 'launchpad'} tokens...</p>
        </div>
      </div>
    );
  }

  if (error && tokens.length === 0) {
    return (
      <div className="rounded-2xl border border-border bg-card/50 backdrop-blur-sm p-8 text-center">
        <div className="text-4xl mb-4">⚠️</div>
        <h3 className="text-lg font-semibold text-foreground mb-2">Failed to Load</h3>
        <p className="text-muted-foreground text-sm">{error}</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Data Source Toggle + Connection Status */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-1 rounded-full border border-border bg-card/50 p-1">
          <Button
            size="sm"
            variant="ghost"
            className={cn(
              "rounded-full gap-1.5 h-7 text-xs px-3 transition-all",
              dataSource === 'birdeye'
                ? "bg-primary text-primary-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            )}
            onClick={() => setDataSource('birdeye')}
          >
            <Bird className="h-3.5 w-3.5" />
            Birdeye Trending
          </Button>
          <Button
            size="sm"
            variant="ghost"
            className={cn(
              "rounded-full gap-1.5 h-7 text-xs px-3 transition-all",
              dataSource === 'launchpad'
                ? "bg-primary text-primary-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            )}
            onClick={() => setDataSource('launchpad')}
          >
            <Rocket className="h-3.5 w-3.5" />
            Launchpad
          </Button>
        </div>

        <div className="flex items-center gap-2">
          {isConnected ? (
            <>
              <div className="relative">
                <Wifi className="h-4 w-4 text-accent" />
                <span className="absolute -top-0.5 -right-0.5 h-2 w-2 rounded-full bg-accent animate-pulse" />
              </div>
              <span className="text-xs text-muted-foreground">Live</span>
            </>
          ) : (
            <>
              <WifiOff className="h-4 w-4 text-muted-foreground" />
              <span className="text-xs text-muted-foreground">Connecting...</span>
            </>
          )}
          {lastUpdate && (
            <span className="text-xs text-muted-foreground">
              {lastUpdate.toLocaleTimeString()}
            </span>
          )}
        </div>
      </div>

      {/* Trending Cards Carousel */}
      <div className="rounded-2xl border border-border bg-card/30 backdrop-blur-sm p-6">
        <TrendingCarousel tokens={sortedTokens} onTokenClick={handleTokenClick} />
      </div>

      {/* Filter Tabs */}
      <FilterTabs
        activeFilter={activeFilter}
        onFilterChange={setActiveFilter}
        viewMode={viewMode}
        onViewModeChange={setViewMode}
      />

      {/* Token Table */}
      <div className="rounded-2xl border border-border bg-card/30 backdrop-blur-sm overflow-hidden">
        <TokenTable
          tokens={sortedTokens}
          onTokenClick={handleTokenClick}
          sortField={sortField}
          sortDirection={sortDirection}
          onSort={handleSort}
        />
      </div>
    </div>
  );
}
