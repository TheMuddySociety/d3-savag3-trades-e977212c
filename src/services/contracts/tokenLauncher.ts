/**
 * TypeScript client SDK for the Token Launch program.
 * Bonding curve token launches, Pump.fun style.
 */
import { PublicKey, SystemProgram, TransactionInstruction } from '@solana/web3.js';

export const TOKEN_LAUNCHER_PROGRAM_ID = new PublicKey(
  'D3ST0kenLaunch111111111111111111111111111111'
);

// Use SPL Token program ID
const SPL_TOKEN_PROGRAM_ID = new PublicKey('TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA');

export interface LaunchData {
  creator: PublicKey;
  tokenMint: PublicKey;
  name: string;
  symbol: string;
  uri: string;
  totalSupply: bigint;
  tokensSold: bigint;
  solRaised: bigint;
  graduationMcapLamports: bigint;
  isGraduated: boolean;
  isActive: boolean;
  createdAt: bigint;
}

/**
 * Derive the launch PDA for a given token mint.
 */
export function findLaunchPDA(tokenMint: PublicKey): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [Buffer.from('launch'), tokenMint.toBuffer()],
    TOKEN_LAUNCHER_PROGRAM_ID
  );
}

/**
 * Derive the curve authority PDA for a given token mint.
 */
export function findCurveAuthorityPDA(tokenMint: PublicKey): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [Buffer.from('curve_authority'), tokenMint.toBuffer()],
    TOKEN_LAUNCHER_PROGRAM_ID
  );
}

/**
 * Derive the SOL vault PDA for a given token mint.
 */
export function findSolVaultPDA(tokenMint: PublicKey): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [Buffer.from('sol_vault'), tokenMint.toBuffer()],
    TOKEN_LAUNCHER_PROGRAM_ID
  );
}

/**
 * Build instruction to buy tokens from the bonding curve.
 */
export function createBuyInstruction(
  buyer: PublicKey,
  tokenMint: PublicKey,
  curveVault: PublicKey,
  buyerTokenAccount: PublicKey,
  solAmount: number
): TransactionInstruction {
  const [launchPDA] = findLaunchPDA(tokenMint);
  const [solVaultPDA] = findSolVaultPDA(tokenMint);
  const [curveAuthority] = findCurveAuthorityPDA(tokenMint);

  const discriminator = Buffer.from([0x66, 0x06, 0x3d, 0x12, 0x01, 0xda, 0xeb, 0xea]);
  const data = Buffer.alloc(discriminator.length + 8);
  discriminator.copy(data, 0);
  data.writeBigUInt64LE(BigInt(solAmount), 8);

  return new TransactionInstruction({
    programId: TOKEN_LAUNCHER_PROGRAM_ID,
    keys: [
      { pubkey: buyer, isSigner: true, isWritable: true },
      { pubkey: launchPDA, isSigner: false, isWritable: true },
      { pubkey: curveVault, isSigner: false, isWritable: true },
      { pubkey: buyerTokenAccount, isSigner: false, isWritable: true },
      { pubkey: solVaultPDA, isSigner: false, isWritable: true },
      { pubkey: curveAuthority, isSigner: false, isWritable: false },
      { pubkey: SPL_TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
      { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
    ],
    data,
  });
}

/**
 * Build instruction to sell tokens back to the bonding curve.
 */
export function createSellInstruction(
  seller: PublicKey,
  tokenMint: PublicKey,
  curveVault: PublicKey,
  sellerTokenAccount: PublicKey,
  tokenAmount: number
): TransactionInstruction {
  const [launchPDA] = findLaunchPDA(tokenMint);
  const [solVaultPDA] = findSolVaultPDA(tokenMint);

  const discriminator = Buffer.from([0x33, 0xe6, 0x85, 0xa4, 0x01, 0x7f, 0x83, 0x96]);
  const data = Buffer.alloc(discriminator.length + 8);
  discriminator.copy(data, 0);
  data.writeBigUInt64LE(BigInt(tokenAmount), 8);

  return new TransactionInstruction({
    programId: TOKEN_LAUNCHER_PROGRAM_ID,
    keys: [
      { pubkey: seller, isSigner: true, isWritable: true },
      { pubkey: launchPDA, isSigner: false, isWritable: true },
      { pubkey: curveVault, isSigner: false, isWritable: true },
      { pubkey: sellerTokenAccount, isSigner: false, isWritable: true },
      { pubkey: solVaultPDA, isSigner: false, isWritable: true },
      { pubkey: SPL_TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
    ],
    data,
  });
}

/**
 * Estimate tokens received for a given SOL amount on the bonding curve.
 */
export function estimateTokensOut(
  solAmount: number,
  totalSupply: number,
  tokensSold: number,
  solRaised: number
): number {
  const remaining = totalSupply - tokensSold;
  if (remaining <= 0) return 0;

  if (solRaised === 0) {
    return Math.min(
      Math.floor((solAmount * remaining) / 1_000_000_000),
      remaining
    );
  }

  return Math.min(
    Math.floor((solAmount * remaining) / (solRaised + solAmount)),
    remaining
  );
}

/**
 * Estimate SOL received for selling tokens on the bonding curve.
 */
export function estimateSolOut(
  tokenAmount: number,
  tokensSold: number,
  solRaised: number
): number {
  if (tokensSold <= 0) return 0;
  return Math.floor((tokenAmount * solRaised) / tokensSold);
}

/**
 * Calculate current token price in lamports.
 */
export function currentPriceLamports(tokensSold: number, solRaised: number): number {
  if (tokensSold <= 0) return 0;
  return Math.floor(solRaised / tokensSold);
}
