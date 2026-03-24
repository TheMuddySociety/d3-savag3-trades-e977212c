import { ReactNode, useMemo } from "react";
import { JupiverseKitProvider } from "jupiverse-kit";
import { useNetwork } from "@/hooks/useNetwork";
import { createAppKit } from '@reown/appkit/react';
import { SolanaAdapter } from '@reown/appkit-adapter-solana/react';
import { solana, solanaDevnet, solanaTestnet } from '@reown/appkit/networks';
import { PLATFORM_CONFIG } from "@/config/platform";
import "jupiverse-kit/dist/index.css";

const projectId = import.meta.env.VITE_REOWN_PROJECT_ID || "5b36451f84329b89549bb3c7b5826795";

const metadata = {
  name: "SAVAG3BOT",
  description: "High-performance Solana Memecoin Trading Terminal",
  url: window.location.origin,
  icons: [window.location.origin + "/dan-logo.jpg"],
};

const solanaAdapter = new SolanaAdapter();

createAppKit({
  adapters: [solanaAdapter],
  networks: [solana, solanaDevnet, solanaTestnet] as any,
  projectId,
  metadata,
  themeMode: 'dark',
  features: {
    analytics: true,
    socials: ['google', 'x', 'discord', 'apple'],
  },
});

interface NetworkProviderProps {
  children: ReactNode;
}

export function NetworkProvider({ children }: NetworkProviderProps) {
  const { rpcUrl, jupiterEnv } = useNetwork();

  const jupiverseConfig = useMemo(() => ({
    endpoint: rpcUrl,
    autoConnect: true,
    lang: "en" as const,
    env: jupiterEnv as any,
    theme: "dark" as const,
    walletConnectProjectId: projectId,
    metadata: {
      ...metadata,
      iconUrls: metadata.icons, // Support both formats
    },
    referralAccount: PLATFORM_CONFIG.REFERRAL_ACCOUNT,
    platformFeeBps: 150,
  }), [rpcUrl, jupiterEnv]);

  return (
    <JupiverseKitProvider {...(jupiverseConfig as any)}>
      {children}
    </JupiverseKitProvider>
  );
}
