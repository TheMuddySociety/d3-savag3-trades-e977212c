
import { Connection } from '@solana/web3.js';
import { 
  JupiterQuoteService, 
  JupiterTransactionService,
  TokenService 
} from './jupiter';

/**
 * Facade service for all swap-related operations
 * This class delegates to specialized Jupiter services
 */
export class SwapService {
  /**
   * Get Jupiter quote for a token swap
   */
  static async getSwapQuote(
    connection: Connection,
    fromToken: string, 
    toToken: string,
    amount: number,
    maxAccounts?: number
  ) {
    return JupiterQuoteService.getSwapQuote(
      connection,
      fromToken,
      toToken,
      amount,
      maxAccounts
    );
  }

  /**
   * Perform an actual token swap
   */
  static async swapTokens(
    connection: Connection,
    wallet: any,
    fromToken: string,
    toToken: string,
    amount: number,
    slippageBps: number = 100,
    maxAccounts?: number,
    priorityLevel?: 'low' | 'medium' | 'high' | 'veryHigh',
    useDynamicSlippage?: boolean
  ) {
    return JupiterTransactionService.performSwap(
      connection,
      wallet,
      fromToken,
      toToken,
      amount,
      slippageBps,
      maxAccounts,
      priorityLevel,
      useDynamicSlippage
    );
  }

  /**
   * Get common token list
   */
  static getCommonTokens() {
    return TokenService.getCommonTokens();
  }
}
