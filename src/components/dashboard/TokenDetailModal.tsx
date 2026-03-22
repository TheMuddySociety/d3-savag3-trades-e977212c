import React, { useMemo, useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  AreaChart, Area, ResponsiveContainer,
  XAxis, YAxis, Tooltip, CartesianGrid, PieChart, Pie, Cell,
} from 'recharts';
import {
  ExternalLink, TrendingUp, TrendingDown, Users, Droplets,
  BarChart3, Clock, Copy, ArrowUpRight, ArrowDownRight, Loader2,
  ArrowRightLeft, ChevronDown, ChevronUp, Bell, Brain, Rocket,
} from 'lucide-react';
import { MemeToken } from '@/types/memeToken';
import { TokenSafetyCard } from './TokenSafetyCard';
import { cn } from '@/lib/utils';
import { supabase } from '@/integrations/supabase/client';
import { useWallet } from '@solana/wallet-adapter-react';
import { backgroundTaskService } from '@/services/d3mon/BackgroundTaskService';
import { useToast } from '@/hooks/use-toast';

interface TokenDetailModalProps {
  token: MemeToken | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSetAlert?: (token: MemeToken) => void;
}

interface PricePoint {
  time: string;
  price: number;
  unixTime?: number;
}

interface HolderSegment {
  name: string;
  value: number;
  color: string;
}

interface Trade {
  id: number;
  type: 'buy' | 'sell';
  amount: number;
  solAmount: number;
  price: number;
  time: string;
  wallet: string;
}

const HOLDER_COLORS = [
  'hsl(var(--primary))',
  'hsl(var(--accent))',
  'hsl(var(--muted-foreground))',
  'hsl(var(--muted))',
];

// ── Data fetching hooks ─────────────────────────────────────────────

