import { ReactNode } from "react";
import { UnifiedWalletProvider } from "@jup-ag/wallet-adapter";
import { useNetwork } from "@/hooks/useNetwork";
import { PLATFORM_CONFIG } from "@/config/platform";
import { WalletNotification } from "@/components/WalletNotification";

const projectId = import.meta.env.VITE_REOWN_PROJECT_ID || "5b36451f84329b89549bb3c7b5826795";

const metadata = {
  name: "SAVAG3BOT",
  description: "High-performance Solana Memecoin Trading Terminal",
  url: typeof window !== 'undefined' ? window.location.origin : "https://savag3bot.app",
  iconUrls: [typeof window !== 'undefined' ? window.location.origin + "/dan-logo.jpg" : ""],
};

interface NetworkProviderProps {
  children: ReactNode;
}

export function NetworkProvider({ children }: NetworkProviderProps) {
  const { rpcUrl, jupiterEnv } = useNetwork();

  return (
    <UnifiedWalletProvider
      wallets={[]} // Unified Wallet Kit handles discovery automatically
      config={{
        autoConnect: true,
        env: jupiterEnv as any,
        metadata: {
          name: metadata.name,
          description: metadata.description,
          url: metadata.url,
          iconUrls: metadata.iconUrls,
        },
        notificationCallback: WalletNotification,
        walletlistExplanation: {
          href: "https://dev.jup.ag/tool-kits/wallet-kit",
        },
        theme: "dark",
        lang: "en",
      }}
    >
      {children}
    </UnifiedWalletProvider>
  );
}
