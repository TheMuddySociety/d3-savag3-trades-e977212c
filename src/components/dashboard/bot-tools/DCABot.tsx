import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Clock, TrendingUp, Play, Pause } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

const INTERVAL_OPTIONS = [
  { value: "1m", label: "Every 1 min" },
  { value: "5m", label: "Every 5 min" },
  { value: "15m", label: "Every 15 min" },
  { value: "1h", label: "Every 1 hour" },
  { value: "4h", label: "Every 4 hours" },
  { value: "1d", label: "Every 1 day" },
];

export const DCABot = () => {
  const { toast } = useToast();
  const [isRunning, setIsRunning] = useState(false);
  const [tokenAddress, setTokenAddress] = useState("");
  const [amountPerOrder, setAmountPerOrder] = useState("0.1");
  const [interval, setInterval] = useState("1h");
  const [totalOrders, setTotalOrders] = useState("10");
  const [useRandomDelay, setUseRandomDelay] = useState(true);

  const handleToggle = () => {
    if (!tokenAddress) {
      toast({ title: "Missing token", description: "Enter a token address to DCA into", variant: "destructive" });
      return;
    }
    setIsRunning(!isRunning);
    toast({
      title: isRunning ? "DCA Paused" : "DCA Started",
      description: isRunning
        ? "Your DCA strategy has been paused"
        : `Buying ${amountPerOrder} SOL worth every ${INTERVAL_OPTIONS.find(i => i.value === interval)?.label}`,
    });
  };

  const totalSol = parseFloat(amountPerOrder) * parseInt(totalOrders || "0");

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Clock className="h-4 w-4 text-accent" />
          <span className="text-sm font-medium text-foreground">Dollar Cost Average</span>
        </div>
        {isRunning && (
          <Badge className="bg-accent/20 text-accent border-accent/30 animate-pulse">
            Running
          </Badge>
        )}
      </div>

      <div className="space-y-3">
        <div>
          <Label className="text-xs text-muted-foreground">Token Address</Label>
          <Input
            placeholder="Enter token mint address..."
            value={tokenAddress}
            onChange={(e) => setTokenAddress(e.target.value)}
            className="bg-muted/30 border-border text-sm font-mono"
            disabled={isRunning}
          />
        </div>

        <div className="grid grid-cols-2 gap-2">
          <div>
            <Label className="text-xs text-muted-foreground">Amount per buy (SOL)</Label>
            <Input
              type="number"
              value={amountPerOrder}
              onChange={(e) => setAmountPerOrder(e.target.value)}
              className="bg-muted/30 border-border text-sm"
              disabled={isRunning}
              min="0.001"
              step="0.01"
            />
          </div>
          <div>
            <Label className="text-xs text-muted-foreground">Interval</Label>
            <Select value={interval} onValueChange={setInterval} disabled={isRunning}>
              <SelectTrigger className="bg-muted/30 border-border text-sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {INTERVAL_OPTIONS.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2">
          <div>
            <Label className="text-xs text-muted-foreground">Total Orders</Label>
            <Input
              type="number"
              value={totalOrders}
              onChange={(e) => setTotalOrders(e.target.value)}
              className="bg-muted/30 border-border text-sm"
              disabled={isRunning}
              min="1"
            />
          </div>
          <div className="flex items-end pb-1">
            <div className="flex items-center gap-2">
              <Switch
                checked={useRandomDelay}
                onCheckedChange={setUseRandomDelay}
                disabled={isRunning}
              />
              <Label className="text-xs text-muted-foreground">Random delay</Label>
            </div>
          </div>
        </div>

        <div className="p-2 rounded-lg bg-muted/20 border border-border">
          <div className="flex justify-between text-xs">
            <span className="text-muted-foreground">Total budget</span>
            <span className="text-foreground font-mono">{totalSol.toFixed(3)} SOL</span>
          </div>
          <div className="flex justify-between text-xs mt-1">
            <span className="text-muted-foreground">Est. duration</span>
            <span className="text-foreground font-mono">{totalOrders} orders</span>
          </div>
        </div>

        <Button
          onClick={handleToggle}
          className={`w-full ${isRunning ? 'bg-destructive hover:bg-destructive/90' : 'bg-accent hover:bg-accent/90'} text-accent-foreground`}
          size="sm"
        >
          {isRunning ? (
            <><Pause className="h-4 w-4 mr-2" /> Pause DCA</>
          ) : (
            <><Play className="h-4 w-4 mr-2" /> Start DCA</>
          )}
        </Button>
      </div>
    </div>
  );
};
