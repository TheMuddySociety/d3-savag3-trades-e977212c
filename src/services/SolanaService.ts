import { PublicKey, clusterApiUrl } from '@solana/web3.js';
import { toast } from 'sonner';
import { createSolanaClient, SolanaClient } from '@/utils/solanaClient';

export class SolanaService {
  private static solanaClient: SolanaClient | null = null;
  
  // Initialize Solana connection
  static initConnection() {
    try {
      if (!this.solanaClient) {
        // Create a Solana client with connections for both RPC and subscriptions
        this.solanaClient = createSolanaClient({
          urlOrMoniker: 'mainnet',  // Change to 'devnet' or 'testnet' for testing
          commitment: 'confirmed'
        });
        console.log('Solana connection initialized');
      }
      return this.solanaClient.rpc;
    } catch (error) {
      console.error('Failed to initialize Solana connection:', error);
      toast.error('Failed to connect to Solana network');
      return null;
    }
  }

  // Get connection (initialize if needed)
  static getConnection() {
    if (!this.solanaClient) {
      this.initConnection();
    }
    return this.solanaClient!.rpc;
  }
  
  // Get subscription connection
  static getSubscriptionConnection() {
    if (!this.solanaClient) {
      this.initConnection();
    }
    return this.solanaClient!.rpcSubscriptions;
  }

  // Get token account balance
  static async getTokenBalance(tokenAddress: string, walletAddress: string): Promise<number | null> {
    try {
      const connection = this.getConnection();
      const tokenPublicKey = new PublicKey(tokenAddress);
      const walletPublicKey = new PublicKey(walletAddress);
      
      const tokenAccounts = await connection.getParsedTokenAccountsByOwner(
        walletPublicKey,
        { mint: tokenPublicKey }
      );
      
      if (tokenAccounts.value.length === 0) {
        return 0;
      }
      
      const balance = tokenAccounts.value[0].account.data.parsed.info.tokenAmount.uiAmount;
      return balance;
    } catch (error) {
      console.error('Error fetching token balance:', error);
      return null;
    }
  }

  // Fetch token metadata
  static async getTokenMetadata(tokenAddress: string): Promise<any | null> {
    try {
      const connection = this.getConnection();
      const tokenPublicKey = new PublicKey(tokenAddress);
      
      // This is a simplified approach - in a production app, you'd want to use
      // the Metaplex SDK to fetch proper metadata
      const accountInfo = await connection.getAccountInfo(tokenPublicKey);
      
      if (!accountInfo) {
        return null;
      }
      
      return {
        address: tokenAddress,
        supply: accountInfo.lamports,
        executable: accountInfo.executable,
        owner: accountInfo.owner.toString()
      };
    } catch (error) {
      console.error('Error fetching token metadata:', error);
      return null;
    }
  }

}
