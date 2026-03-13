import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Activity, TrendingUp, TrendingDown, AlertTriangle, Zap } from 'lucide-react';
import { cn } from "@/lib/utils";
import { supabase } from '@/integrations/supabase/client';

interface Signal {
  id: string;
  type: 'buy' | 'sell' | 'alert' | 'volume';
  token: string;
  message: string;
  timestamp: number;
  strength: 'low' | 'medium' | 'high';
  price?: number;
  change?: number;
}

const SIGNAL_TYPES = {
  buy: { icon: TrendingUp, color: 'text-retro-green', bg: 'bg-retro-green/20' },
  sell: { icon: TrendingDown, color: 'text-red-400', bg: 'bg-red-400/20' },
  alert: { icon: AlertTriangle, color: 'text-yellow-400', bg: 'bg-yellow-400/20' },
  volume: { icon: Zap, color: 'text-blue-400', bg: 'bg-blue-400/20' }
};

function deriveSignalsFromTrending(trendingData: any[]): Signal[] {
  return trendingData
    .filter((t: any) => t.price > 0)
    .slice(0, 10)
    .map((t: any) => {
      const change = t.price_change_24h || 0;
      let type: Signal['type'] = 'alert';
      let message = '';
      let strength: Signal['strength'] = 'low';

      if (change > 15) {
        type = 'buy';
        message = `Surging +${change.toFixed(1)}% — breakout detected`;
        strength = 'high';
      } else if (change > 5) {
        type = 'buy';
        message = `Trending up +${change.toFixed(1)}% in 24h`;
        strength = 'medium';
      } else if (change < -10) {
        type = 'sell';
        message = `Dropping ${change.toFixed(1)}% — sell pressure`;
        strength = 'high';
      } else if (change < -3) {
        type = 'sell';
        message = `Declining ${change.toFixed(1)}% in 24h`;
        strength = 'medium';
      } else {
        type = 'volume';
        message = `Active trading — ${change >= 0 ? '+' : ''}${change.toFixed(1)}% change`;
        strength = 'low';
      }

      return {
        id: `signal-${t.address || t.symbol}-${Date.now()}`,
        type,
        token: t.symbol?.toUpperCase() || 'UNKNOWN',
        message,
        timestamp: Date.now(),
        strength,
        price: t.price,
        change,
      };
    });
}

export function LiveSignalFeed() {
  const [signals, setSignals] = useState<Signal[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchSignals = async () => {
    try {
      const { data, error } = await supabase.functions.invoke('token-prices', {
        body: { action: 'trending' },
      });
      if (error) throw error;
      if (data?.success && Array.isArray(data.data)) {
        const derived = deriveSignalsFromTrending(data.data);
        setSignals(derived);
      }
    } catch (err) {
      console.error('Failed to fetch signals:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSignals();
    const interval = setInterval(fetchSignals, 30000); // refresh every 30s
    return () => clearInterval(interval);
  }, []);

  const getStrengthColor = (strength: Signal['strength']) => {
    switch (strength) {
      case 'high': return 'border-retro-green text-retro-green';
      case 'medium': return 'border-yellow-400 text-yellow-400';
      case 'low': return 'border-gray-400 text-gray-400';
    }
  };

  return (
    <Card className="retro-terminal h-full">
      <CardHeader className="pb-3">
        <CardTitle className="text-xs font-mono text-primary flex items-center gap-2">
          <Activity className="h-4 w-4 text-retro-green animate-pulse" />
          LIVE SIGNALS
          <Badge variant="outline" className="text-xs font-mono border-retro-green text-retro-green">
            {signals.length}
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="pt-0">
        <ScrollArea className="h-48">
          <div className="space-y-2">
            {loading && signals.length === 0 && (
              <div className="text-xs text-muted-foreground text-center py-4">Loading signals...</div>
            )}
            {signals.map((signal, index) => {
              const signalConfig = SIGNAL_TYPES[signal.type];
              const Icon = signalConfig.icon;
              
              return (
                <div
                  key={signal.id}
                  className={cn(
                    "p-2 rounded border border-white/10 transition-all duration-500",
                    "hover:border-primary/50",
                    index === 0 ? "animate-fade-in" : "",
                    signalConfig.bg
                  )}
                >
                  <div className="flex items-start gap-2">
                    <Icon className={cn("h-3 w-3 mt-0.5", signalConfig.color)} />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-xs font-mono text-primary font-bold">
                          ${signal.token}
                        </span>
                        <Badge 
                          variant="outline" 
                          className={cn("text-xs px-1 py-0 h-4", getStrengthColor(signal.strength))}
                        >
                          {signal.strength.toUpperCase()}
                        </Badge>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        {signal.message}
                      </p>
                      <div className="flex justify-between items-center mt-1">
                        {signal.price !== undefined && (
                          <span className="text-xs font-mono text-primary">
                            ${signal.price < 0.01 ? signal.price.toExponential(2) : signal.price.toFixed(4)}
                          </span>
                        )}
                        <span className="text-xs text-muted-foreground">
                          {new Date(signal.timestamp).toLocaleTimeString()}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  );
}
