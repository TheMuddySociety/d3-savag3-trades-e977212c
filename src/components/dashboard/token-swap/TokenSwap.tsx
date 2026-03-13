import { useEffect } from 'react';
import { useWallet } from '@solana/wallet-adapter-react';
// @ts-ignore - CSS module lacks type declarations
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
          defaultExplorer: "Solscan",
          formProps: {
            initialAmount: "100",
            swapMode: "ExactInOrOut",
            fixedMint: "So11111111111111111111111111111111111111112",
            referralAccount: "ETz1CboRkEJZDZcstd6bjHtjhRsydHQNHPEYMuhcYK2Z",
            referralFee: 80,
          },
          branding: {
            name: "SAVAG3 D3 Tradez",
            logoUri: "https://i.ibb.co/QvtDd1yY/image-6483441-4.jpg",
          },
        });
      });
    }
  }, []);

  return (
    <div className="w-full max-w-md mx-auto">
      <div className="bg-card/90 backdrop-blur-xl rounded-3xl border-2 border-primary/30 shadow-xl overflow-hidden">
        <div className="px-5 py-4 border-b border-border/30 bg-gradient-to-r from-primary/10 to-accent/10">
          <div className="flex items-center gap-2">
            <img src="https://i.ibb.co/QvtDd1yY/image-6483441-4.jpg" alt="D3 SAVAG3 Ai" className="h-6 w-6 rounded-full" />
            <h2 className="text-lg font-bold text-foreground">D3 SAVAG3 Swap</h2>
          </div>
          <p className="text-xs text-muted-foreground mt-1">Best rates across DEXs ✨</p>
        </div>
        <div 
          id="target-container"
          className="min-h-[380px] w-full p-3"
        />
      </div>
    </div>
  );
}
