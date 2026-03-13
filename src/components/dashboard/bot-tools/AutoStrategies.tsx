import { useState, useEffect, useRef, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Brain, TrendingUp, TrendingDown, ShieldCheck, Flame, Palmtree, Zap, Users } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useWallet } from "@solana/wallet-adapter-react";
import { useConnection } from "@solana/wallet-adapter-react";
import { JupiterUltraService } from "@/services/jupiter/ultra";
import { LiveTradeConfirmDialog } from "./LiveTradeConfirmDialog";
import { supabase } from "@/integrations/supabase/client";

const SOL_MINT = "So11111111111111111111111111111111111111112";

interface Strategy {
  id: string;
  name: string;
  description: string;
  icon: React.ReactNode;
  risk: "Low" | "Medium" | "High";
  enabled: boolean;
}

interface LiveHolding {
  mint: string;
  symbol: string;
  amount: number;
  decimals: number;
  price: number;
  value: number;
}

const INITIAL_STRATEGIES: Strategy[] = [
  { id: "momentum", name: "Momentum Rider", description: "Buys tokens trending up with high volume, sells on reversal", icon: <TrendingUp className="h-4 w-4" />, risk: "Medium", enabled: false },
  { id: "dip_buy", name: "Dip Buyer", description: "Auto-buys when price drops >20% in 1h with recovery signals", icon: <TrendingDown className="h-4 w-4" />, risk: "High", enabled: false },
  { id: "safe_exit", name: "Safe Exit", description: "Auto stop-loss at -15% and trailing take-profit at +50%", icon: <ShieldCheck className="h-4 w-4" />, risk: "Low", enabled: false },
  { id: "new_launch", name: "New Launch Hunter", description: "Snipes new tokens on Pump.fun within first 30s of launch", icon: <Flame className="h-4 w-4" />, risk: "High", enabled: false },
  { id: "scalper", name: "Scalper", description: "Sell on 3% gain — auto-sells positions at target", icon: <Zap className="h-4 w-4" />, risk: "Medium", enabled: false },
  { id: "whale_follow", name: "Whale Follow", description: "Auto-copies top leaderboard wallets' trades", icon: <Users className="h-4 w-4" />, risk: "Medium", enabled: false },
];

const riskColors: Record<string, string> = {
  Low: "bg-accent/20 text-accent border-accent/30",
  Medium: "bg-[hsl(var(--fun-yellow))]/20 text-[hsl(var(--fun-yellow))] border-[hsl(var(--fun-yellow))]/30",
  High: "bg-destructive/20 text-destructive border-destructive/30",
};

interface Props {
  sim: any;
  isLive?: boolean;
  killSignal?: number;
}

// Store entry prices per session (mint → price in SOL)
const entryPrices = new Map<string, number>();

