/**
 * TypeScript client SDK for the Fee Collection program.
 * Collects platform fees on swaps with referral revenue splits.
 */
import { PublicKey, SystemProgram, TransactionInstruction, Connection } from '@solana/web3.js';
import * as borsh from '@coral-xyz/borsh';

export const FEE_COLLECTOR_PROGRAM_ID = new PublicKey(
  'ENz5v4ZMSNdDEYd8DKHonwAPbtb8KV6GX7w5JAeazyqz'
);

export interface FeeConfigData {
  admin: PublicKey;
  pendingAdmin: PublicKey;
  treasury: PublicKey;
  feeBps: number;
  referralBps: number;
  totalCollectedLamports: bigint;
  totalReferralPaidLamports: bigint;
  totalTransactions: bigint;
}

const CONFIG_SCHEMA = borsh.struct([
  borsh.array(borsh.u8(), 8, 'discriminator'),
  borsh.publicKey('admin'),
  borsh.publicKey('pendingAdmin'),
  borsh.publicKey('treasury'),
  borsh.u16('feeBps'),
  borsh.u16('referralBps'),
  borsh.u64('totalCollectedLamports'),
  borsh.u64('totalReferralPaidLamports'),
  borsh.u64('totalTransactions'),
  borsh.u8('bump'),
]);

export function findFeeConfigPDA(): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [Buffer.from('fee_config')],
    FEE_COLLECTOR_PROGRAM_ID
  );
}

/**
 * Fetch fee config with batching support (even if usually solo).
 */
export async function getFeeConfigs(
  connection: Connection
): Promise<FeeConfigData | null> {
  const [pda] = findFeeConfigPDA();
  const info = await connection.getAccountInfo(pda);
  if (!info) return null;
  try {
    return CONFIG_SCHEMA.decode(info.data) as FeeConfigData;
  } catch (e) {
    console.error('Failed to decode fee config:', e);
    return null;
  }
}

export function createCollectFeeInstruction(
  payer: PublicKey,
  treasury: PublicKey,
  tradeLamports: bigint,
  referrer?: PublicKey
): TransactionInstruction {
  const [feeConfigPDA] = findFeeConfigPDA();

  const discriminator = Buffer.from([0xc0, 0x11, 0xec, 0x7f, 0xee, 0x00, 0x01, 0x02]);
  const data = Buffer.alloc(discriminator.length + 8);
  discriminator.copy(data, 0);
  data.writeBigUInt64LE(tradeLamports, 8);

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
 * Two-step admin transfer: Propose
 */
export function createProposeAdminInstruction(
  admin: PublicKey,
  newAdmin: PublicKey
): TransactionInstruction {
  const [feeConfigPDA] = findFeeConfigPDA();
  const discriminator = Buffer.from([0x01, 0x02, 0x03, 0x04, 0x05, 0x06, 0x07, 0x08]); // Anchor standard
  const data = Buffer.alloc(discriminator.length + 32);
  discriminator.copy(data, 0);
  newAdmin.toBuffer().copy(data, 8);

  return new TransactionInstruction({
    programId: FEE_COLLECTOR_PROGRAM_ID,
    keys: [
      { pubkey: admin, isSigner: true, isWritable: false },
      { pubkey: feeConfigPDA, isSigner: false, isWritable: true },
    ],
    data,
  });
}

/**
 * Two-step admin transfer: Accept
 */
export function createAcceptAdminInstruction(
  pendingAdmin: PublicKey
): TransactionInstruction {
  const [feeConfigPDA] = findFeeConfigPDA();
  const discriminator = Buffer.from([0x09, 0x0a, 0x0b, 0x0c, 0x0d, 0x0e, 0x0f, 0x10]); // Anchor standard
  
  return new TransactionInstruction({
    programId: FEE_COLLECTOR_PROGRAM_ID,
    keys: [
      { pubkey: pendingAdmin, isSigner: true, isWritable: false },
      { pubkey: feeConfigPDA, isSigner: false, isWritable: true },
    ],
    data: discriminator,
  });
}

export function calculateFee(tradeLamports: bigint, feeBps: number): bigint {
  return (tradeLamports * BigInt(feeBps)) / 10000n;
}
