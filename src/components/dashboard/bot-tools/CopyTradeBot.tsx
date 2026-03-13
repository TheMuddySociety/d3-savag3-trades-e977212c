import { useState, useEffect, useRef, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Eye, Play, Square, Wifi, WifiOff } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { isValidSolanaAddress } from "@/utils/validateSolanaAddress";
import { LiveTradeConfirmDialog } from "./LiveTradeConfirmDialog";
import { JupiterTransactionService } from "@/services/jupiter/transactions";
import { useWallet } from "@solana/wallet-adapter-react";
import { Connection } from "@solana/web3.js";
import { supabase } from "@/integrations/supabase/client";

const SOL_MINT = "So11111111111111111111111111111111111111112";
const RPC_URL = "https://api.mainnet-beta.solana.com";

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
  const walletAddress = wallet.publicKey?.toBase58() || "";
  const [targetWallet, setTargetWallet] = useState("");
  const [maxSolPerTrade, setMaxSolPerTrade] = useState("0.5");
  const [autoSell, setAutoSell] = useState(true);
  const [isActive, setIsActive] = useState(false);
  const [isConnected, setIsConnected] = useState(false);
  const [copiedTrades, setCopiedTrades] = useState<CopiedTrade[]>([]);
  const [showConfirm, setShowConfirm] = useState(false);
  const webhookIdRef = useRef<string | null>(null);
  const channelRef = useRef<any>(null);
  const killedRef = useRef(false);

  useEffect(() => {
    if (killSignal > 0) {
      killedRef.current = true;
      stopCopying();
    }
  }, [killSignal]);

  // Process incoming realtime events
  const processSwapEvent = useCallback(async (event: any) => {
    if (killedRef.current) return;

    const { swap_type, token_mint, sol_amount, id } = event;
    const sol = Math.min(parseFloat(maxSolPerTrade), sol_amount || parseFloat(maxSolPerTrade));
    const isBuy = swap_type === "buy";

    if (!token_mint || !isValidSolanaAddress(token_mint)) return;
    if (!isBuy && !autoSell) return;

    try {
      if (isLive && wallet.publicKey && wallet.signTransaction) {
        const connection = new Connection(RPC_URL);
        if (isBuy) {
          const lamports = Math.floor(sol * 1e9);
          await JupiterTransactionService.swapTokens(connection, wallet, SOL_MINT, token_mint, lamports, 300, undefined, "high");
        } else {
          const holding = sim.holdings?.find((h: any) => h.token_address === token_mint);
          if (holding) {
            const lamports = Math.floor(holding.amount * 1e9);
            await JupiterTransactionService.swapTokens(connection, wallet, token_mint, SOL_MINT, lamports, 300, undefined, "high");
          }
        }
      } else {
        if (isBuy) {
          await sim.simulateBuy(token_mint, token_mint.slice(0, 6), sol, "copy");
        } else {
          await sim.simulateSell(token_mint, token_mint.slice(0, 6), 100, "copy");
        }
      }

      setCopiedTrades(prev => [{
        timestamp: new Date().toLocaleTimeString(),
        type: (isBuy ? "buy" : "sell") as "buy" | "sell",
        tokenMint: token_mint,
        solAmount: sol,
        status: "success" as const,
      }, ...prev].slice(0, 50));

      toast({ title: `📋 Copied ${isBuy ? "Buy" : "Sell"}`, description: `${token_mint.slice(0, 8)}... for ${sol} SOL` });
    } catch (e: any) {
      setCopiedTrades(prev => [{
        timestamp: new Date().toLocaleTimeString(),
        type: (isBuy ? "buy" : "sell") as "buy" | "sell",
        tokenMint: token_mint,
        solAmount: sol,
        status: "error" as const,
      }, ...prev].slice(0, 50));
    }

    // Mark event as processed
    await supabase
      .from('copy_trade_events')
      .update({ processed: true } as any)
      .eq('id', id);
  }, [maxSolPerTrade, autoSell, isLive, wallet, sim, toast]);

  const startCopying = useCallback(async () => {
    if (!isValidSolanaAddress(targetWallet)) {
      toast({ title: "Invalid wallet address", variant: "destructive" });
      return;
    }
    if (!walletAddress) {
      toast({ title: "Connect wallet first", variant: "destructive" });
      return;
    }

    killedRef.current = false;
    setIsActive(true);

    try {
      // 1. Save/update config in DB
      const { data: existing } = await supabase
        .from('copy_trade_configs')
        .select('id')
        .eq('wallet_address', walletAddress)
        .eq('target_wallet', targetWallet)
        .maybeSingle();

      if (existing) {
        await supabase
          .from('copy_trade_configs')
          .update({
            is_active: true,
            max_sol_per_trade: parseFloat(maxSolPerTrade),
            auto_sell: autoSell,
            updated_at: new Date().toISOString(),
          })
          .eq('id', existing.id);
      } else {
        await supabase
          .from('copy_trade_configs')
          .insert({
            wallet_address: walletAddress,
            target_wallet: targetWallet,
            max_sol_per_trade: parseFloat(maxSolPerTrade),
            auto_sell: autoSell,
            is_active: true,
          });
      }

      // 2. Register Helius webhook
      const { data, error } = await supabase.functions.invoke("copy-trade", {
        body: {
          action: "register_webhook",
          target_wallet: targetWallet,
          webhook_id_existing: webhookIdRef.current,
        },
      });

      if (error || !data?.success) {
        console.error("Webhook registration failed:", error || data);
        toast({ title: "Webhook setup failed — falling back to polling", variant: "destructive" });
      } else {
        webhookIdRef.current = data.data?.webhookId || null;
      }

      // 3. Subscribe to realtime events
      const channel = supabase
        .channel(`copy-trade-${walletAddress}`)
        .on(
          'postgres_changes',
          {
            event: 'INSERT',
            schema: 'public',
            table: 'copy_trade_events',
            filter: `wallet_address=eq.${walletAddress}`,
          },
          (payload) => {
            if (payload.new && !killedRef.current) {
              processSwapEvent(payload.new);
            }
          }
        )
        .subscribe((status) => {
          setIsConnected(status === 'SUBSCRIBED');
          console.log(`[CopyTrade] Realtime status: ${status}`);
        });

      channelRef.current = channel;

      toast({
        title: "🔌 WebSocket Connected",
        description: `Real-time monitoring ${targetWallet.slice(0, 8)}... via Helius webhook`,
      });
    } catch (e) {
      console.error("Start copy trading error:", e);
      toast({ title: "Failed to start", variant: "destructive" });
      setIsActive(false);
    }
  }, [targetWallet, walletAddress, maxSolPerTrade, autoSell, processSwapEvent, toast]);

  const stopCopying = useCallback(async () => {
    setIsActive(false);
    setIsConnected(false);

    // Unsubscribe from realtime
    if (channelRef.current) {
      supabase.removeChannel(channelRef.current);
      channelRef.current = null;
    }

    // Delete Helius webhook
    if (webhookIdRef.current) {
      try {
        await supabase.functions.invoke("copy-trade", {
          body: { action: "delete_webhook", webhook_id: webhookIdRef.current },
        });
      } catch (e) {
        console.error("Webhook cleanup error:", e);
      }
      webhookIdRef.current = null;
    }

    // Deactivate config
    if (walletAddress && targetWallet) {
      await supabase
        .from('copy_trade_configs')
        .update({ is_active: false, updated_at: new Date().toISOString() })
        .eq('wallet_address', walletAddress)
        .eq('target_wallet', targetWallet);
    }
  }, [walletAddress, targetWallet]);

  const handleStart = () => {
    if (isLive) {
      setShowConfirm(true);
    } else {
      startCopying();
    }
  };

  useEffect(() => {
    return () => {
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
      }
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
        <span className="text-sm font-medium text-foreground">Copy Trade (WebSocket)</span>
        {isActive && (
          <Badge className={`text-[10px] gap-1 ${isLive ? "bg-destructive/20 text-destructive" : "bg-primary/20 text-primary"}`}>
            {isConnected ? <Wifi className="h-2.5 w-2.5" /> : <WifiOff className="h-2.5 w-2.5" />}
            {isLive ? "LIVE" : "PAPER"} • {isConnected ? "Connected" : "Connecting..."}
          </Badge>
        )}
      </div>

      {isActive && (
        <div className={`flex items-center gap-2 p-2 rounded-lg border ${isConnected ? "bg-accent/10 border-accent/30" : "bg-muted/20 border-border"}`}>
          <div className={`h-2 w-2 rounded-full ${isConnected ? "bg-accent animate-pulse" : "bg-muted-foreground"}`} />
          <span className="text-[10px] text-muted-foreground">
            {isConnected ? "Real-time WebSocket active — instant swap detection" : "Establishing connection..."}
          </span>
        </div>
      )}

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
