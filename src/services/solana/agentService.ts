import { createUmi } from "@metaplex-foundation/umi-bundle-defaults";
import { mplCore } from "@metaplex-foundation/mpl-core";
import { mplAgentIdentity, mplAgentTools } from "@metaplex-foundation/mpl-agent-registry";
import {
  registerIdentityV1,
} from "@metaplex-foundation/mpl-agent-registry/dist/src/generated/identity/instructions/registerIdentityV1";
import {
  findAgentIdentityV1Pda,
  safeFetchAgentIdentityV1,
} from "@metaplex-foundation/mpl-agent-registry/dist/src/generated/identity/accounts/agentIdentityV1";
import {
  delegateExecutionV1,
} from "@metaplex-foundation/mpl-agent-registry/dist/src/generated/tools/instructions/delegateExecutionV1";
import {
  findExecutiveProfileV1Pda,
} from "@metaplex-foundation/mpl-agent-registry/dist/src/generated/tools/accounts/executiveProfileV1";
import {
  findExecutionDelegateRecordV1Pda,
  safeFetchExecutionDelegateRecordV1,
} from "@metaplex-foundation/mpl-agent-registry/dist/src/generated/tools/accounts/executionDelegateRecordV1";
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
   * Creates a read-only Umi instance (no wallet adapter needed).
   */
  private static getReadOnlyUmi() {
    return createUmi(PLATFORM_CONFIG.RPC_URL)
      .use(mplCore())
      .use(mplAgentIdentity())
      .use(mplAgentTools());
  }

  /**
   * Checks whether a given asset already has a registered agent identity
   * AND has delegated execution to D3MON Dan's executive profile.
   */
  static async isAgentHired(walletAddress: string): Promise<boolean> {
    try {
      const umi = this.getReadOnlyUmi();
      const assetPubkey = publicKey(walletAddress);

      // Check if agent identity exists
      const identityPda = findAgentIdentityV1Pda(umi, { asset: assetPubkey });
      const identity = await safeFetchAgentIdentityV1(umi, identityPda);
      if (!identity) return false;

      // Check if delegation to our executive exists
      const executiveProfilePda = findExecutiveProfileV1Pda(umi, {
        authority: publicKey(this.EXECUTIVE_ADDRESS),
      });
      const delegatePda = findExecutionDelegateRecordV1Pda(umi, {
        executiveProfile: publicKey(executiveProfilePda),
        agentAsset: assetPubkey,
      });
      const delegateRecord = await safeFetchExecutionDelegateRecordV1(umi, delegatePda);
      return delegateRecord !== null;
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
   */
  static async hireDan(wallet: any): Promise<string> {
    const umi = this.getUmi(wallet);
    const userPubkey = publicKey(wallet.publicKey.toBase58());
    const executivePubkey = publicKey(this.EXECUTIVE_ADDRESS);

    try {
      console.log("Delegating execution to D3MON Dan...");

      const executiveProfilePda = findExecutiveProfileV1Pda(umi, {
        authority: executivePubkey,
      });

      const agentIdentityPda = findAgentIdentityV1Pda(umi, { asset: userPubkey });

      const tx = await delegateExecutionV1(umi, {
        executiveProfile: executiveProfilePda,
        agentAsset: userPubkey,
        agentIdentity: agentIdentityPda,
      }).sendAndConfirm(umi);

      const signature = Buffer.from(tx.signature).toString("base64");
      console.log("Delegation successful:", signature);
      return signature;
    } catch (e: any) {
      throw new Error(`Failed to hire D3MON Dan: ${e.message}`);
    }
  }
}
