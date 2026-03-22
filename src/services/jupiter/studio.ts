
import { VersionedTransaction } from '@solana/web3.js';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';

// ── Bonding Curve Presets ─────────────────────────────────────────
export const CURVE_PRESETS = {
  meme: {
    label: 'Meme',
    description: 'Great for memes. Starts at 16K MC, graduates at 69K MC.',
    initialMarketCap: 16000,
    migrationMarketCap: 69000,
    antiSniping: false,
    feeBps: 100,
    lockedVestingParam: {
      totalLockedVestingAmount: 0,
      cliffUnlockAmount: 0,
      numberOfVestingPeriod: 0,
      totalVestingDuration: 0,
      cliffDurationFromMigrationTime: 0,
    },
  },
  indie: {
    label: 'Indie',
    description: 'For serious projects. Starts at 32K MC, graduates at 240K MC. 10% vested over 12 months.',
    initialMarketCap: 32000,
    migrationMarketCap: 240000,
    antiSniping: true,
    feeBps: 100,
    lockedVestingParam: {
      totalLockedVestingAmount: 100000000,
      cliffUnlockAmount: 0,
      numberOfVestingPeriod: 365,
      totalVestingDuration: 31536000,
      cliffDurationFromMigrationTime: 0,
    },
  },
} as const;

export type CurvePreset = keyof typeof CURVE_PRESETS;

export interface TokenCreateParams {
  tokenName: string;
  tokenSymbol: string;
  creator: string;
  preset?: CurvePreset;
  initialMarketCap?: number;
  migrationMarketCap?: number;
  quoteMint?: string;
  tokenImageContentType?: string;
  antiSniping?: boolean;
  feeBps?: number;
  isLpLocked?: boolean;
  lockedVestingParam?: {
    totalLockedVestingAmount: number;
    cliffUnlockAmount: number;
    numberOfVestingPeriod: number;
    totalVestingDuration: number;
    cliffDurationFromMigrationTime: number;
  };
}

export interface CreateTxResponse {
  transaction: string;
  mint: string;
  imagePresignedUrl: string;
  metadataPresignedUrl: string;
  imageUrl: string;
}

export interface TokenMetadata {
  name: string;
  symbol: string;
  description: string;
  image: string;
  website?: string;
  twitter?: string;
  telegram?: string;
}

export interface PoolAddresses {
  dbcPoolAddress: string;
  meteoraDammV2PoolAddress?: string;
  configKey?: string;
}

export interface FeeInfo {
  totalFee: number;
  unclaimedFee: number;
  quoteMint: string;
}

/**
 * Client service for Jupiter Studio API via edge function proxy
 */
export class JupiterStudioService {
  /**
   * Step 1: Get an unsigned token-creation transaction + presigned upload URLs
   */
  static async createTokenTransaction(
    params: TokenCreateParams
  ): Promise<CreateTxResponse | null> {
    try {
      // Apply preset if specified
      let resolvedParams = { ...params };
      if (params.preset && CURVE_PRESETS[params.preset]) {
        const preset = CURVE_PRESETS[params.preset];
        resolvedParams = {
          ...resolvedParams,
          initialMarketCap: params.initialMarketCap ?? preset.initialMarketCap,
          migrationMarketCap: params.migrationMarketCap ?? preset.migrationMarketCap,
          antiSniping: params.antiSniping ?? preset.antiSniping,
          feeBps: params.feeBps ?? preset.feeBps,
          lockedVestingParam: params.lockedVestingParam ?? preset.lockedVestingParam,
        };
      }

      console.log('[Studio] Creating token transaction...');
      const { data, error } = await supabase.functions.invoke('jupiter-studio', {
        body: { action: 'create_token_tx', ...resolvedParams },
      });

      if (error) throw new Error(error.message);
      if (!data?.success) throw new Error(data?.error || 'Create token tx failed');

      console.log('[Studio] Got transaction + presigned URLs, mint:', data.data.mint);
      return data.data as CreateTxResponse;
    } catch (error) {
      console.error('[Studio] createTokenTransaction error:', error);
      toast.error(`Failed to create token: ${error instanceof Error ? error.message : 'Unknown'}`);
      return null;
    }
  }

