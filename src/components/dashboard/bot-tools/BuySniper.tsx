import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Crosshair, Zap, Shield } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

export const BuySniper = () => {
  const { toast } = useToast();
  const [isArmed, setIsArmed] = useState(false);
  const [tokenAddress, setTokenAddress] = useState("");
  const [buyAmount, setBuyAmount] = useState("0.5");
  const [maxSlippage, setMaxSlippage] = useState("15");
  const [priorityFee, setPriorityFee] = useState("0.005");
  const [autoSell, setAutoSell] = useState(false);
  const [takeProfitPercent, setTakeProfitPercent] = useState("100");

  const handleArm = () => {
    if (!tokenAddress) {
      toast({ title: "Missing token", description: "Enter a token address to snipe", variant: "destructive" });
      return;
    }
    setIsArmed(!isArmed);
    toast({
      title: isArmed ? "Sniper Disarmed" : "Sniper Armed 🎯",
      description: isArmed
        ? "Buy sniper has been disarmed"
        : `Watching for liquidity on ${tokenAddress.slice(0, 8)}...`,
    });
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Crosshair className="h-4 w-4 text-primary" />
          <span className="text-sm font-medium text-foreground">Buy Sniper</span>
        </div>
        {isArmed && (
          <Badge className="bg-primary/20 text-primary border-primary/30 animate-pulse">
            🎯 Armed
          </Badge>
        )}
      </div>

      <div className="space-y-3">
        <div>
          <Label className="text-xs text-muted-foreground">Token Address to Snipe</Label>
          <Input
            placeholder="Paste token mint address..."
            value={tokenAddress}
            onChange={(e) => setTokenAddress(e.target.value)}
            className="bg-muted/30 border-border text-sm font-mono"
            disabled={isArmed}
          />
        </div>

        <div className="grid grid-cols-2 gap-2">
          <div>
            <Label className="text-xs text-muted-foreground">Buy Amount (SOL)</Label>
            <Input
              type="number"
              value={buyAmount}
              onChange={(e) => setBuyAmount(e.target.value)}
              className="bg-muted/30 border-border text-sm"
              disabled={isArmed}
              min="0.01"
              step="0.1"
            />
          </div>
          <div>
            <Label className="text-xs text-muted-foreground">Max Slippage (%)</Label>
            <Input
              type="number"
              value={maxSlippage}
              onChange={(e) => setMaxSlippage(e.target.value)}
              className="bg-muted/30 border-border text-sm"
              disabled={isArmed}
              min="1"
              max="50"
            />
          </div>
        </div>

        <div>
          <Label className="text-xs text-muted-foreground">Priority Fee (SOL)</Label>
          <div className="flex gap-1 mt-1">
            {["0.001", "0.005", "0.01", "0.05"].map((fee) => (
              <Button
                key={fee}
                variant={priorityFee === fee ? "default" : "outline"}
                size="sm"
                className="flex-1 text-xs h-7"
                onClick={() => setPriorityFee(fee)}
                disabled={isArmed}
              >
                {fee}
              </Button>
            ))}
          </div>
        </div>

        <div className="p-2 rounded-lg bg-muted/20 border border-border space-y-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Shield className="h-3 w-3 text-muted-foreground" />
              <Label className="text-xs text-muted-foreground">Auto Take-Profit</Label>
            </div>
            <Switch checked={autoSell} onCheckedChange={setAutoSell} disabled={isArmed} />
          </div>
          {autoSell && (
            <div>
              <Label className="text-xs text-muted-foreground">Sell at +%</Label>
              <Input
                type="number"
                value={takeProfitPercent}
                onChange={(e) => setTakeProfitPercent(e.target.value)}
                className="bg-muted/30 border-border text-sm h-7"
                disabled={isArmed}
                min="10"
              />
            </div>
          )}
        </div>

        <Button
          onClick={handleArm}
          className={`w-full ${isArmed ? 'bg-destructive hover:bg-destructive/90' : 'bg-primary hover:bg-primary/90'} text-primary-foreground`}
          size="sm"
        >
          {isArmed ? (
            <><Crosshair className="h-4 w-4 mr-2" /> Disarm Sniper</>
          ) : (
            <><Zap className="h-4 w-4 mr-2" /> Arm Sniper</>
          )}
        </Button>
      </div>
    </div>
  );
};
