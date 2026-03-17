
import { toast } from 'sonner';

import { supabase } from '@/integrations/supabase/client';

export interface HeliusTransaction {
  description: string;
  type: string;
  source: string;
  fee: number;
  feePayer: string;
  signature: string;
  slot: number;
  timestamp: number;
  tokenTransfers: Array<{
    fromUserAccount: string;
    toUserAccount: string;
    amount: number;
    mint: string;
  }>;
  nativeTransfers: Array<{
    fromUserAccount: string;
    toUserAccount: string;
    amount: number;
  }>;
  events: any;
}

/**
 * Service for interacting with Helius Enhanced APIs
 */
export class HeliusService {
  /**
   * Fetch parsed transaction history for a wallet
   */
  static async getTransactionHistory(address: string, limit: number = 20): Promise<HeliusTransaction[]> {
    try {
      const { data, error } = await supabase.functions.invoke('helius-proxy', {
        body: { action: 'history', address, limit }
      });
      
      if (error) throw new Error(error.message);
      return data as HeliusTransaction[];
    } catch (error) {
      console.error('Error fetching Helius history:', error);
      toast.error('Failed to sync history from Solana');
      return [];
    }
  }

  /**
   * Parse specific transaction signatures
   */
  static async parseTransactions(signatures: string[]): Promise<HeliusTransaction[]> {
    try {
      const { data, error } = await supabase.functions.invoke('helius-proxy', {
        body: { action: 'parse', transactions: signatures }
      });

      if (error) throw new Error(error.message);
      return data as HeliusTransaction[];
    } catch (error) {
      console.error('Error parsing transactions with Helius:', error);
      return [];
    }
  }
}