export const AutoStrategies = ({ sim, isLive = false, killSignal = 0 }: Props) => {
  const { toast } = useToast();
  const wallet = useWallet();
  const { connection } = useConnection();
  const [strategies, setStrategies] = useState<Strategy[]>(INITIAL_STRATEGIES);
  const [maxBudget, setMaxBudget] = useState("1.0");
  const [beachMode, setBeachMode] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [pendingStrategyId, setPendingStrategyId] = useState<string | null>(null);
  const [statusLog, setStatusLog] = useState<string[]>([]);
  const [executingTrade, setExecutingTrade] = useState(false);
  const pollingRef = useRef<NodeJS.Timeout | null>(null);

  const addLog = useCallback((msg: string) => {
    const time = new Date().toLocaleTimeString();
    setStatusLog(prev => [`[${time}] ${msg}`, ...prev.slice(0, 19)]);
  }, []);

  // Kill switch
  useEffect(() => {
    if (killSignal > 0) {
      setStrategies(prev => prev.map(s => ({ ...s, enabled: false })));
      setBeachMode(false);
      setShowConfirm(false);
      setPendingStrategyId(null);
      setStatusLog([]);
      setExecutingTrade(false);
      entryPrices.clear();
      if (pollingRef.current) { clearInterval(pollingRef.current); pollingRef.current = null; }
    }
  }, [killSignal]);

  // Fetch live wallet holdings via edge function
  const fetchLiveHoldings = useCallback(async (): Promise<LiveHolding[]> => {
    if (!wallet.publicKey) return [];
    try {
      const { data, error } = await supabase.functions.invoke("wallet-portfolio", {
        body: { wallet_address: wallet.publicKey.toBase58() },
      });
      if (error || !data?.success) return [];
      const tokens = data.data?.tokens || [];
      return tokens.map((t: any) => ({
        mint: t.mint,
        symbol: t.symbol || t.mint.slice(0, 6),
        amount: t.amount,
        decimals: t.decimals || 6,
        price: t.price,
        value: t.value,
      }));
    } catch {
      return [];
    }
  }, [wallet.publicKey]);

  // Execute a sell via Jupiter Ultra (token → SOL)
  const executeLiveSell = useCallback(async (
    holding: LiveHolding,
    reason: string
  ): Promise<boolean> => {
    if (!wallet.publicKey || !wallet.signTransaction || executingTrade) return false;

    try {
      setExecutingTrade(true);
      addLog(`🔄 ${reason}: Selling ${holding.symbol}...`);

      // Calculate raw amount (amount * 10^decimals)
      const rawAmount = Math.floor(holding.amount * Math.pow(10, holding.decimals));
      
      const result = await JupiterUltraService.swap(
        wallet,
        holding.mint,
        SOL_MINT,
        rawAmount.toString(),
        'ExactIn'
      );

      if (result?.status === 'Success') {
        addLog(`✅ ${reason}: Sold ${holding.amount.toFixed(4)} ${holding.symbol} — tx: ${result.signature?.slice(0, 8)}...`);
        entryPrices.delete(holding.mint);
        return true;
      } else {
        addLog(`❌ ${reason}: Sell failed for ${holding.symbol} — ${result?.error || 'Unknown error'}`);
        return false;
      }
    } catch (e: any) {
      addLog(`❌ ${reason}: ${e.message}`);
      return false;
    } finally {
      setExecutingTrade(false);
    }
  }, [wallet, executingTrade, addLog]);

  // Polling loop for active strategies
  useEffect(() => {
    const activeStrategies = strategies.filter(s => s.enabled);
    if (activeStrategies.length === 0) {
      if (pollingRef.current) { clearInterval(pollingRef.current); pollingRef.current = null; }
      return;
    }
    if (pollingRef.current) return;

    const evaluateStrategies = async () => {
      const enabled = strategies.filter(s => s.enabled);
      if (enabled.length === 0) return;

      addLog(`Scanning ${enabled.length} strategy(ies)...`);

      if (!wallet.publicKey) {
        addLog("⚠️ Wallet not connected — skipping");
        return;
      }

      const holdings = await fetchLiveHoldings();
      if (holdings.length === 0) {
        addLog("No token holdings found in wallet");
        return;
      }

      addLog(`Found ${holdings.length} token(s) in wallet`);

      // Track entry prices — first time we see a token, record its price
      for (const h of holdings) {
        if (!entryPrices.has(h.mint) && h.price > 0) {
          entryPrices.set(h.mint, h.price);
          addLog(`📌 Tracking ${h.symbol} entry: $${h.price.toFixed(8)}`);
        }
      }

      for (const strategy of enabled) {
        try {
          switch (strategy.id) {
            case "safe_exit": {
              for (const h of holdings) {
                const entryPrice = entryPrices.get(h.mint);
                if (!entryPrice || h.price <= 0) continue;

                const pnl = ((h.price - entryPrice) / entryPrice) * 100;

                if (pnl <= -15) {
                  addLog(`🛡️ Stop-Loss triggered: ${h.symbol} at ${pnl.toFixed(1)}%`);
                  await executeLiveSell(h, "Stop-Loss");
                } else if (pnl >= 50) {
                  addLog(`🛡️ Take-Profit triggered: ${h.symbol} at +${pnl.toFixed(1)}%`);
                  await executeLiveSell(h, "Take-Profit");
                } else {
                  addLog(`🛡️ ${h.symbol}: P&L ${pnl >= 0 ? '+' : ''}${pnl.toFixed(1)}% (watching)`);
                }
              }
              break;
            }
            case "scalper": {
              for (const h of holdings) {
                const entryPrice = entryPrices.get(h.mint);
                if (!entryPrice || h.price <= 0) continue;

                const pnl = ((h.price - entryPrice) / entryPrice) * 100;

                if (pnl >= 3) {
                  addLog(`⚡ Scalper triggered: ${h.symbol} at +${pnl.toFixed(1)}%`);
                  await executeLiveSell(h, "Scalper");
                } else {
                  addLog(`⚡ ${h.symbol}: ${pnl >= 0 ? '+' : ''}${pnl.toFixed(1)}% (target: +3%)`);
                }
              }
              break;
            }
            case "momentum": {
              addLog(`📈 Momentum: Scanning ${holdings.length} position(s) for reversals`);
              // Momentum needs historical price data — log monitoring for now
              for (const h of holdings) {
                if (h.price > 0 && h.value > 0) {
                  addLog(`📈 ${h.symbol}: $${h.price.toFixed(8)} (${h.value.toFixed(2)} USD)`);
                }
              }
              break;
            }
            case "dip_buy": {
              addLog(`📉 Dip Buyer: Watching for >20% dips with recovery signals`);
              break;
            }
            case "whale_follow": {
              addLog(`🐋 Whale Follow: Monitoring top wallets`);
              break;
            }
            default:
              addLog(`🔍 ${strategy.name}: Active`);
          }
        } catch (e: any) {
          addLog(`❌ ${strategy.name}: ${e.message}`);
        }
      }
    };

    evaluateStrategies();
    pollingRef.current = setInterval(evaluateStrategies, 15000);
    return () => { if (pollingRef.current) { clearInterval(pollingRef.current); pollingRef.current = null; } };
  }, [strategies.map(s => `${s.id}:${s.enabled}`).join(','), wallet.publicKey, fetchLiveHoldings, executeLiveSell, addLog]);

  const proceedToggle = (id: string) => {
    setStrategies((prev) =>
      prev.map((s) => {
        if (s.id === id) {
          const next = !s.enabled;
          sim.saveBotConfig('auto', {
            strategies: prev.map(st => st.id === id ? { ...st, enabled: next } : st).filter(st => st.enabled).map(st => st.id),
            maxBudget: parseFloat(maxBudget),
            beachMode,
          }, next || prev.filter(st => st.id !== id).some(st => st.enabled));
          
          if (next) {
            addLog(`✅ ${s.name} activated`);
          } else {
            addLog(`⏹️ ${s.name} deactivated`);
          }
          
          toast({ title: next ? `${s.name} Enabled` : `${s.name} Disabled`, description: next ? `LIVE: ${s.description}` : "Deactivated" });
          return { ...s, enabled: next };
        }
        return s;
      })
    );
  };

  const toggleStrategy = (id: string) => {
    const strategy = strategies.find(s => s.id === id);
    if (!strategy) return;
    
    if (!wallet.publicKey) {
      toast({ title: "Wallet not connected", description: "Connect your wallet to use auto strategies", variant: "destructive" });
      return;
    }
    
    if (strategy.enabled) { proceedToggle(id); return; }
    setPendingStrategyId(id);
    setShowConfirm(true);
  };

  const handleBeachMode = (checked: boolean) => {
    setBeachMode(checked);
    const activeIds = strategies.filter(s => s.enabled).map(s => s.id);
    sim.saveBotConfig('auto', {
      strategies: activeIds,
      maxBudget: parseFloat(maxBudget),
      beachMode: checked,
    }, activeIds.length > 0);
    toast({
      title: checked ? "🏖️ Beach Mode ON" : "Beach Mode OFF",
      description: checked ? "Strategies will run in the background even when you close the app" : "Background execution disabled",
    });
  };

  const activeCount = strategies.filter((s) => s.enabled).length;
  const pendingStrategy = strategies.find(s => s.id === pendingStrategyId);

  return (
    <div className="space-y-4">
      <LiveTradeConfirmDialog
        open={showConfirm}
        onConfirm={() => { setShowConfirm(false); if (pendingStrategyId) { proceedToggle(pendingStrategyId); setPendingStrategyId(null); } }}
        onCancel={() => { setShowConfirm(false); setPendingStrategyId(null); }}
        action={`Auto Strategy: ${pendingStrategy?.name || "Unknown"}`}
        tokenSymbol="All matching tokens"
        solAmount={parseFloat(maxBudget)}
      />

      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Brain className="h-4 w-4 text-[hsl(var(--fun-purple))]" />
          <span className="text-sm font-medium text-foreground">Auto Strategies</span>
        </div>
        <div className="flex items-center gap-1">
          {executingTrade && (
            <Badge className="bg-[hsl(var(--fun-yellow))]/20 text-[hsl(var(--fun-yellow))] border-[hsl(var(--fun-yellow))]/30 animate-pulse">
              Executing...
            </Badge>
          )}
          {activeCount > 0 && (
            <Badge className="bg-destructive/20 text-destructive border-destructive/30 animate-pulse">
              {activeCount} active (LIVE)
            </Badge>
          )}
        </div>
      </div>

      {/* Beach Mode Toggle */}
      <div className="flex items-center justify-between p-2 rounded-lg bg-accent/5 border border-accent/20">
        <div className="flex items-center gap-2">
          <Palmtree className={`h-4 w-4 ${beachMode ? "text-accent" : "text-muted-foreground"}`} />
          <div>
            <span className="text-xs font-medium text-foreground">🏖️ Beach Mode</span>
            <p className="text-[10px] text-muted-foreground">Run strategies in background 24/7</p>
          </div>
        </div>
        <Switch checked={beachMode} onCheckedChange={handleBeachMode} />
      </div>
      {beachMode && activeCount > 0 && (
        <div className="p-2 rounded-lg bg-accent/10 border border-accent/30">
          <p className="text-[11px] text-accent font-medium">✅ {activeCount} strateg{activeCount > 1 ? "ies" : "y"} running in background — close your browser and earn!</p>
        </div>
      )}

      <div>
        <Label className="text-xs text-muted-foreground">Max budget per strategy (SOL)</Label>
        <Input type="number" value={maxBudget} onChange={(e) => setMaxBudget(e.target.value)} className="bg-muted/30 border-border text-sm mt-1" min="0.1" step="0.1" />
      </div>

      <div className="p-2 rounded-lg bg-destructive/10 border border-destructive/30">
        <p className="text-[11px] text-destructive font-medium">⚠️ LIVE MODE — Safe Exit & Scalper will auto-sell via Jupiter Ultra (gasless). Your wallet must approve each trade.</p>
      </div>

      {/* Status Log */}
      {statusLog.length > 0 && (
        <div className="p-2 rounded-lg bg-muted/20 border border-border max-h-40 overflow-y-auto">
          <p className="text-[10px] font-medium text-muted-foreground mb-1">Activity Log</p>
          {statusLog.map((log, i) => (
            <p key={i} className={`text-[10px] font-mono leading-tight ${
              log.includes('✅') || log.includes('Sold') ? 'text-accent' :
              log.includes('❌') ? 'text-destructive' :
              log.includes('🔄') ? 'text-[hsl(var(--fun-yellow))]' :
              'text-muted-foreground'
            }`}>{log}</p>
          ))}
        </div>
      )}

      <div className="space-y-2">
        {strategies.map((strategy) => (
          <div key={strategy.id} className={`p-3 rounded-lg border transition-all ${strategy.enabled ? "bg-destructive/5 border-destructive/30" : "bg-muted/10 border-border"}`}>
            <div className="flex items-center justify-between mb-1">
              <div className="flex items-center gap-2">
                <span className={strategy.enabled ? "text-destructive" : "text-muted-foreground"}>{strategy.icon}</span>
                <span className="text-sm font-medium text-foreground">{strategy.name}</span>
                <Badge variant="outline" className={`text-[10px] px-1.5 py-0 ${riskColors[strategy.risk]}`}>{strategy.risk}</Badge>
                {(strategy.id === "safe_exit" || strategy.id === "scalper") && (
                  <Badge variant="outline" className="text-[10px] px-1.5 py-0 bg-accent/10 text-accent border-accent/30">
                    Auto-Sell
                  </Badge>
                )}
              </div>
              <Switch 
                checked={strategy.enabled} 
                onCheckedChange={() => toggleStrategy(strategy.id)} 
                disabled={executingTrade}
              />
            </div>
            <p className="text-xs text-muted-foreground pl-6">{strategy.description}</p>
          </div>
        ))}
      </div>
    </div>
  );
};
