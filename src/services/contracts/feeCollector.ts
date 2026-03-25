/**
 * TypeScript client SDK for the Fee Collection program.
 * Collects platform fees on swaps with referral revenue splits.
 */
import { PublicKey, SystemProgram, TransactionInstruction } from '@solana/web3.js';

export const FEE_COLLECTOR_PROGRAM_ID = new PublicKey(
  'ENz5v4ZMSNdDEYd8DKHonwAPbtb8KV6GX7w5JAeazyqz'
);

export interface FeeConfigData {
  admin: PublicKey;
  treasury: PublicKey;
  feeBps: number;
  referralBps: number;
  totalCollectedLamports: bigint;
  totalReferralPaidLamports: bigint;
  totalTransactions: bigint;
}

/**
 * Derive the fee config PDA.
 */
export function findFeeConfigPDA(): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [Buffer.from('fee_config')],
    FEE_COLLECTOR_PROGRAM_ID
  );
}

/**
 * Build instruction to collect a fee on a swap.
 */
export function createCollectFeeInstruction(
  payer: PublicKey,
  treasury: PublicKey,
  tradeLamports: number,
  referrer?: PublicKey
): TransactionInstruction {
  const [feeConfigPDA] = findFeeConfigPDA();

  const discriminator = Buffer.from([0xc0, 0x11, 0xec, 0x7f, 0xee, 0x00, 0x01, 0x02]);
  const data = Buffer.alloc(discriminator.length + 8);
  let offset = 0;

  discriminator.copy(data, offset); offset += 8;
  data.writeBigUInt64LE(BigInt(tradeLamports), offset);

  const keys = [
    { pubkey: payer, isSigner: true, isWritable: true },
    { pubkey: treasury, isSigner: false, isWritable: true },
    ...(referrer
      ? [{ pubkey: referrer, isSigner: false, isWritable: true }]
      : []),
    { pubkey: feeConfigPDA, isSigner: false, isWritable: true },
    { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
  ];

  return new TransactionInstruction({
    programId: FEE_COLLECTOR_PROGRAM_ID,
    keys,
    data,
  });
}

/**
 * Calculate the fee amount in lamports for a given trade.
 */
export function calculateFee(tradeLamports: number, feeBps: number): number {
  return Math.floor((tradeLamports * feeBps) / 10_000);
}

/**
 * Calculate referral split from a fee.
 */
export function calculateReferralSplit(
  tradeLamports: number,
  referralBps: number
): number {
  return Math.floor((tradeLamports * referralBps) / 10_000);
}