function useTokenDetail(token: MemeToken | null, open: boolean) {
  const [priceData, setPriceData] = useState<PricePoint[]>([]);
  const [holders, setHolders] = useState<HolderSegment[]>([]);
  const [trades, setTrades] = useState<Trade[]>([]);
  const [loading, setLoading] = useState(false);
  const [dataSource, setDataSource] = useState<'live' | 'mock'>('mock');

  useEffect(() => {
    if (!token || !open) return;

    let cancelled = false;
    setLoading(true);

    const fetchAll = async () => {
      const address = token.tokenAddress;
      if (!address) {
        setPriceData([]);
        setHolders([]);
        setTrades([]);
        setDataSource('mock');
        setLoading(false);
        return;
      }

      // Fetch all three in parallel, fallback to mock on failure
      const [priceResult, holderResult, tradeResult] = await Promise.allSettled([
        supabase.functions.invoke('token-prices', {
          body: { action: 'price_history', address, interval: '30m' },
        }),
        supabase.functions.invoke('token-prices', {
          body: { action: 'token_holders', address },
        }),
        supabase.functions.invoke('token-prices', {
          body: { action: 'token_trades', address, limit: 20 },
        }),
      ]);

      if (cancelled) return;

      let usedLive = false;

      // Price history
      if (priceResult.status === 'fulfilled' && priceResult.value.data?.success && priceResult.value.data.data?.length > 0) {
        const items = priceResult.value.data.data;
        setPriceData(items.map((p: { unixTime: number; value: number }) => ({
          time: new Date(p.unixTime * 1000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          price: p.value,
        })));
        usedLive = true;
      } else {
        setPriceData([]);
      }

      // Holders
      if (holderResult.status === 'fulfilled' && holderResult.value.data?.success && holderResult.value.data.data?.distribution) {
        const dist = holderResult.value.data.data.distribution;
        setHolders(dist.map((d: { name: string; value: number }, i: number) => ({
          ...d,
          value: +d.value.toFixed(1),
          color: HOLDER_COLORS[i] || HOLDER_COLORS[3],
        })));
        usedLive = true;
      } else {
        setHolders([]);
      }

      // Trades
      if (tradeResult.status === 'fulfilled' && tradeResult.value.data?.success && Array.isArray(tradeResult.value.data.data) && tradeResult.value.data.data.length > 0) {
        const rawTrades = tradeResult.value.data.data;
        setTrades(rawTrades.slice(0, 15).map((t: {
          txHash: string;
          side: string;
          from: { amount: number; symbol: string; decimals: number; uiAmount: number };
          to: { amount: number; symbol: string; decimals: number; uiAmount: number };
          blockUnixTime: number;
          owner: string;
        }, i: number) => {
          const isBuy = t.side === 'buy';
          const solAmt = isBuy ? t.from?.uiAmount || 0 : t.to?.uiAmount || 0;
          const tokenAmt = isBuy ? t.to?.uiAmount || 0 : t.from?.uiAmount || 0;
          return {
            id: i,
            type: isBuy ? 'buy' as const : 'sell' as const,
            amount: tokenAmt,
            solAmount: +solAmt.toFixed(3),
            price: tokenAmt > 0 ? solAmt * 67 / tokenAmt : 0,
            time: new Date(t.blockUnixTime * 1000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
            wallet: t.owner ? `${t.owner.slice(0, 4)}...${t.owner.slice(-4)}` : 'unknown',
          };
        }));
        usedLive = true;
      } else {
        setTrades([]);
      }

      setDataSource(usedLive ? 'live' : 'mock');
      setLoading(false);
    };

    fetchAll();
    return () => { cancelled = true; };
  }, [token?.id, open]);

  return { priceData, holders, trades, loading, dataSource };
}

// ── Formatting ──────────────────────────────────────────────────────

const fmt = (v: number, type: 'usd' | 'compact' | 'pct' = 'usd') => {
  if (type === 'pct') return `${v >= 0 ? '+' : ''}${v.toFixed(2)}%`;
  if (type === 'compact') {
    if (v >= 1e9) return `${(v / 1e9).toFixed(2)}B`;
    if (v >= 1e6) return `${(v / 1e6).toFixed(2)}M`;
    if (v >= 1e3) return `${(v / 1e3).toFixed(2)}K`;
    return v.toLocaleString();
  }
  if (v >= 1e9) return `$${(v / 1e9).toFixed(2)}B`;
  if (v >= 1e6) return `$${(v / 1e6).toFixed(2)}M`;
  if (v >= 1e3) return `$${(v / 1e3).toFixed(2)}K`;
  if (v < 0.001 && v > 0) return `$${v.toExponential(2)}`;
  return `$${v.toFixed(4)}`;
};

// ── Component ───────────────────────────────────────────────────────

export function TokenDetailModal({ token, open, onOpenChange, onSetAlert }: TokenDetailModalProps) {
  const navigate = useNavigate();
  const { priceData, holders, trades, loading, dataSource } = useTokenDetail(token, open);

  const [showSwap, setShowSwap] = useState(false);
  const [selectedAmount, setSelectedAmount] = useState<number | null>(null);
  const [isQueueing, setIsQueueing] = useState(false);
  const { publicKey } = useWallet();
  const { toast } = useToast();
  const swapContainerId = `modal-swap-${token?.id || 'none'}`;

  const QUICK_BUY_AMOUNTS = [0.1, 0.5, 1, 5];

  // Initialize Jupiter swap when panel opens or amount changes
  useEffect(() => {
    if (!showSwap || !token?.tokenAddress) return;

    const timer = setTimeout(() => {
      import("@jup-ag/plugin").then((mod) => {
        mod.init({
          displayMode: "integrated",
          integratedTargetId: swapContainerId,
          formProps: {
            fixedMint: undefined,
            initialInputMint: "So11111111111111111111111111111111111111112",
            initialOutputMint: token.tokenAddress,
            initialAmount: selectedAmount ? String(selectedAmount * 1e9) : undefined,
            referralAccount: "F4qYkXAcogrjQHw3ngKWjisMmmRFR4Ea6c9DCCpK5gBr",
            referralFee: 150,
          },
          branding: {
            name: "D3 SAVAGE SWAP",
            logoUri: "https://ibb.co/0VFDBzYQ",
          },
        });
      }).catch(console.error);
    }, 100);

    return () => clearTimeout(timer);
  }, [showSwap, token?.tokenAddress, swapContainerId, selectedAmount]);

  const handleQuickBuy = (amount: number) => {
    setSelectedAmount(amount);
    if (!showSwap) setShowSwap(true);
  };

  const handleBackgroundOrder = async () => {
    if (!publicKey || !token?.tokenAddress || !selectedAmount) {
      toast({
        title: "Missing Information",
        description: "Please connect wallet and select an amount to continue.",
        variant: "destructive"
      });
      return;
    }

    setIsQueueing(true);
    try {
      await backgroundTaskService.queueTrade({
        wallet_address: publicKey.toBase58(),
        input_mint: "So11111111111111111111111111111111111111112",
        output_mint: token.tokenAddress,
        amount: selectedAmount,
        slippage_bps: 300 // Default 3%
      });
      
      toast({
        title: "🚀 Background Task Queued",
        description: `D3S Agent is now watching for an entry to buy ${selectedAmount} SOL of ${token.symbol}. Check the 'Tasks' tab for status.`,
      });
    } catch (error) {
      console.error('Failed to queue background trade:', error);
      toast({
        title: "Queue Failed",
        description: error instanceof Error ? error.message : "Failed to queue background task.",
        variant: "destructive"
      });
    } finally {
      setIsQueueing(false);
    }
  };

  if (!token) return null;

  const isPositive = token.change24h >= 0;

  const copyAddress = () => {
    if (token.tokenAddress) {
      navigator.clipboard.writeText(token.tokenAddress);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto bg-card border-border p-0">
        {/* Header */}
        <DialogHeader className="p-5 pb-0">
          <div className="flex items-center gap-4">
            <div className="h-12 w-12 rounded-full overflow-hidden ring-2 ring-border">
              <img
                src={token.logoUrl}
                alt={token.name}
                className="h-full w-full object-cover"
                onError={(e) => { e.currentTarget.src = '/placeholder.svg'; }}
              />
            </div>
            <div className="flex-1 min-w-0">
              <DialogTitle className="text-lg flex items-center gap-2 flex-wrap">
                {token.name}
                <Badge variant="outline" className="text-xs font-mono">{token.symbol}</Badge>
                {token.tags.map(tag => (
                  <Badge key={tag} variant="secondary" className="text-[10px]">{tag}</Badge>
                ))}
                <Badge
                  variant="outline"
                  className={cn(
                    "text-[9px] ml-1",
                    dataSource === 'live' ? "border-accent/50 text-accent" : "border-muted-foreground/30 text-muted-foreground"
                  )}
                >
                  {loading ? 'Loading...' : dataSource === 'live' ? '● Live Data' : '○ Simulated'}
                </Badge>
              </DialogTitle>
              {token.tokenAddress && (
                <button
                  onClick={copyAddress}
                  className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1 mt-0.5 font-mono transition-colors"
                >
                  {token.tokenAddress.slice(0, 6)}...{token.tokenAddress.slice(-4)}
                  <Copy className="h-3 w-3" />
                </button>
              )}
            </div>
            <div className="text-right flex flex-col items-end gap-1">
              <div className="text-xl font-bold font-mono text-foreground">{fmt(token.price)}</div>
              <div className={cn(
                "text-sm font-medium flex items-center justify-end gap-1",
                isPositive ? "text-accent" : "text-destructive"
              )}>
                {isPositive ? <TrendingUp className="h-3.5 w-3.5" /> : <TrendingDown className="h-3.5 w-3.5" />}
                {fmt(token.change24h, 'pct')}
              </div>
              {onSetAlert && token.tokenAddress && (
                <Button
                  size="sm"
                  variant="outline"
                  className="h-7 text-xs gap-1 border-accent/30 hover:bg-accent/10 hover:text-accent mt-0.5"
                  onClick={() => onSetAlert(token)}
                >
                  <Bell className="h-3 w-3" /> Set Alert
                </Button>
              )}
            </div>
          </div>
        </DialogHeader>

        <div className="p-5 space-y-5">
          {/* Safety Analysis */}
          {token.tokenAddress && (
            <TokenSafetyCard tokenAddress={token.tokenAddress} tokenName={token.name} />
          )}
          {/* Stats Row */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[
              { label: 'Market Cap', value: fmt(token.marketCap), icon: BarChart3 },
              { label: 'Volume 24h', value: fmt(token.volume24h), icon: BarChart3 },
              { label: 'Liquidity', value: fmt(token.liquidity), icon: Droplets },
              { label: 'Holders', value: fmt(token.holders, 'compact'), icon: Users },
            ].map(stat => (
              <div key={stat.label} className="rounded-lg bg-muted/40 border border-border/50 p-3">
                <div className="text-[11px] text-muted-foreground flex items-center gap-1 mb-1">
                  <stat.icon className="h-3 w-3" /> {stat.label}
                </div>
                <div className="text-sm font-semibold font-mono text-foreground">{stat.value}</div>
              </div>
            ))}
          </div>

          {/* Price Chart */}
          <div className="rounded-lg border border-border/50 bg-muted/20 p-4">
            <h3 className="text-sm font-medium text-foreground mb-3 flex items-center gap-2">
              <Clock className="h-4 w-4 text-muted-foreground" />
              Price Chart (24h)
              {loading && <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />}
            </h3>
            <div className="h-52">
              {priceData.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={priceData}>
                    <defs>
                      <linearGradient id="priceGradient" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor={isPositive ? 'hsl(var(--accent))' : 'hsl(var(--destructive))'} stopOpacity={0.3} />
                        <stop offset="95%" stopColor={isPositive ? 'hsl(var(--accent))' : 'hsl(var(--destructive))'} stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.3} />
                    <XAxis dataKey="time" tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }} interval={7} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }} axisLine={false} tickLine={false} width={55} tickFormatter={(v) => fmt(v)} />
                    <Tooltip
                      contentStyle={{ backgroundColor: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: '8px', fontSize: '12px' }}
                      labelStyle={{ color: 'hsl(var(--muted-foreground))' }}
                      formatter={(value: number) => [fmt(value), 'Price']}
                    />
                    <Area type="monotone" dataKey="price" stroke={isPositive ? 'hsl(var(--accent))' : 'hsl(var(--destructive))'} fill="url(#priceGradient)" strokeWidth={2} />
                  </AreaChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-full flex items-center justify-center text-muted-foreground text-sm">
                  <Loader2 className="h-5 w-5 animate-spin mr-2" /> Loading chart...
                </div>
              )}
            </div>
          </div>

          {/* Holder Distribution + Trade History */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Holder Distribution */}
            <div className="rounded-lg border border-border/50 bg-muted/20 p-4">
              <h3 className="text-sm font-medium text-foreground mb-3 flex items-center gap-2">
                <Users className="h-4 w-4 text-muted-foreground" />
                Holder Distribution
                {loading && <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />}
              </h3>
              <div className="h-40">
                {holders.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie data={holders} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={35} outerRadius={60} strokeWidth={2} stroke="hsl(var(--card))">
                        {holders.map((entry, i) => (
                          <Cell key={i} fill={entry.color} />
                        ))}
                      </Pie>
                      <Tooltip
                        contentStyle={{ backgroundColor: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: '8px', fontSize: '12px' }}
                        formatter={(value: number) => [`${value.toFixed(1)}%`, '']}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                ) : loading ? (
                  <div className="h-full flex items-center justify-center text-muted-foreground text-sm">
                    <Loader2 className="h-5 w-5 animate-spin mr-2" /> Loading...
                  </div>
                ) : (
                  <div className="h-full flex items-center justify-center text-muted-foreground text-sm">
                    No holder data available
                  </div>
                )}
              </div>
              <div className="flex flex-wrap gap-x-4 gap-y-1 mt-2 justify-center">
                {holders.map(h => (
                  <div key={h.name} className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                    <div className="h-2 w-2 rounded-full" style={{ backgroundColor: h.color }} />
                    {h.name} ({h.value.toFixed(1)}%)
                  </div>
                ))}
              </div>
            </div>

            {/* Trade History */}
            <div className="rounded-lg border border-border/50 bg-muted/20 p-4">
              <h3 className="text-sm font-medium text-foreground mb-3 flex items-center gap-2">
                <BarChart3 className="h-4 w-4 text-muted-foreground" />
                Recent Trades
                {loading && <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />}
              </h3>
              <div className="space-y-1.5 max-h-56 overflow-y-auto scrollbar-thin">
                {trades.length > 0 ? trades.map(trade => (
                  <div
                    key={trade.id}
                    className={cn(
                      "flex items-center justify-between text-[11px] rounded-md px-2 py-1.5",
                      trade.type === 'buy' ? 'bg-accent/5' : 'bg-destructive/5'
                    )}
                  >
                    <div className="flex items-center gap-1.5">
                      {trade.type === 'buy' ? (
                        <ArrowUpRight className="h-3 w-3 text-accent" />
                      ) : (
                        <ArrowDownRight className="h-3 w-3 text-destructive" />
                      )}
                      <span className={cn("font-medium", trade.type === 'buy' ? 'text-accent' : 'text-destructive')}>
                        {trade.type === 'buy' ? 'BUY' : 'SELL'}
                      </span>
                      <span className="text-muted-foreground font-mono">{trade.wallet}</span>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="text-foreground font-mono">{trade.solAmount} SOL</span>
                      <span className="text-muted-foreground">{trade.time}</span>
                    </div>
                  </div>
                )) : loading ? (
                  <div className="h-20 flex items-center justify-center text-muted-foreground text-sm">
                    <Loader2 className="h-5 w-5 animate-spin mr-2" /> Loading trades...
                  </div>
                ) : (
                  <div className="h-20 flex items-center justify-center text-muted-foreground text-sm">
                    No recent trades found
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Swap Panel */}
          {token.tokenAddress && (
            <div className="rounded-lg border border-border/50 bg-muted/20 overflow-hidden">
              <button
                onClick={() => setShowSwap(!showSwap)}
                className="w-full flex items-center justify-between p-3 hover:bg-muted/40 transition-colors"
              >
                <div className="flex items-center gap-2 text-sm font-medium text-foreground">
                  <ArrowRightLeft className="h-4 w-4 text-primary" />
                  Swap SOL → {token.symbol}
                </div>
                {showSwap ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
              </button>
              {showSwap && (
                <div className="border-t border-border/30">
                  {/* Quick Buy Presets */}
                  <div className="px-3 pt-3 pb-1">
                    <p className="text-[11px] text-muted-foreground mb-2">⚡ Quick Buy</p>
                    <div className="flex gap-2">
                      {QUICK_BUY_AMOUNTS.map((amount) => (
                        <Button
                          key={amount}
                          size="sm"
                          variant={selectedAmount === amount ? "default" : "outline"}
                          className={cn(
                            "flex-1 h-9 text-xs font-mono gap-1 transition-all",
                            selectedAmount === amount
                              ? "bg-primary text-primary-foreground shadow-sm shadow-primary/20"
                              : "border-border/50 hover:border-primary/50 hover:bg-primary/5"
                          )}
                          onClick={() => handleQuickBuy(amount)}
                        >
                          {amount} SOL
                        </Button>
                      ))}
                    </div>
                    {selectedAmount && token.price > 0 && (
                      <p className="text-[10px] text-muted-foreground mt-1.5 text-center">
                        ≈ {((selectedAmount * 67) / token.price).toLocaleString(undefined, { maximumFractionDigits: 0 })} {token.symbol} at current price
                      </p>
                    )}
                  </div>
                    <div
                      id={swapContainerId}
                      className="min-h-[380px] w-full p-3"
                    />
                    
                    {/* Background Order Trigger */}
                    <div className="p-3 pt-0 border-t border-border/20 bg-accent/5">
                      <div className="flex flex-col gap-2 p-3 rounded-lg border border-accent/20 bg-background/50">
                        <div className="flex items-center justify-between text-[11px]">
                          <span className="text-muted-foreground font-medium flex items-center gap-1.5">
                            <Brain className="h-3 w-3 text-accent" />
                            D3S Agent Autonomous Entry
                          </span>
                          <Badge variant="outline" className="text-[9px] text-accent border-accent/30 h-4">BETA</Badge>
                        </div>
                        <p className="text-[10px] text-muted-foreground">
                          Queue this trade to execute via D3S Agent background engine. No need to keep the tab open.
                        </p>
                        <Button 
                          size="sm"
                          className="w-full h-8 text-[11px] bg-accent hover:bg-accent/90 gap-2 mt-1"
                          onClick={handleBackgroundOrder}
                          disabled={!selectedAmount || isQueueing}
                        >
                          {isQueueing ? <Loader2 className="h-3 w-3 animate-spin" /> : <Rocket className="h-3 w-3" />}
                          {selectedAmount ? `Queue ${selectedAmount} SOL Background Buy` : 'Select amount above to queue'}
                        </Button>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}

          {/* Action Buttons */}
          <div className="flex gap-2">
            {token.tokenAddress && (
              <>
                <Button
                  size="sm"
                  variant="default"
                  className="gap-1.5 text-xs flex-1"
                  onClick={() => {
                    onOpenChange(false);
                    navigate(`/token/${token.tokenAddress}`);
                  }}
                >
                  <ExternalLink className="h-3 w-3" /> Full Details
                </Button>
                <Button size="sm" variant="outline" className="gap-1.5 text-xs flex-1" asChild>
                  <a href={`https://solscan.io/token/${token.tokenAddress}`} target="_blank" rel="noopener noreferrer">
                    <ExternalLink className="h-3 w-3" /> Solscan
                  </a>
                </Button>
                <Button size="sm" variant="outline" className="gap-1.5 text-xs flex-1" asChild>
                  <a href={`https://birdeye.so/token/${token.tokenAddress}?chain=solana`} target="_blank" rel="noopener noreferrer">
                    <ExternalLink className="h-3 w-3" /> Birdeye
                  </a>
                </Button>
                <Button size="sm" variant="outline" className="gap-1.5 text-xs flex-1" asChild>
                  <a href={`https://pump.fun/${token.tokenAddress}`} target="_blank" rel="noopener noreferrer">
                    <ExternalLink className="h-3 w-3" /> Pump.Fun
                  </a>
                </Button>
              </>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
