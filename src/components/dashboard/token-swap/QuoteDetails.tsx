
import { RefreshCw } from "lucide-react";

interface QuoteDetailsProps {
  quote: {
    inAmount: number;
    outAmount: number;
    priceImpact: number;
    routeInfo: string;
  } | null;
  fromTokenDetails: any;
  toTokenDetails: any;
  amount: number;
  isGettingQuote: boolean;
  maxAccounts?: number;
  priorityLevel?: 'low' | 'medium' | 'high' | 'veryHigh';
  useDynamicSlippage: boolean;
  slippage: number;
}

export function QuoteDetails({ 
  quote, 
  fromTokenDetails, 
  toTokenDetails, 
  amount,
  isGettingQuote,
  maxAccounts,
  priorityLevel,
  useDynamicSlippage,
  slippage
}: QuoteDetailsProps) {
  if (!quote) return null;

  return (
    <div className="space-y-2 p-3 bg-background/30 rounded-md">
      <div className="flex justify-between text-sm">
        <span className="text-muted-foreground">Rate</span>
        <span>1 {fromTokenDetails?.symbol} ≈ {(quote.outAmount / amount).toFixed(6)} {toTokenDetails?.symbol}</span>
      </div>
      <div className="flex justify-between text-sm">
        <span className="text-muted-foreground">Price Impact</span>
        <span className={quote.priceImpact > 1 ? "text-yellow-500" : "text-green-500"}>
          {quote.priceImpact.toFixed(2)}%
        </span>
      </div>
      <div className="flex justify-between text-sm">
        <span className="text-muted-foreground">Route</span>
        <span>{quote.routeInfo}</span>
      </div>
      {maxAccounts && (
        <div className="flex justify-between text-sm">
          <span className="text-muted-foreground">Max Accounts</span>
          <span>{maxAccounts}</span>
        </div>
      )}
      {priorityLevel && (
        <div className="flex justify-between text-sm">
          <span className="text-muted-foreground">Priority Fee</span>
          <span className="capitalize">{priorityLevel}</span>
        </div>
      )}
      {useDynamicSlippage && (
        <div className="flex justify-between text-sm">
          <span className="text-muted-foreground">Dynamic Slippage</span>
          <span className="text-green-500">Enabled (max {slippage}%)</span>
        </div>
      )}
      {isGettingQuote && (
        <div className="flex justify-center">
          <RefreshCw className="h-4 w-4 animate-spin text-muted-foreground" />
        </div>
      )}
    </div>
  );
}
