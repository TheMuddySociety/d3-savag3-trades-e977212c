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
  AlertCircle,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { PLATFORM_CONFIG } from "@/config/platform";
import { useConnection, useWallet } from "@solana/wallet-adapter-react";
import { PublicKey, Transaction } from "@solana/web3.js";

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
  const [initMint, setInitMint] = useState("");
  const [isInitializing, setIsInitializing] = useState(false);
  const { connection } = useConnection();
  const { publicKey } = useWallet();
  const { toast } = useToast();

  const REFERRAL_PROGRAM_ID = new PublicKey("REFER4ZgYk9G3LyucubvRthSDRY7pY6S77S6N4UckH");

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("referral-earnings");
      if (error) throw error;

      if (data) {
        setReferralData(data);
        if (data.tradeStats) {
          setTradeStats(data.tradeStats);
        }
      }
    } catch (err) {
      console.error("Referral fetch error:", err);
      toast({
        title: "Load Failed",
        description: "Failed to load referral data",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const fmt = (n: number, decimals = 2) =>
    n.toLocaleString(undefined, {
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals,
    });

  return (
    <Card className="border-primary/20 bg-black/40 backdrop-blur-md shadow-2xl overflow-hidden">
      <CardHeader className="flex flex-row items-center justify-between pb-2 border-b border-white/5">
        <CardTitle className="text-base flex items-center gap-2">
          <TrendingUp className="h-4 w-4 text-primary" />
          Platform Referral Earnings
        </CardTitle>
        <div className="flex items-center gap-2">
          <a
            href="https://referral.jup.ag/dashboard"
            target="_blank"
            rel="noopener noreferrer"
          >
            <Button variant="outline" size="sm" className="h-7 px-2 text-[10px] border-primary/20 bg-primary/5 hover:bg-primary/10">
              <ExternalLink className="h-3 w-3 mr-1" />
              Manage
            </Button>
          </a>
          <Button
            variant="outline"
            size="sm"
            className="h-7 px-2 text-[10px] border-primary/20 bg-primary/5 hover:bg-primary/10"
            onClick={fetchData}
            disabled={loading}
          >
            <RefreshCw
              className={`h-3 w-3 mr-1 ${loading ? "animate-spin" : ""}`}
            />
            Refresh
          </Button>
        </div>
      </CardHeader>

      <CardContent className="space-y-6 pt-4">
        {/* Summary cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <SummaryCard
            icon={<BarChart3 className="h-5 w-5 text-primary" />}
            label="Volume"
            loading={loading}
            value={
              tradeStats ? `$${fmt(tradeStats.totalOutputUsd, 0)}` : "$0"
            }
          />
          <SummaryCard
            icon={<Coins className="h-5 w-5 text-accent" />}
            label="Earned"
            loading={loading}
            value={
              tradeStats ? `$${fmt(tradeStats.estimatedFees)}` : "$0.00"
            }
          />
          <SummaryCard
            icon={<TrendingUp className="h-5 w-5 text-chart-green" />}
            label="Trades"
            loading={loading}
            value={tradeStats ? fmt(tradeStats.totalTrades, 0) : "0"}
          />
          <SummaryCard
            icon={<Wallet className="h-5 w-5 text-primary" />}
            label="SOL"
            loading={loading}
            value={
              referralData
                ? `${fmt(referralData.solBalance, 3)}`
                : "0"
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
        <div className="space-y-3">
          <h3 className="text-xs font-semibold text-foreground flex items-center gap-2">
            <Coins className="h-3.5 w-3.5 text-primary" />
            Claimable Token Balances
          </h3>

          {loading ? (
            <div className="space-y-2">
              {[1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-10 w-full rounded-md bg-white/5" />
              ))}
            </div>
          ) : referralData?.tokenBalances.length === 0 ? (
            <div className="text-center py-6 text-muted-foreground text-[10px] border border-dashed border-white/10 rounded-lg">
              No token balances found. Fees will appear here after swaps.
            </div>
          ) : (
            <div className="border rounded-md overflow-hidden border-white/10 bg-black/20">
              <table className="w-full text-[10px]">
                <thead>
                  <tr className="bg-white/5 text-muted-foreground">
                    <th className="text-left p-2 font-medium">Token</th>
                    <th className="text-right p-2 font-medium">Balance</th>
                    <th className="text-right p-2 font-medium">Mint</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {referralData?.tokenBalances.map((token) => (
                    <tr
                      key={token.mint}
                      className="hover:bg-white/5 transition-colors"
                    >
                      <td className="p-2">
                        <div className="flex items-center gap-2">
                          {token.logoURI ? (
                            <img
                              src={token.logoURI}
                              alt={token.symbol}
                              className="w-4 h-4 rounded-full"
                            />
                          ) : (
                            <div className="w-4 h-4 rounded-full bg-white/10" />
                          )}
                          <span className="font-semibold text-foreground">
                            {token.symbol}
                          </span>
                        </div>
                      </td>
                      <td className="p-2 text-right font-mono text-accent">
                        {fmt(token.amount, 4)}
                      </td>
                      <td className="p-2 text-right">
                        <a
                          href={`https://solscan.io/token/${token.mint}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-muted-foreground hover:text-primary flex items-center justify-end gap-1"
                        >
                          {token.mint.slice(0, 4)}…{token.mint.slice(-4)}
                          <ExternalLink className="h-2 w-2" />
                        </a>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Action: Initialize New Token */}
        <div className="border-t border-white/5 pt-4">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-xs font-semibold text-foreground">
              Collect Fees for New Token
            </h3>
            <div className="flex items-center gap-1.5 text-[9px] text-muted-foreground bg-primary/10 px-2 py-0.5 rounded-full border border-primary/20">
              <AlertCircle className="w-2.5 h-2.5" />
              Rent deposit required
            </div>
          </div>
          <div className="flex gap-2">
            <input
              type="text"
              placeholder="Enter Token Mint Address"
              className="flex-1 bg-black/20 border border-white/10 rounded-md px-3 py-1.5 text-[10px] focus:outline-none focus:ring-1 focus:ring-primary/50 text-foreground"
              value={initMint}
              onChange={(e) => setInitMint(e.target.value)}
            />
            <Button 
              size="sm"
              className="h-8 px-3 text-[10px] font-bold bg-primary hover:bg-primary/90"
              onClick={async () => {
                if (!initMint) {
                  toast({ title: "Error", description: "Please enter a mint address", variant: "destructive" });
                  return;
                }
                setIsInitializing(true);
                try {
                  new PublicKey(initMint);
                  window.open(`https://referral.jup.ag/dashboard`, "_blank");
                  toast({ title: "Redirecting", description: "Manage this account on Jupiter Dashboard" });
                } catch (err) {
                  toast({ title: "Invalid Address", description: "Wait! That's not a valid Solana mint.", variant: "destructive" });
                } finally {
                  setIsInitializing(false);
                }
              }}
              disabled={isInitializing}
            >
              {isInitializing ? "..." : "OPEN ACCOUNT"}
            </Button>
          </div>
        </div>

        <div className="flex items-center justify-between text-[9px] text-muted-foreground pt-2">
          <span>Jupiter takes 20% of referral fees automatically</span>
          <a
            href="https://referral.jup.ag/dashboard"
            target="_blank"
            rel="noopener noreferrer"
            className="text-primary hover:underline flex items-center gap-1"
          >
            referral.jup.ag <ExternalLink className="w-2 h-2" />
          </a>
        </div>
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
    <div className="p-3 rounded-xl bg-white/[0.03] border border-white/10 hover:bg-white/[0.06] transition-all duration-300 group">
      <div className="flex items-center gap-2 mb-1.5">
        <div className="p-1 rounded-md bg-white/5 group-hover:bg-primary/10 transition-colors">
          {icon}
        </div>
        <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">{label}</p>
      </div>
      {loading ? (
        <Skeleton className="h-5 w-16 bg-white/5" />
      ) : (
        <p className="text-lg font-bold text-foreground leading-none">{value}</p>
      )}
    </div>
  );
}
