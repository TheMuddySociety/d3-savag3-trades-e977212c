import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Sparkles } from "lucide-react";

interface FeeBadgeProps {
  connected: boolean;
  hasFreePass: boolean;
  isPaymentPending: boolean;
  onBuyPass: () => void;
}

export function FeeBadge({ connected, hasFreePass, isPaymentPending, onBuyPass }: FeeBadgeProps) {
  if (!connected) return null;

  if (hasFreePass) {
    return (
      <Badge className="bg-accent/20 text-accent border-accent/30 text-[10px]">
        <Sparkles className="h-3 w-3 mr-1" />
        FEE-FREE ✨
      </Badge>
    );
  }

  return (
    <Button
      variant="ghost"
      size="sm"
      className="text-[10px] h-7 text-accent hover:text-accent"
      onClick={onBuyPass}
      disabled={isPaymentPending}
    >
      <Sparkles className="h-3 w-3 mr-1" />
      0.1 SOL = No Fees
    </Button>
  );
}
