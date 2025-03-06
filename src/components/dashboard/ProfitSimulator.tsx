
import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { Sparkles, DollarSign, TrendingUp, Calculator } from "lucide-react";
import { cn } from "@/lib/utils";

export function ProfitSimulator() {
  const [initialInvestment, setInitialInvestment] = useState(1000);
  const [daysHeld, setDaysHeld] = useState(7);
  const [profitMultiplier, setProfitMultiplier] = useState(10);
  const [simulatedProfit, setSimulatedProfit] = useState(0);
  const [isCalculating, setIsCalculating] = useState(false);
  const [isGlowing, setIsGlowing] = useState(false);

  const calculateProfit = () => {
    setIsCalculating(true);
    setTimeout(() => {
      // Simple profit calculation for demonstration
      const profit = initialInvestment * profitMultiplier;
      setSimulatedProfit(profit);
      setIsCalculating(false);
      setIsGlowing(true);
      setTimeout(() => setIsGlowing(false), 2000);
    }, 800);
  };

  return (
    <Card className={cn(
      "memecoin-card",
      isGlowing && "animate-pulse-glow"
    )}>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-xl">
          <Calculator className="h-5 w-5 text-solana" />
          Profit Simulator
        </CardTitle>
        <CardDescription>
          Estimate potential returns from memecoin investments
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="investment" className="flex items-center gap-1">
            <DollarSign className="h-4 w-4" />
            Initial Investment (USD)
          </Label>
          <Input
            id="investment"
            type="number"
            value={initialInvestment}
            onChange={(e) => setInitialInvestment(Number(e.target.value))}
            min={10}
            max={1000000}
            className="bg-background/50"
          />
        </div>
        
        <div className="space-y-2">
          <Label className="flex items-center gap-1">
            <TrendingUp className="h-4 w-4" />
            Expected Price Multiplier
          </Label>
          <div className="space-y-2">
            <Slider
              value={[profitMultiplier]}
              onValueChange={(value) => setProfitMultiplier(value[0])}
              min={1}
              max={100}
              step={1}
              className="w-full"
            />
            <div className="flex justify-between text-sm text-muted-foreground">
              <span>1x</span>
              <span className="font-medium">{profitMultiplier}x</span>
              <span>100x</span>
            </div>
          </div>
        </div>
        
        <div className="space-y-2">
          <Label className="flex items-center gap-1">
            Days to Hold
          </Label>
          <div className="space-y-2">
            <Slider
              value={[daysHeld]}
              onValueChange={(value) => setDaysHeld(value[0])}
              min={1}
              max={30}
              step={1}
              className="w-full"
            />
            <div className="flex justify-between text-sm text-muted-foreground">
              <span>1 day</span>
              <span className="font-medium">{daysHeld} days</span>
              <span>30 days</span>
            </div>
          </div>
        </div>
        
        <div className="pt-4">
          <Button 
            onClick={calculateProfit} 
            className="w-full bg-solana hover:bg-solana-dark text-primary-foreground" 
            disabled={isCalculating}
          >
            {isCalculating ? "Calculating..." : "Calculate Potential Profit"}
          </Button>
        </div>
      </CardContent>
      
      {simulatedProfit > 0 && (
        <CardFooter className="border-t border-border p-4 flex flex-col items-center gap-2">
          <div className="text-sm text-muted-foreground">Estimated Profit (after {daysHeld} days)</div>
          <div className="flex items-center gap-2 font-bold text-2xl text-solana">
            <Sparkles className="h-5 w-5 animate-pulse" />
            ${simulatedProfit.toLocaleString()}
            <Sparkles className="h-5 w-5 animate-pulse" />
          </div>
          <div className="text-xs text-center text-muted-foreground mt-2">
            This is a simplified simulation. Actual results may vary significantly.
          </div>
        </CardFooter>
      )}
    </Card>
  );
}
