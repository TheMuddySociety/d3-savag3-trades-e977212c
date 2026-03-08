import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Clock, Play, Pause } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useWallet } from "@solana/wallet-adapter-react";
import { useConnection } from "@solana/wallet-adapter-react";
import { JupiterTransactionService } from "@/services/jupiter/transactions";
import { LiveTradeConfirmDialog } from "./LiveTradeConfirmDialog";

const SOL_MINT = "So11111111111111111111111111111111111111112";

const INTERVAL_OPTIONS = [
  { value: "5000", label: "Every 5 sec (sim)" },
  { value: "10000", label: "Every 10 sec (sim)" },
  { value: "30000", label: "Every 30 sec (sim)" },
  { value: "60000", label: "Every 1 min" },
];

interface Props {
  sim: any;
  isLive?: boolean;
}

export const DCABot = ({ sim, isLive = false }: Props) => {
  const { toast } = useToast();
  const wallet = useWallet();
  const { connection } = useConnection();
  const [isRunning, setIsRunning] = useState(false);
  const [tokenAddress, setTokenAddress] = useState("");
  const [tokenSymbol, setTokenSymbol] = useState("");
  const [amountPerOrder, setAmountPerOrder] = useState("0.1");
  const [interval, setInterval] = useState("10000");
  const [totalOrders, setTotalOrders] = useState("5");
  const [ordersExecuted, setOrdersExecuted] = useState(0);
  const [useRandomDelay, setUseRandomDelay] = useState(true);
  const [showConfirm, setShowConfirm] = useState(false);
  const dcaInterval = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    return () => { if (dcaInterval.current) clearInterval(dcaInterval.current); };
  }, []);

  const proceedStartDCA = () => {
    setIsRunning(true);
    setOrdersExecuted(0);
    let count = 0;
    const maxOrders = parseInt(totalOrders);
    const baseInterval = parseInt(interval);

    const executeDCAOrder = async () => {
      if (count >= maxOrders) {
        stopDCA();
        toast({ title: "DCA Complete ✅", description: `Executed ${maxOrders} orders for ${tokenSymbol || 'token'}` });
        return;
      }

      if (isLive) {
        const lamports = Math.round(parseFloat(amountPerOrder) * 1e9);
        const txid = await JupiterTransactionService.swapTokens(connection, wallet, SOL_MINT, tokenAddress, lamports, 300);
        if (txid) { count++; setOrdersExecuted(count); }
        else { stopDCA(); }
      } else {
        const result = await sim.simulateBuy(tokenAddress, tokenSymbol || tokenAddress.slice(0, 6), parseFloat(amountPerOrder), 'dca');
        if (result) { count++; setOrdersExecuted(count); }
        else { stopDCA(); }
      }
    };

    executeDCAOrder();
    dcaInterval.current = window.setInterval(() => {
      const delay = useRandomDelay ? Math.random() * 2000 : 0;
      window.setTimeout(executeDCAOrder, delay);
    }, baseInterval) as unknown as NodeJS.Timeout;
  };

  const startDCA = () => {
    if (!tokenAddress) {
      toast({ title: "Missing token", description: "Enter a token address to DCA into", variant: "destructive" });
      return;
    }
    if (isLive && !wallet.publicKey) {
      toast({ title: "Wallet not connected", description: "Connect wallet for live trading", variant: "destructive" });
      return;
    }
    if (isLive) {
      setShowConfirm(true);
    } else {
      proceedStartDCA();
    }
  };

  const stopDCA = () => {
    setIsRunning(false);
    if (dcaInterval.current) { clearInterval(dcaInterval.current); dcaInterval.current = null; }
  };

  const handleToggle = () => {
    if (isRunning) { stopDCA(); toast({ title: "DCA Paused", description: `Paused after ${ordersExecuted} orders` }); }
    else { startDCA(); }
  };

  const totalSol = parseFloat(amountPerOrder) * parseInt(totalOrders || "0");

  return (
    <div className="space-y-4">
      <LiveTradeConfirmDialog
        open={showConfirm}
        onConfirm={() => { setShowConfirm(false); proceedStartDCA(); }}
        onCancel={() => setShowConfirm(false)}
        action="DCA Buy"
        tokenSymbol={tokenSymbol || tokenAddress.slice(0, 8)}
        solAmount={totalSol}
      />

      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Clock className="h-4 w-4 text-accent" />
          <span className="text-sm font-medium text-foreground">DCA Bot</span>
        </div>
        {isRunning && (
          <Badge className={`${isLive ? "bg-destructive/20 text-destructive border-destructive/30" : "bg-accent/20 text-accent border-accent/30"} animate-pulse`}>
            {ordersExecuted}/{totalOrders}
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
        <div className="grid grid-cols-2 gap-2">
          <div>
            <Label className="text-xs text-muted-foreground">Amount per buy (SOL)</Label>
            <Input type="number" value={amountPerOrder} onChange={(e) => setAmountPerOrder(e.target.value)} className="bg-muted/30 border-border text-sm" disabled={isRunning} min="0.001" step="0.01" />
          </div>
          <div>
            <Label className="text-xs text-muted-foreground">Interval</Label>
            <Select value={interval} onValueChange={setInterval} disabled={isRunning}>
              <SelectTrigger className="bg-muted/30 border-border text-sm"><SelectValue /></SelectTrigger>
              <SelectContent>
                {INTERVAL_OPTIONS.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <div>
            <Label className="text-xs text-muted-foreground">Total Orders</Label>
            <Input type="number" value={totalOrders} onChange={(e) => setTotalOrders(e.target.value)} className="bg-muted/30 border-border text-sm" disabled={isRunning} min="1" />
          </div>
          <div className="flex items-end pb-1">
            <div className="flex items-center gap-2">
              <Switch checked={useRandomDelay} onCheckedChange={setUseRandomDelay} disabled={isRunning} />
              <Label className="text-xs text-muted-foreground">Random delay</Label>
            </div>
          </div>
        </div>

        <div className="p-2 rounded-lg bg-muted/20 border border-border">
          <div className="flex justify-between text-xs">
            <span className="text-muted-foreground">Total budget</span>
            <span className="text-foreground font-mono">{totalSol.toFixed(3)} SOL</span>
          </div>
          <div className="flex justify-between text-xs mt-1">
            <span className="text-muted-foreground">Progress</span>
            <span className="text-foreground font-mono">{ordersExecuted}/{totalOrders} orders</span>
          </div>
        </div>

        {isLive && (
          <div className="p-2 rounded-lg bg-destructive/10 border border-destructive/30">
            <p className="text-[11px] text-destructive font-medium">⚠️ LIVE MODE — Real SOL will be spent. Transactions are irreversible.</p>
          </div>
        )}

        <Button
          onClick={handleToggle}
          disabled={sim.isLoading}
          className={`w-full ${isRunning ? 'bg-destructive hover:bg-destructive/90' : isLive ? 'bg-destructive hover:bg-destructive/90' : 'bg-accent hover:bg-accent/90'} text-accent-foreground`}
          size="sm"
        >
          {sim.isLoading ? (
            <><div className="animate-spin rounded-full h-3 w-3 border-b-2 border-current mr-2" /> Processing...</>
          ) : isRunning ? (
            <><Pause className="h-4 w-4 mr-2" /> Stop DCA</>
          ) : (
            <><Play className="h-4 w-4 mr-2" /> Start DCA {isLive ? "(LIVE)" : "(Paper)"}</>
          )}
        </Button>
      </div>
    </div>
  );
};
