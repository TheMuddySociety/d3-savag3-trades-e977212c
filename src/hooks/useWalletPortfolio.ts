import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useNetwork } from "./useNetwork";

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
  const [diagnostics, setDiagnostics] = useState<string | null>(null);

  const { network } = useNetwork();

  const fetchPortfolio = useCallback(async (silent = false) => {
    if (!walletAddress) return;
    try {
      if (!silent) setIsLoading(true);
      setError(null);
      setDiagnostics(null);

      const { data, error: fnError } = await supabase.functions.invoke("wallet-portfolio", {
        body: { wallet_address: walletAddress, network },
      });

      if (fnError) throw new Error(fnError.message);
      if (data?.success === false) {
        setDiagnostics(data.diagnostics);
        console.warn("Portfolio fetch degradation:", data.error, data.diagnostics);
        // We still set error if no data was returned at all
        if (!data.data) throw new Error(data.error || "Failed to fetch portfolio");
      }

      setPortfolio(data.data);
    } catch (err: any) {
      console.error("Portfolio fetch error:", err);
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  }, [walletAddress, network]);

  useEffect(() => {
    fetchPortfolio();
    // Refresh every 12s
    const interval = setInterval(() => fetchPortfolio(true), 12000);
    return () => clearInterval(interval);
  }, [fetchPortfolio]);

  return { portfolio, isLoading, error, diagnostics, refresh: () => fetchPortfolio() };
}
