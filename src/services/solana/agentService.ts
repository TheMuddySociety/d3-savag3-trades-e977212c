import { PLATFORM_CONFIG } from "@/config/platform";

/**
 * Lazily imports all Metaplex / Umi dependencies so the heavy Node-only
 * modules (stream, etc.) are never evaluated until a user actually triggers
 * an agent action.  This prevents the browser crash on page load.
 */
async function loadDeps() {
  const [
    { createUmi },
    { mplCore },
    { mplAgentIdentity, mplAgentTools },
    { publicKey },
    { walletAdapterIdentity },
    identityAccounts,
    toolsInstructions,
    profileAccounts,
    delegateAccounts,
  ] = await Promise.all([
    import("@metaplex-foundation/umi-bundle-defaults"),
    import("@metaplex-foundation/mpl-core"),
    import("@metaplex-foundation/mpl-agent-registry"),
    import("@metaplex-foundation/umi"),
    import("@metaplex-foundation/umi-signer-wallet-adapters"),
    import("@metaplex-foundation/mpl-agent-registry/dist/src/generated/identity/accounts/agentIdentityV1"),
    import("@metaplex-foundation/mpl-agent-registry/dist/src/generated/tools/instructions/delegateExecutionV1"),
    import("@metaplex-foundation/mpl-agent-registry/dist/src/generated/tools/accounts/executiveProfileV1"),
    import("@metaplex-foundation/mpl-agent-registry/dist/src/generated/tools/accounts/executionDelegateRecordV1"),
  ]);

  return {
    createUmi,
    mplCore,
    mplAgentIdentity,
    mplAgentTools,
    publicKey,
    walletAdapterIdentity,
    findAgentIdentityV1Pda: identityAccounts.findAgentIdentityV1Pda,
    safeFetchAgentIdentityV1: identityAccounts.safeFetchAgentIdentityV1,
    delegateExecutionV1: toolsInstructions.delegateExecutionV1,
    findExecutiveProfileV1Pda: profileAccounts.findExecutiveProfileV1Pda,
    findExecutionDelegateRecordV1Pda: delegateAccounts.findExecutionDelegateRecordV1Pda,
    safeFetchExecutionDelegateRecordV1: delegateAccounts.safeFetchExecutionDelegateRecordV1,
  };
}

/**
 * Service to manage D3S Agent on-chain agent delegation using Metaplex MPL-Agent Registry.
 */
export class AgentService {
  private static EXECUTIVE_ADDRESS = PLATFORM_CONFIG.WALLET_ADDRESS;

  static async isAgentHired(walletAddress: string): Promise<boolean> {
    try {
      const deps = await loadDeps();
      const umi = deps.createUmi(PLATFORM_CONFIG.RPC_URL)
        .use(deps.mplCore())
        .use(deps.mplAgentIdentity())
        .use(deps.mplAgentTools());

      const assetPubkey = deps.publicKey(walletAddress);
      const identityPda = deps.findAgentIdentityV1Pda(umi, { asset: assetPubkey });
      const identity = await deps.safeFetchAgentIdentityV1(umi, identityPda);
      if (!identity) return false;

      const executiveProfilePda = deps.findExecutiveProfileV1Pda(umi, {
        authority: deps.publicKey(this.EXECUTIVE_ADDRESS),
      });
      const delegatePda = deps.findExecutionDelegateRecordV1Pda(umi, {
        executiveProfile: deps.publicKey(executiveProfilePda),
        agentAsset: assetPubkey,
      });
      const delegateRecord = await deps.safeFetchExecutionDelegateRecordV1(umi, delegatePda);
      return delegateRecord !== null;
    } catch {
      return false;
    }
  }

  static async activateAgent(wallet: any): Promise<string> {
    const deps = await loadDeps();
    const umi = deps.createUmi(PLATFORM_CONFIG.RPC_URL)
      .use(deps.mplCore())
      .use(deps.mplAgentIdentity())
      .use(deps.mplAgentTools())
      .use(deps.walletAdapterIdentity(wallet));

    const userPubkey = deps.publicKey(wallet.publicKey.toBase58());
    const executivePubkey = deps.publicKey(this.EXECUTIVE_ADDRESS);

    try {
      console.log("Delegating execution to D3S Agent...");

      const executiveProfilePda = deps.findExecutiveProfileV1Pda(umi, {
        authority: executivePubkey,
      });
      const agentIdentityPda = deps.findAgentIdentityV1Pda(umi, { asset: userPubkey });

      const tx = await deps.delegateExecutionV1(umi, {
        executiveProfile: executiveProfilePda,
        agentAsset: userPubkey,
        agentIdentity: agentIdentityPda,
      }).sendAndConfirm(umi);

      const signature = Buffer.from(tx.signature).toString("base64");
      console.log("Delegation successful:", signature);
      return signature;
    } catch (e: any) {
      throw new Error(`Failed to hire D3S Agent: ${e.message}`);
    }
  }
}
