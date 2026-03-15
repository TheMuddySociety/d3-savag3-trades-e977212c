import React, { useState, useMemo, useEffect } from 'react';
import { Loader2, Wifi, WifiOff, TrendingUp, Rocket, Globe, Moon } from 'lucide-react';
import { useRealtimeTokens } from '@/hooks/useRealtimeTokens';
import { TrendingCarousel, FilterTabs, TokenTable, FilterType } from './pumpfun';
import { FilterOptions } from './pumpfun/FilterTabs';
import { MemeToken } from '@/types/memeToken';
import { LaunchpadService } from '@/services/launchpads/LaunchpadService';
import { MemeToken } from '@/types/memeToken';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { tokenWebSocketService } from '@/services/websocket/TokenWebSocketService';
import { TokenDetailModal } from './TokenDetailModal';
import { CreateAlertDialog } from './CreateAlertDialog';
import { usePriceAlerts } from '@/hooks/usePriceAlerts';
import { useWallet } from '@solana/wallet-adapter-react';

type DataSource = 'trending' | 'new_launches' | 'moonshot';

const formatValue = (value: number, type: 'currency' | 'percent' = 'currency'): string => {
  if (type === 'percent') {
    const prefix = value >= 0 ? '+' : '';
    return `${prefix}${value.toFixed(2)}%`;
  }
  if (value >= 1e9) return `$${(value / 1e9).toFixed(2)}B`;
  if (value >= 1e6) return `$${(value / 1e6).toFixed(2)}M`;
  if (value >= 1e3) return `$${(value / 1e3).toFixed(2)}K`;
  return `$${value.toFixed(2)}`;
};

