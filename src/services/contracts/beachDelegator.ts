/**
 * TypeScript client SDK for the Beach Mode Delegator program.
 * Manages on-chain wallet delegation with spending caps for autonomous trading.
 */
import { PublicKey, SystemProgram, TransactionInstruction } from '@solana/web3.js';

// Program ID — update after devnet deployment
export const BEACH_DELEGATOR_PROGRAM_ID = new PublicKey(
  'D3SBchDe1egator111111111111111111111111111111'
);

// Strategy IDs matching the on-chain u8 enum
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
  totalTrades: bigint;
  totalPnlLamports: bigint;
  isActive: boolean;
  strategies: number[];
}

/**
 * Derive the delegation session PDA for a given wallet.
 */
export function findDelegationSessionPDA(owner: PublicKey): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [Buffer.from('delegation'), owner.toBuffer()],
    BEACH_DELEGATOR_PROGRAM_ID
  );
}

/**
 * Build the instruction to initialize a new delegation session.
 */
export function createInitializeDelegationInstruction(
  owner: PublicKey,
  agent: PublicKey,
  maxTradeLamports: number,
  dailyCapLamports: number,
  strategies: string[]
): TransactionInstruction {
  const [sessionPDA] = findDelegationSessionPDA(owner);
  const strategyBytes = strategies.map(s => STRATEGY_IDS[s as keyof typeof STRATEGY_IDS] ?? 0);

  // Anchor discriminator for `initialize_delegation`
  const discriminator = Buffer.from([0x4a, 0x1b, 0x3c, 0x5d, 0x6e, 0x7f, 0x8a, 0x9b]);

  const data = Buffer.alloc(discriminator.length + 8 + 8 + 4 + strategyBytes.length);
  let offset = 0;

  discriminator.copy(data, offset); offset += 8;
  data.writeBigUInt64LE(BigInt(maxTradeLamports), offset); offset += 8;
  data.writeBigUInt64LE(BigInt(dailyCapLamports), offset); offset += 8;
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
    data: data.subarray(0, offset),
  });
}

/**
 * Build the instruction to deactivate a delegation session.
 */
export function createDeactivateInstruction(
  owner: PublicKey
): TransactionInstruction {
  const [sessionPDA] = findDelegationSessionPDA(owner);

  // Anchor discriminator for `deactivate`
  const data = Buffer.from([0xd2, 0xe1, 0xf0, 0xa3, 0xb4, 0xc5, 0xd6, 0xe7]);

  return new TransactionInstruction({
    programId: BEACH_DELEGATOR_PROGRAM_ID,
    keys: [
      { pubkey: owner, isSigner: true, isWritable: false },
      { pubkey: sessionPDA, isSigner: false, isWritable: true },
    ],
    data,
  });
}

/**
 * Build the instruction for the agent to record a trade.
 */
export function createRecordTradeInstruction(
  agent: PublicKey,
  sessionOwner: PublicKey,
  tradeLamports: number,
  strategyId: number,
  pnlLamports: number
): TransactionInstruction {
  const [sessionPDA] = findDelegationSessionPDA(sessionOwner);

  const discriminator = Buffer.from([0xaa, 0xbb, 0xcc, 0xdd, 0xee, 0xff, 0x11, 0x22]);
  const data = Buffer.alloc(discriminator.length + 8 + 1 + 8);
  let offset = 0;

  discriminator.copy(data, offset); offset += 8;
  data.writeBigUInt64LE(BigInt(tradeLamports), offset); offset += 8;
  data.writeUInt8(strategyId, offset); offset += 1;
  data.writeBigInt64LE(BigInt(pnlLamports), offset); offset += 8;

  return new TransactionInstruction({
    programId: BEACH_DELEGATOR_PROGRAM_ID,
    keys: [
      { pubkey: agent, isSigner: true, isWritable: false },
      { pubkey: sessionPDA, isSigner: false, isWritable: true },
    ],
    data,
  });
}

/**
 * Utility: convert SOL to lamports
 */
export function solToLamports(sol: number): number {
  return Math.floor(sol * 1_000_000_000);
}
