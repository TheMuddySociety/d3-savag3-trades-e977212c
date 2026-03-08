import React, { useMemo, useState, useEffect, useCallback } from 'react';
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
  ArrowRightLeft, ChevronDown, ChevronUp,
} from 'lucide-react';
import { MemeToken } from '@/types/memeToken';
import { cn } from '@/lib/utils';
import { supabase } from '@/integrations/supabase/client';

interface TokenDetailModalProps {
  token: MemeToken | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
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

// ── Mock fallback generators ────────────────────────────────────────

function generateMockPriceHistory(token: MemeToken): PricePoint[] {
  const points = 48;
  const data: PricePoint[] = [];
  let price = token.price * (1 - Math.abs(token.change24h) / 100);
  const trend = token.change24h >= 0 ? 1 : -1;
  for (let i = 0; i < points; i++) {
    const noise = (Math.random() - 0.45) * price * 0.06;
    const drift = trend * price * 0.003;
    price = Math.max(price * 0.5, price + noise + drift);
    const time = new Date(Date.now() - (points - i) * 30 * 60000);
    data.push({ time: time.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }), price: +price.toPrecision(4) });
  }
  return data;
}

function generateMockHolders(): HolderSegment[] {
  const top10 = 28 + Math.random() * 15;
  const top50 = 15 + Math.random() * 10;
  const top200 = 12 + Math.random() * 8;
  const others = Math.max(5, 100 - top10 - top50 - top200);
  return [
    { name: 'Top 10', value: +top10.toFixed(1), color: HOLDER_COLORS[0] },
    { name: 'Top 11-50', value: +top50.toFixed(1), color: HOLDER_COLORS[1] },
    { name: 'Top 51-200', value: +top200.toFixed(1), color: HOLDER_COLORS[2] },
    { name: 'Others', value: +others.toFixed(1), color: HOLDER_COLORS[3] },
  ];
}

function generateMockTrades(token: MemeToken): Trade[] {
  const trades: Trade[] = [];
  for (let i = 0; i < 15; i++) {
    const isBuy = Math.random() > 0.45;
    const amount = +(Math.random() * token.price * 50000).toPrecision(4);
    const solAmount = +(amount / 67).toFixed(3);
    const time = new Date(Date.now() - i * (60000 + Math.random() * 120000));
    trades.push({
      id: i,
      type: isBuy ? 'buy' : 'sell',
      amount,
      solAmount,
      price: +(token.price * (1 + (Math.random() - 0.5) * 0.02)).toPrecision(4),
      time: time.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
      wallet: `${Math.random().toString(36).slice(2, 6)}...${Math.random().toString(36).slice(2, 6)}`,
    });
  }
  return trades;
}

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
        setPriceData(generateMockPriceHistory(token));
        setHolders(generateMockHolders());
        setTrades(generateMockTrades(token));
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
        setPriceData(generateMockPriceHistory(token));
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
        setHolders(generateMockHolders());
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
        setTrades(generateMockTrades(token));
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

export function TokenDetailModal({ token, open, onOpenChange }: TokenDetailModalProps) {
  const { priceData, holders, trades, loading, dataSource } = useTokenDetail(token, open);

  const [showSwap, setShowSwap] = useState(false);
  const swapContainerId = `modal-swap-${token?.id || 'none'}`;

  // Initialize Jupiter swap when panel opens
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
  }, [showSwap, token?.tokenAddress, swapContainerId]);

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
            <div className="text-right">
              <div className="text-xl font-bold font-mono text-foreground">{fmt(token.price)}</div>
              <div className={cn(
                "text-sm font-medium flex items-center justify-end gap-1",
                isPositive ? "text-accent" : "text-destructive"
              )}>
                {isPositive ? <TrendingUp className="h-3.5 w-3.5" /> : <TrendingDown className="h-3.5 w-3.5" />}
                {fmt(token.change24h, 'pct')}
              </div>
            </div>
          </div>
        </DialogHeader>

        <div className="p-5 space-y-5">
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
                ) : (
                  <div className="h-full flex items-center justify-center text-muted-foreground text-sm">
                    <Loader2 className="h-5 w-5 animate-spin mr-2" /> Loading...
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
                )) : (
                  <div className="h-20 flex items-center justify-center text-muted-foreground text-sm">
                    <Loader2 className="h-5 w-5 animate-spin mr-2" /> Loading trades...
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex gap-2">
            {token.tokenAddress && (
              <>
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
