import { 
  Connection, 
  PublicKey, 
  Transaction, 
  VersionedTransaction, 
  SystemProgram, 
  TransactionMessage
} from '@solana/web3.js';
import { supabase } from '@/integrations/supabase/client';
import { getCustomApiSettings } from '@/utils/getCustomApiSettings';

export class JitoService {
  private static TIP_ACCOUNTS_CACHE: string[] = [];
  private static CACHE_EXPIRY = 0;

  /**
   * Fetch active Jito tip accounts
   */
  static async getTipAccounts(): Promise<string[]> {
    const now = Date.now();
    if (this.TIP_ACCOUNTS_CACHE.length > 0 && now < this.CACHE_EXPIRY) {
      return this.TIP_ACCOUNTS_CACHE;
    }

    try {
      const settings = getCustomApiSettings();
      const engineUrl = settings.jitoBlockEngine || "mainnet.block-engine.jito.wtf";
      
      const { data, error } = await supabase.functions.invoke('jito-proxy', {
        body: {
          engineUrl,
          rpcBody: {
            jsonrpc: "2.0",
            id: 1,
            method: "getTipAccounts",
            params: []
          }
        }
      });

      if (error) throw new Error(error.message);
      const accounts = data?.result || [];
      
      if (accounts.length > 0) {
        this.TIP_ACCOUNTS_CACHE = accounts;
        this.CACHE_EXPIRY = now + 3600_000; // 1 hour cache
      }
      return accounts;
    } catch (error) {
      console.error('Error fetching Jito tip accounts:', error);
      // Fallback to known accounts
      return [
        "9bnz4RShgq1hAnLnZbP8kbgBg1kEmcJBYQq3gQbmnSta",
        "HFqU5x63VTqvQss8hp11i4wVV8bD44PvwucfZ2bU7gRe",
        "Cw8CFyM9FkoMi7K7Crf6HNWoAcFhwPNCHh7D2SBAA8Xy",
        "ADa4Hj2fU3LsiSfsXg2Aggyas71v1LpBRSNoas5vGMAm",
        "ADuUkR4vqMvS2W6ndS9h93mLRM9H8KAsM679zYV8sh9u",
        "DfXygSm4j9vSsu8SXCvGv6XQ6Z9N2XvjN5r8qK5MvpN7",
        "ADuUkR4vqMvS2W6ndS9h93mLRM9H8KAsM679zYV8sh9u",
        "3AVi9Tg9Uo68ayJ9L5S6rZJ9L5S6rZJ9L5S6rZJ9L5S"
      ];
    }
  }

  /**
   * Create a Jito tip instruction
   */
  static async createTipInstruction(payer: PublicKey, amountSOL: number) {
    const accounts = await this.getTipAccounts();
    const tipAccount = new PublicKey(accounts[Math.floor(Math.random() * accounts.length)]);
    const lamports = Math.floor(amountSOL * 1e9);

    return SystemProgram.transfer({
      fromPubkey: payer,
      toPubkey: tipAccount,
      lamports
    });
  }

  /**
   * Send a bundle of transactions to Jito
   */
  static async sendBundle(
    transactions: (Transaction | VersionedTransaction)[],
    engineUrl: string = "mainnet.block-engine.jito.wtf"
  ): Promise<string | null> {
    try {
      const encodedTransactions = transactions.map(tx => {
        if (tx instanceof VersionedTransaction) {
          return Buffer.from(tx.serialize()).toString('base64');
        }
        return tx.serialize().toString('base64');
      });

      const { data, error } = await supabase.functions.invoke('jito-proxy', {
        body: {
          engineUrl,
          rpcBody: {
            jsonrpc: "2.0",
            id: 1,
            method: "sendBundle",
            params: [encodedTransactions]
          }
        }
      });

      if (error) throw new Error(error.message);
      if (data?.error) throw new Error(data.error.message);
      
      return data?.result; // Bundle ID
    } catch (error) {
      console.error('Error sending Jito bundle:', error);
      return null;
    }
  }
}
