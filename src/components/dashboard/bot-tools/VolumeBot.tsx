import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { BarChart3, Play, Pause, Wallet } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface Props {
  sim: any;
  isLive?: boolean;
}

export const VolumeBot = ({ sim, isLive = false }: Props) => {
  const { toast } = useToast();
  const [isRunning, setIsRunning] = useState(false);
  const [tokenAddress, setTokenAddress] = useState("");
  const [tokenSymbol, setTokenSymbol] = useState("");
  const [solPerTx, setSolPerTx] = useState("0.05");
  const [txPerMinute, setTxPerMinute] = useState([3]);
  const [numWallets, setNumWallets] = useState([3]);
  const [useBundling, setUseBundling] = useState(true);
  const [txCount, setTxCount] = useState(0);
  const volumeInterval = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    return () => { if (volumeInterval.current) clearInterval(volumeInterval.current); };
  }, []);

  const startVolumeBot = () => {
    if (!tokenAddress) {
      toast({ title: "Missing token", description: "Enter a token address", variant: "destructive" });
      return;
    }
    if (isLive) {
      toast({ title: "Not available in Live Mode", description: "Volume bot is only available in paper trading mode for safety", variant: "destructive" });
      return;
    }

    setIsRunning(true);
    setTxCount(0);
    let count = 0;
    const intervalMs = (60000 / txPerMinute[0]);

    const executeVolumeTx = async () => {
      const isBuy = count % 2 === 0;
      if (isBuy) {
        await sim.simulateBuy(tokenAddress, tokenSymbol || tokenAddress.slice(0, 6), parseFloat(solPerTx), 'volume');
      } else {
        await sim.simulateSell(tokenAddress, tokenSymbol || tokenAddress.slice(0, 6), 50, 'volume');
      }
      count++;
      setTxCount(count);
    };

    executeVolumeTx();
    volumeInterval.current = setInterval(executeVolumeTx, intervalMs);
  };

  const stopVolumeBot = () => {
    setIsRunning(false);
    if (volumeInterval.current) { clearInterval(volumeInterval.current); volumeInterval.current = null; }
    toast({ title: "Volume Bot Stopped", description: `Executed ${txCount} transactions` });
  };

  const handleToggle = () => {
    if (isRunning) stopVolumeBot();
    else startVolumeBot();
  };

  const estVolPerHour = parseFloat(solPerTx) * txPerMinute[0] * 60 * 2;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <BarChart3 className="h-4 w-4 text-accent" />
          <span className="text-sm font-medium text-foreground">Volume Bot</span>
        </div>
        {isLive && (
          <Badge variant="outline" className="text-[10px] bg-muted/30 text-muted-foreground border-border">
            Paper Only
          </Badge>
        )}
        {isRunning && (
          <Badge className="bg-accent/20 text-accent border-accent/30 animate-pulse">
            {txCount} txs
          </Badge>
        )}
      </div>

      <div className="space-y-3">
        <div>
          <Label className="text-xs text-muted-foreground">Token Address</Label>
          <Input placeholder="Enter token mint address..." value={tokenAddress} onChange={(e) => setTokenAddress(e.target.value)} className="bg-muted/30 border-border text-sm font-mono" disabled={isRunning} />
        </div>
        <div>
          <Label className="text-xs text-muted-foreground">Token Symbol (optional)</Label>
          <Input placeholder="e.g. BONK" value={tokenSymbol} onChange={(e) => setTokenSymbol(e.target.value)} className="bg-muted/30 border-border text-sm" disabled={isRunning} />
        </div>
        <div>
          <Label className="text-xs text-muted-foreground">SOL per Transaction</Label>
          <Input type="number" value={solPerTx} onChange={(e) => setSolPerTx(e.target.value)} className="bg-muted/30 border-border text-sm" disabled={isRunning} min="0.01" step="0.01" />
        </div>
        <div>
          <div className="flex justify-between mb-1">
            <Label className="text-xs text-muted-foreground">Transactions / min</Label>
            <span className="text-xs font-mono text-foreground">{txPerMinute[0]}</span>
          </div>
          <Slider value={txPerMinute} onValueChange={setTxPerMinute} min={1} max={10} step={1} disabled={isRunning} />
        </div>
        <div>
          <div className="flex justify-between mb-1">
            <Label className="text-xs text-muted-foreground">Simulated Wallets</Label>
            <span className="text-xs font-mono text-foreground">{numWallets[0]}</span>
          </div>
          <Slider value={numWallets} onValueChange={setNumWallets} min={1} max={10} step={1} disabled={isRunning} />
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
            <span className="text-muted-foreground">Transactions done</span>
            <span className="text-foreground font-mono">{txCount}</span>
          </div>
        </div>

        <Button
          onClick={handleToggle}
          disabled={sim.isLoading || isLive}
          className={`w-full ${isRunning ? 'bg-destructive hover:bg-destructive/90 text-destructive-foreground' : 'bg-accent hover:bg-accent/90 text-accent-foreground'}`}
          size="sm"
        >
          {sim.isLoading ? (
            <><div className="animate-spin rounded-full h-3 w-3 border-b-2 border-current mr-2" /> Processing...</>
          ) : isRunning ? (
            <><Pause className="h-4 w-4 mr-2" /> Stop Volume Bot</>
          ) : (
            <><Play className="h-4 w-4 mr-2" /> Start Volume Bot (Paper)</>
          )}
        </Button>
      </div>
    </div>
  );
};
