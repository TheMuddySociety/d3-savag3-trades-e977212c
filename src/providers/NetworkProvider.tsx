import { ReactNode } from "react";
import { JupiverseKitProvider } from "jupiverse-kit";
import { useNetwork } from "@/hooks/useNetwork";
import "jupiverse-kit/dist/index.css";

interface NetworkProviderProps {
  children: ReactNode;
}

export function NetworkProvider({ children }: NetworkProviderProps) {
  const { rpcUrl, jupiterEnv } = useNetwork();

  return (
    <JupiverseKitProvider
      endpoint={rpcUrl}
      autoConnect={true}
      lang="en"
      env={jupiterEnv as any}
      theme="dark"
      walletConnectProjectId={import.meta.env.VITE_REOWN_PROJECT_ID || "5b36451f84329b89549bb3c7b5826795"}
      metadata={{
        name: "D3S Agent",
        description: "Solana Memecoin Trading Terminal",
        url: window.location.origin,
        iconUrls: [window.location.origin + "/dan-logo.jpg"],
      }}
    >
      {children}
    </JupiverseKitProvider>
  );
}
