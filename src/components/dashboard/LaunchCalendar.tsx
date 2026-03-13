import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Calendar, Clock, Loader2 } from "lucide-react";
import { supabase } from '@/integrations/supabase/client';

interface LaunchToken {
  address: string;
  name: string;
  symbol: string;
  logo: string;
  timestamp: number;
  marketCap: number;
  liquidity: number;
  tradeCount: number;
  bondingCurveProgress: number;
  status: string;
  description: string;
}

export function LaunchCalendar() {
  const [launches, setLaunches] = useState<LaunchToken[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchLaunches = async () => {
      try {
        const { data, error } = await supabase.functions.invoke('token-prices', {
          body: { action: 'recent_launches' },
        });
        if (error) throw error;
        if (data?.success && Array.isArray(data.data)) {
          setLaunches(data.data);
        }
      } catch (err) {
        console.error('Failed to fetch launches:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchLaunches();
    const interval = setInterval(fetchLaunches, 30000);
    return () => clearInterval(interval);
  }, []);

  const formatTime = (ts: number) => {
    const d = new Date(ts);
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  const getAge = (ts: number) => {
    const diffMs = Date.now() - ts;
    const mins = Math.floor(diffMs / 60000);
    if (mins < 60) return `${mins}m ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h ago`;
    return `${Math.floor(hrs / 24)}d ago`;
  };

  const formatMcap = (v: number) => {
    if (v >= 1e6) return `$${(v / 1e6).toFixed(1)}M`;
    if (v >= 1e3) return `$${(v / 1e3).toFixed(1)}K`;
    return `$${v.toFixed(0)}`;
  };

  return (
    <Card className="memecoin-card">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-xl">
          <Calendar className="h-5 w-5 text-solana" />
          Recent Launches
          {loading && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-3">
          {launches.length === 0 && !loading && (
            <div className="text-sm text-muted-foreground text-center py-4">No recent launches found</div>
          )}
          {launches.map((launch) => (
            <div
              key={launch.address}
              className="p-3 rounded-lg bg-background/40 border border-border hover:border-solana/30 transition-colors"
            >
              <div className="flex justify-between items-start mb-2">
                <div className="flex items-center gap-2">
                  <img
                    src={launch.logo}
                    alt={launch.name}
                    className="h-6 w-6 rounded-full"
                    onError={(e) => { e.currentTarget.src = '/placeholder.svg'; }}
                  />
                  <div>
                    <h3 className="font-semibold text-sm">{launch.name}</h3>
                    <span className="text-xs text-muted-foreground font-mono">{launch.symbol}</span>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className="bg-solana/10 text-solana border-solana/20 text-xs">
                    {getAge(launch.timestamp)}
                  </Badge>
                </div>
              </div>
              <div className="flex items-center gap-4 text-xs text-muted-foreground">
                <div className="flex items-center gap-1">
                  <Clock className="h-3 w-3" />
                  {formatTime(launch.timestamp)}
                </div>
                <span>MCap: {formatMcap(launch.marketCap)}</span>
                <span>Trades: {launch.tradeCount}</span>
                {launch.bondingCurveProgress > 0 && (
                  <span>Bonding: {launch.bondingCurveProgress.toFixed(0)}%</span>
                )}
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
