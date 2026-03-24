import React, { useState, useEffect, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  AreaChart, Area, ResponsiveContainer,
  XAxis, YAxis, Tooltip, CartesianGrid, PieChart, Pie, Cell,
} from 'recharts';
import {
  ArrowLeft, ExternalLink, TrendingUp, TrendingDown, Users, Droplets,
  BarChart3, Clock, Copy, ArrowUpRight, ArrowDownRight, Loader2,
  Globe, Twitter, MessageCircle, Bell, Shield, ArrowRightLeft,
  ChevronDown, ChevronUp,
} from 'lucide-react';
import { TokenSafetyCard } from '@/components/dashboard/TokenSafetyCard';

// ── Types ───────────────────────────────────────────────────────────

interface TokenData {
  address: string;
  name: string;
  symbol: string;
  price: number;
  marketCap: number;
  volume24h: number;
  change24h: number;
  change1h: number;
  change5m: number;
  liquidity: number;
  logoUrl: string;
  dexId: string;
  pairCreatedAt: number;
  txns24h: { buys?: number; sells?: number };
  websites: { label: string; url: string }[];
  socials: { type: string; url: string }[];
  graduated?: boolean;
  bondingCurveProgress?: number;
}

interface PricePoint {
  time: string;
  price: number;
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
  txHash?: string;
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

const HOLDER_COLORS = [
  'hsl(var(--primary))',
  'hsl(var(--accent))',
  'hsl(var(--muted-foreground))',
  'hsl(var(--muted))',
];

// ── Bonding Curve Chart ─────────────────────────────────────────────

function BondingCurveChart({ progress, graduated }: { progress?: number; graduated?: boolean }) {
  const curveData = useMemo(() => {
    const points = [];
    for (let i = 0; i <= 100; i += 2) {
      // Simulated bonding curve: price increases exponentially
      const price = Math.pow(i / 100, 2) * 100;
      points.push({ progress: i, price, filled: i <= (progress || 0) });
    }
    return points;
  }, [progress]);

  const currentProgress = progress || 0;
  const barColor = graduated
    ? 'hsl(var(--accent))'
    : currentProgress >= 80
    ? 'hsl(142, 76%, 36%)'
    : currentProgress >= 50
    ? 'hsl(48, 96%, 53%)'
    : 'hsl(var(--primary))';

  return (
    <div className="rounded-xl border border-border/50 bg-muted/20 p-5">
      <h3 className="text-sm font-medium text-foreground mb-4 flex items-center gap-2">
        <BarChart3 className="h-4 w-4 text-muted-foreground" />
        Bonding Curve Progress
      </h3>

      {graduated ? (
        <div className="text-center py-6">
          <div className="text-4xl mb-2">🎓</div>
          <p className="text-lg font-semibold text-accent">Graduated</p>
          <p className="text-sm text-muted-foreground mt-1">
            This token has completed its bonding curve and migrated to a DEX
          </p>
        </div>
      ) : (
        <>
          {/* Progress bar */}
          <div className="mb-4">
            <div className="flex items-center justify-between text-xs text-muted-foreground mb-1.5">
              <span>Progress</span>
              <span className="font-mono font-semibold" style={{ color: barColor }}>
                {currentProgress.toFixed(1)}%
              </span>
            </div>
            <div className="h-4 rounded-full bg-muted/60 border border-border/30 overflow-hidden relative">
              <div
                className="h-full rounded-full transition-all duration-700 relative overflow-hidden"
                style={{
                  width: `${Math.min(currentProgress, 100)}%`,
                  background: `linear-gradient(90deg, ${barColor}, ${barColor}dd)`,
                }}
              >
                <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent animate-pulse" />
              </div>
            </div>
            <div className="flex justify-between text-[10px] text-muted-foreground mt-1">
              <span>0%</span>
              <span>Migration at 100%</span>
            </div>
          </div>

          {/* Bonding curve shape */}
          <div className="h-40">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={curveData}>
                <defs>
                  <linearGradient id="bondingFilled" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor={barColor} stopOpacity={0.4} />
                    <stop offset="95%" stopColor={barColor} stopOpacity={0.05} />
                  </linearGradient>
                  <linearGradient id="bondingEmpty" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="hsl(var(--muted-foreground))" stopOpacity={0.1} />
                    <stop offset="95%" stopColor="hsl(var(--muted-foreground))" stopOpacity={0.02} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.2} />
                <XAxis
                  dataKey="progress"
                  tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }}
                  axisLine={false}
                  tickLine={false}
                  tickFormatter={(v) => `${v}%`}
                  interval={9}
                />
                <YAxis hide />
                <Tooltip
                  contentStyle={{
                    backgroundColor: 'hsl(var(--card))',
                    border: '1px solid hsl(var(--border))',
                    borderRadius: '8px',
                    fontSize: '12px',
                  }}
                  formatter={(value: number, name: string) => [
                    `${value.toFixed(2)}`,
                    'Relative Price',
                  ]}
                  labelFormatter={(label) => `${label}% progress`}
                />
                <Area
                  type="monotone"
                  dataKey="price"
                  stroke={barColor}
                  fill="url(#bondingFilled)"
                  strokeWidth={2}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </>
      )}
    </div>
  );
}

