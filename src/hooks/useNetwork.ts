import { useNetworkContext } from "@/providers/NetworkProvider";

export type SolanaNetwork = 'mainnet-beta' | 'devnet' | 'testnet';

export function useNetwork() {
  const { network, setNetwork, rpcUrl, jupiterEnv } = useNetworkContext();

  return {
    network,
    setNetwork,
    rpcUrl,
    jupiterEnv,
    caipNetwork: null, // Legacy support for internal hooks
  };
}
