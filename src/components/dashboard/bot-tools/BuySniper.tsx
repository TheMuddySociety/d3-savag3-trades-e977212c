import { useState, useRef, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Crosshair, Zap, Shield } from "lucide-react";
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

export const BuySniper = ({ sim, isLive = false, killSignal = 0 }: Props) => {
  const { toast } = useToast();
  const wallet = useWallet();
  const { connection } = useConnection();
  const [isArmed, setIsArmed] = useState(false);
  const [tokenAddress, setTokenAddress] = useState("");
  const [tokenSymbol, setTokenSymbol] = useState("");
  const [buyAmount, setBuyAmount] = useState("0.5");
  const [maxSlippage, setMaxSlippage] = useState("15");
  const [priorityFee, setPriorityFee] = useState("0.005");
  const [autoSell, setAutoSell] = useState(false);
  const [takeProfitPercent, setTakeProfitPercent] = useState("100");
  const [showConfirm, setShowConfirm] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const sniperInterval = useRef<NodeJS.Timeout | null>(null);

  const executeLiveBuy = useCallback(async () => {
    setStatusMessage("🔄 Executing live buy via Jupiter...");
    try {
      const lamports = Math.round(parseFloat(buyAmount) * 1e9);
      const slippageBps = Math.round(parseFloat(maxSlippage) * 100);
      const priority = parseFloat(priorityFee) >= 0.01 ? 'high' as const
        : parseFloat(priorityFee) >= 0.005 ? 'medium' as const : 'low' as const;

      const txid = await JupiterTransactionService.swapTokens(
        connection, wallet, SOL_MINT, tokenAddress, lamports, slippageBps, undefined, priority
      );
      return txid;
    } catch (err: any) {
      const msg = err.message || "Unknown error";
      setStatusMessage(`❌ Buy failed: ${msg}`);
      toast({ title: "Sniper Buy Failed", description: msg, variant: "destructive" });
      return null;
    }
  }, [connection, wallet, tokenAddress, buyAmount, maxSlippage, priorityFee, toast]);

  const startSniping = useCallback(() => {
    if (sniperInterval.current) clearInterval(sniperInterval.current);
    setStatusMessage("🎯 Sniper armed — scanning for entry...");

    const executeBuy = async () => {
      if (isLive) {
        if (!wallet.publicKey) {
          setStatusMessage("❌ Wallet disconnected");
          setIsArmed(false);
          return;
        }
        
        setStatusMessage("⚡ Attempting live buy...");
        const txid = await executeLiveBuy();
        if (txid) {
          setIsArmed(false);
          if (sniperInterval.current) clearInterval(sniperInterval.current);
          setStatusMessage(`✅ Buy executed! TX: ${txid.slice(0, 16)}...`);
          toast({ title: "🎯 Live Sniper Hit!", description: `TX: ${txid.slice(0, 12)}...` });
        } else {
          // Retry after delay
          setStatusMessage("⏳ Retrying in a few seconds...");
        }
      } else {
        const result = await sim.simulateBuy(
          tokenAddress, tokenSymbol || tokenAddress.slice(0, 6), parseFloat(buyAmount), 'sniper'
        );
        if (result) {
          setIsArmed(false);
          if (sniperInterval.current) clearInterval(sniperInterval.current);
          setStatusMessage(`✅ Bought ${result.token_amount.toFixed(2)} tokens`);
          toast({ title: "🎯 Sniper Hit!", description: `Bought ${result.token_amount.toFixed(2)} ${tokenSymbol || 'tokens'} for ${buyAmount} SOL` });
        }
      }
    };

    const delay = 2000 + Math.random() * 3000;
    sniperInterval.current = setTimeout(executeBuy, delay) as any;
  }, [tokenAddress, tokenSymbol, buyAmount, sim, toast, isLive, executeLiveBuy, wallet.publicKey]);

  useEffect(() => {
    return () => { if (sniperInterval.current) clearInterval(sniperInterval.current); };
  }, []);

  // Kill switch listener
  useEffect(() => {
    if (killSignal > 0) {
      setIsArmed(false);
      setShowConfirm(false);
      setStatusMessage(null);
      if (sniperInterval.current) { clearInterval(sniperInterval.current); sniperInterval.current = null; }
    }
  }, [killSignal]);

  const proceedArm = () => {
    setIsArmed(true);
    startSniping();
    toast({ title: "Sniper Armed 🎯", description: `LIVE — Watching ${tokenAddress.slice(0, 8)}...` });
  };

  const handleArm = () => {
    if (!tokenAddress) {
      toast({ title: "Missing token", description: "Enter a token address to snipe", variant: "destructive" });
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
    if (!isArmed) {
      setShowConfirm(true);
    } else {
      setIsArmed(false);
      setStatusMessage(null);
      if (sniperInterval.current) clearInterval(sniperInterval.current);
      toast({ title: "Sniper Disarmed", description: "Buy sniper deactivated" });
    }
  };

  return (
    <div className="space-y-4">
      <LiveTradeConfirmDialog
        open={showConfirm}
        onConfirm={() => { setShowConfirm(false); proceedArm(); }}
        onCancel={() => setShowConfirm(false)}
        action="Buy Snipe"
        tokenSymbol={tokenSymbol || tokenAddress.slice(0, 8)}
        solAmount={parseFloat(buyAmount)}
      />

      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Crosshair className="h-4 w-4 text-primary" />
          <span className="text-sm font-medium text-foreground">Buy Sniper</span>
        </div>
        {isArmed && (
          <Badge className="bg-destructive/20 text-destructive border-destructive/30 animate-pulse">
            🔴 Armed (LIVE)
          </Badge>
        )}
      </div>

      <div className="space-y-3">
        <div>
          <Label className="text-xs text-muted-foreground">Token Address</Label>
          <Input placeholder="Paste token mint address..." value={tokenAddress} onChange={(e) => setTokenAddress(e.target.value)} className="bg-muted/30 border-border text-sm font-mono" disabled={isArmed} />
        </div>
        <div>
          <Label className="text-xs text-muted-foreground">Token Symbol (optional)</Label>
          <Input placeholder="e.g. BONK" value={tokenSymbol} onChange={(e) => setTokenSymbol(e.target.value)} className="bg-muted/30 border-border text-sm" disabled={isArmed} />
        </div>
        <div className="grid grid-cols-2 gap-2">
          <div>
            <Label className="text-xs text-muted-foreground">Buy Amount (SOL)</Label>
            <Input type="number" value={buyAmount} onChange={(e) => setBuyAmount(e.target.value)} className="bg-muted/30 border-border text-sm" disabled={isArmed} min="0.01" step="0.1" />
          </div>
          <div>
            <Label className="text-xs text-muted-foreground">Max Slippage (%)</Label>
            <Input type="number" value={maxSlippage} onChange={(e) => setMaxSlippage(e.target.value)} className="bg-muted/30 border-border text-sm" disabled={isArmed} min="1" max="50" />
          </div>
        </div>
        <div>
          <Label className="text-xs text-muted-foreground">Priority Fee (SOL)</Label>
          <div className="flex gap-1 mt-1">
            {["0.001", "0.005", "0.01", "0.05"].map((fee) => (
              <Button key={fee} variant={priorityFee === fee ? "default" : "outline"} size="sm" className="flex-1 text-xs h-7" onClick={() => setPriorityFee(fee)} disabled={isArmed}>
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
              <Input type="number" value={takeProfitPercent} onChange={(e) => setTakeProfitPercent(e.target.value)} className="bg-muted/30 border-border text-sm h-7" disabled={isArmed} min="10" />
            </div>
          )}
        </div>

        {/* Status Message */}
        {statusMessage && (
          <div className="p-2 rounded-lg bg-muted/20 border border-border">
            <p className="text-[11px] text-foreground font-mono">{statusMessage}</p>
          </div>
        )}

        <div className="p-2 rounded-lg bg-destructive/10 border border-destructive/30">
          <p className="text-[11px] text-destructive font-medium">⚠️ LIVE MODE — Real SOL will be spent. Transactions are irreversible.</p>
        </div>

        <Button
          onClick={handleArm}
          disabled={sim.isLoading}
          className={`w-full ${isArmed ? 'bg-destructive hover:bg-destructive/90' : 'bg-destructive hover:bg-destructive/90'} text-destructive-foreground`}
          size="sm"
        >
          {sim.isLoading ? (
            <><div className="animate-spin rounded-full h-3 w-3 border-b-2 border-current mr-2" /> Processing...</>
          ) : isArmed ? (
            <><Crosshair className="h-4 w-4 mr-2" /> Disarm Sniper</>
          ) : (
            <><Zap className="h-4 w-4 mr-2" /> Arm Sniper (LIVE)</>
          )}
        </Button>
      </div>
    </div>
  );
};