// ── Social Links Component ──────────────────────────────────────────

function SocialLinks({
  websites,
  socials,
  address,
}: {
  websites: { label: string; url: string }[];
  socials: { type: string; url: string }[];
  address: string;
}) {
  const getSocialIcon = (type: string) => {
    switch (type.toLowerCase()) {
      case 'twitter':
        return <Twitter className="h-4 w-4" />;
      case 'telegram':
        return <MessageCircle className="h-4 w-4" />;
      case 'discord':
        return <MessageCircle className="h-4 w-4" />;
      default:
        return <Globe className="h-4 w-4" />;
    }
  };

  const allLinks = [
    ...websites.map((w) => ({ label: w.label || 'Website', url: w.url, icon: <Globe className="h-4 w-4" /> })),
    ...socials.map((s) => ({ label: s.type.charAt(0).toUpperCase() + s.type.slice(1), url: s.url, icon: getSocialIcon(s.type) })),
  ];

  // Always-present explorer links
  const explorerLinks = [
    { label: 'Solscan', url: `https://solscan.io/token/${address}`, icon: <ExternalLink className="h-4 w-4" /> },
    { label: 'Birdeye', url: `https://birdeye.so/token/${address}?chain=solana`, icon: <ExternalLink className="h-4 w-4" /> },
    { label: 'Pump.Fun', url: `https://pump.fun/${address}`, icon: <ExternalLink className="h-4 w-4" /> },
    { label: 'DexScreener', url: `https://dexscreener.com/solana/${address}`, icon: <ExternalLink className="h-4 w-4" /> },
  ];

  return (
    <div className="rounded-xl border border-border/50 bg-muted/20 p-5">
      <h3 className="text-sm font-medium text-foreground mb-4 flex items-center gap-2">
        <Globe className="h-4 w-4 text-muted-foreground" />
        Links & Socials
      </h3>

      {allLinks.length > 0 && (
        <div className="flex flex-wrap gap-2 mb-4">
          {allLinks.map((link, i) => (
            <Button key={i} size="sm" variant="outline" className="gap-1.5 text-xs h-8" asChild>
              <a href={link.url} target="_blank" rel="noopener noreferrer">
                {link.icon} {link.label}
              </a>
            </Button>
          ))}
        </div>
      )}

      {allLinks.length === 0 && (
        <p className="text-xs text-muted-foreground mb-4">No social links available for this token</p>
      )}

      <div className="border-t border-border/30 pt-3">
        <p className="text-[11px] text-muted-foreground mb-2">Explorers</p>
        <div className="flex flex-wrap gap-2">
          {explorerLinks.map((link, i) => (
            <Button key={i} size="sm" variant="ghost" className="gap-1.5 text-xs h-7 text-muted-foreground hover:text-foreground" asChild>
              <a href={link.url} target="_blank" rel="noopener noreferrer">
                {link.icon} {link.label}
              </a>
            </Button>
          ))}
        </div>
      </div>
    </div>
  );
}

// ── Trade History Component ─────────────────────────────────────────

