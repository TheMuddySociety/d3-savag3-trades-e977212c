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
import { toast } from "sonner";
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

  const handleLookup = useCallback(async () => {
    if (!mintAddress.trim()) {
      toast.error("Enter a token mint address");
      return;
    }

    setIsLoading(true);
    setError(null);
    setPoolAddresses(null);
    setFeeInfo(null);

    try {
      // 1. Get pool addresses
      const pools = await JupiterStudioService.getPoolAddresses(mintAddress.trim());
      if (!pools?.dbcPoolAddress) {
        setError("No Studio pool found for this token. Only tokens created via Jupiter Studio have claimable LP fees.");
        return;
      }
      setPoolAddresses(pools);

      // 2. Check fees
      const fees = await JupiterStudioService.checkFees(pools.dbcPoolAddress);
      setFeeInfo(fees);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Lookup failed");
    } finally {
      setIsLoading(false);
    }
  }, [mintAddress]);

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
        // Refresh fees after claim
        const fees = await JupiterStudioService.checkFees(poolAddresses.dbcPoolAddress);
        setFeeInfo(fees);
      }
    } finally {
      setIsClaiming(false);
    }
  }, [poolAddresses, walletAdapter, feeInfo]);

  return (
    <div className="space-y-3">
      <p className="text-xs text-muted-foreground">
        Look up LP fees from tokens you created on Jupiter Studio.
      </p>

      {/* Mint lookup */}
      <div className="flex gap-2">
        <div className="flex-1">
          <Input
            placeholder="Enter token mint address..."
            value={mintAddress}
            onChange={(e) => setMintAddress(e.target.value)}
            className="h-8 text-xs font-mono"
          />
        </div>
        <Button
          size="sm"
          className="h-8 px-3 text-xs gap-1"
          onClick={handleLookup}
          disabled={isLoading || !mintAddress.trim()}
        >
          {isLoading ? (
            <Loader2 className="h-3 w-3 animate-spin" />
          ) : (
            <Search className="h-3 w-3" />
          )}
          Lookup
        </Button>
      </div>

      {/* Error */}
      {error && (
        <div className="flex items-start gap-2 p-2.5 rounded-lg bg-destructive/10 border border-destructive/20 text-xs text-destructive">
          <AlertCircle className="h-3.5 w-3.5 shrink-0 mt-0.5" />
          {error}
        </div>
      )}

      {/* Pool info */}
      {poolAddresses && (
        <div className="p-3 rounded-xl bg-muted/20 border border-border space-y-3">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4 text-accent" />
            <span className="text-xs font-medium">Pool Found</span>
            <a
              href={`https://solscan.io/account/${poolAddresses.dbcPoolAddress}`}
              target="_blank"
              rel="noopener noreferrer"
              className="ml-auto text-[10px] text-muted-foreground hover:text-foreground flex items-center gap-0.5"
            >
              Solscan <ExternalLink className="h-2.5 w-2.5" />
            </a>
          </div>

          <div className="text-[10px] font-mono text-muted-foreground break-all">
            Pool: {poolAddresses.dbcPoolAddress}
          </div>

          {feeInfo && (
            <div className="grid grid-cols-2 gap-3">
              <div className="p-2.5 rounded-lg bg-card/50 border border-border/50">
                <p className="text-[10px] text-muted-foreground mb-0.5">Total Fees</p>
                <p className="text-sm font-mono font-bold text-foreground">
                  {(feeInfo.totalFee / 1e6).toFixed(2)}
                  <span className="text-[10px] text-muted-foreground ml-1">USDC</span>
                </p>
              </div>
              <div className="p-2.5 rounded-lg bg-accent/5 border border-accent/20">
                <p className="text-[10px] text-muted-foreground mb-0.5">Unclaimed</p>
                <p className={cn(
                  "text-sm font-mono font-bold",
                  feeInfo.unclaimedFee > 0 ? "text-accent" : "text-muted-foreground"
                )}>
                  {(feeInfo.unclaimedFee / 1e6).toFixed(2)}
                  <span className="text-[10px] text-muted-foreground ml-1">USDC</span>
                </p>
              </div>
            </div>
          )}

          {feeInfo && feeInfo.unclaimedFee > 0 && (
            <Button
              className="w-full h-9 text-xs font-bold gap-2"
              onClick={handleClaim}
              disabled={isClaiming || !publicKey}
            >
              {isClaiming ? (
                <>
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  Claiming...
                </>
              ) : (
                <>
                  <Coins className="h-3.5 w-3.5" />
                  Claim {(feeInfo.unclaimedFee / 1e6).toFixed(2)} USDC
                </>
              )}
            </Button>
          )}
        </div>
      )}
    </div>
  );
}
