import { useState, useEffect, useCallback, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  BarChart3, TrendingUp, TrendingDown, Trophy, Target,
  Zap, Shield, Rocket, Brain, Activity, PieChart
} from "lucide-react";
import { useWallet } from "@solana/wallet-adapter-react";
import { supabase } from "@/integrations/supabase/client";
import {
  ChartContainer, ChartTooltip, ChartTooltipContent
} from "@/components/ui/chart";
import {
  AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid,
  ResponsiveContainer, Cell, PieChart as RPieChart, Pie
} from "recharts";

interface TradeRecord {
  id: string;
  token_symbol: string | null;
  side: string;
  strategy: string;
  pnl_percent: number | null;
  status: string;
  created_at: string;
  current_price: number | null;
  entry_price: number | null;
}

const STRATEGY_META: Record<string, { label: string; icon: React.ElementType; color: string }> = {
  safe_exit: { label: 'Safe Exit', icon: Shield, color: 'hsl(var(--chart-green))' },
  scalper: { label: 'Scalper', icon: Zap, color: 'hsl(0, 84%, 50%)' },
  new_launch: { label: 'Launch Hunter', icon: Rocket, color: 'hsl(280, 70%, 55%)' },
  momentum: { label: 'Momentum', icon: TrendingUp, color: 'hsl(200, 70%, 50%)' },
  dip_buy: { label: 'Dip Buyer', icon: TrendingDown, color: 'hsl(45, 90%, 50%)' },
};

const chartConfig = {
  pnl: { label: 'P&L', color: 'hsl(var(--chart-green))' },
  wins: { label: 'Wins', color: 'hsl(var(--chart-green))' },
  losses: { label: 'Losses', color: 'hsl(var(--chart-red))' },
};

