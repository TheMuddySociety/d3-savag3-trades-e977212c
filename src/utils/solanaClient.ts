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
        return 'https://api.mainnet-beta.solana.com';
      case 'devnet':
        return 'https://api.devnet.solana.com';
      case 'testnet':
        return 'https://api.testnet.solana.com';
      default:
        // If not a known moniker, treat as a direct URL
        return moniker;
    }
  };
  
  // Get the HTTP endpoint
  const endpoint = getEndpoint(urlOrMoniker);
  
  // Create WebSocket endpoint by replacing http with ws if not explicitly provided
  const wsEndpoint = wsEndpointOverride || endpoint.replace('http', 'ws');
  
  // Create the RPC connection for regular API calls
  const rpc = new Connection(PLATFORM_CONFIG.RPC_URL, commitment);
  
  // Create the RPC connection optimized for WebSocket subscriptions
  const rpcSubscriptions = new Connection(wsEndpoint, commitment);
  
  return { rpc, rpcSubscriptions };
}
