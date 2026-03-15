import React, { useState, useEffect } from 'react';
import { LineChart, Line, ResponsiveContainer } from 'recharts';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { TrendingUp, TrendingDown, Loader2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';

const SOL_MINT = 'So11111111111111111111111111111111111111112';

interface MiniChartProps {
  title?: string;
}

export function MiniChart({ title = "SOL/USD" }: MiniChartProps) {
  const [price, setPrice] = useState<number | null>(null);
  const [change, setChange] = useState<number>(0);
  const [chartData, setChartData] = useState<Array<{ value: number; timestamp: number }>>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchSolData = async () => {
      try {
        // Fetch SOL price and real price history in parallel
        const [priceResult, historyResult] = await Promise.allSettled([
          supabase.functions.invoke('token-prices', {
            body: { action: 'sol_price' },
          }),
          supabase.functions.invoke('token-prices', {
            body: { action: 'price_history', address: SOL_MINT, interval: '1H' },
          }),
        ]);

        // Set current price
        if (priceResult.status === 'fulfilled' && priceResult.value.data?.success && priceResult.value.data.data) {
          setPrice(priceResult.value.data.data.price);
          setChange(priceResult.value.data.data.change24h || 0);
        }

        // Set real chart data from price history
        if (historyResult.status === 'fulfilled' && historyResult.value.data?.success && Array.isArray(historyResult.value.data.data) && historyResult.value.data.data.length > 0) {
          const points = historyResult.value.data.data.map((p: { unixTime: number; value: number }) => ({
            value: p.value,
            timestamp: p.unixTime * 1000,
          }));
          setChartData(points);
        }
      } catch (err) {
        console.error('Failed to fetch SOL data:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchSolData();
    const interval = setInterval(fetchSolData, 30000);
    return () => clearInterval(interval);
  }, []);

  const isPositive = change >= 0;

  return (
    <Card className="retro-terminal">
      <CardHeader className="pb-2">
        <CardTitle className="text-xs font-mono text-primary flex items-center gap-2">
          {isPositive ? (
            <TrendingUp className="h-3 w-3 text-retro-green" />
          ) : (
            <TrendingDown className="h-3 w-3 text-red-400" />
          )}
          {title}
        </CardTitle>
      </CardHeader>
      <CardContent className="pt-0">
        <div className="flex items-center justify-between mb-2">
          {loading ? (
            <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
          ) : (
            <>
              <span className="text-sm font-mono text-primary">
                ${price?.toFixed(2) ?? '—'}
              </span>
              <span className={`text-xs font-mono ${isPositive ? 'text-retro-green' : 'text-red-400'}`}>
                {isPositive ? '+' : ''}{change.toFixed(1)}%
              </span>
            </>
          )}
        </div>
        <div className="h-16 w-full">
          {chartData.length > 0 && (
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData}>
                <Line
                  type="monotone"
                  dataKey="value"
                  stroke={isPositive ? '#00ff00' : '#ff0000'}
                  strokeWidth={1}
                  dot={false}
                  activeDot={{ r: 2, fill: isPositive ? '#00ff00' : '#ff0000' }}
                />
              </LineChart>
            </ResponsiveContainer>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
