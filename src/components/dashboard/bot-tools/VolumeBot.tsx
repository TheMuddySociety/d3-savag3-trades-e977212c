import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { BarChart3, Play, Pause, Wallet } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

export const VolumeBot = () => {
  const { toast } = useToast();
  const [isRunning, setIsRunning] = useState(false);
  const [tokenAddress, setTokenAddress] = useState("");
  const [solPerTx, setSolPerTx] = useState("0.05");
  const [txPerMinute, setTxPerMinute] = useState([3]);
  const [numWallets, setNumWallets] = useState([3]);
  const [useBundling, setUseBundling] = useState(true);

  const handleToggle = () => {
    if (!tokenAddress) {
      toast({ title: "Missing token", description: "Enter a token address", variant: "destructive" });
      return;
    }
    setIsRunning(!isRunning);
    toast({
      title: isRunning ? "Volume Bot Stopped" : "Volume Bot Started 📊",
      description: isRunning
        ? "Volume generation stopped"
        : `Generating volume with ${numWallets[0]} wallets at ${txPerMinute[0]} tx/min`,
    });
  };

  const estVolPerHour = parseFloat(solPerTx) * txPerMinute[0] * 60 * 2; // buy + sell

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <BarChart3 className="h-4 w-4 text-[hsl(var(--fun-green))]" />
          <span className="text-sm font-medium text-foreground">Volume Bot</span>
        </div>
        {isRunning && (
          <Badge className="bg-[hsl(var(--fun-green))]/20 text-[hsl(var(--fun-green))] border-[hsl(var(--fun-green))]/30 animate-pulse">
            Active
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

        <div>
          <Label className="text-xs text-muted-foreground">SOL per Transaction</Label>
          <Input
            type="number"
            value={solPerTx}
            onChange={(e) => setSolPerTx(e.target.value)}
            className="bg-muted/30 border-border text-sm"
            disabled={isRunning}
            min="0.01"
            step="0.01"
          />
        </div>

        <div>
          <div className="flex justify-between mb-1">
            <Label className="text-xs text-muted-foreground">Transactions / min</Label>
            <span className="text-xs font-mono text-foreground">{txPerMinute[0]}</span>
          </div>
          <Slider
            value={txPerMinute}
            onValueChange={setTxPerMinute}
            min={1}
            max={10}
            step={1}
            disabled={isRunning}
          />
        </div>

        <div>
          <div className="flex justify-between mb-1">
            <Label className="text-xs text-muted-foreground">Number of Wallets</Label>
            <span className="text-xs font-mono text-foreground">{numWallets[0]}</span>
          </div>
          <Slider
            value={numWallets}
            onValueChange={setNumWallets}
            min={1}
            max={10}
            step={1}
            disabled={isRunning}
          />
        </div>

        <div className="flex items-center justify-between p-2 rounded-lg bg-muted/20 border border-border">
          <div className="flex items-center gap-2">
            <Wallet className="h-3 w-3 text-muted-foreground" />
            <Label className="text-xs text-muted-foreground">Multi-wallet bundling</Label>
          </div>
          <Switch checked={useBundling} onCheckedChange={setUseBundling} disabled={isRunning} />
        </div>

        <div className="p-2 rounded-lg bg-muted/20 border border-border">
          <div className="flex justify-between text-xs">
            <span className="text-muted-foreground">Est. volume/hour</span>
            <span className="text-foreground font-mono">{estVolPerHour.toFixed(2)} SOL</span>
          </div>
          <div className="flex justify-between text-xs mt-1">
            <span className="text-muted-foreground">Wallets active</span>
            <span className="text-foreground font-mono">{numWallets[0]}</span>
          </div>
        </div>

        <Button
          onClick={handleToggle}
          className={`w-full ${isRunning ? 'bg-destructive hover:bg-destructive/90 text-destructive-foreground' : 'bg-accent hover:bg-accent/90 text-accent-foreground'}`}
          size="sm"
        >
          {isRunning ? (
            <><Pause className="h-4 w-4 mr-2" /> Stop Volume Bot</>
          ) : (
            <><Play className="h-4 w-4 mr-2" /> Start Volume Bot</>
          )}
        </Button>
      </div>
    </div>
  );
};
