import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { BarChart3, Activity, AlertCircle, RefreshCw, Loader2 } from "lucide-react";
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface Transaction {
  txHash: string;
  type: string;
  source: string;
  timestamp: number;
  description: string;
}

interface MarketInsights {
  newTokens24h: number;
  avgLiquidity: number;
  solPrice: number;
  totalVolume: number;
  marketCapChange24h: number;
}

export function BlockchainAnalytics() {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [insights, setInsights] = useState<MarketInsights | null>(null);

  const fetchTransactions = async () => {
    try {
      setIsRefreshing(true);
      const txs = await SolanaService.getRecentMemeTransactions(15);
      setTransactions(txs);
    } catch (error) {
      console.error('Error fetching transactions:', error);
      toast.error('Failed to fetch blockchain data');
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  };

  const fetchInsights = async () => {
    try {
      const { data, error } = await supabase.functions.invoke('token-prices', {
        body: { action: 'market_stats' },
      });
      if (error) throw error;
      if (data?.success) setInsights(data.data);
    } catch (err) {
      console.error('Error fetching insights:', err);
    }
  };

  useEffect(() => {
    SolanaService.initConnection();
    fetchTransactions();
    fetchInsights();
    const intervalId = setInterval(() => { fetchTransactions(); fetchInsights(); }, 120000);
    return () => clearInterval(intervalId);
  }, []);

  const formatDate = (timestamp?: string) => {
    if (!timestamp) return 'Unknown';
    return new Date(timestamp).toLocaleString();
  };

  const shortenAddress = (address: string) => `${address.slice(0, 4)}...${address.slice(-4)}`;

  const formatLargeNumber = (n: number) => {
    if (n >= 1e12) return `$${(n / 1e12).toFixed(1)}T`;
    if (n >= 1e9) return `$${(n / 1e9).toFixed(1)}B`;
    if (n >= 1e6) return `$${(n / 1e6).toFixed(1)}M`;
    if (n >= 1e3) return `$${(n / 1e3).toFixed(1)}K`;
    return `$${n.toFixed(0)}`;
  };

  return (
    <Card className="memecoin-card">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-xl">
            <BarChart3 className="h-5 w-5 text-solana" />
            Solana Memecoin Activity
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => { fetchTransactions(); fetchInsights(); }}
            disabled={isRefreshing}
            className="h-8 gap-1"
          >
            <RefreshCw className={`h-4 w-4 ${isRefreshing ? 'animate-spin' : ''}`} />
            {isRefreshing ? 'Refreshing...' : 'Refresh'}
          </Button>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue="transactions" className="space-y-4">
          <TabsList className="grid grid-cols-2 w-full">
            <TabsTrigger value="transactions" className="flex items-center gap-1">
              <Activity className="h-4 w-4" />
              <span>Recent Transactions</span>
            </TabsTrigger>
            <TabsTrigger value="insights" className="flex items-center gap-1">
              <AlertCircle className="h-4 w-4" />
              <span>Market Insights</span>
            </TabsTrigger>
          </TabsList>

          <TabsContent value="transactions" className="space-y-4">
            <div className="max-h-[300px] overflow-y-auto rounded-md border">
              {isLoading ? (
                <div className="space-y-2 p-4">
                  {Array(5).fill(0).map((_, index) => (
                    <div key={index} className="flex items-center justify-between">
                      <Skeleton className="h-4 w-32" />
                      <Skeleton className="h-4 w-24" />
                    </div>
                  ))}
                </div>
              ) : transactions.length === 0 ? (
                <div className="p-4 text-center text-muted-foreground">
                  No recent transactions found
                </div>
              ) : (
                <div className="divide-y">
                  {transactions.map((tx) => (
                    <div key={tx.signature} className="p-3 hover:bg-muted/50 transition-colors">
                      <div className="flex justify-between mb-1">
                        <span className="font-mono text-xs text-muted-foreground">
                          {shortenAddress(tx.signature)}
                        </span>
                        <span className={`text-xs ${tx.err ? 'text-red-500' : 'text-green-500'}`}>
                          {tx.err ? 'Failed' : 'Success'}
                        </span>
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {formatDate(tx.timestamp)}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </TabsContent>

          <TabsContent value="insights" className="space-y-4">
            <div className="p-4 bg-muted/30 rounded-md">
              <h3 className="font-semibold mb-2">Live Market Insights</h3>
              {insights ? (
                <ul className="space-y-2 text-sm">
                  <li className="flex items-start gap-1">
                    <span className="text-solana">•</span>
                    <span>Global crypto market cap changed {insights.marketCapChange24h >= 0 ? '+' : ''}{insights.marketCapChange24h.toFixed(1)}% in the last 24h</span>
                  </li>
                  <li className="flex items-start gap-1">
                    <span className="text-solana">•</span>
                    <span>SOL trading at ${insights.solPrice.toFixed(2)} with {formatLargeNumber(insights.totalVolume)} total volume</span>
                  </li>
                  <li className="flex items-start gap-1">
                    <span className="text-solana">•</span>
                    <span>{insights.newTokens24h} new tokens recently launched on Solana launchpads</span>
                  </li>
                  <li className="flex items-start gap-1">
                    <span className="text-solana">•</span>
                    <span>Average new token liquidity: {formatLargeNumber(insights.avgLiquidity)}</span>
                  </li>
                </ul>
              ) : (
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" /> Loading insights...
                </div>
              )}
            </div>

            <div className="grid grid-cols-2 gap-4">
              <Card className="bg-muted/10">
                <CardContent className="p-4">
                  <div className="text-xs text-muted-foreground mb-1">Recent New Tokens</div>
                  <div className="text-xl font-bold">
                    {insights ? insights.newTokens24h : <Skeleton className="h-6 w-12" />}
                  </div>
                </CardContent>
              </Card>
              <Card className="bg-muted/10">
                <CardContent className="p-4">
                  <div className="text-xs text-muted-foreground mb-1">Avg. Initial Liquidity</div>
                  <div className="text-xl font-bold">
                    {insights ? formatLargeNumber(insights.avgLiquidity) : <Skeleton className="h-6 w-16" />}
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}
