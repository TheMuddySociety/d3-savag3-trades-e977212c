
import { VersionedTransaction } from '@solana/web3.js';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { JupiterV6Service, jupiterV6Service } from './v6';
import { JupiterV2Service } from './v2';

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
 * Service for Jupiter Ultra API via edge function proxy (handles auth)
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
      console.log('Fetching Jupiter Ultra order via proxy...');
      const { data, error } = await supabase.functions.invoke('jupiter-ultra', {
        body: { action: 'order', inputMint, outputMint, amount, taker, swapMode },
      });

      if (error) throw new Error(error.message);
      if (!data?.success) throw new Error(data?.error || 'Order failed');

      const order = data.data as UltraOrderResponse;
      
      // Log warning if order has error but still return it for caller to handle
      if ((order as any).errorCode) {
        console.warn('Jupiter Ultra order has error:', (order as any).errorMessage);
      }

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
      toast.error(`Failed to get swap order: ${error instanceof Error ? error.message : 'Unknown'}`);
      return null;
    }
  }

  /**
   * Execute a signed transaction via Jupiter Ultra
   */
  static async execute(
    signedTransaction: string,
    requestId: string,
    useHelius: boolean = false
  ): Promise<UltraExecuteResponse | null> {
    try {
      console.log('Executing Ultra swap via proxy, requestId:', requestId, 'useHelius:', useHelius);
      
      const { data, error } = await supabase.functions.invoke('jupiter-ultra', {
        body: { action: 'execute', signedTransaction, requestId, useHelius },
      });

      if (error) throw new Error(error.message);
      if (!data?.success) throw new Error(data?.error || 'Execute failed');

      const result = data.data as UltraExecuteResponse;
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
    swapMode: 'ExactIn' | 'ExactOut' = 'ExactIn',
    useHelius: boolean = false
  ): Promise<UltraExecuteResponse | null> {
    try {
      if (!wallet.publicKey || !wallet.signTransaction) {
        toast.error('Wallet not connected');
        return null;
      }

      const taker = wallet.publicKey.toString();

      // 1. Get order via proxy
      const order = await this.getOrder(inputMint, outputMint, amount, taker, swapMode);
      if (!order) return null;

      // Check for API-level errors (e.g. insufficient funds)
      if ((order as any).errorCode || (order as any).error) {
        const errMsg = (order as any).errorMessage || (order as any).error || 'Order error';
        toast.error(errMsg);
        return { status: 'Failed', error: errMsg, code: (order as any).errorCode || -1 } as UltraExecuteResponse;
      }

      // Ensure transaction data exists
      if (!order.transaction) {
        toast.error('No transaction returned from Jupiter');
        return { status: 'Failed', error: 'Empty transaction', code: -1 } as UltraExecuteResponse;
      }

      // 2. Deserialize and sign the transaction
      const transactionBuf = Buffer.from(order.transaction, 'base64');
      const transaction = VersionedTransaction.deserialize(transactionBuf);
      const signedTx = await wallet.signTransaction(transaction);

      // 3. Serialize the signed transaction back to base64
      const signedTxBase64 = Buffer.from(signedTx.serialize()).toString('base64');

      // 4. Execute via proxy
      const result = await this.execute(signedTxBase64, order.requestId, useHelius);
      
      if (!result) return null;

      if (result.status === 'Success') {
        toast.success(`Swap successful! Tx: ${result.signature?.substring(0, 8)}...`);

        // Log trade to live_trades table
        try {
          await supabase.from('live_trades').insert({
            wallet_address: taker,
            tx_signature: result.signature || '',
            input_mint: inputMint,
            output_mint: outputMint,
            input_amount: parseFloat(order.inAmount) || 0,
            output_amount: parseFloat(order.outAmount) || 0,
            input_usd_value: order.inUsdValue || 0,
            output_usd_value: order.outUsdValue || 0,
            input_symbol: null,
            output_symbol: null,
            status: 'success',
            trade_type: 'swap',
            bot_type: null,
          });
        } catch (logErr) {
          console.warn('Failed to log trade:', logErr);
        }
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

  /**
   * Smart swap: routes through unified V2 service
   */
  static async smartSwap(
    wallet: any,
    inputMint: string,
    outputMint: string,
    amount: string,
    slippageBps: number = 300,
    swapMode: 'ExactIn' | 'ExactOut' = 'ExactIn',
  ): Promise<UltraExecuteResponse | null> {
    console.log('[SmartSwap] Using unified Jupiter V2 architecture');
    const result = await JupiterV2Service.swap(wallet, inputMint, outputMint, amount, slippageBps, swapMode);
    return result as UltraExecuteResponse | null;
  }

  /**
   * Get a price quote without building a transaction (for display / price checking)
   */
  static async getQuoteOnly(
    inputMint: string,
    outputMint: string,
    amount: string,
  ): Promise<{ inAmount: string; outAmount: string; priceImpactPct: string } | null> {
    try {
      const res = await fetch(
        `https://quote-api.jup.ag/v6/quote?inputMint=${inputMint}&outputMint=${outputMint}&amount=${amount}&slippageBps=300`
      );
      if (!res.ok) return null;
      const data = await res.json();
      return {
        inAmount: data.inAmount,
        outAmount: data.outAmount,
        priceImpactPct: data.priceImpactPct,
      };
    } catch {
      return null;
    }
  }
}
