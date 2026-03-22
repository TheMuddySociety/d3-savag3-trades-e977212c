import { useState, useRef, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Crosshair, Zap, Shield, Rocket, OctagonX, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useWallet } from "@solana/wallet-adapter-react";
import { JupiterUltraService } from "@/services/jupiter/ultra";
import { cn } from "@/lib/utils";
import { LiveTradeConfirmDialog } from "./LiveTradeConfirmDialog";
import { isValidSolanaAddress } from "@/utils/validateSolanaAddress";

const SOL_MINT = "So11111111111111111111111111111111111111112";

interface Props {
  killSignal?: number;
}

export const BuySniper = ({ killSignal = 0 }: Props) => {
  const { toast } = useToast();
  const wallet = useWallet();
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
  const [retryCount, setRetryCount] = useState(0);
  const [useHighPerformance, setUseHighPerformance] = useState(true);
  const [isLoading, setIsLoading] = useState(false);
  const sniperInterval = useRef<ReturnType<typeof setInterval> | null>(null);
  const isArmedRef = useRef(false);

  useEffect(() => { isArmedRef.current = isArmed; }, [isArmed]);

  const executeLiveBuy = useCallback(async (): Promise<string | null> => {
    if (!wallet.publicKey || !wallet.signTransaction) {
      setStatusMessage("❌ Wallet not connected or can't sign");
      return null;
    }

    setStatusMessage("🔄 Getting swap quote via Jupiter Ultra...");
    try {
      const lamports = Math.round(parseFloat(buyAmount) * 1e9);
      const result = await JupiterUltraService.swap(
        wallet, SOL_MINT, tokenAddress, String(lamports), 'ExactIn', useHighPerformance
      );

      if (result?.status === 'Success' && result.signature) {
        return result.signature;
      }

      const errorMsg = result?.error || 'Swap returned no success';
      setStatusMessage(`❌ ${errorMsg}`);
      return null;
    } catch (err: any) {
      setStatusMessage(`❌ Buy failed: ${err.message || "Unknown error"}`);
      return null;
    }
  }, [wallet, tokenAddress, buyAmount]);

  const startSniping = useCallback(() => {
    if (sniperInterval.current) clearInterval(sniperInterval.current);
    setStatusMessage("🎯 Sniper armed — scanning for entry...");
    setRetryCount(0);

    let attempts = 0;
    const MAX_RETRIES = 5;

    const executeBuy = async () => {
      if (!isArmedRef.current) return;

      if (!wallet.publicKey) {
        setStatusMessage("❌ Wallet disconnected");
        setIsArmed(false);
        if (sniperInterval.current) clearInterval(sniperInterval.current);
        return;
      }

      attempts++;
      setRetryCount(attempts);
      setStatusMessage(`⚡ Attempt ${attempts}/${MAX_RETRIES} — executing buy...`);

      const txid = await executeLiveBuy();
      if (txid) {
        setIsArmed(false);
        if (sniperInterval.current) { clearInterval(sniperInterval.current); sniperInterval.current = null; }
        setStatusMessage(`✅ Buy executed! TX: ${txid.slice(0, 16)}...`);
        toast({ title: "🎯 Live Sniper Hit!", description: `TX: ${txid.slice(0, 12)}...` });
        return;
      }

      if (attempts >= MAX_RETRIES) {
        setIsArmed(false);
        if (sniperInterval.current) { clearInterval(sniperInterval.current); sniperInterval.current = null; }
        setStatusMessage(`❌ Failed after ${MAX_RETRIES} attempts. Check wallet balance & token address.`);
        toast({ title: "Sniper Failed", description: `Could not execute after ${MAX_RETRIES} retries`, variant: "destructive" });
      }
    };

    const initialDelay = setTimeout(() => {
      executeBuy();
      sniperInterval.current = setInterval(executeBuy, 5000);
    }, 1500);

    sniperInterval.current = initialDelay as any;
  }, [tokenAddress, tokenSymbol, buyAmount, toast, executeLiveBuy, wallet.publicKey]);

  useEffect(() => {
    return () => { if (sniperInterval.current) clearInterval(sniperInterval.current); };
  }, []);

  useEffect(() => {
    if (killSignal > 0) {
      setIsArmed(false);
      setShowConfirm(false);
      setStatusMessage(null);
      setRetryCount(0);
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
      setRetryCount(0);
      if (sniperInterval.current) { clearInterval(sniperInterval.current); sniperInterval.current = null; }
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
            🔴 Armed {retryCount > 0 ? `(${retryCount}/5)` : "(LIVE)"}
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
            disabled={isArmed}
          />
        </div>

        {!useHighPerformance && (
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
        )}
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

        {statusMessage && (
          <div className={`p-2 rounded-lg border ${statusMessage.startsWith('✅') ? 'bg-accent/10 border-accent/30' : statusMessage.startsWith('❌') ? 'bg-destructive/10 border-destructive/30' : 'bg-muted/20 border-border'}`}>
            <p className="text-[11px] text-foreground font-mono">{statusMessage}</p>
          </div>
        )}

        <div className="p-2 rounded-lg bg-destructive/10 border border-destructive/30">
          <p className="text-[11px] text-destructive font-medium">⚠️ LIVE MODE — Real SOL will be spent. Transactions are irreversible.</p>
        </div>

        <Button
          onClick={handleArm}
          disabled={isLoading}
          variant="glass"
          className={cn(
            "w-full text-xs font-bold gap-2 h-9 rounded-lg transition-all duration-300",
            isArmed ? "border-destructive/40 text-destructive bg-destructive/10" : "border-accent/40 text-accent bg-accent/5 hover:bg-accent/10"
          )}
        >
          {isLoading ? (
            <><Loader2 className="h-3.5 w-3.5 animate-spin mr-2" /> Processing...</>
          ) : isArmed ? (
            <><OctagonX className="h-3.5 w-3.5 mr-1" /> Disarm Sniper</>
          ) : (
            <><Zap className="h-3.5 w-3.5 mr-1" /> Arm Sniper (LIVE)</>
          )}
        </Button>
      </div>
    </div>
  );
};