function TokenGrid({ tokens, onTokenClick }: { tokens: MemeToken[]; onTokenClick: (t: MemeToken) => void }) {
  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 p-4">
      {tokens.map((token) => (
        <div
          key={token.id}
          className="rounded-xl border border-border bg-card/60 p-4 cursor-pointer hover:border-primary/50 hover:bg-card transition-all group"
          onClick={() => onTokenClick(token)}
        >
          <div className="flex items-center gap-3 mb-3">
            <div className="h-10 w-10 rounded-full overflow-hidden ring-2 ring-border group-hover:ring-primary/50 transition-all shrink-0">
              <img
                src={token.logoUrl}
                alt={token.name}
                className="h-full w-full object-cover"
                onError={(e) => { e.currentTarget.src = '/placeholder.svg'; }}
              />
            </div>
            <div className="min-w-0">
              <div className="font-semibold text-foreground text-sm truncate">{token.name}</div>
              <div className="text-xs text-muted-foreground">{token.symbol}</div>
            </div>
          </div>
          <div className="space-y-1.5 text-xs">
            <div className="flex justify-between">
              <span className="text-muted-foreground">MCap</span>
              <span className="font-mono text-foreground">{formatValue(token.marketCap)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Vol</span>
              <span className="font-mono text-foreground">{formatValue(token.volume24h)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">24h</span>
              <span className={cn("font-mono font-medium", token.change24h >= 0 ? "positive-change" : "negative-change")}>
                {formatValue(token.change24h, 'percent')}
              </span>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

export function TopMemecoins() {
  const [activeFilter, setActiveFilter] = useState<FilterType>('movers');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('list');
  const [sortField, setSortField] = useState<string>('volume24h');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');
  const [dataSource, setDataSource] = useState<DataSource>('trending');
  const [trendingTokens, setTrendingTokens] = useState<MemeToken[]>([]);
  const [moonshotTokens, setMoonshotTokens] = useState<MemeToken[]>([]);
  const [trendingLoading, setTrendingLoading] = useState(false);
  const [moonshotLoading, setMoonshotLoading] = useState(false);
  const [selectedToken, setSelectedToken] = useState<MemeToken | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [alertToken, setAlertToken] = useState<MemeToken | null>(null);
  const [alertDialogOpen, setAlertDialogOpen] = useState(false);
  const [filterOptions, setFilterOptions] = useState<FilterOptions>({
    minMarketCap: null,
    minVolume: null,
    onlyPositive: false,
  });

  const { publicKey } = useWallet();
  const walletAddress = publicKey?.toBase58() || null;
  const { createAlert } = usePriceAlerts(walletAddress);

  const handleSetAlert = (token: MemeToken) => {
    setAlertToken(token);
    setAlertDialogOpen(true);
  };

  const handleTokenClick = (token: MemeToken) => {
    setSelectedToken(token);
    setModalOpen(true);
  };
  
  const { tokens: launchTokens, loading: launchLoading, error: launchError, isConnected, lastUpdate } = useRealtimeTokens('all', 30);

  useEffect(() => {
    if (dataSource !== 'trending') return;
    let cancelled = false;
    const fetchTrending = async () => {
      setTrendingLoading(true);
      setTrendingError(null);
      try {
        const tokens = await tokenWebSocketService.fetchTrendingTokens();
        if (!cancelled) setTrendingTokens(tokens);
      } catch (err) {
        if (!cancelled) setTrendingError(err instanceof Error ? err.message : 'Failed to fetch trending');
      } finally {
        if (!cancelled) setTrendingLoading(false);
      }
    };
    fetchTrending();
    const interval = setInterval(fetchTrending, 30000);
    return () => { cancelled = true; clearInterval(interval); };
  }, [dataSource]);

  const tokens = dataSource === 'trending' ? trendingTokens : launchTokens;
  const loading = dataSource === 'trending' ? trendingLoading : launchLoading;
  const error = dataSource === 'trending' ? trendingError : launchError;

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
    
    if (filterOptions.onlyPositive) {
      filtered = filtered.filter(t => t.change24h > 0);
    }
    if (filterOptions.minMarketCap) {
      filtered = filtered.filter(t => t.marketCap >= filterOptions.minMarketCap!);
    }
    if (filterOptions.minVolume) {
      filtered = filtered.filter(t => t.volume24h >= filterOptions.minVolume!);
    }
    
    switch (activeFilter) {
      case 'movers':
        filtered.sort((a, b) => Math.abs(b.change24h) - Math.abs(a.change24h));
        break;
      case 'live':
        filtered.sort((a, b) => b.timestamp - a.timestamp);
        break;
      case 'new':
        filtered = filtered.filter(t => Date.now() - t.timestamp < 86400000);
        filtered.sort((a, b) => b.timestamp - a.timestamp);
        break;
      case 'marketcap':
        filtered.sort((a, b) => b.marketCap - a.marketCap);
        break;
      case 'volume':
        filtered.sort((a, b) => b.volume24h - a.volume24h);
        break;
      case 'gainers':
        filtered.sort((a, b) => b.change24h - a.change24h);
        break;
      case 'oldest':
        filtered.sort((a, b) => a.timestamp - b.timestamp);
        break;
    }
    
    return filtered;
  }, [tokens, activeFilter, filterOptions]);

  const sortedTokens = useMemo(() => {
    return [...filteredTokens].sort((a, b) => {
      let aVal = a[sortField as keyof MemeToken] as number || 0;
      let bVal = b[sortField as keyof MemeToken] as number || 0;
      return sortDirection === 'asc' ? aVal - bVal : bVal - aVal;
    });
  }, [filteredTokens, sortField, sortDirection]);

  if (loading && tokens.length === 0) {
    return (
      <div className="rounded-2xl border border-border bg-card/50 backdrop-blur-sm p-8">
        <div className="flex flex-col items-center justify-center gap-4">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p className="text-muted-foreground">Loading Solana memecoins...</p>
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
              dataSource === 'trending'
                ? "bg-primary text-primary-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            )}
            onClick={() => setDataSource('trending')}
          >
            <TrendingUp className="h-3.5 w-3.5" />
            Trending
          </Button>
          <Button
            size="sm"
            variant="ghost"
            className={cn(
              "rounded-full gap-1.5 h-7 text-xs px-3 transition-all",
              dataSource === 'new_launches'
                ? "bg-primary text-primary-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            )}
            onClick={() => setDataSource('new_launches')}
          >
            <Rocket className="h-3.5 w-3.5" />
            New Launches
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
        filterOptions={filterOptions}
        onFilterOptionsChange={setFilterOptions}
      />

      {/* Token Table or Grid */}
      <div className="rounded-2xl border border-border bg-card/30 backdrop-blur-sm overflow-hidden">
        {viewMode === 'list' ? (
          <TokenTable
            tokens={sortedTokens}
            onTokenClick={handleTokenClick}
            sortField={sortField}
            sortDirection={sortDirection}
            onSort={handleSort}
          />
        ) : (
          <TokenGrid tokens={sortedTokens} onTokenClick={handleTokenClick} />
        )}
      </div>

      <TokenDetailModal
        token={selectedToken}
        open={modalOpen}
        onOpenChange={setModalOpen}
        onSetAlert={handleSetAlert}
      />
      <CreateAlertDialog
        token={alertToken}
        open={alertDialogOpen}
        onOpenChange={setAlertDialogOpen}
        onCreateAlert={createAlert}
      />
    </div>
  );
}
