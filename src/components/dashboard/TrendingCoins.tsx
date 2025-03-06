
import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { TrendingUp, TrendingDown, BarChart2, Eye } from "lucide-react";
import { mockMemecoins } from "@/lib/mock-data";
import { cn } from "@/lib/utils";

interface MemeToken {
  id: string;
  name: string;
  symbol: string;
  logoUrl: string;
  price: number;
  change24h: number;
  volume24h: number;
  marketCap: number;
  launchDate: string;
  tags: string[];
  liquidity: number;
  holders: number;
}

export function TrendingCoins() {
  const [memecoins, setMemecoins] = useState<MemeToken[]>([]);
  const [loading, setLoading] = useState(true);
  const [sortBy, setSortBy] = useState('change24h');
  const [sortDirection, setSortDirection] = useState('desc');

  useEffect(() => {
    // Simulate API fetch
    const fetchData = async () => {
      setLoading(true);
      // In a real app, you would fetch from an API
      setTimeout(() => {
        setMemecoins(mockMemecoins);
        setLoading(false);
      }, 1500);
    };

    fetchData();
  }, []);

  const sortedMemecoins = [...memecoins].sort((a, b) => {
    const direction = sortDirection === 'asc' ? 1 : -1;
    // @ts-ignore
    return direction * (a[sortBy] - b[sortBy]);
  });

  const formatNumber = (num: number) => {
    if (num >= 1000000) return `$${(num / 1000000).toFixed(2)}M`;
    if (num >= 1000) return `$${(num / 1000).toFixed(2)}K`;
    return `$${num.toFixed(2)}`;
  };

  const handleSort = (field: string) => {
    if (field === sortBy) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(field);
      setSortDirection('desc');
    }
  };

  return (
    <Card className="memecoin-card">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-xl">
          <BarChart2 className="h-5 w-5 text-solana" /> 
          Trending Memecoins
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="w-full overflow-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-border">
                <th className="p-2 text-left font-medium text-muted-foreground">Token</th>
                <th 
                  className="p-2 text-right font-medium text-muted-foreground cursor-pointer hover:text-foreground"
                  onClick={() => handleSort('price')}
                >
                  Price
                </th>
                <th 
                  className="p-2 text-right font-medium text-muted-foreground cursor-pointer hover:text-foreground"
                  onClick={() => handleSort('change24h')}
                >
                  24h %
                </th>
                <th
                  className="p-2 text-right font-medium text-muted-foreground cursor-pointer hover:text-foreground hidden md:table-cell"
                  onClick={() => handleSort('volume24h')}
                >
                  Volume
                </th>
                <th
                  className="p-2 text-right font-medium text-muted-foreground cursor-pointer hover:text-foreground hidden lg:table-cell"
                  onClick={() => handleSort('marketCap')}
                >
                  Market Cap
                </th>
                <th className="p-2 text-center font-medium text-muted-foreground hidden lg:table-cell">Tags</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                Array(5).fill(0).map((_, index) => (
                  <tr key={index} className="border-b border-border">
                    <td className="p-2">
                      <div className="flex items-center gap-2">
                        <Skeleton className="h-8 w-8 rounded-full" />
                        <div className="space-y-1">
                          <Skeleton className="h-4 w-20" />
                          <Skeleton className="h-3 w-12" />
                        </div>
                      </div>
                    </td>
                    <td className="p-2 text-right"><Skeleton className="h-4 w-16 ml-auto" /></td>
                    <td className="p-2 text-right"><Skeleton className="h-4 w-14 ml-auto" /></td>
                    <td className="p-2 text-right hidden md:table-cell"><Skeleton className="h-4 w-20 ml-auto" /></td>
                    <td className="p-2 text-right hidden lg:table-cell"><Skeleton className="h-4 w-20 ml-auto" /></td>
                    <td className="p-2 text-center hidden lg:table-cell"><Skeleton className="h-6 w-24 mx-auto" /></td>
                  </tr>
                ))
              ) : (
                sortedMemecoins.map((coin) => (
                  <tr key={coin.id} className="border-b border-border hover:bg-muted/20 cursor-pointer transition-colors">
                    <td className="p-2">
                      <div className="flex items-center gap-2">
                        <div className="h-8 w-8 rounded-full overflow-hidden">
                          <img 
                            src={coin.logoUrl} 
                            alt={coin.name} 
                            className="h-full w-full object-cover" 
                            loading="lazy" 
                          />
                        </div>
                        <div>
                          <div className="font-medium">{coin.name}</div>
                          <div className="text-xs text-muted-foreground">{coin.symbol}</div>
                        </div>
                      </div>
                    </td>
                    <td className="p-2 text-right font-mono">
                      ${coin.price < 0.01 ? coin.price.toExponential(2) : coin.price.toFixed(2)}
                    </td>
                    <td className="p-2 text-right">
                      <span className={cn(
                        "flex items-center justify-end gap-1 font-medium",
                        coin.change24h >= 0 ? "text-green-500" : "text-red-500"
                      )}>
                        {coin.change24h >= 0 ? (
                          <TrendingUp className="h-4 w-4" />
                        ) : (
                          <TrendingDown className="h-4 w-4" />
                        )}
                        {Math.abs(coin.change24h).toFixed(2)}%
                      </span>
                    </td>
                    <td className="p-2 text-right font-mono hidden md:table-cell">{formatNumber(coin.volume24h)}</td>
                    <td className="p-2 text-right font-mono hidden lg:table-cell">{formatNumber(coin.marketCap)}</td>
                    <td className="p-2 text-center hidden lg:table-cell">
                      <div className="flex flex-wrap gap-1 justify-center">
                        {coin.tags.slice(0, 2).map((tag) => (
                          <Badge key={tag} variant="outline" className="text-xs">
                            {tag}
                          </Badge>
                        ))}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
}
