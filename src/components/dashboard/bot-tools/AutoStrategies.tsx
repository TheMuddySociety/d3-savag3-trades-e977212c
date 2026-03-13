import { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Brain, TrendingUp, TrendingDown, ShieldCheck, Flame } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { LiveTradeConfirmDialog } from "./LiveTradeConfirmDialog";

interface Strategy {
  id: string;
  name: string;
  description: string;
  icon: React.ReactNode;
  risk: "Low" | "Medium" | "High";
  enabled: boolean;
}

const INITIAL_STRATEGIES: Strategy[] = [
  { id: "momentum", name: "Momentum Rider", description: "Buys tokens trending up with high volume, sells on reversal", icon: <TrendingUp className="h-4 w-4" />, risk: "Medium", enabled: false },
  { id: "dip_buy", name: "Dip Buyer", description: "Auto-buys when price drops >20% in 1h with recovery signals", icon: <TrendingDown className="h-4 w-4" />, risk: "High", enabled: false },
  { id: "safe_exit", name: "Safe Exit", description: "Auto stop-loss at -15% and trailing take-profit at +50%", icon: <ShieldCheck className="h-4 w-4" />, risk: "Low", enabled: false },
  { id: "new_launch", name: "New Launch Hunter", description: "Snipes new tokens on Pump.fun within first 30s of launch", icon: <Flame className="h-4 w-4" />, risk: "High", enabled: false },
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

export const AutoStrategies = ({ sim, isLive = false, killSignal = 0 }: Props) => {
  const { toast } = useToast();
  const [strategies, setStrategies] = useState<Strategy[]>(INITIAL_STRATEGIES);
  const [maxBudget, setMaxBudget] = useState("1.0");
  const [showConfirm, setShowConfirm] = useState(false);
  const [pendingStrategyId, setPendingStrategyId] = useState<string | null>(null);
  const pollingRef = useRef<NodeJS.Timeout | null>(null);

  // Kill switch listener
  useEffect(() => {
    if (killSignal > 0) {
      setStrategies(prev => prev.map(s => ({ ...s, enabled: false })));
      setShowConfirm(false);
      setPendingStrategyId(null);
      if (pollingRef.current) { clearInterval(pollingRef.current); pollingRef.current = null; }
    }
  }, [killSignal]);

  // Strategy execution polling loop
  useEffect(() => {
    const activeStrategies = strategies.filter(s => s.enabled);

    if (activeStrategies.length === 0) {
      if (pollingRef.current) { clearInterval(pollingRef.current); pollingRef.current = null; }
      return;
    }

    // Only start polling if not already running
    if (pollingRef.current) return;

    const evaluateStrategies = async () => {
      const enabled = strategies.filter(s => s.enabled);
      if (enabled.length === 0) return;

      for (const strategy of enabled) {
        try {
          // Fetch portfolio to evaluate conditions
          const portfolio = sim.portfolio;
          if (!portfolio) continue;

          const budget = parseFloat(maxBudget);
          const holdings = portfolio.holdings || [];

          switch (strategy.id) {
            case "safe_exit": {
              // Check holdings for stop-loss (-15%) or take-profit (+50%)
              for (const h of holdings) {
                const pnl = h.pnl_percent || 0;
                if (pnl <= -15) {
                  await sim.simulateSell(h.token_address, h.token_symbol || 'UNK', 100, 'auto');
                  toast({ title: "🛡️ Safe Exit: Stop-Loss", description: `Sold ${h.token_symbol} at ${pnl.toFixed(1)}% loss` });
                } else if (pnl >= 50) {
                  await sim.simulateSell(h.token_address, h.token_symbol || 'UNK', 100, 'auto');
                  toast({ title: "🛡️ Safe Exit: Take-Profit", description: `Sold ${h.token_symbol} at +${pnl.toFixed(1)}%` });
                }
              }
              break;
            }
            case "momentum":
            case "dip_buy":
            case "new_launch": {
              // These strategies require external price feed monitoring
              // Currently evaluated via portfolio data only — paper mode sim trades
              // Real implementation would poll Birdeye/Helius for price changes
              break;
            }
          }
        } catch (e) {
          console.error(`Strategy ${strategy.id} evaluation error:`, e);
        }
      }
    };

    // Poll every 15 seconds
    evaluateStrategies();
    pollingRef.current = setInterval(evaluateStrategies, 15000);

    return () => {
      if (pollingRef.current) { clearInterval(pollingRef.current); pollingRef.current = null; }
    };
  }, [strategies.map(s => `${s.id}:${s.enabled}`).join(',')]); // Re-run when enabled states change

  const proceedToggle = (id: string) => {
    setStrategies((prev) =>
      prev.map((s) => {
        if (s.id === id) {
          const next = !s.enabled;
          sim.saveBotConfig('auto', {
            strategies: prev.map(st => st.id === id ? { ...st, enabled: next } : st).filter(st => st.enabled).map(st => st.id),
            maxBudget: parseFloat(maxBudget),
          }, next || prev.filter(st => st.id !== id).some(st => st.enabled));
          toast({ title: next ? `${s.name} Enabled` : `${s.name} Disabled`, description: next ? `${isLive ? "LIVE" : "Paper"} trading: ${s.description}` : `Strategy deactivated` });
          return { ...s, enabled: next };
        }
        return s;
      })
    );
  };

  const toggleStrategy = (id: string) => {
    const strategy = strategies.find(s => s.id === id);
    if (!strategy) return;

    // If disabling, no confirmation needed
    if (strategy.enabled) {
      proceedToggle(id);
      return;
    }

    // If enabling in live mode, show confirmation
    if (isLive) {
      setPendingStrategyId(id);
      setShowConfirm(true);
    } else {
      proceedToggle(id);
    }
  };

  const activeCount = strategies.filter((s) => s.enabled).length;
  const pendingStrategy = strategies.find(s => s.id === pendingStrategyId);

  return (
    <div className="space-y-4">
      <LiveTradeConfirmDialog
        open={showConfirm}
        onConfirm={() => {
          setShowConfirm(false);
          if (pendingStrategyId) {
            proceedToggle(pendingStrategyId);
            setPendingStrategyId(null);
          }
        }}
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
          {activeCount > 0 && (
            <Badge className={`${isLive ? "bg-destructive/20 text-destructive border-destructive/30" : "bg-primary/20 text-primary border-primary/30"}`}>
              {activeCount} active {isLive ? "(LIVE)" : ""}
            </Badge>
          )}
        </div>
      </div>

      <div>
        <Label className="text-xs text-muted-foreground">Max budget per strategy (SOL)</Label>
        <Input type="number" value={maxBudget} onChange={(e) => setMaxBudget(e.target.value)} className="bg-muted/30 border-border text-sm mt-1" min="0.1" step="0.1" />
      </div>

      {isLive && (
        <div className="p-2 rounded-lg bg-destructive/10 border border-destructive/30">
          <p className="text-[11px] text-destructive font-medium">⚠️ LIVE MODE — Enabling strategies will execute real trades automatically.</p>
        </div>
      )}

      <div className="space-y-2">
        {strategies.map((strategy) => (
          <div key={strategy.id} className={`p-3 rounded-lg border transition-all ${strategy.enabled ? (isLive ? "bg-destructive/5 border-destructive/30" : "bg-primary/5 border-primary/30") : "bg-muted/10 border-border"}`}>
            <div className="flex items-center justify-between mb-1">
              <div className="flex items-center gap-2">
                <span className={strategy.enabled ? (isLive ? "text-destructive" : "text-primary") : "text-muted-foreground"}>{strategy.icon}</span>
                <span className="text-sm font-medium text-foreground">{strategy.name}</span>
                <Badge variant="outline" className={`text-[10px] px-1.5 py-0 ${riskColors[strategy.risk]}`}>{strategy.risk}</Badge>
              </div>
              <Switch checked={strategy.enabled} onCheckedChange={() => toggleStrategy(strategy.id)} />
            </div>
            <p className="text-xs text-muted-foreground pl-6">{strategy.description}</p>
          </div>
        ))}
      </div>
    </div>
  );
};
