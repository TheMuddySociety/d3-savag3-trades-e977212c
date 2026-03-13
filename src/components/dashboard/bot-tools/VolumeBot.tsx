import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Slider } from "@/components/ui/slider";
import { BarChart3, Play, Pause } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useWallet } from "@solana/wallet-adapter-react";
import { useConnection } from "@solana/wallet-adapter-react";
import { JupiterTransactionService } from "@/services/jupiter/transactions";
import { LiveTradeConfirmDialog } from "./LiveTradeConfirmDialog";
import { isValidSolanaAddress } from "@/utils/validateSolanaAddress";

const SOL_MINT = "So11111111111111111111111111111111111111112";

interface Props {
  sim: any;
  isLive?: boolean;
  killSignal?: number;
}

export const VolumeBot = ({ sim, isLive = false, killSignal = 0 }: Props) => {
  const { toast } = useToast();
  const wallet = useWallet();
  const { connection } = useConnection();
  const [isRunning, setIsRunning] = useState(false);
  const [tokenAddress, setTokenAddress] = useState("");
  const [tokenSymbol, setTokenSymbol] = useState("");
  const [solPerTx, setSolPerTx] = useState("0.05");
  const [txPerMinute, setTxPerMinute] = useState([3]);
  const [txCount, setTxCount] = useState(0);
  const [showConfirm, setShowConfirm] = useState(false);
  const volumeInterval = useRef<NodeJS.Timeout | null>(null);
  const isExecutingRef = useRef(false);
  const countRef = useRef(0);

  useEffect(() => {
    return () => { if (volumeInterval.current) clearInterval(volumeInterval.current); };
  }, []);

  // Kill switch listener
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

        if (isLive) {
          const lamports = Math.round(parseFloat(solPerTx) * 1e9);
          if (isBuy) {
            await JupiterTransactionService.swapTokens(connection, wallet, SOL_MINT, tokenAddress, lamports, 300);
          } else {
            await JupiterTransactionService.swapTokens(connection, wallet, tokenAddress, SOL_MINT, lamports, 300);
          }
        } else {
          if (isBuy) {
            await sim.simulateBuy(tokenAddress, tokenSymbol || tokenAddress.slice(0, 6), parseFloat(solPerTx), 'volume');
          } else {
            await sim.simulateSell(tokenAddress, tokenSymbol || tokenAddress.slice(0, 6), 50, 'volume');
          }
        }

        countRef.current++;
        setTxCount(countRef.current);
      } finally {
        isExecutingRef.current = false;
      }
    };

    executeVolumeTx();
    volumeInterval.current = setInterval(executeVolumeTx, intervalMs);
    toast({ title: "Volume Bot Started", description: `${isLive ? "LIVE" : "Paper"} — Running on ${tokenSymbol || tokenAddress.slice(0, 8)}` });
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
    if (isLive && !wallet.publicKey) {
      toast({ title: "Wallet not connected", description: "Connect wallet for live trading", variant: "destructive" });
      return;
    }

    if (isLive) {
      setShowConfirm(true);
    } else {
      proceedStart();
    }
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
        </div>
        {isRunning && (
          <Badge className={`${isLive ? "bg-destructive/20 text-destructive border-destructive/30" : "bg-accent/20 text-accent border-accent/30"} animate-pulse`}>
            {isLive ? `🔴 ${txCount} txs` : `${txCount} txs`}
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

        {isLive && !isRunning && (
          <div className="p-2 rounded-lg bg-destructive/10 border border-destructive/30">
            <p className="text-[11px] text-destructive font-medium">⚠️ LIVE MODE — Real SOL will be spent. Transactions are irreversible.</p>
          </div>
        )}

        <Button
          onClick={handleToggle}
          disabled={sim.isLoading}
          className={`w-full ${isRunning ? 'bg-destructive hover:bg-destructive/90 text-destructive-foreground' : isLive ? 'bg-destructive hover:bg-destructive/90 text-destructive-foreground' : 'bg-accent hover:bg-accent/90 text-accent-foreground'}`}
          size="sm"
        >
          {sim.isLoading ? (
            <><div className="animate-spin rounded-full h-3 w-3 border-b-2 border-current mr-2" /> Processing...</>
          ) : isRunning ? (
            <><Pause className="h-4 w-4 mr-2" /> Stop Volume Bot</>
          ) : (
            <><Play className="h-4 w-4 mr-2" /> Start Volume Bot {isLive ? "(LIVE)" : "(Paper)"}</>
          )}
        </Button>
      </div>
    </div>
  );
};
