import { useEffect } from 'react';
import { useWallet } from '@solana/wallet-adapter-react';
import "@jup-ag/plugin/css";

export function TokenSwap() {
  const walletProps = useWallet();

  useEffect(() => {
    if (typeof window !== "undefined") {
      import("@jup-ag/plugin").then((mod) => {
        const init = mod.init;
        init({
          displayMode: "integrated",
          integratedTargetId: "target-container",
          formProps: {
            fixedAmount: true,
            fixedMint: "So11111111111111111111111111111111111111112",
            referralAccount: "F4qYkXAcogrjQHw3ngKWjisMmmRFR4Ea6c9DCCpK5gBr",
            referralFee: 150,
          },
          branding: {
            name: "D3 SAVAGE SWAP",
            logoUri: "https://ibb.co/0VFDBzYQ",
          },
        });
      });
    }
  }, []);

  return (
    <div className="w-full max-w-md mx-auto">
      <div className="bg-card/80 backdrop-blur-sm rounded-2xl border border-border/50 shadow-lg overflow-hidden">
        <div className="px-4 py-3 border-b border-border/30">
          <h2 className="text-lg font-semibold text-foreground">Swap</h2>
          <p className="text-xs text-muted-foreground">Best rates across DEXs</p>
        </div>
        <div 
          id="target-container"
          className="min-h-[380px] w-full p-2"
        />
      </div>
    </div>
  );
}
