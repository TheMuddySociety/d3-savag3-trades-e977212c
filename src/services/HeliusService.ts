
import { toast } from 'sonner';

const API_KEY = '251ce93e-be5b-4d6e-9c96-a9805fae66de';
const BASE_URL = 'https://api.helius.xyz/v0'; // Standard Helius base

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
      console.log(`Fetching history for ${address} from Helius...`);
      const url = `${BASE_URL}/addresses/${address}/transactions?api-key=${API_KEY}`;
      
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`Helius API error: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();
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
      const url = `${BASE_URL}/transactions?api-key=${API_KEY}`;
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ transactions: signatures }),
      });

      if (!response.ok) {
        throw new Error(`Helius API error: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();
      return data as HeliusTransaction[];
    } catch (error) {
      console.error('Error parsing transactions with Helius:', error);
      return [];
    }
  }
}
