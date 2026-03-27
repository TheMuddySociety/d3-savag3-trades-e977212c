import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { BarChart2, RefreshCw, Star, Filter, ArrowUpDown, ExternalLink } from "lucide-react";
import { Button } from '@/components/ui/button';
import { useMemecoins } from '@/hooks/useMemecoins';
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { formatNumber } from "@/utils/format";

export function TrendingCoins() {
  const { 
    memecoins, 
    loading, 
    handleSort, 
    isRefreshing, 
    refreshData 
  } = useMemecoins();
  
  const [favorites, setFavorites] = useState<string[]>([]);
  const [minMarketCap, setMinMarketCap] = useState<number>(0);
  const [minVolume, setMinVolume] = useState<number>(0);
  const [maxAge, setMaxAge] = useState<string>("all");
  const [showFilters, setShowFilters] = useState(false);
  
  const toggleFavorite = (id: string) => {
    setFavorites(prevFavorites => 
      prevFavorites.includes(id) 
        ? prevFavorites.filter(fav => fav !== id)
        : [...prevFavorites, id]
    );
  };

  const handleTokenClick = (tokenAddress: string) => {
    if (tokenAddress) {
      const solscanUrl = `https://solscan.io/token/${tokenAddress}`;
      window.open(solscanUrl, '_blank', 'noopener,noreferrer');
    }
  };

  const filteredCoins = memecoins.filter(coin => {
    if (minMarketCap > 0 && coin.marketCap < minMarketCap) return false;
    if (minVolume > 0 && coin.volume24h < minVolume) return false;
    if (maxAge !== "all") {
      const ageStr = coin.age || "0m";
      if (maxAge === "1h") return !ageStr.includes('h') && !ageStr.includes('d');
      if (maxAge === "24h") return !ageStr.includes('d');
    }
    return true;
  });

  return (
    <Card className="memecoin-card">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-xl">
            <BarChart2 className="h-5 w-5 text-solana" /> 
            Trending Pump.Fun Tokens
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center gap-2">
              <Button 
                variant={showFilters ? "secondary" : "outline"}
                size="sm"
                className="h-8 gap-1"
                onClick={() => setShowFilters(!showFilters)}
              >
                <Filter className="h-4 w-4" />
                {showFilters ? 'Hide Filters' : 'Filter'}
              </Button>
            <div className="flex items-center gap-4">
              <span className="text-[10px] text-muted-foreground hidden sm:inline">
                Refreshes every 5 mins
              </span>
              <Button 
                variant="outline" 
                size="sm" 
                onClick={refreshData}
                disabled={isRefreshing}
                className="h-8 gap-1 min-w-[90px]"
              >
                <RefreshCw className={`h-4 w-4 ${isRefreshing ? 'animate-spin' : ''}`} />
                {isRefreshing ? 'Syncing...' : 'Refresh'}
              </Button>
            </div>
            </div>
          </div>
        </CardTitle>
        
        {showFilters && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-4 p-4 rounded-xl bg-secondary/20 border border-border/50 animate-in fade-in slide-in-from-top-2">
            <div className="space-y-2">
              <label className="text-[10px] uppercase tracking-wider text-muted-foreground font-bold">Min Market Cap</label>
              <div className="flex gap-2">
                {[0, 50000, 100000, 500000].map(val => (
                  <Button 
                    key={val}
                    variant={minMarketCap === val ? "default" : "outline"} 
                    size="sm" 
                    className="h-7 text-[10px] px-2"
                    onClick={() => setMinMarketCap(val)}
                  >
                    {val === 0 ? "Any" : `$${val/1000}k+`}
                  </Button>
                ))}
              </div>
            </div>
            <div className="space-y-2">
              <label className="text-[10px] uppercase tracking-wider text-muted-foreground font-bold">Min 24h Volume</label>
              <div className="flex gap-2">
                {[0, 10000, 50000, 200000].map(val => (
                  <Button 
                    key={val}
                    variant={minVolume === val ? "default" : "outline"} 
                    size="sm" 
                    className="h-7 text-[10px] px-2"
                    onClick={() => setMinVolume(val)}
                  >
                    {val === 0 ? "Any" : `$${val/1000}k+`}
                  </Button>
                ))}
              </div>
            </div>
            <div className="space-y-2">
              <label className="text-[10px] uppercase tracking-wider text-muted-foreground font-bold">Max Age</label>
              <div className="flex gap-2">
                {["all", "1h", "24h"].map(val => (
                  <Button 
                    key={val}
                    variant={maxAge === val ? "default" : "outline"} 
                    size="sm" 
                    className="h-7 text-[10px] px-2"
                    onClick={() => setMaxAge(val)}
                  >
                    {val === "all" ? "Any" : `<${val}`}
                  </Button>
                ))}
              </div>
            </div>
          </div>
        )}
      </CardHeader>
      <CardContent>
        <div className="w-full overflow-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[30px]"></TableHead>
                <TableHead>Token</TableHead>
                <TableHead className="cursor-pointer" onClick={() => handleSort('age')}>
                  <div className="flex items-center gap-1">
                    Age <ArrowUpDown className="h-3 w-3" />
                  </div>
                </TableHead>
                <TableHead className="text-right cursor-pointer" onClick={() => handleSort('liquidity')}>
                  <div className="flex items-center justify-end gap-1">
                    Liquidity <ArrowUpDown className="h-3 w-3" />
                  </div>
                </TableHead>
                <TableHead className="text-right cursor-pointer" onClick={() => handleSort('marketCap')}>
                  <div className="flex items-center justify-end gap-1">
                    Market Cap <ArrowUpDown className="h-3 w-3" />
                  </div>
                </TableHead>
                <TableHead className="text-right">Holders</TableHead>
                <TableHead className="text-right cursor-pointer" onClick={() => handleSort('price')}>
                  <div className="flex items-center justify-end gap-1">
                    Price <ArrowUpDown className="h-3 w-3" />
                  </div>
                </TableHead>
                <TableHead className="text-right cursor-pointer" onClick={() => handleSort('change1h')}>
                  <div className="flex items-center justify-end gap-1">
                    1h% <ArrowUpDown className="h-3 w-3" />
                  </div>
                </TableHead>
                <TableHead className="text-right cursor-pointer" onClick={() => handleSort('change24h')}>
                  <div className="flex items-center justify-end gap-1">
                    24h% <ArrowUpDown className="h-3 w-3" />
                  </div>
                </TableHead>
                <TableHead className="text-right">Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                Array(5).fill(0).map((_, index) => (
                  <TableRow key={index}>
                    <TableCell><div className="h-4 w-4 bg-muted rounded-full animate-pulse"></div></TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <div className="h-8 w-8 bg-muted rounded-full animate-pulse"></div>
                        <div className="space-y-1">
                          <div className="h-4 w-24 bg-muted rounded animate-pulse"></div>
                          <div className="h-3 w-16 bg-muted rounded animate-pulse"></div>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell><div className="h-4 w-12 bg-muted rounded animate-pulse"></div></TableCell>
                    <TableCell className="text-right"><div className="h-4 w-16 bg-muted rounded animate-pulse ml-auto"></div></TableCell>
                    <TableCell className="text-right"><div className="h-4 w-20 bg-muted rounded animate-pulse ml-auto"></div></TableCell>
                    <TableCell className="text-right"><div className="h-4 w-12 bg-muted rounded animate-pulse ml-auto"></div></TableCell>
                    <TableCell className="text-right"><div className="h-4 w-16 bg-muted rounded animate-pulse ml-auto"></div></TableCell>
                    <TableCell className="text-right"><div className="h-4 w-14 bg-muted rounded animate-pulse ml-auto"></div></TableCell>
                    <TableCell className="text-right"><div className="h-4 w-14 bg-muted rounded animate-pulse ml-auto"></div></TableCell>
                    <TableCell className="text-right"><div className="h-6 w-12 bg-muted rounded animate-pulse ml-auto"></div></TableCell>
                    <TableCell className="text-right"><div className="h-8 w-16 bg-muted rounded animate-pulse ml-auto"></div></TableCell>
                  </TableRow>
                ))
              ) : filteredCoins.length > 0 ? (
                filteredCoins.map((coin) => (
                  <TableRow 
                    key={coin.id} 
                    className={cn(
                      "trading-row-hover border-t border-t-accent/10 whitespace-nowrap",
                      favorites.includes(coin.id) && "bg-accent/5"
                    )}
                    onClick={() => coin.tokenAddress && handleTokenClick(coin.tokenAddress)}
                  >
                    <TableCell onClick={(e) => e.stopPropagation()}>
                      <button 
                        onClick={() => toggleFavorite(coin.id)}
                        className="text-yellow-500 hover:text-yellow-300 transition-colors"
                      >
                        <Star className={cn("h-4 w-4", favorites.includes(coin.id) ? "fill-yellow-500" : "")} />
                      </button>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <div className="h-8 w-8 rounded-full overflow-hidden bg-muted">
                          <img 
                            src={coin.logoUrl} 
                            alt={coin.name} 
                            className="h-full w-full object-cover" 
                            loading="lazy" 
                            onError={(e) => {
                              (e.target as HTMLImageElement).src = "/placeholder.svg";
                            }}
                          />
                        </div>
                        <div>
                          <div className="font-medium flex items-center gap-1">
                            {coin.name}
                            {coin.tokenAddress && (
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <span className="ml-1">
                                    <Badge variant="outline" className="bg-blue-500/10 text-blue-500 border-blue-500/20 text-[10px] py-0 px-1 h-4">
                                      V
                                    </Badge>
                                  </span>
                                </TooltipTrigger>
                                <TooltipContent>
                                  <p>Verified on-chain - Click to view on Solscan</p>
                                </TooltipContent>
                              </Tooltip>
                            )}
                            {coin.tokenAddress && (
                              <ExternalLink className="h-3 w-3 text-muted-foreground opacity-60" />
                            )}
                          </div>
                          <div className="text-xs text-muted-foreground">
                            {coin.symbol}
                          </div>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      {coin.age || "—"}
                    </TableCell>
                    <TableCell className="text-right font-mono">
                      ${formatNumber(coin.liquidity || 0)}
                    </TableCell>
                    <TableCell className="text-right font-mono">
                      ${formatNumber(coin.marketCap || 0)}
                    </TableCell>
                    <TableCell className="text-right">
                      {formatNumber(coin.holders || 0)}
                    </TableCell>
                    <TableCell className="text-right font-mono">
                      ${coin.price < 0.01 ? coin.price.toExponential(2) : coin.price.toFixed(4)}
                    </TableCell>
                    <TableCell className="text-right font-medium">
                      <span className={cn(
                        coin.change1h >= 0 ? "text-green-500" : "text-red-500"
                      )}>
                        {coin.change1h ? `${coin.change1h > 0 ? '+' : ''}${coin.change1h.toFixed(1)}%` : "—"}
                      </span>
                    </TableCell>
                    <TableCell className="text-right font-medium">
                      <span className={cn(
                        coin.change24h >= 0 ? "text-green-500" : "text-red-500"
                      )}>
                        {coin.change24h ? `${coin.change24h > 0 ? '+' : ''}${coin.change24h.toFixed(1)}%` : "—"}
                      </span>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end">
                        <Badge variant={coin.status === "NEW" ? "success" : "secondary"} className="text-xs">
                          {coin.status || "LISTED"}
                        </Badge>
                      </div>
                    </TableCell>
                    <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
                      <div className="flex items-center justify-end gap-1">
                        <Button variant="outline" size="sm" className="h-7 px-2 text-xs text-green-500 hover:text-green-400 hover:bg-green-500/10">
                          Buy
                        </Button>
                        <Button variant="outline" size="sm" className="h-7 px-2 text-xs text-red-500 hover:text-red-400 hover:bg-red-500/10">
                          Sell
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={11} className="h-32 text-center text-muted-foreground">
                    <div className="flex flex-col items-center gap-2">
                      <BarChart2 className="h-8 w-8 opacity-20" />
                      <p>No trending tokens found or still syncing...</p>
                      <Button variant="link" size="sm" onClick={refreshData}>
                        Try refreshing
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}
