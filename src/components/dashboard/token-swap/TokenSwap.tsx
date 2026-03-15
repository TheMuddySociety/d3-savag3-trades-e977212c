import { useEffect } from 'react';
// @ts-ignore - CSS module lacks type declarations
import "@jup-ag/plugin/css";
import { loadJupiterPluginScript } from '@/utils/loadJupiterPlugin';

export function TokenSwap() {
  useEffect(() => {
    let cancelled = false;

    loadJupiterPluginScript()
      .then(() => {
        if (cancelled || typeof window === "undefined" || !window.Jupiter?.init) return;

        window.Jupiter.init({
          displayMode: "integrated",
          integratedTargetId: "target-container",
          defaultExplorer: "Solscan",
          formProps: {
            initialAmount: "100",
            swapMode: "ExactInOrOut",
            initialInputMint: "So11111111111111111111111111111111111111112",
            initialOutputMint: "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v",
            referralAccount: "ETz1CboRkEJZDZcstd6bjHtjhRsydHQNHPEYMuhcYK2Z",
            referralFee: 80,
          },
          branding: {
            name: "SAVAG3 D3 Tradez",
            logoUri: "https://i.ibb.co/QvtDd1yY/image-6483441-4.jpg",
          },
        });
      })
      .catch((error) => {
        console.error("Failed to initialize Jupiter plugin:", error);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="w-full max-w-md mx-auto">
      <div className="bg-card/90 backdrop-blur-xl rounded-3xl border-2 border-primary/30 shadow-xl overflow-hidden">
        <div className="px-5 py-4 border-b border-border/30 bg-gradient-to-r from-primary/10 to-accent/10">
          <div className="flex items-center gap-2">
            <img src="https://i.ibb.co/QvtDd1yY/image-6483441-4.jpg" alt="SAVAG3 D3 Tradez" className="h-6 w-6 rounded-full" />
            <h2 className="text-lg font-bold text-foreground">SAVAG3 D3 Tradez</h2>
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
