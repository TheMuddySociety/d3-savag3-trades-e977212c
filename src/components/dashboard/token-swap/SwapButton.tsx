
import { Button } from "@/components/ui/button";
import { RefreshCw } from "lucide-react";
import { WalletMultiButton } from '@solana/wallet-adapter-react-ui';

interface SwapButtonProps {
  connected: boolean;
  isSwapping: boolean;
  quote: any;
  handleSwap: () => void;
}

export function SwapButton({ connected, isSwapping, quote, handleSwap }: SwapButtonProps) {
  if (!connected) {
    return (
      <WalletMultiButton className="w-full bg-solana hover:bg-solana-dark text-primary-foreground" />
    );
  }

  return (
    <Button 
      onClick={handleSwap} 
      className="w-full bg-solana hover:bg-solana-dark text-primary-foreground" 
      disabled={isSwapping || !quote}
    >
      {isSwapping ? (
        <span className="flex items-center gap-2">
          <RefreshCw className="h-4 w-4 animate-spin" /> Swapping...
        </span>
      ) : (
        "Swap"
      )}
    </Button>
  );
}
