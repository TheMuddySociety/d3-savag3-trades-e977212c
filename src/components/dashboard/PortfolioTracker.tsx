import { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Briefcase, TrendingUp, TrendingDown, RefreshCw, Wallet, PieChart } from "lucide-react";
import { useWallet } from "@solana/wallet-adapter-react";
import { useSimTrading } from "@/hooks/useSimTrading";
import { useTradingMode } from "@/hooks/useTradingMode";

export const PortfolioTracker = () => {
  const { publicKey } = useWallet();
  const walletAddress = publicKey?.toBase58() || null;
  const { wallet, holdings, totalValue, isLoading, refreshPortfolio } = useSimTrading(walletAddress);
  const { isLive } = useTradingMode();
  const [isRefreshing, setIsRefreshing] = useState(false);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await refreshPortfolio();
    setTimeout(() => setIsRefreshing(false), 500);
  };

  const totalInvested = holdings.reduce((sum, h) => sum + h.total_invested, 0);
  const totalPnlSol = wallet ? (wallet.sol_balance - 10 + totalInvested) : 0;
  const totalPnlPercent = totalInvested > 0 ? ((totalValue - totalInvested) / totalInvested) * 100 : 0;
  const portfolioValue = (wallet?.sol_balance || 0) + totalValue;

  if (!walletAddress) {
    return (
      <Card className="w-full">
        <CardHeader className="pb-2">
          <div className="flex items-center gap-2">
            <Briefcase className="h-5 w-5 text-primary" />
            <CardTitle className="text-sm">Portfolio Tracker</CardTitle>
          </div>
        </CardHeader>
        <CardContent>
          <p className="text-xs text-muted-foreground text-center py-4">Connect wallet to view portfolio</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="w-full">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Briefcase className="h-5 w-5 text-primary" />
            <CardTitle className="text-sm">Portfolio Tracker</CardTitle>
            <Badge
              variant="outline"
              className={`text-[10px] ${isLive
                ? "bg-destructive/20 text-destructive border-destructive/30"
                : "bg-[hsl(var(--fun-yellow))]/20 text-[hsl(var(--fun-yellow))] border-[hsl(var(--fun-yellow))]/30"
              }`}
            >
              {isLive ? "LIVE" : "PAPER"}
            </Badge>
          </div>
          <Button
            variant="ghost"
            size="sm"
            className="h-6 w-6 p-0"
            onClick={handleRefresh}
            disabled={isRefreshing}
          >
            <RefreshCw className={`h-3 w-3 ${isRefreshing ? "animate-spin" : ""}`} />
          </Button>
        </div>
      </CardHeader>

      <CardContent className="space-y-3 pt-0">
        {/* Portfolio Summary */}
        <div className="grid grid-cols-2 gap-2">
          <div className="p-2.5 rounded-lg bg-muted/20 border border-border">
            <div className="flex items-center gap-1.5 mb-1">
              <Wallet className="h-3 w-3 text-muted-foreground" />
              <span className="text-[10px] text-muted-foreground">Total Value</span>
            </div>
            <p className="text-sm font-mono font-bold text-foreground">
              {portfolioValue.toFixed(4)} <span className="text-xs text-muted-foreground">SOL</span>
            </p>
          </div>
          <div className="p-2.5 rounded-lg bg-muted/20 border border-border">
            <div className="flex items-center gap-1.5 mb-1">
              <PieChart className="h-3 w-3 text-muted-foreground" />
              <span className="text-[10px] text-muted-foreground">Total P&L</span>
            </div>
            <div className="flex items-center gap-1">
              {totalPnlSol >= 0 ? (
                <TrendingUp className="h-3 w-3 text-accent" />
              ) : (
                <TrendingDown className="h-3 w-3 text-destructive" />
              )}
              <p className={`text-sm font-mono font-bold ${totalPnlSol >= 0 ? "text-accent" : "text-destructive"}`}>
                {totalPnlSol >= 0 ? "+" : ""}{totalPnlSol.toFixed(4)}
              </p>
            </div>
          </div>
        </div>

        {/* SOL Balance */}
        {wallet && (
          <div className="flex items-center justify-between p-2 rounded-lg bg-primary/5 border border-primary/20">
            <div className="flex items-center gap-2">
              <div className="w-5 h-5 rounded-full bg-primary/20 flex items-center justify-center text-[10px]">◎</div>
              <div>
                <span className="text-xs font-medium text-foreground">SOL</span>
                <p className="text-[10px] text-muted-foreground">Solana</p>
              </div>
            </div>
            <div className="text-right">
              <p className="text-xs font-mono font-medium text-foreground">{wallet.sol_balance.toFixed(4)}</p>
              <p className="text-[10px] text-muted-foreground">Available</p>
            </div>
          </div>
        )}

        {/* Token Holdings */}
        {holdings.length > 0 ? (
          <div className="space-y-1.5">
            <span className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">Token Holdings</span>
            {holdings.map((h, i) => {
              const pnl = h.pnl_percent || 0;
              const currentVal = h.current_value || h.total_invested;
              const pnlSol = currentVal - h.total_invested;

              return (
                <div
                  key={h.id || i}
                  className="flex items-center justify-between p-2 rounded-lg bg-muted/20 border border-border hover:bg-muted/30 transition-colors"
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <div className="w-5 h-5 rounded-full bg-accent/20 flex items-center justify-center text-[10px] shrink-0">
                      {(h.token_symbol || "?")[0]}
                    </div>
                    <div className="min-w-0">
                      <span className="text-xs font-medium text-foreground block truncate">
                        {h.token_symbol || h.token_address?.slice(0, 6)}
                      </span>
                      <p className="text-[10px] text-muted-foreground font-mono">
                        {h.amount.toLocaleString(undefined, { maximumFractionDigits: 2 })} tokens
                      </p>
                    </div>
                  </div>
                  <div className="text-right shrink-0 ml-2">
                    <p className="text-xs font-mono text-foreground">{h.total_invested.toFixed(4)} SOL</p>
                    <div className="flex items-center justify-end gap-0.5">
                      {pnl >= 0 ? (
                        <TrendingUp className="h-2.5 w-2.5 text-accent" />
                      ) : (
                        <TrendingDown className="h-2.5 w-2.5 text-destructive" />
                      )}
                      <span className={`text-[10px] font-mono font-medium ${pnl >= 0 ? "text-accent" : "text-destructive"}`}>
                        {pnl >= 0 ? "+" : ""}{pnl.toFixed(1)}%
                      </span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="text-center py-4">
            <p className="text-xs text-muted-foreground">No token holdings yet</p>
            <p className="text-[10px] text-muted-foreground mt-1">Use the bot tools to start trading</p>
          </div>
        )}

        {/* Stats Footer */}
        {holdings.length > 0 && (
          <div className="grid grid-cols-3 gap-2 pt-1 border-t border-border">
            <div className="text-center">
              <p className="text-[10px] text-muted-foreground">Tokens</p>
              <p className="text-xs font-mono font-medium text-foreground">{holdings.length}</p>
            </div>
            <div className="text-center">
              <p className="text-[10px] text-muted-foreground">Invested</p>
              <p className="text-xs font-mono font-medium text-foreground">{totalInvested.toFixed(3)}</p>
            </div>
            <div className="text-center">
              <p className="text-[10px] text-muted-foreground">Win Rate</p>
              <p className="text-xs font-mono font-medium text-accent">
                {holdings.length > 0
                  ? ((holdings.filter(h => (h.pnl_percent || 0) > 0).length / holdings.length) * 100).toFixed(0)
                  : 0}%
              </p>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
};
