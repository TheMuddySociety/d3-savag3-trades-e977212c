/**
 * Jupiter V6 API Service
 *
 * Direct integration with Jupiter's v6 API for users with custom RPC/API keys.
 * Implements the quote → swap-instructions → versioned-tx flow from the
 * QuickNode trading bot guide, adapted for browser-side wallet signing.
 *
 * Falls back to this path when the user has a custom Jupiter API key configured
 * in Settings → API & RPC. Default users continue to use JupiterUltraService.
 */

import {
  Connection,
  PublicKey,
  TransactionInstruction,
  TransactionMessage,
  VersionedTransaction,
  AddressLookupTableAccount,
} from '@solana/web3.js';
import { toast } from 'sonner';
import { getCustomApiSettings } from '@/utils/getCustomApiSettings';
import { PLATFORM_CONFIG } from '@/config/platform';

// ─── Types ──────────────────────────────────────────────────────────

export interface QuoteParams {
  inputMint: string;
  outputMint: string;
  amount: string;              // In smallest unit (lamports / base units)
  slippageBps?: number;        // Default: 300 (3%)
  swapMode?: 'ExactIn' | 'ExactOut';
  onlyDirectRoutes?: boolean;
  maxAccounts?: number;
}

export interface QuoteResponse {
  inputMint: string;
  outputMint: string;
  inAmount: string;
  outAmount: string;
  otherAmountThreshold: string;
  swapMode: string;
  slippageBps: number;
  priceImpactPct: string;
  routePlan: any[];
  contextSlot: number;
  timeTaken: number;
}

export interface SwapInstructionsResponse {
  tokenLedgerInstruction: InstructionData | null;
  computeBudgetInstructions: InstructionData[];
  setupInstructions: InstructionData[];
  swapInstruction: InstructionData;
  cleanupInstruction: InstructionData | null;
  addressLookupTableAddresses: string[];
}

interface InstructionData {
  programId: string;
  accounts: { pubkey: string; isSigner: boolean; isWritable: boolean }[];
  data: string;
}

// ─── Service ────────────────────────────────────────────────────────

export class JupiterV6Service {
  private baseUrl: string;
  private connection: Connection;

  constructor() {
    this.baseUrl = PLATFORM_CONFIG.JUPITER_V6_API_URL;
    this.connection = new Connection(PLATFORM_CONFIG.RPC_URL, 'confirmed');
  }

