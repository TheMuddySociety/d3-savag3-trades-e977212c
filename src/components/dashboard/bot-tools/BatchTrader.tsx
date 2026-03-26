import { useState, useRef, useCallback, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Progress } from "@/components/ui/progress";
import { Layers, Play, DollarSign, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { isValidSolanaAddress } from "@/utils/validateSolanaAddress";
import { LiveTradeConfirmDialog } from "./LiveTradeConfirmDialog";
import { JupiterTransactionService } from "@/services/jupiter/transactions";
import { useWallet } from "@solana/wallet-adapter-react";
import { useWalletPortfolio } from "@/hooks/useWalletPortfolio";
import { Connection } from "@solana/web3.js";

const SOL_MINT = "So11111111111111111111111111111111111111112";
const RPC_URL = "https://api.mainnet-beta.solana.com";
const BATCH_SIZE = 5;

interface Props {
  killSignal?: number;
}

interface TokenResult {
  address: string;
  status: "pending" | "success" | "error";
  message?: string;
}

export const BatchTrader = ({ killSignal = 0 }: Props) => {
  const { toast } = useToast();
  const wallet = useWallet();
  const walletAddress = wallet.publicKey?.toBase58() || null;
  const { portfolio } = useWalletPortfolio(walletAddress);
  const [addresses, setAddresses] = useState("");
  const [solPerToken, setSolPerToken] = useState("0.1");
  const [isRunning, setIsRunning] = useState(false);
  const [results, setResults] = useState<TokenResult[]>([]);
  const [progress, setProgress] = useState(0);
  const [showConfirm, setShowConfirm] = useState(false);
  const [pendingAction, setPendingAction] = useState<"buy" | "sell" | null>(null);
  const killedRef = useRef(false);

  useEffect(() => {
    if (killSignal > 0) {
      killedRef.current = true;
      setIsRunning(false);
      setShowConfirm(false);
    }
  }, [killSignal]);

  const parseAddresses = useCallback((): string[] => {
    return addresses
      .split(/[\n,]+/)
      .map(a => a.trim())
      .filter(a => a.length > 0);
  }, [addresses]);

  const executeBatchBuy = useCallback(async () => {
    const tokens = parseAddresses();
    const validTokens = tokens.filter(isValidSolanaAddress);
    const invalidTokens = tokens.filter(a => !isValidSolanaAddress(a));

    if (validTokens.length === 0) {
      toast({ title: "No valid addresses", description: "Enter valid Solana token addresses", variant: "destructive" });
      return;
    }

    if (invalidTokens.length > 0) {
      toast({ title: `${invalidTokens.length} invalid addresses skipped`, variant: "destructive" });
    }

    const sol = parseFloat(solPerToken);
    if (isNaN(sol) || sol <= 0) {
      toast({ title: "Invalid SOL amount", variant: "destructive" });
      return;
    }

    if (!wallet.publicKey || !wallet.signTransaction) {
      toast({ title: "Wallet not connected", variant: "destructive" });
      return;
    }

    killedRef.current = false;
    setIsRunning(true);
    setProgress(0);
    const initialResults: TokenResult[] = validTokens.map(a => ({ address: a, status: "pending" }));
    setResults(initialResults);

    let completed = 0;

    for (let i = 0; i < validTokens.length; i += BATCH_SIZE) {
      if (killedRef.current) break;
      const batch = validTokens.slice(i, i + BATCH_SIZE);

      await Promise.allSettled(
        batch.map(async (tokenAddress) => {
          if (killedRef.current) return;
          try {
            const connection = new Connection(RPC_URL);
            const lamports = Math.floor(sol * 1e9);
            const txid = await JupiterTransactionService.swapTokens(
              connection, wallet, SOL_MINT, tokenAddress, lamports, 300, undefined, "high"
            );
            if (!txid) throw new Error("Swap failed");
            setResults(prev => prev.map(r => r.address === tokenAddress ? { ...r, status: "success", message: txid.slice(0, 8) } : r));
          } catch (e: any) {
            setResults(prev => prev.map(r => r.address === tokenAddress ? { ...r, status: "error", message: e.message } : r));
          }
          completed++;
          setProgress((completed / validTokens.length) * 100);
        })
      );
    }

    setIsRunning(false);
    toast({ title: `🎯 Batch Buy Complete`, description: `${completed}/${validTokens.length} tokens processed` });
  }, [parseAddresses, solPerToken, wallet, toast]);

  const executeBatchSell = useCallback(async () => {
    const holdings = portfolio?.tokens || [];
    if (holdings.length === 0) {
      toast({ title: "No holdings to sell", variant: "destructive" });
      return;
    }

    if (!wallet.publicKey || !wallet.signTransaction) {
      toast({ title: "Wallet not connected", variant: "destructive" });
      return;
    }

    killedRef.current = false;
    setIsRunning(true);
    setProgress(0);
    let completed = 0;

    for (let i = 0; i < holdings.length; i += BATCH_SIZE) {
      if (killedRef.current) break;
      const batch = holdings.slice(i, i + BATCH_SIZE);

      await Promise.allSettled(
        batch.map(async (holding) => {
          if (killedRef.current) return;
          try {
            const connection = new Connection(RPC_URL);
            const lamports = Math.floor(holding.amount * Math.pow(10, holding.decimals));
            await JupiterTransactionService.swapTokens(
              connection, wallet, holding.mint, SOL_MINT, lamports, 300, undefined, "high"
            );
          } catch (e) {
            console.error("Batch sell error:", e);
          }
          completed++;
          setProgress((completed / holdings.length) * 100);
        })
      );
    }

    setIsRunning(false);
    toast({ title: "💰 Batch Sell Complete", description: `Sold ${completed} positions` });
  }, [portfolio, wallet, toast]);

  const handleAction = (action: "buy" | "sell") => {
    if (!wallet.publicKey) {
      toast({ title: "Wallet not connected", description: "Connect wallet for live trading", variant: "destructive" });
      return;
    }
    setPendingAction(action);
    setShowConfirm(true);
  };

  const tokens = parseAddresses();
  const totalSol = tokens.length * parseFloat(solPerToken || "0");
  const holdingsCount = portfolio?.tokens?.length || 0;

  return (
    <div className="space-y-4">
      <LiveTradeConfirmDialog
        open={showConfirm}
        onConfirm={() => {
          setShowConfirm(false);
          if (pendingAction === "buy") executeBatchBuy();
          else executeBatchSell();
          setPendingAction(null);
        }}
        onCancel={() => { setShowConfirm(false); setPendingAction(null); }}
        action={pendingAction === "buy" ? "Batch Buy" : "Batch Sell All"}
        tokenSymbol={pendingAction === "buy" ? `${tokens.length} tokens` : `${holdingsCount} holdings`}
        solAmount={totalSol}
      />

      <div className="flex items-center gap-2">
        <Layers className="h-4 w-4 text-primary" />
        <span className="text-sm font-medium text-foreground">Batch Trader</span>
        <Badge variant="outline" className="h-4 px-1.5 text-[8px] border-primary/20 text-primary/80 font-bold uppercase tracking-tighter">
          Jupiter Metis
        </Badge>
        <Badge variant="outline" className="text-[10px]">1-50 tokens</Badge>
      </div>

      <div>
        <Label className="text-xs text-muted-foreground">Token Addresses (one per line or comma-separated)</Label>
        <Textarea
          value={addresses}
          onChange={(e) => setAddresses(e.target.value)}
          placeholder={"So11111111111111111111111111111111111111112\nEPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v"}
          className="bg-muted/30 border-border text-xs font-mono mt-1 min-h-[100px]"
          disabled={isRunning}
        />
        <div className="flex items-center justify-between mt-1">
          <span className="text-[10px] text-muted-foreground">{tokens.length} address{tokens.length !== 1 ? "es" : ""} detected</span>
          {tokens.length > 50 && <span className="text-[10px] text-destructive">Max 50 tokens</span>}
        </div>
      </div>

      <div>
        <Label className="text-xs text-muted-foreground">SOL per token</Label>
        <Input
          type="number"
          value={solPerToken}
          onChange={(e) => setSolPerToken(e.target.value)}
          className="bg-muted/30 border-border text-sm mt-1"
          min="0.001"
          step="0.1"
          disabled={isRunning}
        />
        <span className="text-[10px] text-muted-foreground">Total: {isNaN(totalSol) ? 0 : totalSol.toFixed(4)} SOL</span>
      </div>

      <div className="p-2 rounded-lg bg-destructive/10 border border-destructive/30">
        <p className="text-[11px] text-destructive font-medium">⚠️ LIVE — Real SOL will be spent on each token swap.</p>
      </div>

      {isRunning && (
        <div className="space-y-2">
          <Progress value={progress} className="h-2" />
          <span className="text-[10px] text-muted-foreground">{Math.round(progress)}% complete</span>
        </div>
      )}

      {results.length > 0 && (
        <div className="max-h-32 overflow-y-auto space-y-1 border border-border rounded-lg p-2">
          {results.map((r, i) => (
            <div key={i} className="flex items-center justify-between text-[10px]">
              <span className="font-mono text-muted-foreground truncate max-w-[120px]">{r.address.slice(0, 6)}...{r.address.slice(-4)}</span>
              <span className={r.status === "success" ? "text-accent" : r.status === "error" ? "text-destructive" : "text-muted-foreground"}>
                {r.status === "pending" ? "⏳" : r.status === "success" ? `✅ ${r.message}` : `❌ ${r.message}`}
              </span>
            </div>
          ))}
        </div>
      )}

      <div className="grid grid-cols-2 gap-2">
        <Button
          onClick={() => handleAction("buy")}
          disabled={isRunning || tokens.length === 0 || tokens.length > 50}
          className="text-xs h-8"
          variant="destructive"
        >
          {isRunning ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : <Play className="h-3 w-3 mr-1" />}
          Buy All ({tokens.length})
        </Button>
        <Button
          onClick={() => handleAction("sell")}
          disabled={isRunning || holdingsCount === 0}
          variant="outline"
          className="text-xs h-8"
        >
          <DollarSign className="h-3 w-3 mr-1" />
          Sell All ({holdingsCount})
        </Button>
      </div>
    </div>
  );
};
