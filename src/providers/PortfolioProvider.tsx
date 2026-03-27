import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useNetwork } from "@/hooks/useNetwork";
import { useWallet } from "@solana/wallet-adapter-react";

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

interface PortfolioContextType {
  portfolio: WalletPortfolio | null;
  isLoading: boolean;
  error: string | null;
  diagnostics: string | null;
  refresh: () => Promise<void>;
}

const PortfolioContext = createContext<PortfolioContextType | undefined>(undefined);

export function PortfolioProvider({ children }: { children: ReactNode }) {
  const { publicKey } = useWallet();
  const walletAddress = publicKey?.toBase58() || null;
  const { network } = useNetwork();
  
  const [portfolio, setPortfolio] = useState<WalletPortfolio | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [diagnostics, setDiagnostics] = useState<string | null>(null);

  const fetchPortfolio = useCallback(async (silent = false) => {
    if (!walletAddress) {
      setPortfolio(null);
      return;
    }
    
    try {
      if (!silent) setIsLoading(true);
      setError(null);
      
      const { data, error: fnError } = await supabase.functions.invoke("wallet-portfolio", {
        body: { wallet_address: walletAddress, network },
      });

      if (fnError) throw new Error(fnError.message);
      if (data?.success === false) {
        setDiagnostics(data.diagnostics);
        if (!data.data) throw new Error(data.error || "Failed to fetch portfolio");
      }

      setPortfolio(data.data);
    } catch (err: any) {
      console.error("Portfolio sync error:", err);
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  }, [walletAddress, network]);

  useEffect(() => {
    fetchPortfolio();
    // Unified interval for all consuming components
    const interval = setInterval(() => fetchPortfolio(true), 15000); // 15s interval
    return () => clearInterval(interval);
  }, [fetchPortfolio]);

  return (
    <PortfolioContext.Provider value={{ portfolio, isLoading, error, diagnostics, refresh: () => fetchPortfolio() }}>
      {children}
    </PortfolioContext.Provider>
  );
}

export function usePortfolio() {
  const context = useContext(PortfolioContext);
  if (context === undefined) {
    throw new Error("usePortfolio must be used within a PortfolioProvider");
  }
  return context;
}
