
import { Connection } from '@solana/web3.js';
import { toast } from 'sonner';

/**
 * Service for fetching Jupiter swap quotes
 */
export class JupiterQuoteService {
  /**
   * Get Jupiter API quote for a token swap
   * @param inputMint Input token mint address
   * @param outputMint Output token mint address
   * @param amount Amount to swap in lamports
   * @param slippageBps Slippage tolerance in basis points
   * @param maxAccounts Optional parameter to limit the number of accounts in the transaction
   * @returns Quote response from Jupiter API or null if failed
   */
  static async getJupiterQuote(
    inputMint: string,
    outputMint: string, 
    amount: number,
    slippageBps: number = 100,
    maxAccounts?: number
  ): Promise<any | null> {
    try {
      // Jupiter V6 API endpoint for quotes
      let quoteUrl = `https://quote-api.jup.ag/v6/quote?inputMint=${inputMint}&outputMint=${outputMint}&amount=${amount}&slippageBps=${slippageBps}`;
      
      // Add maxAccounts parameter if provided
      if (maxAccounts !== undefined) {
        quoteUrl += `&maxAccounts=${maxAccounts}`;
      }
      
      console.log(`Fetching Jupiter quote: ${quoteUrl}`);
      const response = await fetch(quoteUrl);
      
      if (!response.ok) {
        throw new Error(`Error fetching Jupiter quote: ${response.status} ${response.statusText}`);
      }
      
      const quoteResponse = await response.json();
      console.log('Quote received:', quoteResponse);
      return quoteResponse;
    } catch (error) {
      console.error('Error getting Jupiter quote:', error);
      toast.error("Failed to get swap quote from Jupiter");
      return null;
    }
  }

  /**
   * Get quote for a token swap
   * @param connection Solana connection
   * @param fromToken Token to swap from (mint address)
   * @param toToken Token to swap to (mint address)
   * @param amount Amount to swap in lamports
   * @param maxAccounts Optional parameter to limit the number of accounts in the transaction
   * @returns Quote information or null if failed
   */
  static async getSwapQuote(
    connection: Connection,
    fromToken: string,
    toToken: string,
    amount: number,
    maxAccounts?: number
  ): Promise<{
    inAmount: number;
    outAmount: number;
    priceImpact: number;
    routeInfo: string;
  } | null> {
    try {
      console.log(`Getting quote for ${amount} of ${fromToken} to ${toToken}`);
      
      // Get real quote from Jupiter API
      const jupiterQuote = await this.getJupiterQuote(fromToken, toToken, amount, 100, maxAccounts);
      
      if (jupiterQuote && jupiterQuote.outAmount) {
        return {
          inAmount: amount,
          outAmount: parseFloat(jupiterQuote.outAmount),
          priceImpact: jupiterQuote.priceImpactPct || 0,
          routeInfo: jupiterQuote.routePlan 
            ? `${jupiterQuote.routePlan.length} hop(s) via Jupiter V6`
            : "Jupiter V6 Direct Swap"
        };
      }
      
      // No simulated fallback — return null on failure
      return null;
    } catch (error) {
      console.error('Error getting swap quote:', error);
      return null;
    }
  }
}
