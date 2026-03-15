import { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  RefreshCw,
  TrendingUp,
  Coins,
  Wallet,
  ExternalLink,
  BarChart3,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface TokenBalance {
  mint: string;
  amount: number;
  symbol: string;
  name: string;
  logoURI: string | null;
}

interface ReferralData {
  referralWallet: string;
  solBalance: number;
  tokenBalances: TokenBalance[];
  totalTokenAccounts: number;
}

interface TradeStats {
  totalTrades: number;
  totalInputUsd: number;
  totalOutputUsd: number;
  estimatedFees: number;
}

export function ReferralEarningsTracker() {
  const [referralData, setReferralData] = useState<ReferralData | null>(null);
  const [tradeStats, setTradeStats] = useState<TradeStats | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      // Fetch referral wallet balances and trade stats in parallel
      const [earningsRes, tradesRes] = await Promise.all([
        supabase.functions.invoke("referral-earnings"),
        supabase.from("live_trades").select("input_usd_value, output_usd_value"),
      ]);

      if (earningsRes.data) {
        setReferralData(earningsRes.data);
      }

      if (tradesRes.data) {
        const trades = tradesRes.data;
        const totalInputUsd = trades.reduce(
          (s, t) => s + (t.input_usd_value || 0),
          0
        );
        const totalOutputUsd = trades.reduce(
          (s, t) => s + (t.output_usd_value || 0),
          0
        );
        setTradeStats({
          totalTrades: trades.length,
          totalInputUsd,
          totalOutputUsd,
          estimatedFees: totalOutputUsd * 0.005, // 0.5% referral fee
        });
      }
    } catch (err) {
      toast.error("Failed to load referral data");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const fmt = (n: number, decimals = 2) =>
    n.toLocaleString(undefined, {
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals,
    });

  return (
    <Card className="border-primary/20 bg-card">
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="text-xl flex items-center gap-2">
          <TrendingUp className="h-5 w-5 text-primary" />
          Jupiter Referral Earnings
        </CardTitle>
        <div className="flex items-center gap-2">
          <a
            href="https://referral.jup.ag/dashboard"
            target="_blank"
            rel="noopener noreferrer"
          >
            <Button variant="outline" size="sm">
              <ExternalLink className="h-4 w-4 mr-1" />
              Jup Dashboard
            </Button>
          </a>
          <Button
            variant="outline"
            size="sm"
            onClick={fetchData}
            disabled={loading}
          >
            <RefreshCw
              className={`h-4 w-4 mr-1 ${loading ? "animate-spin" : ""}`}
            />
            Refresh
          </Button>
        </div>
      </CardHeader>

      <CardContent className="space-y-6">
        {/* Summary cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <SummaryCard
            icon={<BarChart3 className="h-8 w-8 text-primary" />}
            label="Total Swap Volume"
            loading={loading}
            value={
              tradeStats ? `$${fmt(tradeStats.totalOutputUsd)}` : "$0.00"
            }
          />
          <SummaryCard
            icon={<Coins className="h-8 w-8 text-accent" />}
            label="Est. Fees Earned (0.5%)"
            loading={loading}
            value={
              tradeStats ? `$${fmt(tradeStats.estimatedFees)}` : "$0.00"
            }
          />
          <SummaryCard
            icon={<TrendingUp className="h-8 w-8 text-chart-green" />}
            label="Total Trades"
            loading={loading}
            value={tradeStats ? fmt(tradeStats.totalTrades, 0) : "0"}
          />
          <SummaryCard
            icon={<Wallet className="h-8 w-8 text-primary" />}
            label="Wallet SOL Balance"
            loading={loading}
            value={
              referralData
                ? `${fmt(referralData.solBalance, 4)} SOL`
                : "0 SOL"
            }
          />
        </div>

        {/* Referral wallet info */}
        {referralData && (
          <div className="text-xs text-muted-foreground flex items-center gap-2">
            <span>Referral Wallet:</span>
            <code className="bg-muted px-2 py-0.5 rounded font-mono">
              {referralData.referralWallet}
            </code>
            <a
              href={`https://solscan.io/account/${referralData.referralWallet}`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-primary hover:underline"
            >
              <ExternalLink className="h-3 w-3 inline" />
            </a>
          </div>
        )}

        {/* Token balances (claimable fees) */}
        <div>
          <h3 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
            <Coins className="h-4 w-4 text-primary" />
            Claimable Token Balances
          </h3>

          {loading ? (
            <div className="space-y-2">
              {[1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-12 w-full rounded-md" />
              ))}
            </div>
          ) : referralData?.tokenBalances.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground text-sm">
              No token balances found. Fees will appear here after swaps
              are made through the platform.
            </div>
          ) : (
            <div className="border rounded-md overflow-hidden border-border">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-muted/50">
                    <th className="text-left p-3 text-muted-foreground">
                      Token
                    </th>
                    <th className="text-right p-3 text-muted-foreground">
                      Balance
                    </th>
                    <th className="text-right p-3 text-muted-foreground">
                      Mint
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {referralData?.tokenBalances.map((token) => (
                    <tr
                      key={token.mint}
                      className="border-t border-border hover:bg-muted/30"
                    >
                      <td className="p-3">
                        <div className="flex items-center gap-2">
                          {token.logoURI ? (
                            <img
                              src={token.logoURI}
                              alt={token.symbol}
                              className="w-5 h-5 rounded-full"
                            />
                          ) : (
                            <div className="w-5 h-5 rounded-full bg-muted" />
                          )}
                          <span className="font-medium text-foreground">
                            {token.symbol}
                          </span>
                          <span className="text-muted-foreground text-xs hidden md:inline">
                            {token.name}
                          </span>
                        </div>
                      </td>
                      <td className="p-3 text-right font-mono text-foreground">
                        {fmt(token.amount, 6)}
                      </td>
                      <td className="p-3 text-right">
                        <a
                          href={`https://solscan.io/token/${token.mint}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-xs font-mono text-muted-foreground hover:text-primary"
                        >
                          {token.mint.slice(0, 4)}…{token.mint.slice(-4)}
                          <ExternalLink className="h-3 w-3 inline ml-1" />
                        </a>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <p className="text-xs text-muted-foreground">
          Jupiter takes 20% of referral fees. Claim your earnings at{" "}
          <a
            href="https://referral.jup.ag/dashboard"
            target="_blank"
            rel="noopener noreferrer"
            className="text-primary hover:underline"
          >
            referral.jup.ag
          </a>
          .
        </p>
      </CardContent>
    </Card>
  );
}

function SummaryCard({
  icon,
  label,
  value,
  loading,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  loading: boolean;
}) {
  return (
    <Card className="bg-muted/50 border-border">
      <CardContent className="p-4 flex items-center gap-3">
        {icon}
        <div>
          <p className="text-sm text-muted-foreground">{label}</p>
          {loading ? (
            <Skeleton className="h-7 w-20 mt-1" />
          ) : (
            <p className="text-2xl font-bold text-foreground">{value}</p>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