  /**
   * Step 2a: Upload token image to presigned URL (direct, no edge function needed)
   */
  static async uploadTokenImage(
    presignedUrl: string,
    imageFile: File
  ): Promise<boolean> {
    try {
      console.log('[Studio] Uploading token image...');
      const resp = await fetch(presignedUrl, {
        method: 'PUT',
        headers: { 'Content-Type': imageFile.type },
        body: imageFile,
      });

      if (!resp.ok) {
        throw new Error(`Image upload failed: ${resp.status}`);
      }

      console.log('[Studio] Image uploaded successfully');
      return true;
    } catch (error) {
      console.error('[Studio] uploadTokenImage error:', error);
      toast.error('Failed to upload token image');
      return false;
    }
  }

  /**
   * Step 2b: Upload token metadata JSON to presigned URL
   */
  static async uploadTokenMetadata(
    presignedUrl: string,
    metadata: TokenMetadata
  ): Promise<boolean> {
    try {
      console.log('[Studio] Uploading token metadata...');
      const resp = await fetch(presignedUrl, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(metadata),
      });

      if (!resp.ok) {
        throw new Error(`Metadata upload failed: ${resp.status}`);
      }

      console.log('[Studio] Metadata uploaded successfully');
      return true;
    } catch (error) {
      console.error('[Studio] uploadTokenMetadata error:', error);
      toast.error('Failed to upload token metadata');
      return false;
    }
  }

  /**
   * Step 3: Sign the transaction and return the signed base64 string
   */
  static async signTransaction(
    wallet: any,
    txBase64: string
  ): Promise<string | null> {
    try {
      if (!wallet.publicKey || !wallet.signTransaction) {
        toast.error('Wallet not connected');
        return null;
      }

      console.log('[Studio] Signing transaction...');
      const txBuf = Buffer.from(txBase64, 'base64');
      const transaction = VersionedTransaction.deserialize(txBuf);
      const signedTx = await wallet.signTransaction(transaction);
      const signedTxBase64 = Buffer.from(signedTx.serialize()).toString('base64');
      
      return signedTxBase64;
    } catch (error) {
      console.error('[Studio] signTransaction error:', error);
      toast.error(`Signing failed: ${error instanceof Error ? error.message : 'Unknown'}`);
      return null;
    }
  }

  /**
   * Step 4: Submit a pre-signed transaction
   */
  static async submitSignedToken(
    ownerAddress: string,
    signedTxBase64: string,
    content?: string
  ): Promise<any> {
    try {
      console.log('[Studio] Submitting signed transaction...');
      const { data, error } = await supabase.functions.invoke('jupiter-studio', {
        body: {
          action: 'submit_token',
          signedTransaction: signedTxBase64,
          owner: ownerAddress,
          content: content || '',
        },
      });

      if (error) throw new Error(error.message);
      if (!data?.success) throw new Error(data?.error || 'Submit failed');

      console.log('[Studio] Token submitted successfully!', data.data);
      toast.success('Token launched successfully! 🚀');
      return data.data;
    } catch (error) {
      console.error('[Studio] submitSignedToken error:', error);
      toast.error(`Token launch failed: ${error instanceof Error ? error.message : 'Unknown'}`);
      return null;
    }
  }

  /**
   * Legacy Step 3: Sign the transaction and submit it
   */
  static async submitToken(
    wallet: any,
    txBase64: string,
    content?: string
  ): Promise<any> {
    const signedTx = await this.signTransaction(wallet, txBase64);
    if (!signedTx) return null;
    return this.submitSignedToken(wallet.publicKey.toBase58(), signedTx, content);
  }

  /**
   * Internal helper to prepare assets (Step 1 + 2)
   */
  static async prepareLaunchAssets(
    params: TokenCreateParams,
    imageFile: File,
    metadata: Omit<TokenMetadata, 'image'>
  ): Promise<CreateTxResponse | null> {
    try {
      // 1. Create transaction + get presigned URLs
      const createResult = await this.createTokenTransaction(params);
      if (!createResult) return null;

      // 2. Upload image and metadata in parallel
      const [imgOk, metaOk] = await Promise.all([
        this.uploadTokenImage(createResult.imagePresignedUrl, imageFile),
        this.uploadTokenMetadata(createResult.metadataPresignedUrl, {
          ...metadata,
          image: createResult.imageUrl,
        }),
      ]);

      if (!imgOk || !metaOk) {
        toast.error('Failed to upload token assets');
        return null;
      }

      return createResult;
    } catch (error) {
      console.error('[Studio] prepareLaunchAssets error:', error);
      return null;
    }
  }

  /**
   * Full token launch flow: create tx → upload image/metadata → sign → submit
   */
  static async launchToken(
    wallet: any,
    params: TokenCreateParams,
    imageFile: File,
    metadata: Omit<TokenMetadata, 'image'>,
    content?: string
  ): Promise<{ mint: string; result: any } | null> {
    try {
      // 1. Create transaction + get presigned URLs
      const createResult = await this.createTokenTransaction(params);
      if (!createResult) return null;

      // 2. Upload image and metadata in parallel
      const [imgOk, metaOk] = await Promise.all([
        this.uploadTokenImage(createResult.imagePresignedUrl, imageFile),
        this.uploadTokenMetadata(createResult.metadataPresignedUrl, {
          ...metadata,
          image: createResult.imageUrl,
        }),
      ]);

      if (!imgOk || !metaOk) {
        toast.error('Failed to upload token assets');
        return null;
      }

      // 3. Sign and submit
      const result = await this.submitToken(wallet, createResult.transaction, content);
      if (!result) return null;

      return { mint: createResult.mint, result };
    } catch (error) {
      console.error('[Studio] launchToken error:', error);
      toast.error(`Launch failed: ${error instanceof Error ? error.message : 'Unknown'}`);
      return null;
    }
  }

  /**
   * Get pool addresses for a token mint
   */
  static async getPoolAddresses(mint: string): Promise<PoolAddresses | null> {
    try {
      const { data, error } = await supabase.functions.invoke('jupiter-studio', {
        body: { action: 'pool_addresses', mint },
      });

      if (error) throw new Error(error.message);
      if (!data?.success) throw new Error(data?.error || 'Pool lookup failed');

      return data.data?.data as PoolAddresses;
    } catch (error) {
      console.error('[Studio] getPoolAddresses error:', error);
      return null;
    }
  }

  /**
   * Check unclaimed LP fees for a pool
   */
  static async checkFees(poolAddress: string): Promise<FeeInfo | null> {
    try {
      const { data, error } = await supabase.functions.invoke('jupiter-studio', {
        body: { action: 'check_fees', poolAddress },
      });

      if (error) throw new Error(error.message);
      if (!data?.success) throw new Error(data?.error || 'Fee check failed');

      return data.data as FeeInfo;
    } catch (error) {
      console.error('[Studio] checkFees error:', error);
      return null;
    }
  }

  /**
   * Full fee claim flow: get claim tx → sign → send
   */
  static async claimFees(
    wallet: any,
    poolAddress: string,
    maxQuoteAmount: number = 0
  ): Promise<string | null> {
    try {
      if (!wallet.publicKey || !wallet.signTransaction) {
        toast.error('Wallet not connected');
        return null;
      }

      // 1. Get unsigned claim transaction
      const { data, error } = await supabase.functions.invoke('jupiter-studio', {
        body: {
          action: 'claim_fees_tx',
          ownerWallet: wallet.publicKey.toBase58(),
          poolAddress,
          maxQuoteAmount,
        },
      });

      if (error) throw new Error(error.message);
      if (!data?.success) throw new Error(data?.error || 'Claim tx failed');

      const txBase64 = data.data?.transaction;
      if (!txBase64) throw new Error('No transaction returned');

      // 2. Sign and send
      const txBuf = Buffer.from(txBase64, 'base64');
      const transaction = VersionedTransaction.deserialize(txBuf);
      const signedTx = await wallet.signTransaction(transaction);

      // Send via Supabase RPC proxy
      const signedTxBase64 = Buffer.from(signedTx.serialize()).toString('base64');
      const { data: rpcData, error: rpcError } = await supabase.functions.invoke('rpc-proxy', {
        body: {
          jsonrpc: '2.0',
          id: 1,
          method: 'sendTransaction',
          params: [signedTxBase64, { encoding: 'base64', skipPreflight: true }],
        },
      });

      if (rpcError) throw new Error(rpcError.message);
      const signature = rpcData?.result;

      toast.success(`Fees claimed! Tx: ${signature?.substring(0, 8)}...`);
      return signature;
    } catch (error) {
      console.error('[Studio] claimFees error:', error);
      toast.error(`Fee claim failed: ${error instanceof Error ? error.message : 'Unknown'}`);
      return null;
    }
  }
}
