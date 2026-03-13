import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface TokenHolding {
  mint: string;
  symbol: string;
  name: string;
  logoUrl: string;
  amount: number;
  decimals: number;
  price: number;
  value: number;
}

export interface WalletPortfolio {
  solBalance: number;
  solPrice: number;
  solValueUsd: number;
  tokens: TokenHolding[];
  totalTokenValueUsd: number;
  totalPortfolioUsd: number;
  tokenCount: number;
}

export function useWalletPortfolio(walletAddress: string | null) {
  const [portfolio, setPortfolio] = useState<WalletPortfolio | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchPortfolio = useCallback(async (silent = false) => {
    if (!walletAddress) return;
    try {
      if (!silent) setIsLoading(true);
      setError(null);

      const { data, error: fnError } = await supabase.functions.invoke("wallet-portfolio", {
        body: { wallet_address: walletAddress },
      });

      if (fnError) throw new Error(fnError.message);
      if (!data?.success) throw new Error(data?.error || "Failed to fetch portfolio");

      setPortfolio(data.data);
    } catch (err: any) {
      console.error("Portfolio fetch error:", err);
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  }, [walletAddress]);

  useEffect(() => {
    fetchPortfolio();
    // Refresh every 30s
    const interval = setInterval(() => fetchPortfolio(true), 30000);
    return () => clearInterval(interval);
  }, [fetchPortfolio]);

  return { portfolio, isLoading, error, refresh: fetchPortfolio };
}
