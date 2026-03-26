
import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { Sparkles, DollarSign, TrendingUp, Calculator, Brain, BarChart3, AlertTriangle } from "lucide-react";
import { cn } from "@/lib/utils";
import { useMemecoins } from "@/hooks/useMemecoins";
import { Badge } from "@/components/ui/badge";
import { formatNumber } from "@/utils/format";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export function ProfitSimulator() {
  const [initialInvestment, setInitialInvestment] = useState(1000);
  const [daysHeld, setDaysHeld] = useState(7);
  const [profitMultiplier, setProfitMultiplier] = useState(10);
  const [simulatedProfit, setSimulatedProfit] = useState(0);
  const [isCalculating, setIsCalculating] = useState(false);
  const [isGlowing, setIsGlowing] = useState(false);
  const [usingAI, setUsingAI] = useState(true);
  const [aiResults, setAiResults] = useState<{
    predictedProfit: number;
    confidenceScore: number;
    riskLevel: 'Low' | 'Medium' | 'High';
    tradingSignals: string[];
    reasoning?: string;
  } | null>(null);
  
  const { memecoins } = useMemecoins();
  const [selectedToken, setSelectedToken] = useState('');

  // Set the first token as default when memecoins are loaded
  useEffect(() => {
    if (memecoins.length > 0 && !selectedToken) {
      setSelectedToken(memecoins[0]?.tokenAddress || '');
    }
  }, [memecoins, selectedToken]);

  const calculateProfit = async () => {
    setIsCalculating(true);
    
    if (usingAI && selectedToken) {
      try {
        const token = memecoins.find(m => m.tokenAddress === selectedToken);
        if (!token) throw new Error('Token not found');

        const { data, error } = await supabase.functions.invoke('ai-profit-analysis', {
          body: {
            token: {
              symbol: token.symbol,
              name: token.name,
              price: token.price,
              change24h: token.change24h,
              marketCap: token.marketCap,
              volume24h: token.volume24h,
              liquidity: token.liquidity,
            },
            investment: initialInvestment,
            days: daysHeld,
          },
        });

        if (error) throw error;
        if (!data?.success || !data?.data) throw new Error(data?.error || 'AI analysis failed');

        const prediction = data.data;
        setAiResults({
          predictedProfit: prediction.predictedProfit,
          confidenceScore: prediction.confidenceScore,
          riskLevel: prediction.riskLevel,
          tradingSignals: prediction.tradingSignals,
          reasoning: prediction.reasoning,
        });
        setSimulatedProfit(prediction.predictedProfit);
      } catch (error: any) {
        console.error('Error getting AI prediction:', error);
        toast.error(error?.message || 'AI analysis failed. Try again.');
        // Fallback to simple calc
        const profit = initialInvestment * profitMultiplier;
        setSimulatedProfit(profit);
        setAiResults(null);
      }
    } else {
      const profit = initialInvestment * profitMultiplier;
      setSimulatedProfit(profit);
    }
    
    setIsCalculating(false);
    setIsGlowing(true);
    setTimeout(() => setIsGlowing(false), 2000);
  };

  const getRiskColor = (riskLevel: 'Low' | 'Medium' | 'High') => {
    switch (riskLevel) {
      case 'Low': return 'bg-green-500/20 text-green-600';
      case 'Medium': return 'bg-yellow-500/20 text-yellow-600';
      case 'High': return 'bg-red-500/20 text-red-600';
      default: return '';
    }
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
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm font-medium">Standard Mode</span>
          <button
            onClick={() => setUsingAI(!usingAI)}
            className={cn(
              "relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-background",
              usingAI ? "bg-solana" : "bg-input"
            )}
          >
            <span
              className={cn(
                "pointer-events-none inline-block h-5 w-5 rounded-full bg-background shadow-lg ring-0 transition-transform",
                usingAI ? "translate-x-5" : "translate-x-1"
              )}
            />
          </button>
          <span className="text-sm font-medium flex items-center gap-1">
            <Brain className="h-4 w-4 text-solana" />
            AI Trading
          </span>
        </div>
        
        {usingAI && (
          <div className="space-y-2">
            <Label htmlFor="token" className="flex items-center gap-1">
              <BarChart3 className="h-4 w-4" />
              Select Token
            </Label>
            <select 
              id="token"
              value={selectedToken}
              onChange={(e) => setSelectedToken(e.target.value)}
              className="w-full h-10 px-3 py-2 bg-background/50 border border-border rounded-md focus:outline-none focus:ring-2 focus:ring-solana"
            >
              {memecoins.map((coin) => (
                <option key={coin.id} value={coin.tokenAddress}>
                  {coin.symbol} - {coin.name}
                </option>
              ))}
            </select>
          </div>
        )}
        
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
              onValueChange={(value) => setProfitMultiplier(value?.[0] || 10)}
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
              onValueChange={(value) => setDaysHeld(value?.[0] || 7)}
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
            {isCalculating ? (
              <span className="flex items-center gap-2">
                <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                {usingAI ? "AI Analyzing Market Data..." : "Calculating..."}
              </span>
            ) : (
              <span className="flex items-center gap-2">
                {usingAI ? (
                  <>
                    <Brain className="h-4 w-4" />
                    Calculate with AI Trading Strategy
                  </>
                ) : (
                  <>Calculate Potential Profit</>
                )}
              </span>
            )}
          </Button>
        </div>
      </CardContent>
      
      {(simulatedProfit !== 0 || aiResults) && (
        <CardFooter className="border-t border-border p-4 flex flex-col items-center gap-2">
          <div className="text-sm text-muted-foreground">
            {usingAI ? "AI-Powered Profit Estimate" : "Estimated Profit"} (after {daysHeld} days)
          </div>
          <div className={cn(
            "flex items-center gap-2 font-bold text-2xl",
            simulatedProfit >= 0 ? "text-chart-green" : "text-destructive"
          )}>
            {simulatedProfit >= 0 ? (
              <Sparkles className="h-5 w-5 animate-pulse" />
            ) : (
              <AlertTriangle className="h-5 w-5" />
            )}
            {simulatedProfit < 0 ? "-" : "+"}{formatNumber(Math.abs(simulatedProfit))}
            {simulatedProfit >= 0 && <Sparkles className="h-5 w-5 animate-pulse" />}
          </div>
          
          {usingAI && aiResults && (
            <div className="w-full mt-3 space-y-2">
              <div className="flex justify-between items-center">
                <span className="text-sm text-muted-foreground">AI Confidence</span>
                <div className="flex items-center">
                  <div className="w-24 h-2 bg-muted rounded-full overflow-hidden">
                    <div 
                      className="h-full bg-primary" 
                      style={{ width: `${aiResults.confidenceScore * 100}%` }}
                    ></div>
                  </div>
                  <span className="ml-2 text-sm">{Math.round(aiResults.confidenceScore * 100)}%</span>
                </div>
              </div>
              
              <div className="flex justify-between items-center">
                <span className="text-sm text-muted-foreground">Risk Level</span>
                <Badge variant="outline" className={getRiskColor(aiResults.riskLevel)}>
                  {aiResults.riskLevel === 'High' && <AlertTriangle className="mr-1 h-3 w-3" />}
                  {aiResults.riskLevel}
                </Badge>
              </div>
              
              <div className="space-y-1">
                <span className="text-sm text-muted-foreground">AI Trading Signals</span>
                <div className="flex flex-wrap gap-1">
                  {aiResults.tradingSignals.map((signal, index) => (
                    <Badge key={index} variant="secondary" className="text-xs">
                      {signal}
                    </Badge>
                  ))}
                </div>
              </div>
            </div>
          )}
          
          <div className="text-xs text-center text-muted-foreground mt-2">
            {usingAI 
              ? "AI predictions based on historical data and market sentiment analysis. Not financial advice."
              : "This is a simplified simulation. Actual results may vary significantly."
            }
          </div>
        </CardFooter>
      )}
    </Card>
  );
}
