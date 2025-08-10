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

  // Categorize tokens based on bonding curve progress
  const categorizeTokens = (tokens: any[]) => {
    return {
      newlyCreated: tokens.filter(t => (t.bondingCurveProgress || 0) < 0.8),
      aboutToGraduate: tokens.filter(t => (t.bondingCurveProgress || 0) >= 0.8 && (t.bondingCurveProgress || 0) < 1),
      graduated: tokens.filter(t => (t.bondingCurveProgress || 0) >= 1)
    };
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-4 mb-8">
          <div className="w-12 h-12 rounded-xl bg-gradient-to-r from-green-400 to-emerald-500 flex items-center justify-center animate-pulse">
            <TrendingUp className="h-6 w-6 text-white" />
          </div>
          <div>
            <h2 className="text-3xl font-bold text-white">Trading Dashboard</h2>
            <p className="text-muted-foreground">Live trending tokens from Pump.Fun</p>
          </div>
        </div>
        
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {[...Array(3)].map((_, categoryIndex) => (
            <div key={categoryIndex} className="space-y-4">
              <div className="h-8 bg-white/10 rounded-lg animate-pulse" />
              <div className="space-y-3">
                {[...Array(3)].map((_, i) => (
                  <div key={i} className="h-32 bg-white/5 rounded-xl border border-white/10 animate-pulse" />
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-16">
        <div className="w-16 h-16 rounded-xl bg-gradient-to-r from-red-400 to-red-500 flex items-center justify-center mx-auto mb-4">
          <span className="text-white font-bold text-xl">⚠️</span>
        </div>
        <h3 className="text-xl font-bold text-white mb-2">Failed to Load Data</h3>
        <p className="text-muted-foreground mb-2">Unable to fetch trending tokens</p>
        <p className="text-sm text-red-400">{error}</p>
      </div>
    );
  }

  const categories = categorizeTokens(tokens);
  
  const CategorySection = ({ title, tokens, bgGradient, iconBg, icon }: any) => (
    <div className="space-y-4">
      <div className={cn(
        "flex items-center gap-3 p-4 rounded-xl backdrop-blur-sm",
        "border border-white/10",
        bgGradient
      )}>
        <div className={cn("w-8 h-8 rounded-lg flex items-center justify-center", iconBg)}>
          <span className="text-white font-bold text-sm">{icon}</span>
        </div>
        <div>
          <h3 className="font-bold text-white text-lg">{title}</h3>
          <p className="text-sm text-white/70">{tokens.length} tokens</p>
        </div>
      </div>
      
      <div className="space-y-3">
        {tokens.slice(0, 5).map((coin: any, index: number) => (
          <div
            key={coin.id}
            className={cn(
              "group relative overflow-hidden rounded-xl transition-all duration-300",
              "bg-gradient-to-r from-white/5 to-white/2 backdrop-blur-sm",
              "border border-white/10 hover:border-white/20",
              "hover:scale-[1.02] hover:shadow-lg hover:shadow-primary/10",
              "cursor-pointer"
            )}
            onClick={() => coin.tokenAddress && handleTokenClick(coin.tokenAddress)}
          >
            <div className="p-4">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full overflow-hidden ring-2 ring-white/20">
                    <img 
                      src={coin.logoUrl} 
                      alt={coin.name}
                      className="w-full h-full object-cover"
                      onError={(e) => {
                        e.currentTarget.src = '/placeholder.svg';
                      }}
                    />
                  </div>
                  <div>
                    <h4 className="font-bold text-white text-sm">{coin.name}</h4>
                    <p className="text-xs text-muted-foreground">{coin.symbol}</p>
                  </div>
                </div>
                
                <div className="text-right">
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
              </div>
              
              <div className="space-y-2 mb-3">
                <div className="flex justify-between text-xs">
                  <span className="text-muted-foreground">Market Cap</span>
                  <span className="text-white font-medium">{formatMarketCap(coin.marketCap)}</span>
                </div>
                
                <div className="space-y-1">
                  <div className="flex justify-between text-xs">
                    <span className="text-muted-foreground">Progress</span>
                    <span className="text-white font-medium">{((coin.bondingCurveProgress || 0) * 100).toFixed(1)}%</span>
                  </div>
                  <div className="relative w-full h-1.5 bg-white/10 rounded-full overflow-hidden">
                    <div
                      className={cn(
                        "absolute inset-y-0 left-0 rounded-full transition-all duration-1000 ease-out",
                        title === "GRADUATED" ? "bg-gradient-to-r from-green-400 to-emerald-500" :
                        title === "ABOUT TO GRADUATE" ? "bg-gradient-to-r from-yellow-400 to-orange-500" :
                        "bg-gradient-to-r from-blue-400 to-cyan-500"
                      )}
                      style={{ width: `${Math.min((coin.bondingCurveProgress || 0) * 100, 100)}%` }}
                    />
                  </div>
                </div>
              </div>
              
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  className="flex-1 glass-effect border-purple-500/30 text-purple-400 hover:bg-purple-500/20 hover:border-purple-400/50 text-xs font-medium"
                  onClick={(e) => {
                    e.stopPropagation();
                    handlePumpFunClick(coin.tokenAddress);
                  }}
                >
                  View
                </Button>
                
                <Button
                  size="sm"
                  className="flex-1 bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700 text-white border-0 text-xs font-medium"
                  onClick={(e) => {
                    e.stopPropagation();
                    // Add buy functionality here
                  }}
                >
                  +0.01
                </Button>
              </div>
            </div>
            
            {/* Hover glow effect */}
            <div className="absolute inset-0 bg-gradient-to-t from-primary/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none" />
          </div>
        ))}
      </div>
    </div>
  );

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-gradient-to-r from-green-400 to-emerald-500 flex items-center justify-center shadow-lg shadow-green-500/25">
            <TrendingUp className="h-6 w-6 text-white" />
          </div>
          <div>
            <h2 className="text-3xl font-bold text-white">Trading Dashboard</h2>
            <p className="text-muted-foreground">Live trending tokens from Pump.Fun</p>
          </div>
        </div>
        
        <div className="flex items-center gap-3">
          <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse" />
          <Badge className="bg-green-500/20 text-green-400 border-green-500/30">
            Scan Live
          </Badge>
        </div>
      </div>
      
      {/* Token Categories */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <CategorySection
          title="NEWLY CREATED"
          tokens={categories.newlyCreated}
          bgGradient="bg-gradient-to-r from-blue-500/10 to-cyan-500/10"
          iconBg="bg-gradient-to-r from-blue-500 to-cyan-500"
          icon="🆕"
        />
        
        <CategorySection
          title="ABOUT TO GRADUATE"
          tokens={categories.aboutToGraduate}
          bgGradient="bg-gradient-to-r from-yellow-500/10 to-orange-500/10"
          iconBg="bg-gradient-to-r from-yellow-500 to-orange-500"
          icon="🎓"
        />
        
        <CategorySection
          title="GRADUATED"
          tokens={categories.graduated}
          bgGradient="bg-gradient-to-r from-green-500/10 to-emerald-500/10"
          iconBg="bg-gradient-to-r from-green-500 to-emerald-500"
          icon="✅"
        />
      </div>
    </div>
  );
}