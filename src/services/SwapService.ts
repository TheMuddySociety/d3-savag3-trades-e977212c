
import { Connection } from '@solana/web3.js';
import { 
  JupiterQuoteService, 
  JupiterTransactionService,
  JupiterUltraService,
  TokenService 
} from './jupiter';
import { SolanaClient } from '@/utils/solanaClient';

/**
 * Facade service for all swap-related operations
 * This class delegates to specialized Jupiter services
 */
export class SwapService {
  /**
   * Get Jupiter quote for a token swap
   */
  static async getSwapQuote(
    connection: Connection | SolanaClient,
    fromToken: string, 
    toToken: string,
    amount: number,
    maxAccounts?: number
  ) {
    // If a SolanaClient is provided, use its rpc connection
    const conn = 'rpc' in connection ? connection.rpc : connection;
    
    return JupiterQuoteService.getSwapQuote(
      conn,
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
    connection: Connection | SolanaClient,
    wallet: any,
    fromToken: string,
    toToken: string,
    amount: number,
    slippageBps: number = 100,
    maxAccounts?: number,
    priorityLevel?: 'low' | 'medium' | 'high' | 'veryHigh',
    useDynamicSlippage?: boolean
  ) {
    // If a SolanaClient is provided, use its rpc connection
    const conn = 'rpc' in connection ? connection.rpc : connection;
    
    return JupiterTransactionService.swapTokens(
      conn,
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
  
  /**
   * Get all tokens including new listings from Bullme API
   */
  static async getAllTokens() {
    return TokenService.getAllTokens();
  }
}
