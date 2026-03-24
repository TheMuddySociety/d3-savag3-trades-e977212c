import { useState, useCallback } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Coins,
  Search,
  Loader2,
  CheckCircle2,
  AlertCircle,
  ExternalLink,
} from "lucide-react";
import { useWallet } from "@solana/wallet-adapter-react";
import { useToast } from "@/hooks/use-toast";
import { JupiterStudioService, type FeeInfo, type PoolAddresses } from "@/services/jupiter/studio";
import { cn } from "@/lib/utils";

export function FeeDashboard() {
  const { publicKey, wallet } = useWallet();
  const walletAdapter = wallet?.adapter as any;
  const [mintAddress, setMintAddress] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isClaiming, setIsClaiming] = useState(false);
  const [poolAddresses, setPoolAddresses] = useState<PoolAddresses | null>(null);
  const [feeInfo, setFeeInfo] = useState<FeeInfo | null>(null);
  const [error, setError] = useState<string | null>(null);
  const { toast } = useToast();

  const handleLookup = useCallback(async () => {
    if (!mintAddress.trim()) {
      toast({
        title: "Input Required",
        description: "Enter a token mint address",
        variant: "destructive",
      });
      return;
    }

    setIsLoading(true);
    setError(null);
    setPoolAddresses(null);
    setFeeInfo(null);

    try {
      const pools = await JupiterStudioService.getPoolAddresses(mintAddress.trim());
      if (!pools?.dbcPoolAddress) {
        setError("No Studio pool found for this token.");
        return;
      }
      setPoolAddresses(pools);

      const fees = await JupiterStudioService.checkFees(pools.dbcPoolAddress);
      setFeeInfo(fees);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Lookup failed");
    } finally {
      setIsLoading(false);
    }
  }, [mintAddress, toast]);

  const handleClaim = useCallback(async () => {
    if (!poolAddresses?.dbcPoolAddress || !walletAdapter) return;

    setIsClaiming(true);
    try {
      const signature = await JupiterStudioService.claimFees(
        walletAdapter,
        poolAddresses.dbcPoolAddress,
        feeInfo?.unclaimedFee || 0
      );
      if (signature) {
        toast({
          title: "Claim Successful",
          description: "LP Fees have been sent to your wallet.",
        });
        const fees = await JupiterStudioService.checkFees(poolAddresses.dbcPoolAddress);
        setFeeInfo(fees);
      }
    } catch (e: any) {
      toast({
        title: "Claim Failed",
        description: e.message,
        variant: "destructive",
      });
    } finally {
      setIsClaiming(false);
    }
  }, [poolAddresses, walletAdapter, feeInfo, toast]);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-[10px] text-muted-foreground uppercase tracking-wider font-medium">
          Jupiter Studio Fee Lookup
        </p>
        <Badge variant="outline" className="text-[9px] border-primary/20 bg-primary/5 text-primary">
          LP REWARDS
        </Badge>
      </div>

      {/* Mint lookup */}
      <div className="flex gap-2">
        <div className="flex-1 relative group">
          <Input
            placeholder="Enter token mint address..."
            value={mintAddress}
            onChange={(e) => setMintAddress(e.target.value)}
            className="h-9 text-[10px] font-mono bg-black/40 border-white/10 focus:border-primary/50 transition-all pl-8"
          />
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground group-focus-within:text-primary transition-colors" />
        </div>
        <Button
          size="sm"
          className="h-9 px-4 text-[10px] font-bold gap-2 bg-primary hover:bg-primary/90 shadow-lg shadow-primary/20"
          onClick={handleLookup}
          disabled={isLoading || !mintAddress.trim()}
        >
          {isLoading ? (
            <Loader2 className="h-3 w-3 animate-spin" />
          ) : (
            "LOOKUP"
          )}
        </Button>
      </div>

      {/* Error */}
      {error && (
        <div className="flex items-start gap-2 p-3 rounded-xl bg-destructive/10 border border-destructive/20 text-[10px] text-destructive animate-in fade-in slide-in-from-top-1">
          <AlertCircle className="h-3.5 w-3.5 shrink-0 mt-0.5" />
          <p className="leading-relaxed">{error}</p>
        </div>
      )}

      {/* Pool info */}
      {poolAddresses && (
        <div className="p-4 rounded-xl bg-white/[0.03] border border-white/10 space-y-4 animate-in zoom-in-95 duration-300">
          <div className="flex items-center justify-between border-b border-white/5 pb-3">
            <div className="flex items-center gap-2">
              <div className="p-1.5 rounded-lg bg-accent/10">
                <CheckCircle2 className="h-3.5 w-3.5 text-accent" />
              </div>
              <span className="text-[11px] font-bold">Studio Pool ID</span>
            </div>
            <a
              href={`https://solscan.io/account/${poolAddresses.dbcPoolAddress}`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-[9px] text-muted-foreground hover:text-primary transition-colors flex items-center gap-1 bg-white/5 px-2 py-0.5 rounded-full border border-white/10"
            >
              SOLSCAN <ExternalLink className="h-2.5 w-2.5" />
            </a>
          </div>

          <div className="text-[10px] font-mono p-2 rounded-md bg-black/40 border border-white/5 text-muted-foreground break-all leading-relaxed">
            {poolAddresses.dbcPoolAddress}
          </div>

          {feeInfo && (
            <div className="grid grid-cols-2 gap-3">
              <div className="p-3 rounded-xl bg-black/20 border border-white/5 group hover:border-white/10 transition-colors">
                <p className="text-[9px] text-muted-foreground uppercase tracking-wider font-semibold mb-1">Total Fees</p>
                <div className="flex items-baseline gap-1">
                  <span className="text-sm font-mono font-bold text-foreground">
                    {(feeInfo.totalFee / 1e6).toFixed(2)}
                  </span>
                  <span className="text-[9px] font-bold text-muted-foreground">USDC</span>
                </div>
              </div>
              <div className={cn(
                "p-3 rounded-xl border transition-all duration-300",
                feeInfo.unclaimedFee > 0 
                  ? "bg-accent/10 border-accent/30 shadow-lg shadow-accent/5" 
                  : "bg-black/20 border-white/5"
              )}>
                <p className="text-[9px] text-muted-foreground uppercase tracking-wider font-semibold mb-1">Unclaimed</p>
                <div className="flex items-baseline gap-1">
                  <span className={cn(
                    "text-sm font-mono font-bold",
                    feeInfo.unclaimedFee > 0 ? "text-accent" : "text-muted-foreground"
                  )}>
                    {(feeInfo.unclaimedFee / 1e6).toFixed(2)}
                  </span>
                  <span className="text-[9px] font-bold text-muted-foreground">USDC</span>
                </div>
              </div>
            </div>
          )}

          {feeInfo && feeInfo.unclaimedFee > 0 && (
            <Button
              className="w-full h-10 text-[11px] font-bold gap-2 bg-accent hover:bg-accent/90 pulse-border"
              onClick={handleClaim}
              disabled={isClaiming || !publicKey}
            >
              {isClaiming ? (
                <>
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  CLAIMING REWARDS...
                </>
              ) : (
                <>
                  <Coins className="h-4 w-4" />
                  CLAIM ${(feeInfo.unclaimedFee / 1e6).toFixed(2)} USDC
                </>
              )}
            </Button>
          )}
        </div>
      )}
    </div>
  );
}
