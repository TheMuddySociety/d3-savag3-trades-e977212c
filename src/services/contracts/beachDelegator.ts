/**
 * TypeScript client SDK for the Beach Mode Delegator program.
 * Manages on-chain wallet delegation with spending caps for autonomous trading.
 */
import { PublicKey, SystemProgram, TransactionInstruction, Connection } from '@solana/web3.js';
import * as borsh from '@coral-xyz/borsh';

export const BEACH_DELEGATOR_PROGRAM_ID = new PublicKey(
  '7fLkmNRYhUmqyXAyeVqVyg2QhanSxXPsGRBwUsrjxgxp'
);

export const STRATEGY_IDS = {
  safe_exit: 0,
  scalper: 1,
  new_launch: 2,
  momentum: 3,
  dip_buy: 4,
} as const;

export interface DelegationSessionData {
  owner: PublicKey;
  agent: PublicKey;
  maxTradeLamports: bigint;
  dailyCapLamports: bigint;
  dailySpentLamports: bigint;
  lastResetTimestamp: bigint;
  totalTrades: bigint;
  totalPnlLamports: bigint;
  createdAt: bigint;
  isActive: boolean;
  strategies: Buffer;
}

const SESSION_SCHEMA = borsh.struct([
  borsh.array(borsh.u8(), 8, 'discriminator'),
  borsh.publicKey('owner'),
  borsh.publicKey('agent'),
  borsh.u64('maxTradeLamports'),
  borsh.u64('dailyCapLamports'),
  borsh.u64('dailySpentLamports'),
  borsh.i64('lastResetTimestamp'),
  borsh.u64('totalTrades'),
  borsh.i64('totalPnlLamports'),
  borsh.i64('createdAt'),
  borsh.bool('isActive'),
  borsh.u8('bump'),
  borsh.vecU8('strategies'),
]);

export function findDelegationSessionPDA(owner: PublicKey): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [Buffer.from('delegation'), owner.toBuffer()],
    BEACH_DELEGATOR_PROGRAM_ID
  );
}

/**
 * Batch fetch multiple delegation sessions for performance.
 */
export async function getMultipleSessions(
  connection: Connection,
  owners: PublicKey[]
): Promise<(DelegationSessionData | null)[]> {
  if (owners.length === 0) return [];
  const pdas = owners.map(o => findDelegationSessionPDA(o)[0]);
  const infos = await connection.getMultipleAccountsInfo(pdas);
  
  return infos.map(info => {
    if (!info) return null;
    try {
      return SESSION_SCHEMA.decode(info.data) as DelegationSessionData;
    } catch (e) {
      console.error('Failed to decode delegation session:', e);
      return null;
    }
  });
}

export function createInitializeDelegationInstruction(
  owner: PublicKey,
  agent: PublicKey,
  maxTradeLamports: bigint,
  dailyCapLamports: bigint,
  strategies: string[]
): TransactionInstruction {
  const [sessionPDA] = findDelegationSessionPDA(owner);
  const strategyBytes = strategies.map(s => STRATEGY_IDS[s as keyof typeof STRATEGY_IDS] ?? 0);

  const discriminator = Buffer.from([0x4a, 0x1b, 0x3c, 0x5d, 0x6e, 0x7f, 0x8a, 0x9b]);
  const data = Buffer.alloc(discriminator.length + 8 + 8 + 4 + strategyBytes.length);
  let offset = 0;

  discriminator.copy(data, offset); offset += 8;
  data.writeBigUInt64LE(maxTradeLamports, offset); offset += 8;
  data.writeBigUInt64LE(dailyCapLamports, offset); offset += 8;
  data.writeUInt32LE(strategyBytes.length, offset); offset += 4;
  for (const b of strategyBytes) {
    data.writeUInt8(b, offset); offset += 1;
  }

  return new TransactionInstruction({
    programId: BEACH_DELEGATOR_PROGRAM_ID,
    keys: [
      { pubkey: owner, isSigner: true, isWritable: true },
      { pubkey: agent, isSigner: false, isWritable: false },
      { pubkey: sessionPDA, isSigner: false, isWritable: true },
      { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
    ],
    data,
  });
}

export function createRecordTradeInstruction(
  agent: PublicKey,
  sessionOwner: PublicKey,
  tradeLamports: bigint,
  strategyId: number,
  pnlLamports: bigint
): TransactionInstruction {
  const [sessionPDA] = findDelegationSessionPDA(sessionOwner);

  const discriminator = Buffer.from([0xaa, 0xbb, 0xcc, 0xdd, 0xee, 0xff, 0x11, 0x22]);
  const data = Buffer.alloc(discriminator.length + 8 + 1 + 8);
  let offset = 0;

  discriminator.copy(data, offset); offset += 8;
  data.writeBigUInt64LE(tradeLamports, offset); offset += 8;
  data.writeUInt8(strategyId, offset); offset += 1;
  data.writeBigInt64LE(pnlLamports, offset); offset += 8;

  return new TransactionInstruction({
    programId: BEACH_DELEGATOR_PROGRAM_ID,
    keys: [
      { pubkey: agent, isSigner: true, isWritable: false },
      { pubkey: sessionPDA, isSigner: false, isWritable: true },
    ],
    data,
  });
}

export function solToLamports(sol: number): bigint {
  return BigInt(Math.floor(sol * 1_000_000_000));
}
