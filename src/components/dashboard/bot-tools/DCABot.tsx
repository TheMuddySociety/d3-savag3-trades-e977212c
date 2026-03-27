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
import { isValidSolanaAddress } from "@/utils/validateSolanaAddress";
import { getCustomApiSettings } from "@/utils/getCustomApiSettings";

const SOL_MINT = "So11111111111111111111111111111111111111112";

const INTERVAL_OPTIONS = [
  { value: "10000", label: "Every 10 sec" },
  { value: "30000", label: "Every 30 sec" },
  { value: "60000", label: "Every 1 min" },
  { value: "300000", label: "Every 5 min" },
];

interface Props {
  killSignal?: number;
}

export const DCABot = ({ killSignal = 0 }: Props) => {
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
  const [isLoading, setIsLoading] = useState(false);
  const dcaInterval = useRef<NodeJS.Timeout | null>(null);
  const countRef = useRef(0);
  const isExecutingRef = useRef(false);

  useEffect(() => {
    return () => { if (dcaInterval.current) clearInterval(dcaInterval.current); };
  }, []);

  useEffect(() => {
    if (killSignal > 0) {
      setIsRunning(false);
      setShowConfirm(false);
      if (dcaInterval.current) { clearInterval(dcaInterval.current); dcaInterval.current = null; }
    }
  }, [killSignal]);

  const stopDCA = () => {
    setIsRunning(false);
    if (dcaInterval.current) { clearInterval(dcaInterval.current); dcaInterval.current = null; }
  };

  const proceedStartDCA = () => {
    setIsRunning(true);
    setOrdersExecuted(0);
    countRef.current = 0;
    const maxOrders = parseInt(totalOrders);
    const baseInterval = parseInt(interval);

    const executeDCAOrder = async () => {
      if (isExecutingRef.current) return;
      if (countRef.current >= maxOrders) {
        stopDCA();
        toast({ title: "DCA Complete ✅", description: `Executed ${maxOrders} orders for ${tokenSymbol || 'token'}` });
        return;
      }

      isExecutingRef.current = true;

      try {
        const lamports = Math.round(parseFloat(amountPerOrder) * 1e9);
        const settings = getCustomApiSettings();
        const slippageBps = Math.max(1, Math.floor(settings.slippage * 100));
        let txid = await JupiterTransactionService.swapTokens(connection, wallet, SOL_MINT, tokenAddress, lamports, slippageBps);
        
        if (!txid) {
          await new Promise(r => setTimeout(r, 3000));
          txid = await JupiterTransactionService.swapTokens(connection, wallet, SOL_MINT, tokenAddress, lamports, slippageBps);
        }
        
        if (txid) {
          countRef.current++;
          setOrdersExecuted(countRef.current);
        } else {
          stopDCA();
          toast({ title: "DCA Stopped", description: "Live trade failed after retry", variant: "destructive" });
        }
      } finally {
        isExecutingRef.current = false;
      }
    };

    executeDCAOrder();
    dcaInterval.current = setInterval(() => {
      const delay = useRandomDelay ? Math.random() * 2000 : 0;
      setTimeout(executeDCAOrder, delay);
    }, baseInterval);
  };

  const startDCA = () => {
    if (!tokenAddress) {
      toast({ title: "Missing token", description: "Enter a token address to DCA into", variant: "destructive" });
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
          <Badge variant="outline" className="h-4 px-1.5 text-[8px] border-primary/20 text-primary/80 font-bold uppercase tracking-tighter">
            Jupiter Metis
          </Badge>
        </div>
        {isRunning && (
          <Badge className="bg-destructive/20 text-destructive border-destructive/30 animate-pulse">
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
            <><Pause className="h-4 w-4 mr-2" /> Stop DCA</>
          ) : (
            <><Play className="h-4 w-4 mr-2" /> Start DCA (LIVE)</>
          )}
        </Button>
      </div>
    </div>
  );
};
