
import { VersionedTransaction } from '@solana/web3.js';
import { toast } from 'sonner';
import fetch from 'cross-fetch';

const ULTRA_API_BASE = 'https://api.jup.ag/ultra/v1';

export interface UltraOrderResponse {
  inputMint: string;
  outputMint: string;
  inAmount: string;
  outAmount: string;
  otherAmountThreshold: string;
  swapMode: string;
  slippageBps: number;
  priceImpactPct: string;
  routePlan: any[];
  feeBps: number;
  transaction: string;
  requestId: string;
  gasless: boolean;
  inUsdValue: number;
  outUsdValue: number;
  swapUsdValue: number;
  priceImpact: number;
  mode: string;
  totalTime: number;
}

export interface UltraExecuteResponse {
  status: 'Success' | 'Failed';
  signature?: string;
  slot?: string;
  error?: string;
  code: number;
  totalInputAmount?: string;
  totalOutputAmount?: string;
  inputAmountResult?: string;
  outputAmountResult?: string;
  swapEvents?: Array<{
    inputMint: string;
    inputAmount: string;
    outputMint: string;
    outputAmount: string;
  }>;
}

/**
 * Service for Jupiter Ultra API (gasless swaps with best execution)
 */
export class JupiterUltraService {
  /**
   * Get an order (quote + transaction) from Jupiter Ultra
   */
  static async getOrder(
    inputMint: string,
    outputMint: string,
    amount: string,
    taker: string,
    swapMode: 'ExactIn' | 'ExactOut' = 'ExactIn'
  ): Promise<UltraOrderResponse | null> {
    try {
      const url = `${ULTRA_API_BASE}/order?inputMint=${inputMint}&outputMint=${outputMint}&amount=${amount}&taker=${taker}&swapMode=${swapMode}`;
      
      console.log('Fetching Jupiter Ultra order:', url);
      const response = await fetch(url);
      
      if (!response.ok) {
        const errorBody = await response.text();
        throw new Error(`Ultra order error: ${response.status} ${errorBody}`);
      }
      
      const order: UltraOrderResponse = await response.json();
      console.log('Ultra order received:', {
        inAmount: order.inAmount,
        outAmount: order.outAmount,
        priceImpact: order.priceImpactPct,
        gasless: order.gasless,
        requestId: order.requestId,
      });
      
      return order;
    } catch (error) {
      console.error('Error getting Ultra order:', error);
      toast.error('Failed to get swap order');
      return null;
    }
  }

  /**
   * Execute a signed transaction via Jupiter Ultra
   */
  static async execute(
    signedTransaction: string,
    requestId: string
  ): Promise<UltraExecuteResponse | null> {
    try {
      console.log('Executing Ultra swap, requestId:', requestId);
      
      const response = await fetch(`${ULTRA_API_BASE}/execute`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ signedTransaction, requestId }),
      });
      
      if (!response.ok) {
        const errorBody = await response.text();
        throw new Error(`Ultra execute error: ${response.status} ${errorBody}`);
      }
      
      const result: UltraExecuteResponse = await response.json();
      console.log('Ultra execute result:', result);
      
      return result;
    } catch (error) {
      console.error('Error executing Ultra swap:', error);
      toast.error('Failed to execute swap');
      return null;
    }
  }

  /**
   * Full swap flow: get order → sign → execute
   */
  static async swap(
    wallet: any,
    inputMint: string,
    outputMint: string,
    amount: string,
    swapMode: 'ExactIn' | 'ExactOut' = 'ExactIn'
  ): Promise<UltraExecuteResponse | null> {
    try {
      if (!wallet.publicKey || !wallet.signTransaction) {
        toast.error('Wallet not connected');
        return null;
      }

      const taker = wallet.publicKey.toString();

      // 1. Get order
      const order = await this.getOrder(inputMint, outputMint, amount, taker, swapMode);
      if (!order) return null;

      // 2. Deserialize and sign the transaction
      const transactionBuf = Buffer.from(order.transaction, 'base64');
      const transaction = VersionedTransaction.deserialize(transactionBuf);
      const signedTx = await wallet.signTransaction(transaction);

      // 3. Serialize the signed transaction back to base64
      const signedTxBase64 = Buffer.from(signedTx.serialize()).toString('base64');

      // 4. Execute via Ultra API
      const result = await this.execute(signedTxBase64, order.requestId);
      
      if (!result) return null;

      if (result.status === 'Success') {
        toast.success(`Swap successful! Tx: ${result.signature?.substring(0, 8)}...`);
      } else {
        toast.error(`Swap failed: ${result.error || 'Unknown error'}`);
      }

      return result;
    } catch (error) {
      console.error('Error in Ultra swap flow:', error);
      toast.error(`Swap failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
      return null;
    }
  }
}
