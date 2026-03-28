import { Connection, PublicKey, Commitment, Cluster } from '@solana/web3.js';
import { PLATFORM_CONFIG } from '@/config/platform';

export type SolanaClientOptions = {
  urlOrMoniker: 'mainnet' | 'devnet' | 'testnet' | string;
  commitment?: Commitment;
  wsEndpointOverride?: string;
};

export type SolanaClient = {
  rpc: Connection;
  rpcSubscriptions: Connection;
};

/**
 * Creates a Solana client with separate connections for RPC calls and subscriptions
 * @param options Configuration options for the Solana connections
 * @returns Object containing rpc and rpcSubscriptions Connection instances
 */
export function createSolanaClient(options: SolanaClientOptions): SolanaClient {
  const { urlOrMoniker, commitment = 'confirmed', wsEndpointOverride } = options;
  
  // Map monikers to actual URLs
  const getEndpoint = (moniker: string): string => {
    switch (moniker) {
      case 'mainnet':
      case 'mainnet-beta': {
        const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || "";
        return `${SUPABASE_URL}/functions/v1/rpc-proxy`;
      }
      case 'devnet':
        return 'https://api.devnet.solana.com';
      case 'testnet':
        return 'https://api.testnet.solana.com';
      default:
        return moniker;
    }
  };
  
  const endpoint = getEndpoint(urlOrMoniker);
  
  // Create WebSocket endpoint logic
  let wsEndpoint: string;
  if (wsEndpointOverride) {
    wsEndpoint = wsEndpointOverride;
  } else {
    if (endpoint.includes('rpc-proxy') || endpoint.includes('mainnet-beta')) {
      wsEndpoint = 'wss://api.mainnet-beta.solana.com';
    } else if (endpoint.includes('devnet')) {
      wsEndpoint = 'wss://api.devnet.solana.com';
    } else if (endpoint.includes('testnet')) {
      wsEndpoint = 'wss://api.testnet.solana.com';
    } else {
      wsEndpoint = endpoint.replace('https://', 'wss://').replace('http://', 'ws://');
    }
  }
  
  // Create the RPC connection for regular API calls
  const rpc = new Connection(endpoint, commitment);
  
  // Create the RPC connection optimized for WebSocket subscriptions
  const rpcSubscriptions = new Connection(wsEndpoint, commitment);
  
  return { rpc, rpcSubscriptions };
}
