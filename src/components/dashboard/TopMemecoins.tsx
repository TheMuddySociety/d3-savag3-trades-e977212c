import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { TrendingUp, TrendingDown, ExternalLink, Star } from "lucide-react";
import { cn } from "@/lib/utils";

interface MemecoinData {
  id: string;
  name: string;
  symbol: string;
  image: string;
  rank: number;
  marketCap: number;
  price: number;
  change24h: number;
  volume24h: number;
  trendingScore: number;
  tokenAddress?: string;
}

// Mock data for top trending memecoins today
const trendingMemecoins: MemecoinData[] = [
  {
    id: "mog-coin",
    name: "Mog Coin",
    symbol: "MOG",
    image: "https://assets.coingecko.com/coins/images/31415/thumb/mog.png",
    rank: 1,
    marketCap: 1200000000,
    price: 0.0000030,
    change24h: 25.6,
    volume24h: 120000000,
    trendingScore: 98,
    tokenAddress: "MOGCoin1111111111111111111111111111111111"
  },
  {
    id: "dogwifhat",
    name: "dogwifhat",
    symbol: "WIF",
    image: "https://assets.coingecko.com/coins/images/33767/thumb/dogwifhat.jpg",
    rank: 2,
    marketCap: 3200000000,
    price: 3.21,
    change24h: 18.4,
    volume24h: 450000000,
    trendingScore: 94,
    tokenAddress: "WIFCoin1111111111111111111111111111111111"
  },
  {
    id: "pepe",
    name: "Pepe",
    symbol: "PEPE",
    image: "https://assets.coingecko.com/coins/images/29850/thumb/pepe-token.jpeg",
    rank: 3,
    marketCap: 8900000000,
    price: 0.00002115,
    change24h: 15.7,
    volume24h: 2100000000,
    trendingScore: 92,
    tokenAddress: "PEPECoin111111111111111111111111111111111"
  },
  {
    id: "brett",
    name: "Brett",
    symbol: "BRETT",
    image: "https://assets.coingecko.com/coins/images/30548/thumb/brett.png",
    rank: 4,
    marketCap: 890000000,
    price: 0.089,
    change24h: 14.2,
    volume24h: 78000000,
    trendingScore: 89,
    tokenAddress: "BRETTCoin11111111111111111111111111111111"
  },
  {
    id: "popcat",
    name: "Popcat",
    symbol: "POPCAT",
    image: "https://assets.coingecko.com/coins/images/31659/thumb/popcat.png",
    rank: 5,
    marketCap: 950000000,
    price: 0.98,
    change24h: 12.8,
    volume24h: 95000000,
    trendingScore: 86,
    tokenAddress: "POPCATCoin111111111111111111111111111111"
  },
  {
    id: "floki",
    name: "FLOKI",
    symbol: "FLOKI",
    image: "https://assets.coingecko.com/coins/images/16746/thumb/floki.png",
    rank: 6,
    marketCap: 2100000000,
    price: 0.000218,
    change24h: 11.9,
    volume24h: 290000000,
    trendingScore: 84,
    tokenAddress: "FLOKICoin11111111111111111111111111111111"
  },
  {
    id: "bonk",
    name: "Bonk",
    symbol: "BONK",
    image: "https://assets.coingecko.com/coins/images/28600/thumb/bonk.jpg",
    rank: 7,
    marketCap: 2800000000,
    price: 0.00003985,
    change24h: 9.8,
    volume24h: 380000000,
    trendingScore: 81,
    tokenAddress: "BONKCoin111111111111111111111111111111111"
  },
  {
    id: "dogecoin",
    name: "Dogecoin",
    symbol: "DOGE",
    image: "https://assets.coingecko.com/coins/images/5/thumb/dogecoin.png",
    rank: 8,
    marketCap: 28500000000,
    price: 0.195,
    change24h: 8.2,
    volume24h: 2800000000,
    trendingScore: 78,
    tokenAddress: "DGECoin1111111111111111111111111111111111"
  },
  {
    id: "shiba-inu",
    name: "Shiba Inu",
    symbol: "SHIB",
    image: "https://assets.coingecko.com/coins/images/11939/thumb/shiba.png",
    rank: 9,
    marketCap: 15200000000,
    price: 0.0000258,
    change24h: 7.1,
    volume24h: 890000000,
    trendingScore: 75,
    tokenAddress: "SHIBCoin111111111111111111111111111111111"
  },
  {
    id: "babydoge",
    name: "Baby Doge Coin",
    symbol: "BABYDOGE",
    image: "https://assets.coingecko.com/coins/images/16125/thumb/babydoge.jpg",
    rank: 10,
    marketCap: 1500000000,
    price: 0.0000000024,
    change24h: 6.2,
    volume24h: 85000000,
    trendingScore: 72,
    tokenAddress: "BABYDOGECoin1111111111111111111111111111"
  }
];

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

export function TopMemecoins() {
  return (
    <Card className="glass-effect border-white/10">
      <CardHeader className="pb-3">
        <CardTitle className="text-xl font-bold bg-gradient-to-r from-purple-400 via-red-400 to-green-400 bg-clip-text text-transparent flex items-center gap-2">
          <TrendingUp className="h-5 w-5 text-yellow-400" />
          Top 10 Trending Memecoins Today
        </CardTitle>
      </CardHeader>
      <CardContent className="p-3">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-3">
          {trendingMemecoins.map((coin, index) => (
            <div
              key={coin.id}
              className={cn(
                "glass-effect p-3 rounded-lg transition-all duration-300 hover:scale-105",
                "border border-white/10 hover:border-white/20 min-h-[140px]",
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
                      #{coin.rank}
                    </Badge>
                    <div className="w-8 h-8 rounded-full overflow-hidden ring-1 ring-white/20">
                      <img 
                        src={coin.image} 
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
                <div className="flex items-center justify-between">
                  <div className="text-left">
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

                  <Button
                    variant="outline"
                    size="sm"
                    className="glass-effect border-green-500/30 text-green-400 hover:bg-green-500/10 hover:border-green-400/50 text-xs h-7 px-2"
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
          ))}
        </div>
      </CardContent>
    </Card>
  );
}