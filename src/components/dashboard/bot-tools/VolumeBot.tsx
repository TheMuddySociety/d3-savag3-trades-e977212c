import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Slider } from "@/components/ui/slider";
import { BarChart3, Play, Pause, Rocket } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { useWallet } from "@solana/wallet-adapter-react";
import { useConnection } from "@solana/wallet-adapter-react";
import { JupiterTransactionService } from "@/services/jupiter/transactions";
import { LiveTradeConfirmDialog } from "./LiveTradeConfirmDialog";
import { isValidSolanaAddress } from "@/utils/validateSolanaAddress";

const SOL_MINT = "So11111111111111111111111111111111111111112";

interface Props {
  killSignal?: number;
}

export const VolumeBot = ({ killSignal = 0 }: Props) => {
  const { toast } = useToast();
  const wallet = useWallet();
  const { connection } = useConnection();
  const [isRunning, setIsRunning] = useState(false);
  const [tokenAddress, setTokenAddress] = useState("");
  const [tokenSymbol, setTokenSymbol] = useState("");
  const [solPerTx, setSolPerTx] = useState("0.05");
  const [txPerMinute, setTxPerMinute] = useState([3]);
  const [txCount, setTxCount] = useState(0);
  const [useHighPerformance, setUseHighPerformance] = useState(true);
  const [showConfirm, setShowConfirm] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const volumeInterval = useRef<NodeJS.Timeout | null>(null);
  const isExecutingRef = useRef(false);
  const countRef = useRef(0);

  useEffect(() => {
    return () => { if (volumeInterval.current) clearInterval(volumeInterval.current); };
  }, []);

  useEffect(() => {
    if (killSignal > 0) {
      setIsRunning(false);
      setShowConfirm(false);
      if (volumeInterval.current) { clearInterval(volumeInterval.current); volumeInterval.current = null; }
    }
  }, [killSignal]);

  const proceedStart = () => {
    setIsRunning(true);
    setTxCount(0);
    countRef.current = 0;
    const intervalMs = (60000 / txPerMinute[0]);

    const executeVolumeTx = async () => {
      if (isExecutingRef.current) return;
      isExecutingRef.current = true;

      try {
        const isBuy = countRef.current % 2 === 0;
        const lamports = Math.round(parseFloat(solPerTx) * 1e9);
        if (isBuy) {
          await JupiterTransactionService.swapTokens(connection, wallet, SOL_MINT, tokenAddress, lamports, 300, undefined, 'Medium', false, useHighPerformance);
        } else {
          await JupiterTransactionService.swapTokens(connection, wallet, tokenAddress, SOL_MINT, lamports, 300, undefined, 'Medium', false, useHighPerformance);
        }

        countRef.current++;
        setTxCount(countRef.current);
      } finally {
        isExecutingRef.current = false;
      }
    };

    executeVolumeTx();
    volumeInterval.current = setInterval(executeVolumeTx, intervalMs);
    toast({ title: "Volume Bot Started", description: `LIVE — Running on ${tokenSymbol || tokenAddress.slice(0, 8)}` });
  };

  const startVolumeBot = () => {
    if (!tokenAddress) {
      toast({ title: "Missing token", description: "Enter a token address", variant: "destructive" });
      return;
    }
    if (!isValidSolanaAddress(tokenAddress)) {
      toast({ title: "Invalid address", description: "Enter a valid Solana token mint address", variant: "destructive" });
      return;
    }
    if (!wallet.publicKey) {
      toast({ title: "Wallet not connected", description: "Connect wallet for live trading", variant: "destructive" });
      return;
    }
    setShowConfirm(true);
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
      <LiveTradeConfirmDialog
        open={showConfirm}
        onConfirm={() => { setShowConfirm(false); proceedStart(); }}
        onCancel={() => setShowConfirm(false)}
        action="Volume Bot"
        tokenSymbol={tokenSymbol || tokenAddress.slice(0, 8)}
        solAmount={parseFloat(solPerTx)}
      />

      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <BarChart3 className="h-4 w-4 text-accent" />
          <span className="text-sm font-medium text-foreground">Volume Bot</span>
          <Badge variant="outline" className="h-4 px-1.5 text-[8px] border-primary/20 text-primary/80 font-bold uppercase tracking-tighter">
            Jupiter Metis
          </Badge>
        </div>
        {isRunning && (
          <Badge className="bg-destructive/20 text-destructive border-destructive/30 animate-pulse">
            🔴 {txCount} txs
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

        <div className="flex items-center justify-between p-3 rounded-lg border border-primary/20 bg-primary/5">
          <div className="flex items-center gap-2">
            <Rocket className="h-4 w-4 text-primary" />
            <div className="flex flex-col">
              <Label className="text-xs font-semibold">High Performance</Label>
              <p className="text-[10px] text-muted-foreground">Staked connections + Helius Sender</p>
            </div>
          </div>
          <Switch 
            checked={useHighPerformance}
            onCheckedChange={setUseHighPerformance}
            disabled={isRunning}
          />
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

        <div className="p-2 rounded-lg bg-destructive/10 border border-destructive/30">
          <p className="text-[11px] text-destructive font-medium">⚠️ LIVE MODE — Real SOL will be spent. Transactions are irreversible.</p>
        </div>

        <Button
          onClick={handleToggle}
          disabled={isLoading}
          className={`w-full ${isRunning ? 'bg-destructive hover:bg-destructive/90' : 'bg-destructive hover:bg-destructive/90'} text-destructive-foreground`}
          size="sm"
        >
          {isLoading ? (
            <><div className="animate-spin rounded-full h-3 w-3 border-b-2 border-current mr-2" /> Processing...</>
          ) : isRunning ? (
            <><Pause className="h-4 w-4 mr-2" /> Stop Volume Bot</>
          ) : (
            <><Play className="h-4 w-4 mr-2" /> Start Volume Bot (LIVE)</>
          )}
        </Button>
      </div>
    </div>
  );
};
