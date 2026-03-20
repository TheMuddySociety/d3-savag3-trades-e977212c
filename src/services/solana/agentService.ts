import { createUmi } from "@metaplex-foundation/umi-bundle-defaults";
import { mplCore } from "@metaplex-foundation/mpl-core";
import {
  mplAgentIdentity,
  mplAgentTools,
  registerIdentityV1,
  findAgentIdentityV1Pda,
  safeFetchAgentIdentityV1,
  findExecutiveProfileV1Pda,
  findExecutionDelegateRecordV1Pda,
  delegateExecutionV1,
} from "@metaplex-foundation/mpl-agent-registry";
import { publicKey } from "@metaplex-foundation/umi";
import { walletAdapterIdentity } from "@metaplex-foundation/umi-signer-wallet-adapters";
import { PLATFORM_CONFIG } from "@/config/platform";

/**
 * Service to manage D3MON Dan on-chain agent delegation using Metaplex MPL-Agent Registry.
 *
 * Flow:
 *  1. User creates/owns an MPL Core asset that represents the "agent instance"
 *  2. registerIdentityV1 binds an identity PDA + AgentIdentity plugin to that asset
 *  3. D3MON Dan's executive profile (EXECUTIVE_ADDRESS) is pre-registered on-chain
 *  4. delegateExecutionV1 grants D3MON Dan execution authority over the user's agent asset
 *
 * The executive profile only needs to be registered once per authority wallet.
 * Delegation is per-asset — each user delegates their own agent asset.
 */
export class AgentService {
  /** D3MON Dan's executive authority wallet */
  private static EXECUTIVE_ADDRESS = PLATFORM_CONFIG.WALLET_ADDRESS;

  /**
   * Creates a Umi instance configured with the user's wallet adapter and
   * both MPL-Agent plugins (identity + tools).
   */
  private static getUmi(wallet: any) {
    return createUmi(PLATFORM_CONFIG.RPC_URL)
      .use(mplCore())
      .use(mplAgentIdentity())
      .use(mplAgentTools())
      .use(walletAdapterIdentity(wallet));
  }

  /**
   * Checks whether a given asset already has a registered agent identity.
   * Uses safeFetchAgentIdentityV1 which returns null instead of throwing.
   */
  static async isAgentHired(walletAddress: string): Promise<boolean> {
    try {
      const umi = createUmi(PLATFORM_CONFIG.RPC_URL)
        .use(mplCore())
        .use(mplAgentIdentity())
        .use(mplAgentTools());

      const assetPubkey = publicKey(walletAddress);
      const pda = findAgentIdentityV1Pda(umi, { asset: assetPubkey });
      const identity = await safeFetchAgentIdentityV1(umi, pda);

      if (!identity) return false;

      // Additionally check if delegation to our executive exists
      const executiveProfilePda = findExecutiveProfileV1Pda(umi, {
        authority: publicKey(this.EXECUTIVE_ADDRESS),
      });
      const delegatePda = findExecutionDelegateRecordV1Pda(umi, {
        executiveProfile: executiveProfilePda,
        agentAsset: assetPubkey,
      });

      // Try to fetch the delegation record — if it exists, agent is "hired"
      try {
        const account = await umi.rpc.getAccount(delegatePda);
        return account.exists;
      } catch {
        return false;
      }
    } catch {
      return false;
    }
  }

  /**
   * Delegates execution authority for the user's agent asset to D3MON Dan.
   *
   * Prerequisites:
   *  - The user must own an MPL Core asset with a registered agent identity.
   *  - D3MON Dan's executive profile must already be registered on-chain.
   *
   * For the MVP, we assume the asset address == the user's wallet address.
   * In production you'd create a dedicated Core asset per user.
   */
  static async hireDan(wallet: any): Promise<string> {
    const umi = this.getUmi(wallet);
    const userPubkey = publicKey(wallet.publicKey.toBase58());
    const executivePubkey = publicKey(this.EXECUTIVE_ADDRESS);

    try {
      console.log("Delegating execution to D3MON Dan...");

      // Derive the executive profile PDA for D3MON Dan
      const executiveProfilePda = findExecutiveProfileV1Pda(umi, {
        authority: executivePubkey,
      });

      // Delegate execution: the user (asset owner) grants D3MON Dan's
      // executive profile permission to execute on their agent asset.
      const tx = await delegateExecutionV1(umi, {
        executiveProfile: executiveProfilePda,
        agentAsset: userPubkey,
        agentIdentity: findAgentIdentityV1Pda(umi, { asset: userPubkey }),
      }).sendAndConfirm(umi);

      const signature = Buffer.from(tx.signature).toString("base64");
      console.log("Delegation successful:", signature);
      return signature;
    } catch (e: any) {
      throw new Error(`Failed to hire D3MON Dan: ${e.message}`);
    }
  }
}
