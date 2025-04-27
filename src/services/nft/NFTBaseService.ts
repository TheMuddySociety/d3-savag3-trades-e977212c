
import { PublicKey, Connection } from '@solana/web3.js';
import { createSolanaClient } from '@/utils/solanaClient';
import { createUmiClient } from '@/utils/umiClient';

/**
 * Base service with common utilities for NFT operations
 */
export class NFTBaseService {
  /**
   * Get the Solana connection
   */
  protected static getSolanaConnection(): Connection {
    const client = createSolanaClient({ urlOrMoniker: 'devnet' });
    return client.rpc;
  }

  /**
   * Create a Umi instance for Metaplex operations
   */
  protected static createUmiInstance() {
    try {
      // Create a UMI instance with Candy Machine plugin for devnet
      console.log('Creating UMI instance from NFTBaseService');
      return createUmiClient('https://api.devnet.solana.com');
    } catch (error) {
      console.error('Failed to create UMI instance:', error);
      // Return null and handle in calling code
      return null;
    }
  }
  
  /**
   * Find a metadata PDA for a mint address
   */
  protected static findMetadataPda(mintPublicKey: PublicKey): PublicKey {
    const seeds = [
      Buffer.from('metadata'),
      new PublicKey('metaqbxxUerdq28cj1RbAWkYQm3ybzjb6a8bt518x1s').toBuffer(),
      mintPublicKey.toBuffer()
    ];
    const [metadataAddress] = PublicKey.findProgramAddressSync(
      seeds,
      new PublicKey('metaqbxxUerdq28cj1RbAWkYQm3ybzjb6a8bt518x1s')
    );
    
    return metadataAddress;
  }
}
