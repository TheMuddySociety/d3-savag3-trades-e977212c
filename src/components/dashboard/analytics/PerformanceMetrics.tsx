import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { Activity, TrendingUp, TrendingDown, Loader2 } from "lucide-react";
import { supabase } from '@/integrations/supabase/client';

interface MarketStats {
  totalVolume: number;
  totalMarketCap: number;
  marketCapChange24h: number;
  solPrice: number;
  solChange24h: number;
  newTokens24h: number;
  avgLiquidity: number;
}

function formatLargeNumber(n: number): string {
  if (n >= 1e12) return `$${(n / 1e12).toFixed(1)}T`;
  if (n >= 1e9) return `$${(n / 1e9).toFixed(1)}B`;
  if (n >= 1e6) return `$${(n / 1e6).toFixed(1)}M`;
  if (n >= 1e3) return `$${(n / 1e3).toFixed(1)}K`;
  return `$${n.toFixed(0)}`;
}

export function PerformanceMetrics() {
  const [stats, setStats] = useState<MarketStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const { data, error } = await supabase.functions.invoke('token-prices', {
          body: { action: 'market_stats' },
        });
        if (error) throw error;
        if (data?.success) setStats(data.data);
      } catch (err) {
        console.error('Failed to fetch market stats:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchStats();
    const interval = setInterval(fetchStats, 60000);
    return () => clearInterval(interval);
  }, []);

  const isPositive = (stats?.marketCapChange24h ?? 0) >= 0;

  return (
    <Card className="memecoin-card row-span-2">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-xl">
          <Activity className="h-5 w-5 text-solana" />
          Market Analysis
          {loading && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 gap-4">
          <Card className="bg-background/50">
            <CardContent className="p-4">
              <div className="text-sm text-muted-foreground">24h Crypto Volume</div>
              <div className="text-2xl font-bold flex items-center gap-1">
                {stats ? formatLargeNumber(stats.totalVolume) : '—'}
                {isPositive ? (
                  <TrendingUp className="h-4 w-4 text-green-500" />
                ) : (
                  <TrendingDown className="h-4 w-4 text-red-500" />
                )}
              </div>
              <div className={`text-xs ${isPositive ? 'text-green-500' : 'text-red-500'}`}>
                {stats ? `${isPositive ? '+' : ''}${stats.marketCapChange24h.toFixed(1)}% market cap change` : ''}
              </div>
            </CardContent>
          </Card>
          <Card className="bg-background/50">
            <CardContent className="p-4">
              <div className="text-sm text-muted-foreground">New Tokens (recent)</div>
              <div className="text-2xl font-bold">
                {stats ? stats.newTokens24h.toLocaleString() : '—'}
              </div>
              <div className="text-xs text-muted-foreground">From launchpads</div>
            </CardContent>
          </Card>
          <Card className="bg-background/50">
            <CardContent className="p-4">
              <div className="text-sm text-muted-foreground">SOL Price</div>
              <div className="text-2xl font-bold flex items-center gap-1">
                {stats ? `$${stats.solPrice.toFixed(2)}` : '—'}
                {(stats?.solChange24h ?? 0) >= 0 ? (
                  <TrendingUp className="h-4 w-4 text-green-500" />
                ) : (
                  <TrendingDown className="h-4 w-4 text-red-500" />
                )}
              </div>
              <div className={`text-xs ${(stats?.solChange24h ?? 0) >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                {stats ? `${(stats.solChange24h ?? 0) >= 0 ? '+' : ''}${(stats.solChange24h ?? 0).toFixed(1)}%` : ''}
              </div>
            </CardContent>
          </Card>
          <Card className="bg-background/50">
            <CardContent className="p-4">
              <div className="text-sm text-muted-foreground">Avg. Liquidity</div>
              <div className="text-2xl font-bold">
                {stats ? formatLargeNumber(stats.avgLiquidity) : '—'}
              </div>
              <div className="text-xs text-muted-foreground">New token average</div>
            </CardContent>
          </Card>
        </div>
      </CardContent>
    </Card>
  );
}
