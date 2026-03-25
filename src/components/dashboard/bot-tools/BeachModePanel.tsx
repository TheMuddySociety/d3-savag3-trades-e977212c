import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Slider } from "@/components/ui/slider";
import { Separator } from "@/components/ui/separator";
import {
  Palmtree, Shield, Zap, TrendingUp, TrendingDown,
  Rocket, Brain, Loader2, Power, AlertTriangle,
  DollarSign, Activity, Clock
} from "lucide-react";
import { useWallet } from "@solana/wallet-adapter-react";
import { supabase } from "@/integrations/supabase/client";
import { BeachModeAnalytics } from "./BeachModeAnalytics";
import { AgentService } from "@/services/solana/agentService";
import { toast } from "sonner";

interface BeachModeSession {
  id: string;
  wallet_address: string;
  is_active: boolean;
  delegation_tx: string | null;
  delegation_status: string;
  strategies: string[];
  max_trade_sol: number;
  daily_cap_sol: number;
  daily_spent_sol: number;
  total_trades: number;
  total_pnl_sol: number;
  last_evaluation_at: string | null;
}

interface RecentTrade {
  id: string;
  token_symbol: string;
  side: string;
  strategy: string;
  reason: string;
  status: string;
  pnl_percent: number | null;
  created_at: string;
}

const STRATEGY_OPTIONS = [
  { key: 'safe_exit', label: 'Safe Exit', icon: Shield, desc: 'Stop-loss & take-profit' },
  { key: 'scalper', label: 'Scalper', icon: Zap, desc: 'Quick profit targets' },
  { key: 'new_launch', label: 'Launch Hunter', icon: Rocket, desc: 'Snipe new tokens' },
  { key: 'momentum', label: 'Momentum', icon: TrendingUp, desc: 'Ride trends, sell reversals' },
  { key: 'dip_buy', label: 'Dip Buyer', icon: TrendingDown, desc: 'Buy deep dips' },
];

