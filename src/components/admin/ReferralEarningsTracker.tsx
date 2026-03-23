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
  const { publicKey, sendTransaction } = useWallet();

  const REFERRAL_PROGRAM_ID = new PublicKey("REFER4ZgYk9G3LyucubvRthSDRY7pY6S77S6N4UckH");

  const getReferralTokenAccount = (mint: PublicKey, referralAccount: PublicKey) => {
    const [address] = PublicKey.findProgramAddressSync(
      [
        Buffer.from("referral_token_account"),
        referralAccount.toBuffer(),
        mint.toBuffer(),
      ],
      REFERRAL_PROGRAM_ID
    );
    return address;
  };

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const earningsRes = await supabase.functions.invoke("referral-earnings");

      if (earningsRes.data) {
        setReferralData(earningsRes.data);
        if (earningsRes.data.tradeStats) {
          setTradeStats(earningsRes.data.tradeStats);
        }
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
            label="Est. Fees Earned (1.0%)"
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
            label="Referral SOL"
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

        {/* Action: Initialize New Token */}
        <div className="border-t border-border pt-6 mt-6">
          <h3 className="text-sm font-semibold text-foreground mb-3">
            Initialize Fee Account for New Token
          </h3>
          <div className="flex flex-col md:flex-row gap-3">
            <input
              type="text"
              placeholder="Enter Token Mint Address"
              className="flex-1 bg-muted/50 border border-border rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary"
              value={initMint}
              onChange={(e) => setInitMint(e.target.value)}
            />
            <Button 
              onClick={async () => {
                if (!initMint) {
                  toast.error("Please enter a mint address");
                  return;
                }
                setIsInitializing(true);
                try {
                  new PublicKey(initMint);
                  // Guide to Jupiter Dashboard for initialization
                  window.open(`https://referral.jup.ag/dashboard`, "_blank");
                  toast.success("Redirecting to Jupiter Dashboard to finalize account initialization.");
                } catch (err) {
                  toast.error("Invalid Mint Address");
                } finally {
                  setIsInitializing(false);
                }
              }}
              disabled={isInitializing}
            >
              {isInitializing ? "Processing..." : "Open Fee Account"}
            </Button>
          </div>
          <p className="text-[10px] text-muted-foreground mt-2">
            Opening an account allows you to collect fees for this specific token. It costs a small amount of SOL for rent.
          </p>
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