export function BeachModeAnalytics() {
  const { publicKey } = useWallet();
  const [trades, setTrades] = useState<TradeRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const walletAddress = publicKey?.toBase58();

  const fetchTrades = useCallback(async () => {
    if (!walletAddress) { setLoading(false); return; }
    try {
      const { data } = await supabase
        .from('pending_auto_trades')
        .select('*')
        .eq('wallet_address', walletAddress)
        .order('created_at', { ascending: true })
        .limit(200);
      setTrades((data as TradeRecord[]) || []);
    } catch (e) {
      console.error('Analytics fetch error:', e);
    } finally {
      setLoading(false);
    }
  }, [walletAddress]);

  useEffect(() => { fetchTrades(); }, [fetchTrades]);

  // ── Derived analytics ──
  const stats = useMemo(() => {
    const executed = trades.filter(t => t.status === 'executed' || t.status === 'filled');
    const withPnl = executed.filter(t => t.pnl_percent !== null);
    const wins = withPnl.filter(t => (t.pnl_percent ?? 0) > 0);
    const losses = withPnl.filter(t => (t.pnl_percent ?? 0) <= 0);
    const winRate = withPnl.length > 0 ? (wins.length / withPnl.length) * 100 : 0;
    const avgWin = wins.length > 0 ? wins.reduce((s, t) => s + (t.pnl_percent ?? 0), 0) / wins.length : 0;
    const avgLoss = losses.length > 0 ? losses.reduce((s, t) => s + (t.pnl_percent ?? 0), 0) / losses.length : 0;
    const totalPnl = withPnl.reduce((s, t) => s + (t.pnl_percent ?? 0), 0);
    const bestTrade = withPnl.length > 0 ? Math.max(...withPnl.map(t => t.pnl_percent ?? 0)) : 0;
    const worstTrade = withPnl.length > 0 ? Math.min(...withPnl.map(t => t.pnl_percent ?? 0)) : 0;

    return { executed, withPnl, wins, losses, winRate, avgWin, avgLoss, totalPnl, bestTrade, worstTrade };
  }, [trades]);

  // ── Cumulative P&L chart data ──
  const cumulativePnl = useMemo(() => {
    let cumulative = 0;
    return stats.withPnl.map(t => {
      cumulative += t.pnl_percent ?? 0;
      const date = new Date(t.created_at);
      return {
        time: `${date.getMonth() + 1}/${date.getDate()} ${date.getHours()}:${String(date.getMinutes()).padStart(2, '0')}`,
        pnl: Number(cumulative.toFixed(2)),
        trade: t.token_symbol || 'Unknown',
      };
    });
  }, [stats.withPnl]);

  // ── Strategy breakdown ──
  const strategyBreakdown = useMemo(() => {
    const map: Record<string, { trades: number; wins: number; totalPnl: number }> = {};
    stats.executed.forEach(t => {
      if (!map[t.strategy]) map[t.strategy] = { trades: 0, wins: 0, totalPnl: 0 };
      map[t.strategy].trades++;
      if ((t.pnl_percent ?? 0) > 0) map[t.strategy].wins++;
      map[t.strategy].totalPnl += t.pnl_percent ?? 0;
    });
    const fallback = { label: 'Unknown', icon: Target, color: 'hsl(var(--muted-foreground))' };
    return Object.entries(map).map(([key, val]) => ({
      strategy: key,
      ...(STRATEGY_META[key] || fallback),
      trades: val.trades,
      wins: val.wins,
      winRate: val.trades > 0 ? (val.wins / val.trades) * 100 : 0,
      totalPnl: val.totalPnl,
    }));
  }, [stats.executed]);

  // ── Pie chart data ──
  const pieData = useMemo(() =>
    strategyBreakdown.map(s => ({
      name: s.label,
      value: s.trades,
      fill: s.color,
    })),
  [strategyBreakdown]);

  // ── Win/Loss bar data ──
  const winLossData = useMemo(() => {
    const byDay: Record<string, { day: string; wins: number; losses: number }> = {};
    stats.withPnl.forEach(t => {
      const day = new Date(t.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
      if (!byDay[day]) byDay[day] = { day, wins: 0, losses: 0 };
      if ((t.pnl_percent ?? 0) > 0) byDay[day].wins++;
      else byDay[day].losses++;
    });
    return Object.values(byDay).slice(-14);
  }, [stats.withPnl]);

  if (!publicKey) return null;

  if (loading) {
    return (
      <Card className="memecoin-card">
        <CardContent className="p-6 text-center">
          <Activity className="h-6 w-6 animate-spin text-accent mx-auto" />
        </CardContent>
      </Card>
    );
  }

  const noData = stats.executed.length === 0;

  return (
    <div className="space-y-3">
      {/* KPI Row */}
      <div className="grid grid-cols-2 gap-2">
        <KPICard
          icon={BarChart3}
          label="Total P&L"
          value={`${stats.totalPnl >= 0 ? '+' : ''}${stats.totalPnl.toFixed(1)}%`}
          positive={stats.totalPnl >= 0}
        />
        <KPICard
          icon={Trophy}
          label="Win Rate"
          value={`${stats.winRate.toFixed(0)}%`}
          positive={stats.winRate >= 50}
        />
        <KPICard
          icon={TrendingUp}
          label="Best Trade"
          value={`+${stats.bestTrade.toFixed(1)}%`}
          positive
        />
        <KPICard
          icon={TrendingDown}
          label="Worst Trade"
          value={`${stats.worstTrade.toFixed(1)}%`}
          positive={false}
        />
      </div>

      {/* Charts */}
      <Tabs defaultValue="pnl" className="w-full">
        <TabsList className="grid w-full grid-cols-3 bg-muted/30 h-8">
          <TabsTrigger value="pnl" className="text-[10px] data-[state=active]:bg-accent/20">P&L Curve</TabsTrigger>
          <TabsTrigger value="strategies" className="text-[10px] data-[state=active]:bg-accent/20">Strategies</TabsTrigger>
          <TabsTrigger value="winloss" className="text-[10px] data-[state=active]:bg-accent/20">Win/Loss</TabsTrigger>
        </TabsList>

        {/* Cumulative P&L */}
        <TabsContent value="pnl" className="mt-2">
          <Card className="memecoin-card">
            <CardHeader className="pb-1 pt-3 px-3">
              <CardTitle className="text-xs flex items-center gap-1.5">
                <TrendingUp className="h-3.5 w-3.5 text-accent" />
                Cumulative P&L
              </CardTitle>
            </CardHeader>
            <CardContent className="px-1 pb-2">
              {noData ? (
                <EmptyState />
              ) : (
                <ChartContainer config={chartConfig} className="h-[180px] w-full">
                  <AreaChart data={cumulativePnl}>
                    <defs>
                      <linearGradient id="pnlGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="hsl(var(--chart-green))" stopOpacity={0.3} />
                        <stop offset="95%" stopColor="hsl(var(--chart-green))" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" strokeOpacity={0.3} />
                    <XAxis dataKey="time" tick={{ fontSize: 9, fill: 'hsl(var(--muted-foreground))' }} tickLine={false} axisLine={false} />
                    <YAxis tick={{ fontSize: 9, fill: 'hsl(var(--muted-foreground))' }} tickLine={false} axisLine={false} tickFormatter={v => `${v}%`} />
                    <ChartTooltip content={<ChartTooltipContent />} />
                    <Area
                      type="monotone"
                      dataKey="pnl"
                      stroke="hsl(var(--chart-green))"
                      fill="url(#pnlGrad)"
                      strokeWidth={2}
                    />
                  </AreaChart>
                </ChartContainer>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Strategy Breakdown */}
        <TabsContent value="strategies" className="mt-2">
          <Card className="memecoin-card">
            <CardHeader className="pb-1 pt-3 px-3">
              <CardTitle className="text-xs flex items-center gap-1.5">
                <PieChart className="h-3.5 w-3.5 text-accent" />
                Strategy Performance
              </CardTitle>
            </CardHeader>
            <CardContent className="px-3 pb-3 space-y-3">
              {noData ? (
                <EmptyState />
              ) : (
                <>
                  {/* Pie */}
                  <div className="h-[140px] w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <RPieChart>
                        <Pie
                          data={pieData}
                          cx="50%"
                          cy="50%"
                          innerRadius={35}
                          outerRadius={60}
                          paddingAngle={3}
                          dataKey="value"
                        >
                          {pieData.map((entry, i) => (
                            <Cell key={i} fill={entry.fill} />
                          ))}
                        </Pie>
                      </RPieChart>
                    </ResponsiveContainer>
                  </div>
                  {/* Strategy list */}
                  <div className="space-y-1.5">
                    {strategyBreakdown.map(s => {
                      const Icon = s.icon || Target;
                      return (
                        <div key={s.strategy} className="flex items-center justify-between p-2 rounded-lg border border-border/20 bg-background/30">
                          <div className="flex items-center gap-2">
                            <div className="w-2 h-2 rounded-full" style={{ backgroundColor: s.color }} />
                            <Icon className="h-3 w-3 text-muted-foreground" />
                            <span className="text-[11px] font-medium">{s.label}</span>
                          </div>
                          <div className="flex items-center gap-3 text-[10px]">
                            <span className="text-muted-foreground">{s.trades} trades</span>
                            <Badge variant="outline" className={`text-[9px] ${s.winRate >= 50 ? 'text-accent border-accent/30' : 'text-destructive border-destructive/30'}`}>
                              {s.winRate.toFixed(0)}% WR
                            </Badge>
                            <span className={`font-mono ${s.totalPnl >= 0 ? 'text-accent' : 'text-destructive'}`}>
                              {s.totalPnl >= 0 ? '+' : ''}{s.totalPnl.toFixed(1)}%
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Win/Loss Distribution */}
        <TabsContent value="winloss" className="mt-2">
          <Card className="memecoin-card">
            <CardHeader className="pb-1 pt-3 px-3">
              <CardTitle className="text-xs flex items-center gap-1.5">
                <Trophy className="h-3.5 w-3.5 text-accent" />
                Daily Win / Loss
              </CardTitle>
            </CardHeader>
            <CardContent className="px-1 pb-2">
              {noData ? (
                <EmptyState />
              ) : (
                <ChartContainer config={chartConfig} className="h-[180px] w-full">
                  <BarChart data={winLossData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" strokeOpacity={0.3} />
                    <XAxis dataKey="day" tick={{ fontSize: 9, fill: 'hsl(var(--muted-foreground))' }} tickLine={false} axisLine={false} />
                    <YAxis tick={{ fontSize: 9, fill: 'hsl(var(--muted-foreground))' }} tickLine={false} axisLine={false} />
                    <ChartTooltip content={<ChartTooltipContent />} />
                    <Bar dataKey="wins" stackId="a" fill="hsl(var(--chart-green))" radius={[2, 2, 0, 0]} />
                    <Bar dataKey="losses" stackId="a" fill="hsl(var(--chart-red))" radius={[2, 2, 0, 0]} />
                  </BarChart>
                </ChartContainer>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Summary Stats */}
      <Card className="memecoin-card">
        <CardContent className="p-3">
          <div className="grid grid-cols-3 gap-3 text-center">
            <div>
              <p className="text-[10px] text-muted-foreground uppercase">Avg Win</p>
              <p className="text-sm font-mono font-bold text-accent">+{stats.avgWin.toFixed(1)}%</p>
            </div>
            <div>
              <p className="text-[10px] text-muted-foreground uppercase">Avg Loss</p>
              <p className="text-sm font-mono font-bold text-destructive">{stats.avgLoss.toFixed(1)}%</p>
            </div>
            <div>
              <p className="text-[10px] text-muted-foreground uppercase">Total Trades</p>
              <p className="text-sm font-mono font-bold text-foreground">{stats.executed.length}</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function KPICard({ icon: Icon, label, value, positive }: {
  icon: React.ElementType; label: string; value: string; positive: boolean;
}) {
  return (
    <Card className="memecoin-card p-3">
      <div className="flex items-center gap-1.5 mb-1">
        <Icon className={`h-3 w-3 ${positive ? 'text-accent' : 'text-destructive'}`} />
        <span className="text-[10px] text-muted-foreground uppercase">{label}</span>
      </div>
      <p className={`text-sm font-mono font-bold ${positive ? 'text-accent' : 'text-destructive'}`}>
        {value}
      </p>
    </Card>
  );
}

function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center py-8 text-center">
      <Brain className="h-8 w-8 text-muted-foreground/30 mb-2" />
      <p className="text-xs text-muted-foreground">No trade data yet</p>
      <p className="text-[10px] text-muted-foreground/60">Activate Beach Mode to start generating analytics</p>
    </div>
  );
}