export function BeachModePanel() {
  const { publicKey, wallet } = useWallet();
  const [session, setSession] = useState<BeachModeSession | null>(null);
  const [recentTrades, setRecentTrades] = useState<RecentTrade[]>([]);
  const [loading, setLoading] = useState(true);
  const [activating, setActivating] = useState(false);
  const [strategies, setStrategies] = useState<string[]>(['safe_exit', 'scalper', 'new_launch', 'momentum', 'dip_buy']);
  const [maxTradeSol, setMaxTradeSol] = useState(0.5);
  const [dailyCapSol, setDailyCapSol] = useState(5.0);

  const walletAddress = publicKey?.toBase58();

  const fetchStatus = useCallback(async () => {
    if (!walletAddress) { setLoading(false); return; }
    try {
      const { data, error } = await supabase.functions.invoke('beach-mode', {
        body: { action: 'status', walletAddress },
      });
      if (error) throw error;
      if (data?.session) {
        setSession(data.session);
        setStrategies(data.session.strategies || []);
        setMaxTradeSol(data.session.max_trade_sol);
        setDailyCapSol(data.session.daily_cap_sol);
      }
      if (data?.recentTrades) setRecentTrades(data.recentTrades);
    } catch (err) {
      console.error('Beach mode status error:', err);
    } finally {
      setLoading(false);
    }
  }, [walletAddress]);

  useEffect(() => { fetchStatus(); }, [fetchStatus]);

  // Poll status every 30s when active
  useEffect(() => {
    if (!session?.is_active) return;
    const interval = setInterval(fetchStatus, 30000);
    return () => clearInterval(interval);
  }, [session?.is_active, fetchStatus]);

  const handleActivate = async () => {
    if (!walletAddress || !wallet) return;
    setActivating(true);
    try {
      // Step 1: On-chain delegation via Metaplex Agent Registry
      let delegationTx: string | null = null;
      try {
        delegationTx = await AgentService.activateAgent(wallet.adapter);
        toast.success('On-chain delegation confirmed!');
      } catch (e: any) {
        console.warn('PDA delegation skipped:', e.message);
        toast.info('Beach Mode activating without on-chain PDA (budget-only mode)');
      }

      // Step 2: Activate server-side session
      const { data, error } = await supabase.functions.invoke('beach-mode', {
        body: {
          action: 'activate',
          walletAddress,
          delegationTx,
          strategies,
          maxTradeSol,
          dailyCapSol,
        },
      });

      if (error) throw error;
      setSession(data.session);
      toast.success('🏖️ Beach Mode activated! Your agent is now trading autonomously.');
    } catch (err: any) {
      toast.error(`Activation failed: ${err.message}`);
    } finally {
      setActivating(false);
    }
  };

  const handleDeactivate = async () => {
    if (!walletAddress) return;
    try {
      await supabase.functions.invoke('beach-mode', {
        body: { action: 'deactivate', walletAddress },
      });
      setSession(prev => prev ? { ...prev, is_active: false } : null);
      toast.success('Beach Mode deactivated');
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  const handleStrategyToggle = (key: string) => {
    setStrategies(prev => {
      const next = prev.includes(key) ? prev.filter(s => s !== key) : [...prev, key];
      // Sync to backend if active
      if (session?.is_active && walletAddress) {
        supabase.functions.invoke('beach-mode', {
          body: { action: 'update_strategies', walletAddress, strategies: next },
        });
      }
      return next;
    });
  };

  const handleLimitsChange = useCallback(async () => {
    if (!session?.is_active || !walletAddress) return;
    await supabase.functions.invoke('beach-mode', {
      body: { action: 'update_strategies', walletAddress, maxTradeSol, dailyCapSol },
    });
  }, [session?.is_active, walletAddress, maxTradeSol, dailyCapSol]);

  if (!publicKey) {
    return (
      <Card className="memecoin-card">
        <CardContent className="p-8 text-center">
          <Palmtree className="h-12 w-12 text-accent mx-auto mb-3 opacity-50" />
          <p className="text-muted-foreground text-sm">Connect wallet to activate Beach Mode</p>
        </CardContent>
      </Card>
    );
  }

  if (loading) {
    return (
      <Card className="memecoin-card">
        <CardContent className="p-8 text-center">
          <Loader2 className="h-8 w-8 animate-spin text-accent mx-auto" />
        </CardContent>
      </Card>
    );
  }

  const isActive = session?.is_active || false;
  const dailyUsagePercent = session ? (session.daily_spent_sol / session.daily_cap_sol) * 100 : 0;

  return (
    <div className="space-y-4">
      {/* Main Status Card */}
      <Card className={`memecoin-card border ${isActive ? 'border-accent/40 shadow-[0_0_30px_rgba(0,255,100,0.05)]' : 'border-border/40'}`}>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2 text-lg">
              <Palmtree className={`h-5 w-5 ${isActive ? 'text-accent' : 'text-muted-foreground'}`} />
              Beach Mode
              {isActive && (
                <Badge className="bg-accent/20 text-accent border-accent/30 text-[10px] animate-pulse">
                  ACTIVE
                </Badge>
              )}
            </CardTitle>
            {isActive && (
              <Button variant="ghost" size="sm" onClick={handleDeactivate} className="text-destructive hover:text-destructive text-xs">
                <Power className="h-3 w-3 mr-1" /> Deactivate
              </Button>
            )}
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            Full autonomous AI trading — D3S Agent manages your portfolio 24/7
          </p>
        </CardHeader>

        <CardContent className="space-y-4">
          {/* Delegation Status */}
          {session && (
            <div className="flex items-center gap-2 text-xs">
              <Shield className="h-3.5 w-3.5 text-accent" />
              <span className="text-muted-foreground">PDA Delegation:</span>
              <Badge variant="outline" className={`text-[10px] ${
                session.delegation_status === 'confirmed' ? 'border-accent/30 text-accent' : 'border-yellow-500/30 text-yellow-500'
              }`}>
                {session.delegation_status === 'confirmed' ? 'On-Chain' : 'Budget-Only'}
              </Badge>
            </div>
          )}

          {/* Strategy Toggles */}
          <div className="space-y-2">
            <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">AI Strategies</h4>
            <div className="grid grid-cols-1 gap-2">
              {STRATEGY_OPTIONS.map(({ key, label, icon: Icon, desc }) => (
                <div
                  key={key}
                  className={`flex items-center justify-between p-2.5 rounded-lg border transition-colors ${
                    strategies.includes(key)
                      ? 'border-accent/20 bg-accent/5'
                      : 'border-border/30 bg-background/30'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <Icon className={`h-3.5 w-3.5 ${strategies.includes(key) ? 'text-accent' : 'text-muted-foreground'}`} />
                    <div>
                      <span className="text-xs font-medium">{label}</span>
                      <p className="text-[10px] text-muted-foreground">{desc}</p>
                    </div>
                  </div>
                  <Switch
                    checked={strategies.includes(key)}
                    onCheckedChange={() => handleStrategyToggle(key)}
                  />
                </div>
              ))}
            </div>
          </div>

          <Separator className="bg-border/30" />

          {/* Risk Controls */}
          <div className="space-y-3">
            <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1">
              <AlertTriangle className="h-3 w-3" /> Risk Controls
            </h4>

            <div className="space-y-1.5">
              <div className="flex justify-between text-xs">
                <span className="text-muted-foreground">Max per trade</span>
                <span className="font-mono font-bold">{maxTradeSol} SOL</span>
              </div>
              <Slider
                value={[maxTradeSol]}
                onValueChange={([v]) => setMaxTradeSol(v)}
                onValueCommit={handleLimitsChange}
                min={0.01}
                max={5}
                step={0.01}
                className="w-full"
              />
            </div>

            <div className="space-y-1.5">
              <div className="flex justify-between text-xs">
                <span className="text-muted-foreground">Daily cap</span>
                <span className="font-mono font-bold">{dailyCapSol} SOL</span>
              </div>
              <Slider
                value={[dailyCapSol]}
                onValueChange={([v]) => setDailyCapSol(v)}
                onValueCommit={handleLimitsChange}
                min={0.1}
                max={50}
                step={0.1}
                className="w-full"
              />
            </div>
          </div>

          {/* Activate Button */}
          {!isActive && (
            <Button
              onClick={handleActivate}
              disabled={activating || strategies.length === 0}
              className="w-full bg-accent hover:bg-accent/90 text-accent-foreground font-bold gap-2"
            >
              {activating ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Palmtree className="h-4 w-4" />
              )}
              {activating ? 'Deploying Agent...' : 'Activate Beach Mode'}
            </Button>
          )}
        </CardContent>
      </Card>

      {/* Live Stats */}
      {isActive && session && (
        <div className="grid grid-cols-2 gap-2">
          <Card className="memecoin-card p-3">
            <div className="flex items-center gap-1.5 mb-1">
              <DollarSign className="h-3 w-3 text-accent" />
              <span className="text-[10px] text-muted-foreground uppercase">Daily Budget</span>
            </div>
            <p className="text-sm font-mono font-bold">
              {session.daily_spent_sol.toFixed(2)} / {session.daily_cap_sol} SOL
            </p>
            <div className="mt-1.5 h-1 bg-border/30 rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full transition-all ${dailyUsagePercent > 80 ? 'bg-destructive' : 'bg-accent'}`}
                style={{ width: `${Math.min(dailyUsagePercent, 100)}%` }}
              />
            </div>
          </Card>

          <Card className="memecoin-card p-3">
            <div className="flex items-center gap-1.5 mb-1">
              <Activity className="h-3 w-3 text-accent" />
              <span className="text-[10px] text-muted-foreground uppercase">Total Trades</span>
            </div>
            <p className="text-sm font-mono font-bold">{session.total_trades}</p>
            <p className={`text-[10px] font-mono ${session.total_pnl_sol >= 0 ? 'text-accent' : 'text-destructive'}`}>
              P&L: {session.total_pnl_sol >= 0 ? '+' : ''}{session.total_pnl_sol.toFixed(4)} SOL
            </p>
          </Card>
        </div>
      )}

      {/* Recent AI Trades */}
      {recentTrades.length > 0 && (
        <Card className="memecoin-card">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-1.5">
              <Brain className="h-4 w-4 text-accent" />
              Recent AI Decisions
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-1.5">
            {recentTrades.slice(0, 5).map(trade => (
              <div key={trade.id} className="flex items-center justify-between p-2 rounded bg-background/30 border border-border/20">
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className={`text-[9px] ${trade.side === 'buy' ? 'text-accent border-accent/30' : 'text-primary border-primary/30'}`}>
                    {trade.side.toUpperCase()}
                  </Badge>
                  <div>
                    <span className="text-xs font-medium">{trade.token_symbol}</span>
                    <p className="text-[9px] text-muted-foreground">{trade.reason}</p>
                  </div>
                </div>
                <div className="text-right">
                  <Badge variant="outline" className="text-[9px]">
                    {trade.status}
                  </Badge>
                  {trade.pnl_percent !== null && (
                    <p className={`text-[9px] font-mono ${trade.pnl_percent >= 0 ? 'text-accent' : 'text-destructive'}`}>
                      {trade.pnl_percent >= 0 ? '+' : ''}{trade.pnl_percent.toFixed(1)}%
                    </p>
                  )}
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
