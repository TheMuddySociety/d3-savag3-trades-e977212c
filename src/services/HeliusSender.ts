
import { 
  Connection, 
  PublicKey, 
  Transaction, 
  VersionedTransaction, 
  ComputeBudgetProgram, 
  SystemProgram, 
  TransactionMessage,
  LAMPORTS_PER_SOL
} from '@solana/web3.js';

import { supabase } from '@/integrations/supabase/client';

const TIP_ACCOUNTS = [
  "4ACfpUFoaSD9bfPdeu6DBt89gB6ENTeHBXCAi87NhDEE",
  "D2L6yPZ2FmmmTKPgzaMKdhu6EWZcTpLy1Vhx8uvZe7NZ",
  "9bnz4RShgq1hAnLnZbP8kbgBg1kEmcJBYQq3gQbmnSta",
  "5VY91ws6B2hMmBFRsXkoAAdsPHBJwRfBht4DXox3xkwn",
  "2nyhqdwKcJZR2vcqCyrYsaPVdAnFoJjiksCXJ7hfEYgD",
  "2q5pghRs6arqVjRvT5gfgWfWcHWmw1ZuCzphgd5KfWGJ",
  "wyvPkWjVZz1M8fHQnMMCDTQDbkManefNNhweYk5WkcF",
  "3KCKozbAaF75qEU33jtzozcJ29yJuaLJTy2jFdzUY8bT",
  "4vieeGHPYPG2MmyPRcYjdiDmmhN3ww7hsFNap8pVN3Ey",
  "4TQLFNWK8AovT1gFvda5jfw2oJeRMKEmw7aH6MGBJ3or"
];

export type PriorityLevel = 'Min' | 'Low' | 'Medium' | 'High' | 'VeryHigh' | 'UnsafeMax';

export class HeliusSender {
  /**
   * Get an estimated priority fee for a transaction or set of accounts
   */
  static async getPriorityFeeEstimate(
    priorityLevel: PriorityLevel = 'Medium',
    accountKeys?: string[]
  ): Promise<number> {
    try {
      const { data, error } = await supabase.functions.invoke('helius-proxy', {
        body: { 
          action: 'rpc', 
          rpcBody: {
            jsonrpc: '2.0',
            id: 'helius-fee',
            method: 'getPriorityFeeEstimate',
            params: [{
              ...(accountKeys ? { accountKeys } : {}),
              options: { priorityLevel }
            }]
          }
        }
      });

      if (error) throw new Error(error.message);
      return data?.result?.priorityFeeEstimate || 0;
    } catch (error) {
      console.error('Error fetching priority fee:', error);
      return 0;
    }
  }

  /**
   * Send a transaction via Helius Sender for low-latency landing
   */
  static async sendTransaction(
    serializedTx: string, // Base64 or Base58
    encoding: 'base64' | 'base58' = 'base64'
  ): Promise<string | null> {
    try {
      const { data, error } = await supabase.functions.invoke('helius-proxy', {
        body: {
          action: 'send',
          rpcBody: {
            jsonrpc: '2.0',
            id: `helius-send-${Date.now()}`,
            method: 'sendTransaction',
            params: [
              serializedTx,
              {
                encoding,
                skipPreflight: true,
                maxRetries: 0
              }
            ]
          }
        }
      });

      if (error) throw new Error(error.message);
      if (data?.error) throw new Error(data.error.message);
      return data?.result;
    } catch (error) {
      console.error('Error sending transaction via Helius Sender:', error);
      return null;
    }
  }

  /**
   * Create a tip instruction to be added to a transaction
   */
  static createTipInstruction(payer: PublicKey, amountLamports: number = 2000) {
    const tipAccount = new PublicKey(TIP_ACCOUNTS[Math.floor(Math.random() * TIP_ACCOUNTS.length)]);
    return SystemProgram.transfer({
      fromPubkey: payer,
      toPubkey: tipAccount,
      lamports: amountLamports
    });
  }
}
