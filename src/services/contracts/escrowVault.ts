/**
 * TypeScript client SDK for the Escrow Vault program.
 * Users deposit SOL that the D3S Agent can trade from with on-chain limits.
 */
import { PublicKey, SystemProgram, TransactionInstruction, Connection } from '@solana/web3.js';
import * as borsh from '@coral-xyz/borsh';

export const ESCROW_VAULT_PROGRAM_ID = new PublicKey(
  'H96kQMaLEEXqvbqehBMqV8vdkXZV6A8y7GAzyeZDZYXQ'
);

export interface VaultData {
  owner: PublicKey;
  agent: PublicKey;
  balanceLamports: bigint;
  totalDeposited: bigint;
  totalWithdrawn: bigint;
  totalTraded: bigint;
  withdrawalLimitLamports: bigint;
  cooldownSeconds: bigint;
  lastWithdrawalTimestamp: bigint;
  isLocked: boolean;
}

const VAULT_SCHEMA = borsh.struct([
  borsh.array(borsh.u8(), 8, 'discriminator'),
  borsh.publicKey('owner'),
  borsh.publicKey('agent'),
  borsh.u64('balanceLamports'),
  borsh.u64('totalDeposited'),
  borsh.u64('totalWithdrawn'),
  borsh.u64('totalTraded'),
  borsh.u64('withdrawalLimitLamports'),
  borsh.u64('cooldownSeconds'),
  borsh.u64('lastWithdrawalTimestamp'),
  borsh.bool('isLocked'),
  borsh.u8('bump'),
]);

export function findVaultPDA(owner: PublicKey): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [Buffer.from('vault'), owner.toBuffer()],
    ESCROW_VAULT_PROGRAM_ID
  );
}

export function findVaultSolPDA(owner: PublicKey): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [Buffer.from('vault_sol'), owner.toBuffer()],
    ESCROW_VAULT_PROGRAM_ID
  );
}

/**
 * Batch fetch multiple vaults for performance.
 */
export async function getMultipleVaults(
  connection: Connection,
  owners: PublicKey[]
): Promise<(VaultData | null)[]> {
  if (owners.length === 0) return [];
  const pdas = owners.map(o => findVaultPDA(o)[0]);
  const infos = await connection.getMultipleAccountsInfo(pdas);
  
  return infos.map(info => {
    if (!info) return null;
    try {
      return VAULT_SCHEMA.decode(info.data) as VaultData;
    } catch (e) {
      console.error('Failed to decode vault account:', e);
      return null;
    }
  });
}

export function createCreateVaultInstruction(
  owner: PublicKey,
  agent: PublicKey,
  withdrawalLimitLamports: bigint,
  cooldownSeconds: bigint
): TransactionInstruction {
  const [vaultPDA] = findVaultPDA(owner);
  const [vaultSolPDA] = findVaultSolPDA(owner);

  const discriminator = Buffer.from([0xc8, 0xea, 0x7e, 0xf0, 0x6a, 0x91, 0xb2, 0xd3]);
  const data = Buffer.alloc(discriminator.length + 8 + 8);
  discriminator.copy(data, 0);
  data.writeBigUInt64LE(withdrawalLimitLamports, 8);
  data.writeBigUInt64LE(cooldownSeconds, 16);

  return new TransactionInstruction({
    programId: ESCROW_VAULT_PROGRAM_ID,
    keys: [
      { pubkey: owner, isSigner: true, isWritable: true },
      { pubkey: agent, isSigner: false, isWritable: false },
      { pubkey: vaultPDA, isSigner: false, isWritable: true },
      { pubkey: vaultSolPDA, isSigner: false, isWritable: true }, // Functional in remediation
      { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
    ],
    data,
  });
}

export function createDepositInstruction(
  owner: PublicKey,
  lamports: bigint
): TransactionInstruction {
  const [vaultPDA] = findVaultPDA(owner);
  const [vaultSolPDA] = findVaultSolPDA(owner);

  const discriminator = Buffer.from([0xf8, 0xc6, 0x9e, 0x91, 0xe1, 0x75, 0x87, 0xc8]);
  const data = Buffer.alloc(discriminator.length + 8);
  discriminator.copy(data, 0);
  data.writeBigUInt64LE(lamports, 8);

  return new TransactionInstruction({
    programId: ESCROW_VAULT_PROGRAM_ID,
    keys: [
      { pubkey: owner, isSigner: true, isWritable: true },
      { pubkey: vaultPDA, isSigner: false, isWritable: true },
      { pubkey: vaultSolPDA, isSigner: false, isWritable: true },
      { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
    ],
    data,
  });
}

export function createWithdrawInstruction(
  owner: PublicKey,
  lamports: bigint
): TransactionInstruction {
  const [vaultPDA] = findVaultPDA(owner);
  const [vaultSolPDA] = findVaultSolPDA(owner);

  const discriminator = Buffer.from([0xb7, 0x12, 0x46, 0x9c, 0x94, 0x6d, 0xa1, 0x22]);
  const data = Buffer.alloc(discriminator.length + 8);
  discriminator.copy(data, 0);
  data.writeBigUInt64LE(lamports, 8);

  return new TransactionInstruction({
    programId: ESCROW_VAULT_PROGRAM_ID,
    keys: [
      { pubkey: owner, isSigner: true, isWritable: true },
      { pubkey: vaultPDA, isSigner: false, isWritable: true },
      { pubkey: vaultSolPDA, isSigner: false, isWritable: true },
      { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
    ],
    data,
  });
}

/**
 * D3S Agent spends SOL from vault to trade.
 */
export function createAgentSpendInstruction(
  agent: PublicKey,
  owner: PublicKey,
  destination: PublicKey,
  lamports: bigint
): TransactionInstruction {
  const [vaultPDA] = findVaultPDA(owner);
  const [vaultSolPDA] = findVaultSolPDA(owner);

  const discriminator = Buffer.from([0xb3, 0x8a, 0x2a, 0x7f, 0x6e, 0x0a, 0x3d, 0x01]); // Fixed for remediation
  const data = Buffer.alloc(discriminator.length + 8);
  discriminator.copy(data, 0);
  data.writeBigUInt64LE(lamports, 8);

  return new TransactionInstruction({
    programId: ESCROW_VAULT_PROGRAM_ID,
    keys: [
      { pubkey: agent, isSigner: true, isWritable: true },
      { pubkey: vaultPDA, isSigner: false, isWritable: true },
      { pubkey: vaultSolPDA, isSigner: false, isWritable: true },
      { pubkey: destination, isSigner: false, isWritable: true },
      { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
    ],
    data,
  });
}

export function createToggleLockInstruction(
  owner: PublicKey,
  locked: boolean
): TransactionInstruction {
  const [vaultPDA] = findVaultPDA(owner);

  const discriminator = Buffer.from([0xe4, 0x55, 0x67, 0x89, 0xab, 0xcd, 0xef, 0x01]);
  const data = Buffer.alloc(discriminator.length + 1);
  discriminator.copy(data, 0);
  data.writeUInt8(locked ? 1 : 0, 8);

  return new TransactionInstruction({
    programId: ESCROW_VAULT_PROGRAM_ID,
    keys: [
      { pubkey: owner, isSigner: true, isWritable: false },
      { pubkey: vaultPDA, isSigner: false, isWritable: true },
    ],
    data,
  });
}
