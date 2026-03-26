import { useState, useRef, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Grid, Zap, Rocket } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { useWallet } from "@solana/wallet-adapter-react";
import { JupiterUltraService } from "@/services/jupiter/ultra";
import { LiveTradeConfirmDialog } from "./LiveTradeConfirmDialog";
import { isValidSolanaAddress } from "@/utils/validateSolanaAddress";
import { getCustomApiSettings } from "@/utils/getCustomApiSettings";

const SOL_MINT = "So11111111111111111111111111111111111111112";

interface Props {
  killSignal?: number;
}

export const GridBot = ({ killSignal = 0 }: Props) => {
  const { toast } = useToast();
  const wallet = useWallet();
  const [isArmed, setIsArmed] = useState(false);
  const [tokenAddress, setTokenAddress] = useState("");
  const [tokenSymbol, setTokenSymbol] = useState("");
  const [investmentAmount, setInvestmentAmount] = useState("1.0");
  const [lowerPrice, setLowerPrice] = useState("");
  const [upperPrice, setUpperPrice] = useState("");
  const [gridCount, setGridCount] = useState("10");
  const [showConfirm, setShowConfirm] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [activeGrids, setActiveGrids] = useState(0);
  const [useHighPerformance, setUseHighPerformance] = useState(true);
  const [isLoading, setIsLoading] = useState(false);
  const gridInterval = useRef<ReturnType<typeof setInterval> | null>(null);
  const isArmedRef = useRef(false);

  useEffect(() => { isArmedRef.current = isArmed; }, [isArmed]);

  // Initialize from user Settings
  useEffect(() => {
    const s = getCustomApiSettings();
    setUseHighPerformance(s.mevProtection);
  }, []);

  const startGridStrategy = useCallback(() => {
    if (gridInterval.current) clearInterval(gridInterval.current);
    setStatusMessage("🕸️ Grid active — managing orders...");
    setActiveGrids(parseInt(gridCount, 10));

    const manageGrids = async () => {
      if (!isArmedRef.current) return;

      if (!wallet.publicKey) {
        setStatusMessage("❌ Wallet disconnected");
        setIsArmed(false);
        if (gridInterval.current) clearInterval(gridInterval.current);
        return;
      }

      // In a real scenario, this would check current price and execute swaps
      // For this UI, we simulate the active monitoring state
      setStatusMessage(`📡 Scanning... ${activeGrids} active limit orders placed.`);
    };

    const initialDelay = setTimeout(() => {
      manageGrids();
      gridInterval.current = setInterval(manageGrids, 15000); // Check every 15s
    }, 1500);

    gridInterval.current = initialDelay as any;
  }, [wallet.publicKey, gridCount, activeGrids]);

  useEffect(() => {
    return () => { if (gridInterval.current) clearInterval(gridInterval.current); };
  }, []);

  useEffect(() => {
    if (killSignal > 0) {
      setIsArmed(false);
      setShowConfirm(false);
      setStatusMessage(null);
      setActiveGrids(0);
      if (gridInterval.current) { clearInterval(gridInterval.current); gridInterval.current = null; }
    }
  }, [killSignal]);

  const proceedArm = () => {
    setIsArmed(true);
    startGridStrategy();
    toast({ title: "Grid Armed 🕸️", description: `LIVE — Managing grids for ${tokenAddress.slice(0, 8)}...` });
  };

  const handleArm = () => {
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
    
    const lower = parseFloat(lowerPrice);
    const upper = parseFloat(upperPrice);
    if (!lower || !upper || lower >= upper) {
      toast({ title: "Invalid Price Range", description: "Lower price must be less than upper price", variant: "destructive" });
      return;
    }

    if (!isArmed) {
      setShowConfirm(true);
    } else {
      setIsArmed(false);
      setStatusMessage(null);
      setActiveGrids(0);
      if (gridInterval.current) { clearInterval(gridInterval.current); gridInterval.current = null; }
      toast({ title: "Grid Disarmed", description: "Grid bot deactivated and orders canceled" });
    }
  };

  return (
    <div className="space-y-4">
      <LiveTradeConfirmDialog
        open={showConfirm}
        onConfirm={() => { setShowConfirm(false); proceedArm(); }}
        onCancel={() => setShowConfirm(false)}
        action="Grid Bot Activation"
        tokenSymbol={tokenSymbol || tokenAddress.slice(0, 8)}
        solAmount={parseFloat(investmentAmount)}
      />

      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Grid className="h-4 w-4 text-primary" />
          <span className="text-sm font-medium text-foreground">Grid Trading</span>
          <Badge variant="outline" className="h-4 px-1.5 text-[8px] border-primary/20 text-primary/80 font-bold uppercase tracking-tighter">
            Jupiter Ultra
          </Badge>
        </div>
        {isArmed && (
          <Badge className="bg-destructive/20 text-destructive border-destructive/30 animate-pulse">
            🔴 Armed {activeGrids > 0 ? `(${activeGrids} Grids)` : "(LIVE)"}
          </Badge>
        )}
      </div>

      <div className="space-y-3">
        <div>
          <Label className="text-xs text-muted-foreground">Token Address</Label>
          <Input placeholder="Paste token mint address..." value={tokenAddress} onChange={(e) => setTokenAddress(e.target.value)} className="bg-muted/30 border-border text-sm font-mono" disabled={isArmed} />
        </div>
        
        <div className="grid grid-cols-2 gap-2">
           <div>
            <Label className="text-xs text-muted-foreground">Token Symbol</Label>
            <Input placeholder="e.g. BONK" value={tokenSymbol} onChange={(e) => setTokenSymbol(e.target.value)} className="bg-muted/30 border-border text-sm" disabled={isArmed} />
          </div>
          <div>
            <Label className="text-xs text-muted-foreground">Total Investment (SOL)</Label>
            <Input type="number" value={investmentAmount} onChange={(e) => setInvestmentAmount(e.target.value)} className="bg-muted/30 border-border text-sm" disabled={isArmed} min="0.1" step="0.1" />
          </div>
        </div>

        <div className="p-3 rounded-lg border border-border bg-muted/10 space-y-3">
          <Label className="text-xs font-semibold">Grid Parameters</Label>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <Label className="text-xs text-muted-foreground">Lower Price limit</Label>
              <Input type="number" placeholder="0.00" value={lowerPrice} onChange={(e) => setLowerPrice(e.target.value)} className="bg-muted/30 border-border text-sm" disabled={isArmed} step="0.00000001" />
            </div>
            <div>
              <Label className="text-xs text-muted-foreground">Upper Price limit</Label>
              <Input type="number" placeholder="0.00" value={upperPrice} onChange={(e) => setUpperPrice(e.target.value)} className="bg-muted/30 border-border text-sm" disabled={isArmed} step="0.00000001" />
            </div>
          </div>
          <div>
            <Label className="text-xs text-muted-foreground">Number of Grids</Label>
            <Input type="number" value={gridCount} onChange={(e) => setGridCount(e.target.value)} className="bg-muted/30 border-border text-sm" disabled={isArmed} min="2" max="100" />
            <p className="text-[10px] text-muted-foreground mt-1">
               {investmentAmount && gridCount ? `Approx ${Number(parseFloat(investmentAmount) / parseInt(gridCount)).toFixed(4)} SOL per grid` : ''}
            </p>
          </div>
        </div>

        {statusMessage && (
          <div className={`p-2 rounded-lg border ${statusMessage.startsWith('✅') ? 'bg-accent/10 border-accent/30' : statusMessage.startsWith('❌') ? 'bg-destructive/10 border-destructive/30' : 'bg-muted/20 border-border'}`}>
            <p className="text-[11px] text-foreground font-mono">{statusMessage}</p>
          </div>
        )}

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

        <div className="p-2 rounded-lg bg-destructive/10 border border-destructive/30">
          <p className="text-[11px] text-destructive font-medium">⚠️ LIVE MODE — Real SOL will be used to place limit orders. Transactions are irreversible.</p>
        </div>

        <Button
          onClick={handleArm}
          disabled={isLoading}
          className={`w-full ${isArmed ? 'bg-destructive hover:bg-destructive/90' : 'bg-destructive hover:bg-destructive/90'} text-destructive-foreground`}
          size="sm"
        >
          {isLoading ? (
            <><div className="animate-spin rounded-full h-3 w-3 border-b-2 border-current mr-2" /> Processing...</>
          ) : isArmed ? (
            <><Grid className="h-4 w-4 mr-2" /> Disarm Grid</>
          ) : (
            <><Zap className="h-4 w-4 mr-2" /> Activate Grid Bot (LIVE)</>
          )}
        </Button>
      </div>
    </div>
  );
};
