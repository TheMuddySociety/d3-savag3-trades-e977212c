import { useState, useEffect, useCallback } from "react";
import { Badge } from "@/components/ui/badge";
import { ArrowUpFromLine, ExternalLink } from "lucide-react";
import { useWallet } from "@solana/wallet-adapter-react";
import { supabase } from "@/integrations/supabase/client";

interface Withdrawal {
  id: string;
  amount: number;
  currency: string;
  tx_signature: string;
  created_at: string;
}

export const WithdrawalHistory = () => {
  const { publicKey } = useWallet();
  const [withdrawals, setWithdrawals] = useState<Withdrawal[]>([]);
  const [loading, setLoading] = useState(false);

  const walletAddress = publicKey?.toBase58() || null;

  const fetchWithdrawals = useCallback(async () => {
    if (!walletAddress) return;
    setLoading(true);
    try {
      const { data } = await supabase
        .from("withdrawals")
        .select("*")
        .eq("wallet_address", walletAddress)
        .order("created_at", { ascending: false })
        .limit(20);

      setWithdrawals((data as Withdrawal[]) || []);
    } catch (e) {
      console.error("Fetch withdrawals error:", e);
    } finally {
      setLoading(false);
    }
  }, [walletAddress]);

  useEffect(() => {
    fetchWithdrawals();
  }, [fetchWithdrawals]);

  if (!walletAddress) return null;

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <ArrowUpFromLine className="h-3.5 w-3.5 text-muted-foreground" />
        <span className="text-xs font-medium text-foreground">Withdrawal History</span>
        {withdrawals.length > 0 && (
          <Badge variant="outline" className="text-[10px] px-1.5 py-0 bg-muted/20 text-muted-foreground border-border">
            {withdrawals.length}
          </Badge>
        )}
      </div>

      {loading ? (
        <div className="p-3 rounded-lg bg-muted/10 border border-border">
          <p className="text-[10px] text-muted-foreground text-center animate-pulse">Loading...</p>
        </div>
      ) : withdrawals.length === 0 ? (
        <div className="p-3 rounded-lg bg-muted/10 border border-border text-center">
          <p className="text-[10px] text-muted-foreground">No withdrawals yet</p>
        </div>
      ) : (
        <div className="space-y-1.5 max-h-48 overflow-y-auto">
          {withdrawals.map((w) => (
            <div
              key={w.id}
              className="flex items-center justify-between p-2 rounded-lg bg-muted/10 border border-border"
            >
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5">
                  <span className="text-xs font-medium text-accent">
                    {w.amount.toFixed(4)} {w.currency}
                  </span>
                  <Badge variant="outline" className="text-[9px] px-1 py-0 bg-accent/10 text-accent border-accent/30">
                    Completed
                  </Badge>
                </div>
                <p className="text-[10px] text-muted-foreground mt-0.5">
                  {new Date(w.created_at).toLocaleDateString()} · {new Date(w.created_at).toLocaleTimeString()}
                </p>
              </div>
              <a
                href={`https://solscan.io/tx/${w.tx_signature}`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1 text-[10px] text-primary hover:text-primary/80 shrink-0 ml-2"
                title={w.tx_signature}
              >
                {w.tx_signature.slice(0, 6)}...
                <ExternalLink className="h-3 w-3" />
              </a>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
