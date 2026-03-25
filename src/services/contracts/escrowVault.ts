/**
 * TypeScript client SDK for the Escrow Vault program.
 * Users deposit SOL that the D3S Agent can trade from with on-chain limits.
 */
import { PublicKey, SystemProgram, TransactionInstruction } from '@solana/web3.js';

export const ESCROW_VAULT_PROGRAM_ID = new PublicKey(
  'D3SEscr0wVau1t11111111111111111111111111111'
);

export interface VaultData {
  owner: PublicKey;
  agent: PublicKey;
  balanceLamports: bigint;
  totalDeposited: bigint;
  totalWithdrawn: bigint;
  totalTraded: bigint;
  withdrawalLimitLamports: bigint;
  cooldownSlots: bigint;
  lastWithdrawalSlot: bigint;
  isLocked: boolean;
}

/**
 * Derive the vault PDA for a given owner.
 */
export function findVaultPDA(owner: PublicKey): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [Buffer.from('vault'), owner.toBuffer()],
    ESCROW_VAULT_PROGRAM_ID
  );
}

/**
 * Derive the SOL vault PDA (holds actual lamports).
 */
export function findVaultSolPDA(owner: PublicKey): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [Buffer.from('vault_sol'), owner.toBuffer()],
    ESCROW_VAULT_PROGRAM_ID
  );
}

/**
 * Build instruction to create a new vault.
 */
export function createCreateVaultInstruction(
  owner: PublicKey,
  agent: PublicKey,
  withdrawalLimitLamports: number,
  cooldownSlots: number
): TransactionInstruction {
  const [vaultPDA] = findVaultPDA(owner);
  const [vaultSolPDA] = findVaultSolPDA(owner);

  const discriminator = Buffer.from([0xc8, 0xea, 0x7e, 0xf0, 0x6a, 0x91, 0xb2, 0xd3]);
  const data = Buffer.alloc(discriminator.length + 8 + 8);
  let offset = 0;

  discriminator.copy(data, offset); offset += 8;
  data.writeBigUInt64LE(BigInt(withdrawalLimitLamports), offset); offset += 8;
  data.writeBigUInt64LE(BigInt(cooldownSlots), offset);

  return new TransactionInstruction({
    programId: ESCROW_VAULT_PROGRAM_ID,
    keys: [
      { pubkey: owner, isSigner: true, isWritable: true },
      { pubkey: agent, isSigner: false, isWritable: false },
      { pubkey: vaultPDA, isSigner: false, isWritable: true },
      { pubkey: vaultSolPDA, isSigner: false, isWritable: false },
      { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
    ],
    data,
  });
}

/**
 * Build instruction to deposit SOL into the vault.
 */
export function createDepositInstruction(
  owner: PublicKey,
  lamports: number
): TransactionInstruction {
  const [vaultPDA] = findVaultPDA(owner);
  const [vaultSolPDA] = findVaultSolPDA(owner);

  const discriminator = Buffer.from([0xf8, 0xc6, 0x9e, 0x91, 0xe1, 0x75, 0x87, 0xc8]);
  const data = Buffer.alloc(discriminator.length + 8);
  let offset = 0;

  discriminator.copy(data, offset); offset += 8;
  data.writeBigUInt64LE(BigInt(lamports), offset);

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
 * Build instruction to withdraw SOL from the vault.
 */
export function createWithdrawInstruction(
  owner: PublicKey,
  lamports: number
): TransactionInstruction {
  const [vaultPDA] = findVaultPDA(owner);
  const [vaultSolPDA] = findVaultSolPDA(owner);

  const discriminator = Buffer.from([0xb7, 0x12, 0x46, 0x9c, 0x94, 0x6d, 0xa1, 0x22]);
  const data = Buffer.alloc(discriminator.length + 8);
  let offset = 0;

  discriminator.copy(data, offset); offset += 8;
  data.writeBigUInt64LE(BigInt(lamports), offset);

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
 * Build instruction to toggle vault lock (emergency freeze).
 */
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
