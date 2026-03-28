import { createContext, ReactNode, useContext, useEffect, useMemo, useState } from "react";
import { ConnectionProvider } from "@solana/wallet-adapter-react";
import { UnifiedWalletProvider } from "@jup-ag/wallet-adapter";
import { SolanaNetwork } from "@/hooks/useNetwork";
import { WalletNotification } from "@/components/WalletNotification";

interface NetworkContextType {
  network: SolanaNetwork;
  setNetwork: (network: SolanaNetwork) => void;
  rpcUrl: string;
  jupiterEnv: string;
}

const NetworkContext = createContext<NetworkContextType | undefined>(undefined);

export function useNetworkContext() {
  const context = useContext(NetworkContext);
  if (!context) {
    throw new Error("useNetworkContext must be used within a NetworkProvider");
  }
  return context;
}

interface NetworkProviderProps {
  children: ReactNode;
}

const NETWORK_STORAGE_KEY = "solana-network";

export function NetworkProvider({ children }: NetworkProviderProps) {
  const [network, setNetworkState] = useState<SolanaNetwork>(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem(NETWORK_STORAGE_KEY);
      if (saved === "mainnet-beta" || saved === "devnet" || saved === "testnet") {
        return saved as SolanaNetwork;
      }
    }
    return "mainnet-beta";
  });

  const setNetwork = (newNetwork: SolanaNetwork) => {
    setNetworkState(newNetwork);
    localStorage.setItem(NETWORK_STORAGE_KEY, newNetwork);
  };

  const rpcUrl = useMemo(() => {
    const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || "";
    const PROXY_URL = `${SUPABASE_URL}/functions/v1/rpc-proxy`;
    
    switch (network) {
      case "devnet": return "https://api.devnet.solana.com";
      case "testnet": return "https://api.testnet.solana.com";
      default: return PROXY_URL;
    }
  }, [network]);

  const jupiterEnv = useMemo(() => {
    // Jupiter officially supports mainnet-beta and devnet
    return network === "mainnet-beta" ? "mainnet-beta" : "devnet";
  }, [network]);

  const contextValue = useMemo(() => ({
    network,
    setNetwork,
    rpcUrl,
    jupiterEnv
  }), [network, rpcUrl, jupiterEnv]);

  return (
    <NetworkContext.Provider value={contextValue}>
      <ConnectionProvider endpoint={rpcUrl}>
        <UnifiedWalletProvider
          wallets={[]}
          config={{
            autoConnect: true,
            env: jupiterEnv as any,
            metadata: {
              name: "D3S AGENT",
              description: "High-performance Solana Trading & Launch Protocol",
              url: typeof window !== 'undefined' ? window.location.origin : "https://savag3bot.app",
              iconUrls: [typeof window !== 'undefined' ? window.location.origin + "/dan-logo.jpg" : ""],
            },
            notificationCallback: WalletNotification as any,
            walletlistExplanation: {
              href: "https://dev.jup.ag/tool-kits/wallet-kit",
            },
            theme: "dark",
            lang: "en",
          }}
        >
          {children}
        </UnifiedWalletProvider>
      </ConnectionProvider>
    </NetworkContext.Provider>
  );
}