function TradeHistory({ trades, loading }: { trades: Trade[]; loading: boolean }) {
  return (
    <div className="rounded-xl border border-border/50 bg-muted/20 p-5">
      <h3 className="text-sm font-medium text-foreground mb-4 flex items-center gap-2">
        <BarChart3 className="h-4 w-4 text-muted-foreground" />
        Recent Trades
        {loading && <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />}
      </h3>

      {/* Table header */}
      <div className="grid grid-cols-5 gap-2 text-[11px] text-muted-foreground border-b border-border/30 pb-2 mb-2 font-medium">
        <span>Type</span>
        <span>Wallet</span>
        <span className="text-right">SOL</span>
        <span className="text-right">Tokens</span>
        <span className="text-right">Time</span>
      </div>

      <div className="space-y-1 max-h-96 overflow-y-auto scrollbar-thin">
        {trades.length > 0 ? (
          trades.map((trade) => (
            <div
              key={trade.id}
              className={cn(
                'grid grid-cols-5 gap-2 text-[11px] rounded-md px-2 py-2 items-center',
                trade.type === 'buy' ? 'bg-accent/5' : 'bg-destructive/5'
              )}
            >
              <div className="flex items-center gap-1">
                {trade.type === 'buy' ? (
                  <ArrowUpRight className="h-3 w-3 text-accent" />
                ) : (
                  <ArrowDownRight className="h-3 w-3 text-destructive" />
                )}
                <span className={cn('font-medium', trade.type === 'buy' ? 'text-accent' : 'text-destructive')}>
                  {trade.type === 'buy' ? 'BUY' : 'SELL'}
                </span>
              </div>
              <span className="text-muted-foreground font-mono truncate">
                {trade.txHash ? (
                  <a
                    href={`https://solscan.io/tx/${trade.txHash}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="hover:text-foreground transition-colors"
                  >
                    {trade.wallet}
                  </a>
                ) : (
                  trade.wallet
                )}
              </span>
              <span className="text-foreground font-mono text-right">{trade.solAmount} SOL</span>
              <span className="text-muted-foreground font-mono text-right">
                {trade.amount > 1e6 ? `${(trade.amount / 1e6).toFixed(1)}M` : trade.amount > 1e3 ? `${(trade.amount / 1e3).toFixed(1)}K` : trade.amount.toFixed(2)}
              </span>
              <span className="text-muted-foreground text-right">{trade.time}</span>
            </div>
          ))
        ) : loading ? (
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
  );
}

// ── Main Page ───────────────────────────────────────────────────────

export default function TokenDetail() {
  const { address } = useParams<{ address: string }>();
  const navigate = useNavigate();

  const [token, setToken] = useState<TokenData | null>(null);
  const [priceData, setPriceData] = useState<PricePoint[]>([]);
  const [holders, setHolders] = useState<HolderSegment[]>([]);
  const [trades, setTrades] = useState<Trade[]>([]);
  const [loading, setLoading] = useState(true);
  const [tradesLoading, setTradesLoading] = useState(true);
  const [copied, setCopied] = useState(false);

  // Fetch token info from DexScreener via pumpfun-api enrichment
  useEffect(() => {
    if (!address) return;
    let cancelled = false;

    const fetchToken = async () => {
      setLoading(true);
      try {
        // Fetch pair data from DexScreener directly
        const resp = await fetch(`https://api.dexscreener.com/tokens/v1/solana/${address}`);
        if (!resp.ok) throw new Error('Failed to fetch');
        const pairs = await resp.json();

        if (!Array.isArray(pairs) || pairs.length === 0) throw new Error('Token not found');

        // Pick highest liquidity pair
        const best = pairs.reduce((a: any, b: any) =>
          (a.liquidity?.usd || 0) > (b.liquidity?.usd || 0) ? a : b
        );

        if (!cancelled) {
          const isPumpFun = best.dexId === 'pumpswap' || best.dexId === 'pumpfun';
          const isGraduated = best.dexId === 'raydium' && best.labels?.includes('pump.fun');

          setToken({
            address: best.baseToken?.address || address,
            name: best.baseToken?.name || '',
            symbol: best.baseToken?.symbol || '',
            price: parseFloat(best.priceUsd) || 0,
            marketCap: best.marketCap || best.fdv || 0,
            volume24h: best.volume?.h24 || 0,
            change24h: best.priceChange?.h24 || 0,
            change1h: best.priceChange?.h1 || 0,
            change5m: best.priceChange?.m5 || 0,
            liquidity: best.liquidity?.usd || 0,
            logoUrl: best.info?.imageUrl || '/placeholder.svg',
            dexId: best.dexId || '',
            pairCreatedAt: best.pairCreatedAt || 0,
            txns24h: best.txns?.h24 || {},
            websites: best.info?.websites || [],
            socials: best.info?.socials || [],
            graduated: isGraduated,
            bondingCurveProgress: isGraduated ? 100 : isPumpFun ? undefined : undefined,
          });
        }
      } catch (err) {
        console.error('[TokenDetail] Fetch error:', err);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    fetchToken();
    return () => { cancelled = true; };
  }, [address]);

  // Fetch price history, holders, trades
  useEffect(() => {
    if (!address) return;
    let cancelled = false;

    const fetchDetails = async () => {
      setTradesLoading(true);

      const { data, error } = await supabase.functions.invoke('token-prices', {
        body: { action: 'full_token_profile', mint: address }
      });

      if (cancelled) return;

      if (data && data.success) {
        // Price history
        if (data.price_history?.data?.length > 0) {
          setPriceData(
            data.price_history.data.map((p: { unixTime: number; value: number }) => ({
              time: new Date(p.unixTime * 1000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
              price: p.value,
            }))
          );
        }

        // Holders
        if (data.holders?.data?.distribution) {
          setHolders(
            data.holders.data.distribution.map((d: { name: string; value: number }, i: number) => ({
              ...d,
              value: +d.value.toFixed(1),
              color: HOLDER_COLORS[i] || HOLDER_COLORS[3],
            }))
          );
        }

        // Trades
        if (Array.isArray(data.trades?.data) && data.trades.data.length > 0) {
          setTrades(
            data.trades.data.slice(0, 30).map((t: any, i: number) => {
              const isBuy = t.side === 'buy';
              const solAmt = isBuy ? t.from?.uiAmount || 0 : t.to?.uiAmount || 0;
              const tokenAmt = isBuy ? t.to?.uiAmount || 0 : t.from?.uiAmount || 0;
              return {
                id: i,
                type: isBuy ? ('buy' as const) : ('sell' as const),
                amount: tokenAmt,
                solAmount: +solAmt.toFixed(3),
                price: tokenAmt > 0 ? (solAmt * 88) / tokenAmt : 0,
                time: new Date(t.blockUnixTime * 1000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
                wallet: t.owner ? `${t.owner.slice(0, 4)}...${t.owner.slice(-4)}` : 'unknown',
                txHash: t.txHash || '',
              };
            })
          );
        }
      }

      setTradesLoading(false);
    };

    fetchDetails();
    return () => { cancelled = true; };
  }, [address]);

  const copyAddress = () => {
    if (address) {
      navigator.clipboard.writeText(address);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p className="text-muted-foreground">Loading token data...</p>
        </div>
      </div>
    );
  }

  if (!token) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <div className="text-4xl mb-4">⚠️</div>
          <h2 className="text-lg font-semibold text-foreground mb-2">Token Not Found</h2>
          <p className="text-muted-foreground text-sm mb-4">Could not load data for this token address</p>
          <Button onClick={() => navigate('/dashboard')}>
            <ArrowLeft className="h-4 w-4 mr-2" /> Back to Dashboard
          </Button>
        </div>
      </div>
    );
  }

  const isPositive = token.change24h >= 0;
  const age = token.pairCreatedAt
    ? `${Math.floor((Date.now() - token.pairCreatedAt) / 86400000)}d`
    : 'N/A';

  return (
    <div className="min-h-screen bg-background">
      {/* Top bar */}
      <div className="sticky top-0 z-50 bg-background/80 backdrop-blur-md border-b border-border">
        <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between">
          <Button variant="ghost" size="sm" className="gap-1.5 text-muted-foreground" onClick={() => navigate('/dashboard')}>
            <ArrowLeft className="h-4 w-4" /> Dashboard
          </Button>
          <div className="flex items-center gap-3">
            <span className="text-sm font-mono text-foreground">{fmt(token.price)}</span>
            <span className={cn('text-sm font-medium', isPositive ? 'text-accent' : 'text-destructive')}>
              {fmt(token.change24h, 'pct')}
            </span>
          </div>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-4 py-6 space-y-6">
        {/* Header */}
        <div className="flex items-start gap-4 flex-wrap">
          <div className="h-16 w-16 rounded-2xl overflow-hidden ring-2 ring-border shrink-0">
            <img
              src={token.logoUrl}
              alt={token.name}
              className="h-full w-full object-cover"
              onError={(e) => { e.currentTarget.src = '/placeholder.svg'; }}
            />
          </div>
          <div className="flex-1 min-w-0">
            <h1 className="text-2xl font-bold text-foreground flex items-center gap-2 flex-wrap">
              {token.name}
              <Badge variant="outline" className="text-xs font-mono">{token.symbol}</Badge>
              {token.graduated && <Badge className="bg-accent/20 text-accent border-accent/30 text-xs">🎓 Graduated</Badge>}
              <Badge variant="secondary" className="text-[10px]">{token.dexId}</Badge>
            </h1>
            <button
              onClick={copyAddress}
              className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1 mt-1 font-mono transition-colors"
            >
              {address}
              <Copy className="h-3 w-3" />
              {copied && <span className="text-accent text-[10px] ml-1">Copied!</span>}
            </button>
          </div>
          <div className="text-right">
            <div className="text-3xl font-bold font-mono text-foreground">{fmt(token.price)}</div>
            <div className={cn('text-base font-medium flex items-center justify-end gap-1', isPositive ? 'text-accent' : 'text-destructive')}>
              {isPositive ? <TrendingUp className="h-4 w-4" /> : <TrendingDown className="h-4 w-4" />}
              {fmt(token.change24h, 'pct')}
            </div>
          </div>
        </div>

        {/* Stats Row */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          {[
            { label: 'Market Cap', value: fmt(token.marketCap), icon: BarChart3 },
            { label: 'Volume 24h', value: fmt(token.volume24h), icon: BarChart3 },
            { label: 'Liquidity', value: fmt(token.liquidity), icon: Droplets },
            { label: 'Age', value: age, icon: Clock },
            { label: '1h Change', value: fmt(token.change1h, 'pct'), icon: token.change1h >= 0 ? TrendingUp : TrendingDown, color: token.change1h >= 0 ? 'text-accent' : 'text-destructive' },
            { label: '5m Change', value: fmt(token.change5m, 'pct'), icon: token.change5m >= 0 ? TrendingUp : TrendingDown, color: token.change5m >= 0 ? 'text-accent' : 'text-destructive' },
          ].map((stat) => (
            <div key={stat.label} className="rounded-xl bg-muted/40 border border-border/50 p-3">
              <div className="text-[11px] text-muted-foreground flex items-center gap-1 mb-1">
                <stat.icon className="h-3 w-3" /> {stat.label}
              </div>
              <div className={cn('text-sm font-semibold font-mono', (stat as any).color || 'text-foreground')}>
                {stat.value}
              </div>
            </div>
          ))}
        </div>

        {/* Safety Analysis */}
        <TokenSafetyCard tokenAddress={address!} tokenName={token.name} />

        {/* Two-column layout */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Left column */}
          <div className="space-y-6">
            {/* Price Chart */}
            <div className="rounded-xl border border-border/50 bg-muted/20 p-5">
              <h3 className="text-sm font-medium text-foreground mb-3 flex items-center gap-2">
                <Clock className="h-4 w-4 text-muted-foreground" />
                Price Chart (24h)
              </h3>
              <div className="h-64">
                {priceData.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={priceData}>
                      <defs>
                        <linearGradient id="priceGrad" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor={isPositive ? 'hsl(var(--accent))' : 'hsl(var(--destructive))'} stopOpacity={0.3} />
                          <stop offset="95%" stopColor={isPositive ? 'hsl(var(--accent))' : 'hsl(var(--destructive))'} stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.3} />
                      <XAxis dataKey="time" tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }} interval={7} axisLine={false} tickLine={false} />
                      <YAxis tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }} axisLine={false} tickLine={false} width={55} tickFormatter={(v) => fmt(v)} />
                      <Tooltip
                        contentStyle={{ backgroundColor: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: '8px', fontSize: '12px' }}
                        formatter={(value: number) => [fmt(value), 'Price']}
                      />
                      <Area type="monotone" dataKey="price" stroke={isPositive ? 'hsl(var(--accent))' : 'hsl(var(--destructive))'} fill="url(#priceGrad)" strokeWidth={2} />
                    </AreaChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="h-full flex items-center justify-center text-muted-foreground text-sm">
                    <Loader2 className="h-5 w-5 animate-spin mr-2" /> Loading chart...
                  </div>
                )}
              </div>
            </div>

            {/* Bonding Curve */}
            <BondingCurveChart progress={token.bondingCurveProgress} graduated={token.graduated} />

            {/* Social Links */}
            <SocialLinks websites={token.websites} socials={token.socials} address={address!} />
          </div>

          {/* Right column */}
          <div className="space-y-6">
            {/* Holder Distribution */}
            <div className="rounded-xl border border-border/50 bg-muted/20 p-5">
              <h3 className="text-sm font-medium text-foreground mb-3 flex items-center gap-2">
                <Users className="h-4 w-4 text-muted-foreground" />
                Holder Distribution
              </h3>
              <div className="h-48">
                {holders.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie data={holders} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={40} outerRadius={70} strokeWidth={2} stroke="hsl(var(--card))">
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
              <div className="flex flex-wrap gap-x-4 gap-y-1 justify-center">
                {holders.map((h) => (
                  <div key={h.name} className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                    <div className="h-2 w-2 rounded-full" style={{ backgroundColor: h.color }} />
                    {h.name} ({h.value.toFixed(1)}%)
                  </div>
                ))}
              </div>
            </div>

            {/* 24h Trading Activity */}
            <div className="rounded-xl border border-border/50 bg-muted/20 p-5">
              <h3 className="text-sm font-medium text-foreground mb-3 flex items-center gap-2">
                <ArrowRightLeft className="h-4 w-4 text-muted-foreground" />
                24h Trading Activity
              </h3>
              <div className="grid grid-cols-2 gap-4">
                <div className="text-center p-3 rounded-lg bg-accent/5 border border-accent/10">
                  <div className="text-2xl font-bold font-mono text-accent">{fmt(token.txns24h.buys || 0, 'compact')}</div>
                  <div className="text-xs text-muted-foreground mt-1">Buys</div>
                </div>
                <div className="text-center p-3 rounded-lg bg-destructive/5 border border-destructive/10">
                  <div className="text-2xl font-bold font-mono text-destructive">{fmt(token.txns24h.sells || 0, 'compact')}</div>
                  <div className="text-xs text-muted-foreground mt-1">Sells</div>
                </div>
              </div>
              {(token.txns24h.buys || 0) + (token.txns24h.sells || 0) > 0 && (
                <div className="mt-3">
                  <div className="h-2 rounded-full bg-muted/60 overflow-hidden flex">
                    <div
                      className="h-full bg-accent rounded-l-full"
                      style={{ width: `${((token.txns24h.buys || 0) / ((token.txns24h.buys || 0) + (token.txns24h.sells || 0))) * 100}%` }}
                    />
                    <div className="h-full bg-destructive rounded-r-full flex-1" />
                  </div>
                  <div className="flex justify-between text-[10px] text-muted-foreground mt-1">
                    <span>Buy pressure {(((token.txns24h.buys || 0) / ((token.txns24h.buys || 0) + (token.txns24h.sells || 0))) * 100).toFixed(0)}%</span>
                    <span>Sell pressure {(((token.txns24h.sells || 0) / ((token.txns24h.buys || 0) + (token.txns24h.sells || 0))) * 100).toFixed(0)}%</span>
                  </div>
                </div>
              )}
            </div>

            {/* Trade History */}
            <TradeHistory trades={trades} loading={tradesLoading} />
          </div>
        </div>
      </div>
    </div>
  );
}
