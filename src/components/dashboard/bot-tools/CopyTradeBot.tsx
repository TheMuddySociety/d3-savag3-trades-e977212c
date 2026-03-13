import { useState, useEffect, useRef, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Eye, Play, Square, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { isValidSolanaAddress } from "@/utils/validateSolanaAddress";
import { LiveTradeConfirmDialog } from "./LiveTradeConfirmDialog";
import { JupiterTransactionService } from "@/services/jupiter/transactions";
import { useWallet } from "@solana/wallet-adapter-react";
import { Connection } from "@solana/web3.js";
import { supabase } from "@/integrations/supabase/client";

const SOL_MINT = "So11111111111111111111111111111111111111112";
const RPC_URL = "https://api.mainnet-beta.solana.com";
const POLL_INTERVAL = 10000;

interface CopiedTrade {
  timestamp: string;
  type: "buy" | "sell";
  tokenMint: string;
  solAmount: number;
  status: "success" | "error";
}

interface Props {
  sim: any;
  isLive?: boolean;
  killSignal?: number;
}

export const CopyTradeBot = ({ sim, isLive = false, killSignal = 0 }: Props) => {
  const { toast } = useToast();
  const wallet = useWallet();
  const [targetWallet, setTargetWallet] = useState("");
  const [maxSolPerTrade, setMaxSolPerTrade] = useState("0.5");
  const [autoSell, setAutoSell] = useState(true);
  const [isActive, setIsActive] = useState(false);
  const [copiedTrades, setCopiedTrades] = useState<CopiedTrade[]>([]);
  const [showConfirm, setShowConfirm] = useState(false);
  const pollingRef = useRef<NodeJS.Timeout | null>(null);
  const lastTxRef = useRef<string | null>(null);
  const killedRef = useRef(false);

  useEffect(() => {
    if (killSignal > 0) {
      killedRef.current = true;
      stopCopying();
    }
  }, [killSignal]);

  const stopCopying = useCallback(() => {
    setIsActive(false);
    if (pollingRef.current) {
      clearInterval(pollingRef.current);
      pollingRef.current = null;
    }
  }, []);

  const pollWhaleSwaps = useCallback(async () => {
    if (killedRef.current) { stopCopying(); return; }

    try {
      const { data, error } = await supabase.functions.invoke("copy-trade", {
        body: {
          target_wallet: targetWallet,
          last_tx: lastTxRef.current,
        },
      });

      if (error || !data?.success) return;

      const swaps = data.data?.swaps || [];
      if (swaps.length === 0) return;

      lastTxRef.current = swaps[0]?.signature || lastTxRef.current;

      for (const swap of swaps) {
        if (killedRef.current) break;

        const sol = Math.min(parseFloat(maxSolPerTrade), swap.solAmount || parseFloat(maxSolPerTrade));
        const isBuy = swap.type === "buy";
        const tokenMint = swap.tokenMint;

        if (!tokenMint || !isValidSolanaAddress(tokenMint)) continue;

        // Only process sells if autoSell is on
        if (!isBuy && !autoSell) continue;

        try {
          if (isLive && wallet.publicKey && wallet.signTransaction) {
            const connection = new Connection(RPC_URL);
            if (isBuy) {
              const lamports = Math.floor(sol * 1e9);
              await JupiterTransactionService.swapTokens(connection, wallet, SOL_MINT, tokenMint, lamports, 300, undefined, "high");
            } else {
              // Sell — swap token back to SOL
              const holding = sim.holdings?.find((h: any) => h.token_address === tokenMint);
              if (holding) {
                const lamports = Math.floor(holding.amount * 1e9);
                await JupiterTransactionService.swapTokens(connection, wallet, tokenMint, SOL_MINT, lamports, 300, undefined, "high");
              }
            }
          } else {
            if (isBuy) {
              await sim.simulateBuy(tokenMint, tokenMint.slice(0, 6), sol, "copy");
            } else {
              await sim.simulateSell(tokenMint, tokenMint.slice(0, 6), 100, "copy");
            }
          }

          setCopiedTrades(prev => [{
            timestamp: new Date().toLocaleTimeString(),
            type: (isBuy ? "buy" : "sell") as "buy" | "sell",
            tokenMint,
            solAmount: sol,
            status: "success",
          }, ...prev].slice(0, 50));

          toast({ title: `📋 Copied ${isBuy ? "Buy" : "Sell"}`, description: `${tokenMint.slice(0, 8)}... for ${sol} SOL` });
        } catch (e: any) {
          setCopiedTrades(prev => [{
            timestamp: new Date().toLocaleTimeString(),
            type: isBuy ? "buy" : "sell",
            tokenMint,
            solAmount: sol,
            status: "error",
          }, ...prev].slice(0, 50));
        }
      }
    } catch (e) {
      console.error("Copy trade poll error:", e);
    }
  }, [targetWallet, maxSolPerTrade, autoSell, isLive, wallet, sim, toast, stopCopying]);

  const startCopying = useCallback(() => {
    if (!isValidSolanaAddress(targetWallet)) {
      toast({ title: "Invalid wallet address", variant: "destructive" });
      return;
    }
    killedRef.current = false;
    setIsActive(true);
    lastTxRef.current = null;
    pollWhaleSwaps();
    pollingRef.current = setInterval(pollWhaleSwaps, POLL_INTERVAL);
    toast({ title: "👁️ Copy Trading Started", description: `Monitoring ${targetWallet.slice(0, 8)}...` });
  }, [targetWallet, pollWhaleSwaps, toast]);

  const handleStart = () => {
    if (isLive) {
      setShowConfirm(true);
    } else {
      startCopying();
    }
  };

  useEffect(() => {
    return () => {
      if (pollingRef.current) clearInterval(pollingRef.current);
    };
  }, []);

  return (
    <div className="space-y-4">
      <LiveTradeConfirmDialog
        open={showConfirm}
        onConfirm={() => { setShowConfirm(false); startCopying(); }}
        onCancel={() => setShowConfirm(false)}
        action="Copy Trade Bot"
        tokenSymbol="Whale wallet mirrors"
        solAmount={parseFloat(maxSolPerTrade)}
      />

      <div className="flex items-center gap-2">
        <Eye className="h-4 w-4 text-[hsl(var(--fun-purple))]" />
        <span className="text-sm font-medium text-foreground">Copy Trade (MEV Bot)</span>
        {isActive && (
          <Badge className={`text-[10px] ${isLive ? "bg-destructive/20 text-destructive" : "bg-primary/20 text-primary"}`}>
            {isLive ? "LIVE" : "PAPER"} • Monitoring
          </Badge>
        )}
      </div>

      <div>
        <Label className="text-xs text-muted-foreground">Whale Wallet Address</Label>
        <Input
          value={targetWallet}
          onChange={(e) => setTargetWallet(e.target.value)}
          placeholder="Enter wallet to copy..."
          className="bg-muted/30 border-border text-xs font-mono mt-1"
          disabled={isActive}
        />
      </div>

      <div>
        <Label className="text-xs text-muted-foreground">Max SOL per trade</Label>
        <Input
          type="number"
          value={maxSolPerTrade}
          onChange={(e) => setMaxSolPerTrade(e.target.value)}
          className="bg-muted/30 border-border text-sm mt-1"
          min="0.01"
          step="0.1"
          disabled={isActive}
        />
      </div>

      <div className="flex items-center justify-between p-2 rounded-lg bg-muted/20 border border-border">
        <div>
          <span className="text-xs font-medium text-foreground">Auto-sell when whale sells</span>
          <p className="text-[10px] text-muted-foreground">Mirror sell transactions too</p>
        </div>
        <Switch checked={autoSell} onCheckedChange={setAutoSell} disabled={isActive} />
      </div>

      {isLive && (
        <div className="p-2 rounded-lg bg-destructive/10 border border-destructive/30">
          <p className="text-[11px] text-destructive font-medium">⚠️ LIVE — Will execute real swaps mirroring the whale's trades.</p>
        </div>
      )}

      <Button
        onClick={isActive ? stopCopying : handleStart}
        className="w-full text-xs h-8"
        variant={isActive ? "outline" : isLive ? "destructive" : "default"}
      >
        {isActive ? (
          <><Square className="h-3 w-3 mr-1" /> Stop Copying</>
        ) : (
          <><Play className="h-3 w-3 mr-1" /> Start Copy Trading</>
        )}
      </Button>

      {copiedTrades.length > 0 && (
        <div className="space-y-1">
          <span className="text-xs font-medium text-foreground">Recent Copied Trades</span>
          <div className="max-h-32 overflow-y-auto space-y-1 border border-border rounded-lg p-2">
            {copiedTrades.map((t, i) => (
              <div key={i} className="flex items-center justify-between text-[10px]">
                <span className="text-muted-foreground">{t.timestamp}</span>
                <span className={t.type === "buy" ? "text-accent" : "text-[hsl(var(--fun-yellow))]"}>
                  {t.type.toUpperCase()} {t.tokenMint.slice(0, 6)}...
                </span>
                <span className="font-mono">{t.solAmount} SOL</span>
                <span className={t.status === "success" ? "text-accent" : "text-destructive"}>
                  {t.status === "success" ? "✅" : "❌"}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
