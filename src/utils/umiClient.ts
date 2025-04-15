
import { createUmi } from '@metaplex-foundation/umi-bundle-defaults';
import { publicKey } from '@metaplex-foundation/umi';
import { PublicKey } from '@solana/web3.js';

/**
 * Create a UMI instance for Metaplex operations
 * @param endpoint Optional RPC endpoint (defaults to devnet)
 * @returns Configured UMI instance
 */
export function createUmiClient(endpoint: string = 'https://api.devnet.solana.com') {
  return createUmi(endpoint);
}

/**
 * Convert a Solana web3.js PublicKey to UMI publicKey
 * @param key Solana web3.js PublicKey
 * @returns UMI publicKey
 */
export function toUmiPublicKey(key: PublicKey) {
  return publicKey(key.toBase58());
}

/**
 * Convert a UMI publicKey to Solana web3.js PublicKey
 * @param key UMI publicKey
 * @returns Solana web3.js PublicKey
 */
export function fromUmiPublicKey(key: string) {
  return new PublicKey(key);
}
