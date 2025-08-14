import { useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { ArrowDownUp } from "lucide-react";
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
    <Card className="memecoin-card">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-xl">
          <ArrowDownUp className="h-5 w-5 text-solana" />
          D3 SAVAGE SWAP
        </CardTitle>
        <CardDescription>
          Swap your tokens at the best rates across multiple DEXs
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div 
          id="target-container"
          className="min-h-[400px] w-full"
        />
      </CardContent>
    </Card>
  );
}
