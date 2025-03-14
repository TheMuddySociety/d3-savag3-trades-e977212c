
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Info } from "lucide-react";
import { cn } from "@/lib/utils";

interface SlippageSelectorProps {
  slippage: number;
  setSlippage: (value: number) => void;
  useDynamicSlippage: boolean;
  setUseDynamicSlippage: (value: boolean) => void;
}

export function SlippageSelector({ 
  slippage, 
  setSlippage, 
  useDynamicSlippage, 
  setUseDynamicSlippage 
}: SlippageSelectorProps) {
  return (
    <div className="space-y-2">
      <Label className="flex items-center gap-1">
        Slippage Tolerance
        <Info className="h-3 w-3 text-muted-foreground" />
      </Label>
      <div className="flex space-x-2">
        {[0.5, 1, 2, 3].map((value) => (
          <Button
            key={value}
            variant={slippage === value ? "default" : "outline"}
            className={cn(
              "flex-1",
              slippage === value && "bg-solana hover:bg-solana-dark"
            )}
            onClick={() => setSlippage(value)}
          >
            {value}%
          </Button>
        ))}
      </div>
      <div className="flex items-center gap-2 pt-1">
        <Switch 
          id="dynamic-slippage" 
          checked={useDynamicSlippage}
          onCheckedChange={setUseDynamicSlippage}
        />
        <Label htmlFor="dynamic-slippage" className="text-sm cursor-pointer">
          Use dynamic slippage optimization
        </Label>
        <Info className="h-3 w-3 text-muted-foreground cursor-help" />
      </div>
    </div>
  );
}
