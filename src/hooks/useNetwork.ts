import { useAppKitNetwork } from '@reown/appkit/react';
import { useMemo } from 'react';

export type SolanaNetwork = 'mainnet-beta' | 'devnet' | 'testnet';

export function useNetwork() {
  const { caipNetwork } = useAppKitNetwork();

  // Map CAIP network IDs to Solana networks
  const network = useMemo((): SolanaNetwork => {
    if (!caipNetwork || !caipNetwork.id) return 'mainnet-beta';
    
    // AppKit Solana CAIP IDs
    const id = String(caipNetwork.id);
    if (id.includes('EtWTRABG3VvSfhqMmcYnbmEPJMDfVWte')) return 'devnet';
    if (id.includes('4uhcV1ymUj8VfP3eeoST3wknK6K6SrgB')) return 'testnet';
    
    // Default to mainnet if explicitly solana or unknown
    return 'mainnet-beta';
  }, [caipNetwork]);

  const rpcUrl = useMemo(() => {
    // Ported from App.tsx - use the Helius-backed proxy for mainnet stability
    const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
    const PROXY_URL = `${SUPABASE_URL}/functions/v1/rpc-proxy`;

    switch (network) {
      case 'devnet':
        return 'https://api.devnet.solana.com';
      case 'testnet':
        return 'https://api.testnet.solana.com';
      default:
        // Use proxy for mainnet to leverage Helius API key
        return PROXY_URL;
    }
  }, [network]);

  const jupiterEnv = useMemo(() => {
    switch (network) {
      case 'devnet':
        return 'devnet';
      case 'testnet':
        return 'testnet';
      default:
        return 'mainnet-beta';
    }
  }, [network]);

  return {
    network,
    rpcUrl,
    jupiterEnv,
    caipNetwork,
  };
}
