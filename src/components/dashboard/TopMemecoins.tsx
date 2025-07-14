import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { TrendingUp, TrendingDown, ExternalLink, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { usePumpFunTokens } from "@/hooks/usePumpFunTokens";

const formatMarketCap = (value: number): string => {
  if (value >= 1e9) return `$${(value / 1e9).toFixed(2)}B`;
  if (value >= 1e6) return `$${(value / 1e6).toFixed(2)}M`;
  if (value >= 1e3) return `$${(value / 1e3).toFixed(2)}K`;
  return `$${value.toFixed(2)}`;
};

const formatPrice = (price: number): string => {
  if (price < 0.000001) return `$${price.toFixed(10)}`;
  if (price < 0.01) return `$${price.toFixed(8)}`;
  if (price < 1) return `$${price.toFixed(6)}`;
  return `$${price.toFixed(4)}`;
};

const handleTokenClick = (tokenAddress?: string) => {
  if (tokenAddress) {
    const solscanUrl = `https://solscan.io/token/${tokenAddress}`;
    window.open(solscanUrl, '_blank', 'noopener,noreferrer');
  }
};

const handlePumpFunClick = (tokenAddress?: string) => {
  if (tokenAddress) {
    const pumpFunUrl = `https://pump.fun/${tokenAddress}`;
    window.open(pumpFunUrl, '_blank', 'noopener,noreferrer');
  }
};

export function TopMemecoins() {
  const { tokens, loading, error } = usePumpFunTokens(10);

  if (loading) {
    return (
      <Card className="glass-effect border-white/10">
        <CardHeader className="pb-3">
          <CardTitle className="text-xl font-bold bg-gradient-to-r from-purple-400 via-red-400 to-green-400 bg-clip-text text-transparent flex items-center gap-2">
            <TrendingUp className="h-5 w-5 text-yellow-400" />
            Top 10 Trending from Pump.Fun
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-8 w-8 animate-spin text-yellow-400" />
          </div>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card className="glass-effect border-white/10">
        <CardHeader className="pb-3">
          <CardTitle className="text-xl font-bold bg-gradient-to-r from-purple-400 via-red-400 to-green-400 bg-clip-text text-transparent flex items-center gap-2">
            <TrendingUp className="h-5 w-5 text-yellow-400" />
            Top 10 Trending from Pump.Fun
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8">
            <p className="text-muted-foreground">Failed to load trending tokens</p>
            <p className="text-sm text-red-500">{error}</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="glass-effect border-white/10">
      <CardHeader className="pb-3">
        <CardTitle className="text-xl font-bold bg-gradient-to-r from-purple-400 via-red-400 to-green-400 bg-clip-text text-transparent flex items-center gap-2">
          <TrendingUp className="h-5 w-5 text-yellow-400" />
          Top 10 Trending from Pump.Fun
        </CardTitle>
      </CardHeader>
      <CardContent className="p-3">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-3">
          {tokens.map((coin, index) => (
            <div
              key={coin.id}
              className={cn(
                "glass-effect p-3 rounded-lg transition-all duration-300 hover:scale-105",
                "border border-white/10 hover:border-white/20 min-h-[200px]",
                coin.tokenAddress ? "cursor-pointer hover:bg-white/5" : ""
              )}
              onClick={() => coin.tokenAddress && handleTokenClick(coin.tokenAddress)}
            >
              <div className="flex flex-col h-full">
                <div className="flex items-start justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <Badge 
                      variant="outline" 
                      className="bg-gradient-to-r from-purple-500 to-red-500 text-white border-none text-xs h-5 px-2"
                    >
                      #{index + 1}
                    </Badge>
                    <div className="w-8 h-8 rounded-full overflow-hidden ring-1 ring-white/20">
                      <img 
                        src={coin.logoUrl} 
                        alt={coin.name}
                        className="w-full h-full object-cover"
                        onError={(e) => {
                          e.currentTarget.src = '/placeholder.svg';
                        }}
                      />
                    </div>
                  </div>
                  
                  {coin.tokenAddress && (
                    <ExternalLink className="h-3 w-3 text-muted-foreground opacity-60" />
                  )}
                </div>

                <div className="flex-1 min-w-0 mb-2">
                  <h3 className="font-bold text-white text-sm truncate">{coin.name}</h3>
                  <div className="flex items-center gap-1 mb-1">
                    <Badge variant="secondary" className="text-xs bg-white/10 text-gray-300 px-1 py-0">
                      {coin.symbol}
                    </Badge>
                  </div>
                  <p className="text-xs text-gray-400 truncate">{formatMarketCap(coin.marketCap)}</p>
                </div>
                
                {/* Bonding Curve Progress */}
                <div className="mb-3">
                  <div className="flex items-center justify-between text-xs text-muted-foreground mb-1">
                    <span>Bonding Curve</span>
                    <span>{((coin.bondingCurveProgress || 0) * 100).toFixed(1)}%</span>
                  </div>
                  
                  <Progress 
                    value={(coin.bondingCurveProgress || 0) * 100} 
                    className="h-1.5 mb-2"
                  />
                  
                  <Badge 
                    variant={coin.bondingCurveProgress && coin.bondingCurveProgress >= 1 ? "default" : 
                            coin.bondingCurveProgress && coin.bondingCurveProgress > 0.8 ? "secondary" : "outline"} 
                    className="text-xs h-5 px-2"
                  >
                    {coin.bondingCurveProgress && coin.bondingCurveProgress >= 1 
                      ? "Graduated" 
                      : coin.bondingCurveProgress && coin.bondingCurveProgress > 0.8 
                      ? "Near Graduate" 
                      : "Bonding"
                    }
                  </Badge>
                </div>

                <div className="flex items-center justify-between gap-2">
                  <div className="text-left flex-1">
                    <p className="font-bold text-white text-sm">{formatPrice(coin.price)}</p>
                    <div className="flex items-center gap-1">
                      {coin.change24h >= 0 ? (
                        <TrendingUp className="h-3 w-3 text-green-400" />
                      ) : (
                        <TrendingDown className="h-3 w-3 text-red-400" />
                      )}
                      <span className={cn(
                        "text-xs font-medium",
                        coin.change24h >= 0 ? "text-green-400" : "text-red-400"
                      )}>
                        {coin.change24h >= 0 ? '+' : ''}{coin.change24h.toFixed(1)}%
                      </span>
                    </div>
                  </div>

                  <div className="flex flex-col gap-1">
                    <Button
                      variant="outline"
                      size="sm"
                      className="glass-effect border-purple-500/30 text-purple-400 hover:bg-purple-500/10 hover:border-purple-400/50 text-xs h-6 px-2"
                      onClick={(e) => {
                        e.stopPropagation();
                        handlePumpFunClick(coin.tokenAddress);
                      }}
                    >
                      Pump.Fun
                    </Button>
                    
                    <Button
                      variant="outline"
                      size="sm"
                      className="glass-effect border-green-500/30 text-green-400 hover:bg-green-500/10 hover:border-green-400/50 text-xs h-6 px-2"
                      onClick={(e) => {
                        e.stopPropagation();
                        // Add buy functionality here
                      }}
                    >
                      Buy
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}