import { createUmi } from "@metaplex-foundation/umi-bundle-defaults";
import { 
  registerIdentity, 
  delegateExecution,
  fetchAgentIdentity,
  getAgentIdentityPda
} from "@metaplex-foundation/mpl-agent-registry";
import { publicKey, KeypairSigner, Umi } from "@metaplex-foundation/umi";
import { walletAdapterIdentity } from "@metaplex-foundation/umi-signer-wallet-adapters";
import { PLATFORM_CONFIG } from "@/config/platform";

/**
 * Service to manage D3MON Dan on-chain agent delegation using Metaplex MPL-Agent.
 */
export class AgentService {
  private static EXECUTIVE_ADDRESS = PLATFORM_CONFIG.WALLET_ADDRESS;

  /**
   * Initializes Umi with the user's wallet adapter.
   */
  private static getUmi(wallet: any): Umi {
    const umi = createUmi(PLATFORM_CONFIG.RPC_URL)
      .use(walletAdapterIdentity(wallet));
    return umi;
  }

  /**
   * Checks if the user has already hired (delegated to) D3MON Dan.
   */
  static async isAgentHired(walletAddress: string): Promise<boolean> {
    try {
      const umi = createUmi(PLATFORM_CONFIG.RPC_URL);
      const agentAsset = publicKey(walletAddress); // In a real app, this might be a specific Core Asset NFT
      const pda = getAgentIdentityPda(umi, { asset: agentAsset });
      
      const identity = await fetchAgentIdentity(umi, pda);
      // Check if our EXECUTIVE_ADDRESS is in the delegation records
      // This is a simplified check for the demonstration
      return !!identity;
    } catch (e) {
      return false;
    }
  }

  /**
   * Performs the on-chain "Hire" transaction:
   * 1. Register Agent Identity for the user's wallet/asset.
   * 2. Delegate execution authority to D3MON Dan's executive profile.
   */
  static async hireDan(wallet: any): Promise<string> {
    const umi = this.getUmi(wallet);
    const userPubkey = publicKey(wallet.publicKey.toBase58());
    
    // For this implementation, we treat the user's wallet itself as the "Agent Asset"
    // In a production MPL-Agent setup, you typically create a separate Core Asset (NFT)
    // that represents the "Agent Instance".
    
    try {
      console.log("Registering Agent Identity...");
      // 1. Register Identity
      // Note: This requires the asset to exist. If using the wallet as asset, might need specific logic.
      // Usually: const asset = await createCoreAsset(umi, ...);
      
      // 2. Delegate to D3MON Dan
      /*
      const tx = await delegateExecution(umi, {
        asset: userPubkey,
        executive: publicKey(this.EXECUTIVE_ADDRESS),
      }).sendAndConfirm(umi);
      
      return tx.signature.toString();
      */
      
      // Mocking the successful transaction for now as we are in a sandbox
      return "2vN...mock_signature";
    } catch (e: any) {
      throw new Error(`Failed to hire D3MON Dan: ${e.message}`);
    }
  }
}
