import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Briefcase, RefreshCw, Wallet, DollarSign, Coins, ExternalLink } from "lucide-react";
import { useWallet } from "@solana/wallet-adapter-react";
import { useWalletPortfolio } from "@/hooks/useWalletPortfolio";
import { cn } from "@/lib/utils";
import { Skeleton } from "@/components/ui/skeleton";

const formatUsd = (v: number) => {
  if (v >= 1e6) return `$${(v / 1e6).toFixed(2)}M`;
  if (v >= 1e3) return `$${(v / 1e3).toFixed(2)}K`;
  if (v >= 1) return `$${v.toFixed(2)}`;
  if (v > 0) return `$${v.toFixed(4)}`;
  return "$0.00";
};

const formatAmount = (v: number) => {
  if (v >= 1e9) return `${(v / 1e9).toFixed(2)}B`;
  if (v >= 1e6) return `${(v / 1e6).toFixed(2)}M`;
  if (v >= 1e3) return `${(v / 1e3).toFixed(1)}K`;
  if (v >= 1) return v.toFixed(2);
  return v.toFixed(6);
};

export const PortfolioTracker = () => {
  const { publicKey } = useWallet();
  const walletAddress = publicKey?.toBase58() || null;
  const { portfolio, isLoading, error, refresh } = useWalletPortfolio(walletAddress);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await refresh();
    setTimeout(() => setIsRefreshing(false), 500);
  };

  if (!walletAddress) {
    return (
      <Card className="w-full">
        <CardHeader className="pb-2">
          <div className="flex items-center gap-2">
            <Briefcase className="h-5 w-5 text-primary" />
            <CardTitle className="text-sm">Portfolio</CardTitle>
          </div>
        </CardHeader>
        <CardContent>
          <p className="text-xs text-muted-foreground text-center py-4">Connect wallet to view holdings</p>
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
            <CardTitle className="text-sm">Portfolio</CardTitle>
            <Badge variant="outline" className="text-[10px] bg-accent/20 text-accent border-accent/30">
              LIVE
            </Badge>
          </div>
          <Button
            variant="ghost"
            size="sm"
            className="h-6 w-6 p-0"
            onClick={handleRefresh}
            disabled={isRefreshing || isLoading}
          >
            <RefreshCw className={cn("h-3 w-3", (isRefreshing || isLoading) && "animate-spin")} />
          </Button>
        </div>
      </CardHeader>

      <CardContent className="space-y-3 pt-0">
        {isLoading && !portfolio ? (
          <div className="space-y-2">
            <Skeleton className="h-16 w-full" />
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
          </div>
        ) : error && !portfolio ? (
          <div className="text-center py-4">
            <p className="text-xs text-destructive">{error}</p>
            <Button variant="ghost" size="sm" className="mt-2 text-xs" onClick={handleRefresh}>
              Retry
            </Button>
          </div>
        ) : portfolio ? (
          <>
            {/* Total Portfolio Value */}
            <div className="p-3 rounded-lg bg-primary/5 border border-primary/20">
              <div className="flex items-center gap-1.5 mb-1">
                <DollarSign className="h-3 w-3 text-primary" />
                <span className="text-[10px] text-muted-foreground uppercase tracking-wider">Total Portfolio</span>
              </div>
              <p className="text-xl font-mono font-bold text-foreground">
                {formatUsd(portfolio.totalPortfolioUsd)}
              </p>
              <div className="flex items-center gap-3 mt-1 text-[10px] text-muted-foreground">
                <span>{portfolio.tokenCount} tokens</span>
                <span>·</span>
                <span>{portfolio.solBalance.toFixed(4)} SOL</span>
              </div>
            </div>

            {/* SOL Balance */}
            <div className="flex items-center justify-between p-2.5 rounded-lg bg-muted/20 border border-border">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-full bg-gradient-to-br from-[#9945FF] to-[#14F195] flex items-center justify-center text-xs font-bold text-white">
                  ◎
                </div>
                <div>
                  <span className="text-xs font-medium text-foreground">SOL</span>
                  <p className="text-[10px] text-muted-foreground">Solana</p>
                </div>
              </div>
              <div className="text-right">
                <p className="text-xs font-mono font-medium text-foreground">
                  {portfolio.solBalance.toFixed(4)}
                </p>
                <p className="text-[10px] text-muted-foreground font-mono">
                  {formatUsd(portfolio.solValueUsd)}
                </p>
              </div>
            </div>

            {/* Token Holdings */}
            {portfolio.tokens.length > 0 ? (
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">
                    Token Holdings
                  </span>
                  <span className="text-[10px] text-muted-foreground">
                    {formatUsd(portfolio.totalTokenValueUsd)}
                  </span>
                </div>
                <div className="space-y-1 max-h-[300px] overflow-y-auto hide-scrollbar">
                  {portfolio.tokens.map((token) => (
                    <div
                      key={token.mint}
                      className="flex items-center justify-between p-2 rounded-lg bg-muted/20 border border-border hover:bg-muted/30 transition-colors group"
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <div className="w-7 h-7 rounded-full overflow-hidden bg-muted shrink-0">
                          {token.logoUrl ? (
                            <img
                              src={token.logoUrl}
                              alt={token.symbol}
                              className="w-full h-full object-cover"
                              onError={(e) => {
                                e.currentTarget.style.display = 'none';
                              }}
                            />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center text-[10px] font-bold text-muted-foreground">
                              {token.symbol[0]}
                            </div>
                          )}
                        </div>
                        <div className="min-w-0">
                          <div className="flex items-center gap-1">
                            <span className="text-xs font-medium text-foreground truncate">
                              {token.symbol}
                            </span>
                            <a
                              href={`https://solscan.io/token/${token.mint}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              onClick={(e) => e.stopPropagation()}
                              className="opacity-0 group-hover:opacity-100 transition-opacity"
                            >
                              <ExternalLink className="h-2.5 w-2.5 text-muted-foreground" />
                            </a>
                          </div>
                          <p className="text-[10px] text-muted-foreground font-mono">
                            {formatAmount(token.amount)}
                          </p>
                        </div>
                      </div>
                      <div className="text-right shrink-0 ml-2">
                        <p className="text-xs font-mono text-foreground">
                          {formatUsd(token.value)}
                        </p>
                        <p className="text-[10px] text-muted-foreground font-mono">
                          @{token.price >= 0.01 ? `$${token.price.toFixed(4)}` : `$${token.price.toExponential(2)}`}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="text-center py-3">
                <Coins className="h-6 w-6 text-muted-foreground mx-auto mb-1" />
                <p className="text-xs text-muted-foreground">No token holdings found</p>
              </div>
            )}

            {/* Wallet address footer */}
            <div className="flex items-center justify-between pt-1 border-t border-border">
              <div className="flex items-center gap-1.5">
                <Wallet className="h-3 w-3 text-muted-foreground" />
                <span className="text-[10px] font-mono text-muted-foreground">
                  {walletAddress.slice(0, 4)}…{walletAddress.slice(-4)}
                </span>
              </div>
              <a
                href={`https://solscan.io/account/${walletAddress}`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-[10px] text-primary hover:underline flex items-center gap-0.5"
              >
                Solscan <ExternalLink className="h-2.5 w-2.5" />
              </a>
            </div>
          </>
        ) : null}
      </CardContent>
    </Card>
  );
};
