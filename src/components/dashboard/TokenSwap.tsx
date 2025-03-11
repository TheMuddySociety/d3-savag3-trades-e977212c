
import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { ArrowDownUp, RefreshCw, DollarSign, Info } from "lucide-react";
import { cn } from "@/lib/utils";
import { useWallet, useConnection } from '@solana/wallet-adapter-react';
import { toast } from "sonner";
import { SwapService } from '@/services/SwapService';
import { formatNumber } from "@/utils/format";

export function TokenSwap() {
  const { connection } = useConnection();
  const wallet = useWallet();
  const [isSwapping, setIsSwapping] = useState(false);
  const [tokens, setTokens] = useState<any[]>([]);
  const [fromToken, setFromToken] = useState<string>('');
  const [toToken, setToToken] = useState<string>('');
  const [amount, setAmount] = useState<number>(1);
  const [slippage, setSlippage] = useState<number>(1); // 1%
  const [quote, setQuote] = useState<any>(null);
  const [isGettingQuote, setIsGettingQuote] = useState(false);

  useEffect(() => {
    // Initialize with common tokens
    const commonTokens = SwapService.getCommonTokens();
    setTokens(commonTokens);
    
    // Set default tokens
    if (commonTokens.length >= 2) {
      setFromToken(commonTokens[0].mint);
      setToToken(commonTokens[1].mint);
    }
  }, []);

  // Get new quote when inputs change
  useEffect(() => {
    if (fromToken && toToken && amount > 0) {
      getQuote();
    }
  }, [fromToken, toToken, amount]);

  const getQuote = async () => {
    if (!fromToken || !toToken || amount <= 0) return;
    
    setIsGettingQuote(true);
    
    try {
      const quoteResult = await SwapService.getSwapQuote(
        connection,
        fromToken,
        toToken,
        amount
      );
      
      setQuote(quoteResult);
    } catch (error) {
      console.error('Error getting quote:', error);
      toast.error("Failed to get swap quote");
    } finally {
      setIsGettingQuote(false);
    }
  };

  const handleSwap = async () => {
    if (!wallet.connected) {
      toast.error("Please connect your wallet first");
      return;
    }
    
    if (!fromToken || !toToken || amount <= 0) {
      toast.error("Please select tokens and enter an amount");
      return;
    }
    
    setIsSwapping(true);
    
    try {
      const txSignature = await SwapService.swapTokens(
        connection,
        wallet,
        fromToken,
        toToken,
        amount,
        slippage * 100 // Convert percentage to basis points
      );
      
      if (txSignature) {
        console.log('Swap transaction:', txSignature);
      }
    } catch (error) {
      console.error('Error performing swap:', error);
      toast.error("Swap failed");
    } finally {
      setIsSwapping(false);
    }
  };

  const switchTokens = () => {
    const temp = fromToken;
    setFromToken(toToken);
    setToToken(temp);
  };

  const getTokenDetails = (mint: string) => {
    return tokens.find(t => t.mint === mint) || null;
  };

  const fromTokenDetails = getTokenDetails(fromToken);
  const toTokenDetails = getTokenDetails(toToken);

  return (
    <Card className="memecoin-card">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-xl">
          <ArrowDownUp className="h-5 w-5 text-solana" />
          Swap Tokens
        </CardTitle>
        <CardDescription>
          Swap your tokens at the best rates across multiple DEXs
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* From Token */}
        <div className="space-y-2">
          <Label htmlFor="fromToken">From</Label>
          <div className="flex space-x-2">
            <select
              id="fromToken"
              value={fromToken}
              onChange={(e) => setFromToken(e.target.value)}
              className="w-1/3 h-10 px-3 py-2 bg-background/50 border border-border rounded-md focus:outline-none focus:ring-2 focus:ring-solana"
            >
              {tokens.map((token) => (
                <option key={`from-${token.mint}`} value={token.mint}>
                  {token.symbol}
                </option>
              ))}
            </select>
            <Input
              type="number"
              value={amount}
              onChange={(e) => setAmount(Number(e.target.value))}
              min={0.000001}
              placeholder="Amount"
              className="w-2/3"
            />
          </div>
          {fromTokenDetails && (
            <div className="flex items-center text-sm text-muted-foreground">
              <img 
                src={fromTokenDetails.logoURI} 
                alt={fromTokenDetails.symbol}
                className="w-4 h-4 mr-1 rounded-full"
              />
              {fromTokenDetails.name}
            </div>
          )}
        </div>
        
        {/* Switch Button */}
        <div className="flex justify-center">
          <Button 
            variant="outline" 
            size="icon" 
            onClick={switchTokens}
            className="rounded-full"
          >
            <ArrowDownUp className="h-4 w-4" />
          </Button>
        </div>
        
        {/* To Token */}
        <div className="space-y-2">
          <Label htmlFor="toToken">To (estimated)</Label>
          <div className="flex space-x-2">
            <select
              id="toToken"
              value={toToken}
              onChange={(e) => setToToken(e.target.value)}
              className="w-1/3 h-10 px-3 py-2 bg-background/50 border border-border rounded-md focus:outline-none focus:ring-2 focus:ring-solana"
            >
              {tokens.map((token) => (
                <option key={`to-${token.mint}`} value={token.mint}>
                  {token.symbol}
                </option>
              ))}
            </select>
            <Input
              type="text"
              value={quote ? quote.outAmount.toFixed(6) : "0"}
              readOnly
              className="w-2/3 bg-background/30"
            />
          </div>
          {toTokenDetails && (
            <div className="flex items-center text-sm text-muted-foreground">
              <img 
                src={toTokenDetails.logoURI} 
                alt={toTokenDetails.symbol}
                className="w-4 h-4 mr-1 rounded-full"
              />
              {toTokenDetails.name}
            </div>
          )}
        </div>
        
        {/* Slippage Settings */}
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
        </div>
        
        {/* Quote Details */}
        {quote && (
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
            {isGettingQuote && (
              <div className="flex justify-center">
                <RefreshCw className="h-4 w-4 animate-spin text-muted-foreground" />
              </div>
            )}
          </div>
        )}
        
        {/* Swap Button */}
        <Button 
          onClick={handleSwap} 
          className="w-full bg-solana hover:bg-solana-dark text-primary-foreground" 
          disabled={isSwapping || !wallet.connected || !quote}
        >
          {isSwapping ? (
            <span className="flex items-center gap-2">
              <RefreshCw className="h-4 w-4 animate-spin" /> Swapping...
            </span>
          ) : !wallet.connected ? (
            "Connect Wallet to Swap"
          ) : (
            "Swap"
          )}
        </Button>
      </CardContent>
      <CardFooter className="text-xs text-center text-muted-foreground">
        Powered by V6 Swap API. Trading incurs a 0.25% fee.
      </CardFooter>
    </Card>
  );
}
