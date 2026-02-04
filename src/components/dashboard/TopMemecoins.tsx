import React, { useState, useMemo } from 'react';
import { Loader2, Wifi, WifiOff } from 'lucide-react';
import { useRealtimeTokens } from '@/hooks/useRealtimeTokens';
import { TrendingCarousel, FilterTabs, TokenTable, FilterType } from './pumpfun';
import { MemeToken } from '@/types/memeToken';
import { cn } from '@/lib/utils';

const handleTokenClick = (token: MemeToken) => {
  if (token.tokenAddress) {
    const url = `https://pump.fun/${token.tokenAddress}`;
    window.open(url, '_blank', 'noopener,noreferrer');
  }
};

export function TopMemecoins() {
  const [activeFilter, setActiveFilter] = useState<FilterType>('movers');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('list');
  const [sortField, setSortField] = useState<string>('volume24h');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');
  
  const { tokens, loading, error, isConnected, lastUpdate } = useRealtimeTokens('pumpfun', 20);

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

  if (loading) {
    return (
      <div className="rounded-2xl border border-border bg-card/50 backdrop-blur-sm p-8">
        <div className="flex flex-col items-center justify-center gap-4">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p className="text-muted-foreground">Loading trending tokens...</p>
        </div>
      </div>
    );
  }

  if (error) {
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
      {/* Connection Status Indicator */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          {isConnected ? (
            <>
              <div className="relative">
                <Wifi className="h-4 w-4 text-accent" />
                <span className="absolute -top-0.5 -right-0.5 h-2 w-2 rounded-full bg-accent animate-pulse" />
              </div>
              <span className="text-xs text-muted-foreground">Live updates active</span>
            </>
          ) : (
            <>
              <WifiOff className="h-4 w-4 text-muted-foreground" />
              <span className="text-xs text-muted-foreground">Connecting...</span>
            </>
          )}
        </div>
        {lastUpdate && (
          <span className="text-xs text-muted-foreground">
            Last update: {lastUpdate.toLocaleTimeString()}
          </span>
        )}
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
