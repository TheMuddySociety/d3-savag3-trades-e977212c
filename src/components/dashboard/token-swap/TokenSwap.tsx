
import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { ArrowDownUp, Info } from "lucide-react";
import { cn } from "@/lib/utils";
import { useWallet, useConnection } from '@solana/wallet-adapter-react';
import { toast } from "sonner";
import { TokenService, JupiterQuoteService } from '@/services/jupiter';
import { Button } from "@/components/ui/button";
import { TokenSelector } from './TokenSelector';
import { SlippageSelector } from './SlippageSelector';
import { QuoteDetails } from './QuoteDetails';
import { SwapSettings } from './SwapSettings';
import { SwapButton } from './SwapButton';

export function TokenSwap() {
  const { connection } = useConnection();
  const { publicKey, signTransaction, connected } = useWallet();
  const [isSwapping, setIsSwapping] = useState(false);
  const [tokens, setTokens] = useState<any[]>([]);
  const [fromToken, setFromToken] = useState<string>('');
  const [toToken, setToToken] = useState<string>('');
  const [amount, setAmount] = useState<number>(1);
  const [slippage, setSlippage] = useState<number>(1); // 1%
  const [maxAccounts, setMaxAccounts] = useState<number | undefined>(undefined);
  const [priorityLevel, setPriorityLevel] = useState<'low' | 'medium' | 'high' | 'veryHigh' | undefined>(undefined);
  const [useDynamicSlippage, setUseDynamicSlippage] = useState<boolean>(false);
  const [quote, setQuote] = useState<any>(null);
  const [isGettingQuote, setIsGettingQuote] = useState(false);

  useEffect(() => {
    // Initialize with common tokens
    const commonTokens = TokenService.getCommonTokens();
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
  }, [fromToken, toToken, amount, maxAccounts]);

  const getQuote = async () => {
    if (!fromToken || !toToken || amount <= 0) return;
    
    setIsGettingQuote(true);
    
    try {
      const quoteResult = await JupiterQuoteService.getSwapQuote(
        connection,
        fromToken,
        toToken,
        amount,
        maxAccounts
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
    if (!connected || !publicKey || !signTransaction) {
      toast.error("Please connect your wallet first");
      return;
    }
    
    if (!fromToken || !toToken || amount <= 0) {
      toast.error("Please select tokens and enter an amount");
      return;
    }
    
    setIsSwapping(true);
    
    try {
      // We'll use the JupiterTransactionService here via SwapService facade
      const txSignature = await JupiterQuoteService.swapTokens(
        connection,
        {
          publicKey,
          signTransaction,
        },
        fromToken,
        toToken,
        amount,
        slippage * 100, // Convert percentage to basis points
        maxAccounts,
        priorityLevel,
        useDynamicSlippage
      );
      
      if (!txSignature) {
        throw new Error("Failed to perform swap");
      }
      
      console.log('Swap transaction signature:', txSignature);
      
    } catch (error) {
      console.error('Error performing swap:', error);
      toast.error(`Swap failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setIsSwapping(false);
    }
  };

  const switchTokens = () => {
    const temp = fromToken;
    setFromToken(toToken);
    setToToken(temp);
  };

  const fromTokenDetails = tokens.find(t => t.mint === fromToken) || null;
  const toTokenDetails = tokens.find(t => t.mint === toToken) || null;

  return (
    <Card className="memecoin-card">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2 text-xl">
              <ArrowDownUp className="h-5 w-5 text-solana" />
              Swap Tokens
            </CardTitle>
            <CardDescription>
              Swap your tokens at the best rates across multiple DEXs
            </CardDescription>
          </div>
          <SwapSettings 
            maxAccounts={maxAccounts}
            setMaxAccounts={setMaxAccounts}
            priorityLevel={priorityLevel}
            setPriorityLevel={setPriorityLevel}
          />
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* From Token */}
        <TokenSelector 
          label="From"
          tokens={tokens}
          selectedToken={fromToken}
          onTokenChange={setFromToken}
          amount={amount}
          onAmountChange={setAmount}
        />
        
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
        <TokenSelector 
          label="To (estimated)"
          tokens={tokens}
          selectedToken={toToken}
          onTokenChange={setToToken}
          readonly={true}
          value={quote ? quote.outAmount.toFixed(6) : "0"}
        />
        
        {/* Slippage Settings */}
        <SlippageSelector 
          slippage={slippage}
          setSlippage={setSlippage}
          useDynamicSlippage={useDynamicSlippage}
          setUseDynamicSlippage={setUseDynamicSlippage}
        />
        
        {/* Quote Details */}
        {quote && (
          <QuoteDetails 
            quote={quote}
            fromTokenDetails={fromTokenDetails}
            toTokenDetails={toTokenDetails}
            amount={amount}
            isGettingQuote={isGettingQuote}
            maxAccounts={maxAccounts}
            priorityLevel={priorityLevel}
            useDynamicSlippage={useDynamicSlippage}
            slippage={slippage}
          />
        )}
        
        {/* Connect Wallet or Swap Button */}
        <SwapButton 
          connected={connected}
          isSwapping={isSwapping}
          quote={quote}
          handleSwap={handleSwap}
        />
      </CardContent>
      <CardFooter className="text-xs text-center text-muted-foreground">
        Powered by Jupiter V6 API. Trading incurs a 0.25% fee.
      </CardFooter>
    </Card>
  );
}
