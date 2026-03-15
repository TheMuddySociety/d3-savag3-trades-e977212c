import { useState, useEffect, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useWallet } from "@solana/wallet-adapter-react";
import { Badge } from "@/components/ui/badge";
import { TrendingUp, Target, BarChart3, Hash, ExternalLink, Loader2 } from "lucide-react";
import { formatDistanceToNow } from "date-fns";

interface LiveTrade {
  id: string;
  input_amount: number;
  output_amount: number;
  input_usd_value: number | null;
  output_usd_value: number | null;
  input_mint: string;
  output_mint: string;
  input_symbol: string | null;
  output_symbol: string | null;
  status: string;
  trade_type: string;
  bot_type: string | null;
  tx_signature: string;
  created_at: string;
}

export const LiveTradeHistory = () => {
  const { publicKey } = useWallet();
  const walletAddress = publicKey?.toBase58() || null;
  const [trades, setTrades] = useState<LiveTrade[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!walletAddress) { setTrades([]); setLoading(false); return; }

    const fetchTrades = async () => {
      setLoading(true);
      const { data, error } = await supabase
        .from("live_trades")
        .select("*")
        .eq("wallet_address", walletAddress)
        .order("created_at", { ascending: false })
        .limit(50);

      if (!error && data) setTrades(data as LiveTrade[]);
      setLoading(false);
    };

    fetchTrades();
  }, [walletAddress]);

  const stats = useMemo(() => {
    const withUsd = trades.filter(t => t.input_usd_value && t.output_usd_value && t.status === 'success');
    const totalPnl = withUsd.reduce((sum, t) => sum + ((t.output_usd_value || 0) - (t.input_usd_value || 0)), 0);
    const wins = withUsd.filter(t => (t.output_usd_value || 0) > (t.input_usd_value || 0)).length;
    const winRate = withUsd.length > 0 ? (wins / withUsd.length) * 100 : 0;
    const avgSize = withUsd.length > 0 ? withUsd.reduce((s, t) => s + (t.input_usd_value || 0), 0) / withUsd.length : 0;
    return { totalPnl, winRate, avgSize, totalTrades: trades.length };
  }, [trades]);

  if (!walletAddress) {
    return (
      <div className="text-center py-6 text-xs text-muted-foreground">
        Connect your wallet to view trade history.
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-6">
        <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* P&L Dashboard */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        <div className="rounded-lg border border-border bg-muted/20 p-2.5">
          <div className="flex items-center gap-1.5 mb-1">
            <TrendingUp className="h-3 w-3 text-muted-foreground" />
            <span className="text-[10px] text-muted-foreground">Total P&L</span>
          </div>
          <p className={`text-sm font-mono font-semibold ${stats.totalPnl >= 0 ? 'text-accent' : 'text-destructive'}`}>
            {stats.totalPnl >= 0 ? '+' : ''}{stats.totalPnl.toFixed(2)} USD
          </p>
        </div>
        <div className="rounded-lg border border-border bg-muted/20 p-2.5">
          <div className="flex items-center gap-1.5 mb-1">
            <Target className="h-3 w-3 text-muted-foreground" />
            <span className="text-[10px] text-muted-foreground">Win Rate</span>
          </div>
          <p className="text-sm font-mono font-semibold text-foreground">{stats.winRate.toFixed(1)}%</p>
        </div>
        <div className="rounded-lg border border-border bg-muted/20 p-2.5">
          <div className="flex items-center gap-1.5 mb-1">
            <BarChart3 className="h-3 w-3 text-muted-foreground" />
            <span className="text-[10px] text-muted-foreground">Avg Size</span>
          </div>
          <p className="text-sm font-mono font-semibold text-foreground">${stats.avgSize.toFixed(2)}</p>
        </div>
        <div className="rounded-lg border border-border bg-muted/20 p-2.5">
          <div className="flex items-center gap-1.5 mb-1">
            <Hash className="h-3 w-3 text-muted-foreground" />
            <span className="text-[10px] text-muted-foreground">Total Trades</span>
          </div>
          <p className="text-sm font-mono font-semibold text-foreground">{stats.totalTrades}</p>
        </div>
      </div>

      {/* Trade List */}
      {trades.length === 0 ? (
        <div className="text-center py-4 text-xs text-muted-foreground">
          No live trades yet. Execute a swap to see history here.
        </div>
      ) : (
        <div className="space-y-1.5 max-h-64 overflow-y-auto">
          {trades.map((trade) => {
            const pnl = (trade.output_usd_value || 0) - (trade.input_usd_value || 0);
            return (
              <div key={trade.id} className="flex items-center justify-between p-2 rounded-lg bg-muted/10 border border-border">
                <div className="flex items-center gap-2">
                  <Badge
                    variant="outline"
                    className={`text-[10px] px-1.5 ${trade.status === 'success' ? 'text-accent border-accent/30' : 'text-destructive border-destructive/30'}`}
                  >
                    {trade.status === 'success' ? '✓' : '✗'}
                  </Badge>
                  <div>
                    <span className="text-xs font-medium text-foreground">
                      {trade.input_symbol || trade.input_mint.slice(0, 4)} → {trade.output_symbol || trade.output_mint.slice(0, 4)}
                    </span>
                    <p className="text-[10px] text-muted-foreground">
                      {trade.bot_type || 'Manual'} · {formatDistanceToNow(new Date(trade.created_at), { addSuffix: true })}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <div className="text-right">
                    {trade.input_usd_value != null && (
                      <p className="text-xs font-mono text-foreground">${trade.input_usd_value.toFixed(2)}</p>
                    )}
                    {trade.input_usd_value != null && trade.output_usd_value != null && (
                      <span className={`text-[10px] font-mono ${pnl >= 0 ? 'text-accent' : 'text-destructive'}`}>
                        {pnl >= 0 ? '+' : ''}{pnl.toFixed(2)}
                      </span>
                    )}
                  </div>
                  <a
                    href={`https://solscan.io/tx/${trade.tx_signature}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-muted-foreground hover:text-foreground"
                  >
                    <ExternalLink className="h-3 w-3" />
                  </a>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
