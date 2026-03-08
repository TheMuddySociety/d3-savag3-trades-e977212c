import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Brain, TrendingUp, TrendingDown, ShieldCheck, Flame } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface Strategy {
  id: string;
  name: string;
  description: string;
  icon: React.ReactNode;
  risk: "Low" | "Medium" | "High";
  enabled: boolean;
}

const INITIAL_STRATEGIES: Strategy[] = [
  {
    id: "momentum",
    name: "Momentum Rider",
    description: "Buys tokens trending up with high volume, sells on reversal",
    icon: <TrendingUp className="h-4 w-4" />,
    risk: "Medium",
    enabled: false,
  },
  {
    id: "dip_buy",
    name: "Dip Buyer",
    description: "Auto-buys when price drops >20% in 1h with recovery signals",
    icon: <TrendingDown className="h-4 w-4" />,
    risk: "High",
    enabled: false,
  },
  {
    id: "safe_exit",
    name: "Safe Exit",
    description: "Auto stop-loss at -15% and trailing take-profit at +50%",
    icon: <ShieldCheck className="h-4 w-4" />,
    risk: "Low",
    enabled: false,
  },
  {
    id: "new_launch",
    name: "New Launch Hunter",
    description: "Snipes new tokens on Pump.fun within first 30s of launch",
    icon: <Flame className="h-4 w-4" />,
    risk: "High",
    enabled: false,
  },
];

const riskColors: Record<string, string> = {
  Low: "bg-accent/20 text-accent border-accent/30",
  Medium: "bg-[hsl(var(--fun-yellow))]/20 text-[hsl(var(--fun-yellow))] border-[hsl(var(--fun-yellow))]/30",
  High: "bg-destructive/20 text-destructive border-destructive/30",
};

export const AutoStrategies = () => {
  const { toast } = useToast();
  const [strategies, setStrategies] = useState<Strategy[]>(INITIAL_STRATEGIES);
  const [maxBudget, setMaxBudget] = useState("1.0");

  const toggleStrategy = (id: string) => {
    setStrategies((prev) =>
      prev.map((s) => {
        if (s.id === id) {
          const next = !s.enabled;
          toast({
            title: next ? `${s.name} Enabled` : `${s.name} Disabled`,
            description: next ? s.description : `Strategy deactivated`,
          });
          return { ...s, enabled: next };
        }
        return s;
      })
    );
  };

  const activeCount = strategies.filter((s) => s.enabled).length;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Brain className="h-4 w-4 text-[hsl(var(--fun-purple))]" />
          <span className="text-sm font-medium text-foreground">Auto Strategies</span>
        </div>
        {activeCount > 0 && (
          <Badge className="bg-primary/20 text-primary border-primary/30">
            {activeCount} active
          </Badge>
        )}
      </div>

      <div>
        <Label className="text-xs text-muted-foreground">Max budget per strategy (SOL)</Label>
        <Input
          type="number"
          value={maxBudget}
          onChange={(e) => setMaxBudget(e.target.value)}
          className="bg-muted/30 border-border text-sm mt-1"
          min="0.1"
          step="0.1"
        />
      </div>

      <div className="space-y-2">
        {strategies.map((strategy) => (
          <div
            key={strategy.id}
            className={`p-3 rounded-lg border transition-all ${
              strategy.enabled
                ? "bg-primary/5 border-primary/30"
                : "bg-muted/10 border-border"
            }`}
          >
            <div className="flex items-center justify-between mb-1">
              <div className="flex items-center gap-2">
                <span className={strategy.enabled ? "text-primary" : "text-muted-foreground"}>
                  {strategy.icon}
                </span>
                <span className="text-sm font-medium text-foreground">{strategy.name}</span>
                <Badge variant="outline" className={`text-[10px] px-1.5 py-0 ${riskColors[strategy.risk]}`}>
                  {strategy.risk}
                </Badge>
              </div>
              <Switch
                checked={strategy.enabled}
                onCheckedChange={() => toggleStrategy(strategy.id)}
              />
            </div>
            <p className="text-xs text-muted-foreground pl-6">{strategy.description}</p>
          </div>
        ))}
      </div>
    </div>
  );
};
