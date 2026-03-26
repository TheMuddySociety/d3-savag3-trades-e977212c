import { VersionedTransaction, Connection } from '@solana/web3.js';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { getCustomApiSettings } from '@/utils/getCustomApiSettings';
import { PLATFORM_CONFIG } from '@/config/platform';

export interface SwapOrderResponse {
  inputMint: string;
  outputMint: string;
  inAmount: string;
  outAmount: string;
  otherAmountThreshold: string;
  swapMode: string;
  slippageBps: number;
  priceImpactPct: string;
  routePlan: any[];
  feeBps?: number;
  transaction: string;
  requestId: string;
  gasless?: boolean;
  inUsdValue?: number;
  outUsdValue?: number;
  swapUsdValue?: number;
  priceImpact?: number;
  mode?: string;
  totalTime?: number;
}

export interface SwapExecuteResponse {
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

export class JupiterV2Service {
  private static connection = new Connection(PLATFORM_CONFIG.RPC_URL, 'confirmed');

  private static getHeaders(): Record<string, string> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
    };
    const settings = getCustomApiSettings();
    if (settings?.useCustomJupiter && settings.jupiterApiKey) {
      headers['x-api-key'] = settings.jupiterApiKey;
    }
    return headers;
  }

  /**
   * Get an order (quote + transaction) from Jupiter Swap API V2
   */
  static async getOrder(
    inputMint: string,
    outputMint: string,
    amount: string,
    taker: string,
    slippageBps: number = 300,
    swapMode: 'ExactIn' | 'ExactOut' = 'ExactIn'
  ): Promise<SwapOrderResponse | null> {
    try {
      const settings = getCustomApiSettings();
      const useCustom = settings?.useCustomJupiter && settings.jupiterApiKey;

      if (useCustom) {
        console.log('[JupiterV2] Fetching direct Swap V2 order...');
        const queryParams = new URLSearchParams({
          inputMint,
          outputMint,
          amount,
          taker,
          swapMode,
          slippageBps: String(slippageBps),
        });
        const res = await fetch(`https://api.jup.ag/swap/v2/order?${queryParams.toString()}`, {
          headers: this.getHeaders(),
        });
        if (!res.ok) throw new Error(`Swap V2 order failed: ${res.status}`);
        return await res.json();
      } else {
        console.log('[JupiterV2] Fetching Swap V2 order via proxy...');
        const { data, error } = await supabase.functions.invoke('jupiter-ultra', {
          body: { action: 'order', inputMint, outputMint, amount, taker, swapMode, slippageBps },
        });
        if (error) throw new Error(error.message);
        if (!data?.success) throw new Error(data?.error || 'Order failed');
        return data.data as SwapOrderResponse;
      }
    } catch (error) {
      console.error('[JupiterV2] Error getting order:', error);
      toast.error(`Order failed: ${error instanceof Error ? error.message : 'Unknown'}`);
      return null;
    }
  }

  /**
   * Execute a signed transaction
   */
  static async execute(
    signedTransaction: string,
    requestId: string,
    useHelius: boolean = false
  ): Promise<SwapExecuteResponse | null> {
    try {
      const settings = getCustomApiSettings();
      const useCustom = settings?.useCustomJupiter && settings.jupiterApiKey;

      if (useCustom) {
        console.log('[JupiterV2] Executing direct Swap V2...');
        const res = await fetch(`https://api.jup.ag/swap/v2/execute`, {
          method: 'POST',
          headers: this.getHeaders(),
          body: JSON.stringify({ signedTransaction, requestId }),
        });
        if (!res.ok) throw new Error(`Execute failed: ${res.status}`);
        return await res.json();
      } else {
        console.log('[JupiterV2] Executing Swap V2 via proxy...');
        const { data, error } = await supabase.functions.invoke('jupiter-ultra', {
          body: { action: 'execute', signedTransaction, requestId, useHelius },
        });
        if (error) throw new Error(error.message);
        if (!data?.success) throw new Error(data?.error || 'Execute failed');
        return data.data as SwapExecuteResponse;
      }
    } catch (error) {
      console.error('[JupiterV2] Error executing swap:', error);
      toast.error('Swap execution failed');
      return null;
    }
  }

  /**
   * Universal Swap Flow
   */
  static async swap(
    wallet: any,
    inputMint: string,
    outputMint: string,
    amount: string,
    slippageBps: number = 300,
    swapMode: 'ExactIn' | 'ExactOut' = 'ExactIn'
  ): Promise<SwapExecuteResponse | null> {
    try {
      if (!wallet.publicKey || !wallet.signTransaction) {
        toast.error('Wallet not connected');
        return null;
      }

      const taker = wallet.publicKey.toString();

      // 1. Get Order
      const order = await this.getOrder(inputMint, outputMint, amount, taker, slippageBps, swapMode);
      if (!order || !order.transaction) return null;

      // 2. Sign
      const transaction = VersionedTransaction.deserialize(Buffer.from(order.transaction, 'base64'));
      const signedTx = await wallet.signTransaction(transaction);
      const signedTxBase64 = Buffer.from(signedTx.serialize()).toString('base64');

      // 3. Execute
      const result = await this.execute(signedTxBase64, order.requestId);
      if (!result) return null;

      if (result.status === 'Success') {
        toast.success(`Swap successful! Tx: ${result.signature?.substring(0, 8)}...`);
        // Log trade locally
        this.logTrade(taker, result, order, inputMint, outputMint);
      } else {
        toast.error(`Swap failed: ${result.error || 'Unknown error'}`);
      }

      return result;
    } catch (error) {
      console.error('[JupiterV2] Flow error:', error);
      toast.error('Swap failed');
      return null;
    }
  }

  private static async logTrade(
    walletAddress: string,
    result: SwapExecuteResponse,
    order: SwapOrderResponse,
    inputMint: string,
    outputMint: string
  ) {
    try {
      await supabase.from('live_trades').insert({
        wallet_address: walletAddress,
        tx_signature: result.signature || '',
        input_mint: inputMint,
        output_mint: outputMint,
        input_amount: parseFloat(order.inAmount) || 0,
        output_amount: parseFloat(order.outAmount) || 0,
        input_usd_value: order.inUsdValue || 0,
        output_usd_value: order.outUsdValue || 0,
        status: 'success',
        trade_type: 'swap',
      });
    } catch (e) {
      console.warn('Failed to log trade:', e);
    }
  }
}
