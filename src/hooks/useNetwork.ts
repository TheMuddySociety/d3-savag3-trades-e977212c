import { useMemo } from 'react';

export type SolanaNetwork = 'mainnet-beta' | 'devnet' | 'testnet';

export function useNetwork() {
  // Default to mainnet for the full wallet experience
  const network: SolanaNetwork = 'mainnet-beta';

  const rpcUrl = useMemo(() => {
    // Ported from App.tsx - use the Helius-backed proxy for mainnet stability
    const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
    const PROXY_URL = `${SUPABASE_URL}/functions/v1/rpc-proxy`;
    
    // Always returns proxy for now as we default to mainnet
    return PROXY_URL;
  }, []);

  const jupiterEnv = useMemo(() => {
    return 'mainnet-beta';
  }, []);

  return {
    network,
    rpcUrl,
    jupiterEnv,
    caipNetwork: null, // Legacy support for internal hooks
  };
}