  private getHeaders(): Record<string, string> {
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

  // ── Quote ─────────────────────────────────────────────────────────

  /**
   * Get a swap quote from Jupiter v6 API
   */
  async getQuote(params: QuoteParams): Promise<QuoteResponse> {
    const {
      inputMint,
      outputMint,
      amount,
      slippageBps = 300,
      swapMode = 'ExactIn',
      onlyDirectRoutes = false,
      maxAccounts,
    } = params;

    const queryParams = new URLSearchParams({
      inputMint,
      outputMint,
      amount,
      slippageBps: String(slippageBps),
      swapMode,
    });

    if (onlyDirectRoutes) queryParams.set('onlyDirectRoutes', 'true');
    if (maxAccounts) queryParams.set('maxAccounts', String(maxAccounts));

    const res = await fetch(`${this.baseUrl}/quote?${queryParams}`, {
      headers: this.getHeaders(),
    });

    if (!res.ok) {
      const body = await res.text();
      throw new Error(`Quote failed (${res.status}): ${body}`);
    }

    return res.json();
  }

  // ── Swap Instructions ─────────────────────────────────────────────

  /**
   * Get swap instructions (not a pre-built tx) for advanced tx composition
   */
  async getSwapInstructions(
    quote: QuoteResponse,
    userPublicKey: string,
  ): Promise<SwapInstructionsResponse> {
    const res = await fetch(`${this.baseUrl}/swap-instructions`, {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify({
        quoteResponse: quote,
        userPublicKey,
        prioritizationFeeLamports: 'auto',
        dynamicComputeUnitLimit: true,
      }),
    });

    if (!res.ok) {
      const body = await res.text();
      throw new Error(`Swap instructions failed (${res.status}): ${body}`);
    }

    return res.json();
  }

  // ── Build & Send ──────────────────────────────────────────────────

  /**
   * Full v6 swap flow: quote → instructions → build versioned tx → sign → send
   */
  async buildAndSendSwap(
    wallet: any,
    params: QuoteParams,
  ): Promise<{ signature: string; quote: QuoteResponse } | null> {
    try {
      if (!wallet.publicKey || !wallet.signTransaction) {
        toast.error('Wallet not connected');
        return null;
      }

      const userPubkey = wallet.publicKey.toBase58();

      // 1. Get quote
      console.log('[JupiterV6] Getting quote...');
      const quote = await this.getQuote(params);
      console.log('[JupiterV6] Quote:', {
        in: quote.inAmount,
        out: quote.outAmount,
        impact: quote.priceImpactPct,
      });

      // 2. Get swap instructions
      console.log('[JupiterV6] Getting swap instructions...');
      const ixResponse = await this.getSwapInstructions(quote, userPubkey);

      // 3. Convert instruction data to TransactionInstruction objects
      const instructions: TransactionInstruction[] = [
        ...ixResponse.computeBudgetInstructions.map(this.toInstruction),
        ...ixResponse.setupInstructions.map(this.toInstruction),
        this.toInstruction(ixResponse.swapInstruction),
      ].filter(Boolean) as TransactionInstruction[];

      if (ixResponse.cleanupInstruction) {
        instructions.push(this.toInstruction(ixResponse.cleanupInstruction)!);
      }

      // 4. Resolve address lookup tables
      const addressLookupTableAccounts = await this.resolveAddressLookupTables(
        ixResponse.addressLookupTableAddresses
      );

      // 5. Build versioned transaction
      const { blockhash, lastValidBlockHeight } =
        await this.connection.getLatestBlockhash('confirmed');

      const messageV0 = new TransactionMessage({
        payerKey: wallet.publicKey,
        recentBlockhash: blockhash,
        instructions,
      }).compileToV0Message(addressLookupTableAccounts);

      const transaction = new VersionedTransaction(messageV0);

      // 6. Sign with user's wallet
      console.log('[JupiterV6] Signing transaction...');
      const signedTx = await wallet.signTransaction(transaction);

      // 7. Send via user's RPC
      console.log('[JupiterV6] Sending transaction...');
      const rawTransaction = signedTx.serialize();
      const txid = await this.connection.sendRawTransaction(rawTransaction, {
        skipPreflight: true,
        maxRetries: 2,
      });

      // 8. Confirm
      console.log('[JupiterV6] Confirming:', txid);
      const confirmation = await this.connection.confirmTransaction(
        { signature: txid, blockhash, lastValidBlockHeight },
        'confirmed'
      );

      if (confirmation.value.err) {
        throw new Error(`Transaction failed: ${JSON.stringify(confirmation.value.err)}`);
      }

      toast.success(`Swap confirmed! Tx: ${txid.slice(0, 8)}...`);
      return { signature: txid, quote };
    } catch (error) {
      console.error('[JupiterV6] Swap error:', error);
      toast.error(`V6 swap failed: ${error instanceof Error ? error.message : 'Unknown'}`);
      return null;
    }
  }

  // ── Helpers ───────────────────────────────────────────────────────

  private toInstruction(ix: InstructionData | null): TransactionInstruction | null {
    if (!ix) return null;
    return new TransactionInstruction({
      programId: new PublicKey(ix.programId),
      keys: ix.accounts.map((acc) => ({
        pubkey: new PublicKey(acc.pubkey),
        isSigner: acc.isSigner,
        isWritable: acc.isWritable,
      })),
      data: Buffer.from(ix.data, 'base64'),
    });
  }

  private async resolveAddressLookupTables(
    addresses: string[]
  ): Promise<AddressLookupTableAccount[]> {
    if (!addresses || addresses.length === 0) return [];

    const accounts: AddressLookupTableAccount[] = [];

    for (const addr of addresses) {
      try {
        const res = await this.connection.getAddressLookupTable(new PublicKey(addr));
        if (res.value) {
          accounts.push(res.value);
        }
      } catch (e) {
        console.warn(`[JupiterV6] Failed to resolve ALT ${addr}:`, e);
      }
    }

    return accounts;
  }

  /**
   * Check if user has a custom Jupiter API key configured
   */
  static isV6Available(): boolean {
    const settings = getCustomApiSettings();
    return !!(settings?.useCustomJupiter && settings.jupiterApiKey);
  }
}

export const jupiterV6Service = new JupiterV6Service();
