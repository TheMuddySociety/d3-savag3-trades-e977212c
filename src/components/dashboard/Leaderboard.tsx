import { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Trophy, TrendingUp, TrendingDown, RefreshCw, Medal, Target, BarChart3 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useWallet } from "@solana/wallet-adapter-react";
import { formatDistanceToNow } from "date-fns";

interface LeaderboardEntry {
  wallet_address: string;
  display_address: string;
  sol_balance: number;
  pnl_sol: number;
  pnl_percent: number;
  avg_trade_pnl: number;
  total_trades: number;
  win_rate: number;
  bot_types: string[];
  joined: string;
}

const RANK_STYLES = [
  { bg: "bg-[hsl(var(--fun-yellow))]/10", border: "border-[hsl(var(--fun-yellow))]/40", icon: "🥇" },
  { bg: "bg-muted/20", border: "border-muted-foreground/30", icon: "🥈" },
  { bg: "bg-[hsl(var(--fun-yellow))]/5", border: "border-[hsl(var(--fun-yellow))]/20", icon: "🥉" },
];

const BOT_TYPE_LABELS: Record<string, string> = {
  sniper: "🎯",
  dca: "⏰",
  volume: "📊",
  auto: "🧠",
  manual: "✋",
};

export const Leaderboard = () => {
  const { publicKey } = useWallet();
  const myAddress = publicKey?.toBase58() || null;
  const [entries, setEntries] = useState<LeaderboardEntry[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  const fetchLeaderboard = useCallback(async () => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("sim-trading", {
        body: { action: "leaderboard", limit: 20 },
      });
      if (!error && data?.success) {
        setEntries(data.data);
        setLastUpdated(new Date());
      }
    } catch (err) {
      console.error("Leaderboard fetch error:", err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchLeaderboard();
    const interval = setInterval(fetchLeaderboard, 30000);
    return () => clearInterval(interval);
  }, [fetchLeaderboard]);

  const myRank = myAddress
    ? entries.findIndex((e) => e.wallet_address === myAddress) + 1
    : 0;

  return (
    <Card className="w-full">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Trophy className="h-5 w-5 text-[hsl(var(--fun-yellow))]" />
            <CardTitle className="text-sm">Global Trading Leaderboard</CardTitle>
          </div>
          <Button
            variant="ghost"
            size="sm"
            className="h-6 w-6 p-0"
            onClick={fetchLeaderboard}
            disabled={isLoading}
          >
            <RefreshCw className={`h-3 w-3 ${isLoading ? "animate-spin" : ""}`} />
          </Button>
        </div>
        <div className="flex items-center gap-2 mt-1">
          {myRank > 0 && (
            <Badge variant="outline" className="text-[10px] bg-primary/10 text-primary border-primary/30">
              Your rank: #{myRank}
            </Badge>
          )}
          {lastUpdated && (
            <span className="text-[10px] text-muted-foreground">
              Updated {formatDistanceToNow(lastUpdated, { addSuffix: true })}
            </span>
          )}
        </div>
      </CardHeader>

      <CardContent className="pt-0">
        {entries.length === 0 ? (
          <div className="text-center py-6 text-sm text-muted-foreground">
            {isLoading ? (
              <div className="flex items-center justify-center gap-2">
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-primary" />
                Loading...
              </div>
            ) : (
              <>
                <Trophy className="h-8 w-8 mx-auto mb-2 text-muted-foreground/40" />
                <p>No traders yet. Be the first!</p>
                <p className="text-xs mt-1">Start paper trading to appear here</p>
              </>
            )}
          </div>
        ) : (
          <div className="space-y-1.5">
            {entries.map((entry, index) => {
              const isMe = entry.wallet_address === myAddress;
              const rankStyle = index < 3 ? RANK_STYLES[index] : null;

              return (
                <div
                  key={entry.wallet_address}
                  className={`flex items-center gap-2 p-2.5 rounded-lg border transition-all ${
                    isMe
                      ? "bg-primary/10 border-primary/40 ring-1 ring-primary/20"
                      : rankStyle
                      ? `${rankStyle.bg} ${rankStyle.border}`
                      : "bg-muted/10 border-border"
                  }`}
                >
                  {/* Rank */}
                  <div className="w-7 text-center shrink-0">
                    {rankStyle ? (
                      <span className="text-lg">{rankStyle.icon}</span>
                    ) : (
                      <span className="text-xs font-mono text-muted-foreground">#{index + 1}</span>
                    )}
                  </div>

                  {/* Trader info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5">
                      <span className={`text-sm font-mono ${isMe ? "text-primary font-bold" : "text-foreground"}`}>
                        {entry.display_address}
                      </span>
                      {isMe && (
                        <Badge variant="outline" className="text-[9px] px-1 py-0 bg-primary/20 text-primary border-primary/30">
                          YOU
                        </Badge>
                      )}
                    </div>
                    <div className="flex items-center gap-2 mt-0.5">
                      <div className="flex items-center gap-0.5">
                        <Target className="h-2.5 w-2.5 text-muted-foreground" />
                        <span className="text-[10px] text-muted-foreground">{entry.total_trades} trades</span>
                      </div>
                      {entry.win_rate > 0 && (
                        <div className="flex items-center gap-0.5">
                          <BarChart3 className="h-2.5 w-2.5 text-muted-foreground" />
                          <span className="text-[10px] text-muted-foreground">{entry.win_rate.toFixed(0)}% win</span>
                        </div>
                      )}
                      <div className="flex gap-0.5">
                        {entry.bot_types.map((bt) => (
                          <span key={bt} className="text-[10px]" title={bt}>
                            {BOT_TYPE_LABELS[bt] || bt}
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>

                  {/* P&L */}
                  <div className="text-right shrink-0">
                    <div className={`text-sm font-mono font-bold ${
                      entry.pnl_sol >= 0 ? "text-accent" : "text-destructive"
                    }`}>
                      {entry.pnl_sol >= 0 ? "+" : ""}{entry.pnl_sol.toFixed(3)} SOL
                    </div>
                    <div className="flex items-center justify-end gap-0.5">
                      {entry.pnl_percent >= 0 ? (
                        <TrendingUp className="h-2.5 w-2.5 text-accent" />
                      ) : (
                        <TrendingDown className="h-2.5 w-2.5 text-destructive" />
                      )}
                      <span className={`text-[10px] font-mono ${
                        entry.pnl_percent >= 0 ? "text-accent" : "text-destructive"
                      }`}>
                        {entry.pnl_percent >= 0 ? "+" : ""}{entry.pnl_percent.toFixed(1)}%
                      </span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
};
