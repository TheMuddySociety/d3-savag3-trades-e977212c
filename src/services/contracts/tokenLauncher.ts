/**
 * TypeScript client SDK for the Token Launch program.
 * Bonding curve token launches, 2026 Pro standards.
 */
import { PublicKey, SystemProgram, TransactionInstruction, Connection, AccountInfo } from '@solana/web3.js';
import * as borsh from '@coral-xyz/borsh';

export const TOKEN_LAUNCHER_PROGRAM_ID = new PublicKey(
  'AucLeAW92yJiJuDCmtatTcpYyWQ6VAk9HQjXFR2EAN4v'
);

const SPL_TOKEN_PROGRAM_ID = new PublicKey('TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA');

export interface FeeRecipient {
  recipient: PublicKey;
  bps: number;
}

export interface LaunchData {
  creator: PublicKey;
  tokenMint: PublicKey;
  name: string;
  symbol: string;
  uri: string;
  totalSupply: bigint;
  virtualSolReserves: bigint;
  realSolReserves: bigint;
  realTokenReserves: bigint;
  graduationMcapLamports: bigint;
  isGraduated: boolean;
  isActive: boolean;
  isCtoApproved: boolean;
  feeSharingLocked: boolean;
  createdAt: bigint;
  feeRecipients: FeeRecipient[];
}

/**
 * Borsh schema for the Launch account (aligned with 800-byte Rust struct).
 * Note: discriminator is 8 bytes.
 */
const LAUNCH_SCHEMA = borsh.struct([
  borsh.array(borsh.u8(), 8, 'discriminator'), // 8
  borsh.publicKey('creator'),     // 32
  borsh.publicKey('tokenMint'),   // 32
  borsh.str('name'),              // 4 + 32
  borsh.str('symbol'),            // 4 + 10
  borsh.str('uri'),               // 4 + 200
  borsh.u64('totalSupply'),       // 8
  borsh.u64('virtualSolReserves'),// 8
  borsh.u64('realSolReserves'),   // 8
  borsh.u64('realTokenReserves'), // 8
  borsh.u64('graduationMcapLamports'), // 8
  borsh.bool('isGraduated'),      // 1
  borsh.bool('isActive'),         // 1
  borsh.bool('isCtoApproved'),    // 1
  borsh.bool('feeSharingLocked'), // 1
  borsh.i64('createdAt'),         // 8
  borsh.u8('bump'),               // 1
  borsh.vec(                      // 4 + sharing
    borsh.struct([
      borsh.publicKey('recipient'),
      borsh.u16('bps'),
    ]),
    'feeRecipients'
  ),
  borsh.option(borsh.publicKey(), 'pendingCtoAdmin'),
  borsh.option(borsh.array(borsh.u8(), 32), 'evidenceHash'),
]);

export function findLaunchPDA(tokenMint: PublicKey): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [Buffer.from('launch'), tokenMint.toBuffer()],
    TOKEN_LAUNCHER_PROGRAM_ID
  );
}

export function findCurveAuthorityPDA(tokenMint: PublicKey): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [Buffer.from('curve_authority'), tokenMint.toBuffer()],
    TOKEN_LAUNCHER_PROGRAM_ID
  );
}

export function findSolVaultPDA(tokenMint: PublicKey): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [Buffer.from('sol_vault'), tokenMint.toBuffer()],
    TOKEN_LAUNCHER_PROGRAM_ID
  );
}

/**
 * Fetch and decode multiple launch accounts in one RPC call (Efficiency!).
 * Critical for staying within free-tier RPC limits.
 */
export async function getMultipleLaunches(
  connection: Connection,
  mints: PublicKey[]
): Promise<(LaunchData | null)[]> {
  if (mints.length === 0) return [];
  const pdas = mints.map(m => findLaunchPDA(m)[0]);
  const infos = await connection.getMultipleAccountsInfo(pdas);
  
  return infos.map(info => {
    if (!info) return null;
    try {
      return LAUNCH_SCHEMA.decode(info.data) as LaunchData;
    } catch (e) {
      console.error('Failed to decode launch account:', e);
      return null;
    }
  });
}

export function createBuyInstruction(
  buyer: PublicKey,
  tokenMint: PublicKey,
  curveVault: PublicKey,
  buyerTokenAccount: PublicKey,
  solAmount: bigint
): TransactionInstruction {
  const [launchPDA] = findLaunchPDA(tokenMint);
  const [solVaultPDA] = findSolVaultPDA(tokenMint);
  const [curveAuthority] = findCurveAuthorityPDA(tokenMint);

  const discriminator = Buffer.from([0x66, 0x06, 0x3d, 0x12, 0x01, 0xda, 0xeb, 0xea]);
  const data = Buffer.alloc(discriminator.length + 8);
  discriminator.copy(data, 0);
  data.writeBigUInt64LE(solAmount, 8);

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

export function createSellInstruction(
  seller: PublicKey,
  tokenMint: PublicKey,
  curveVault: PublicKey,
  sellerTokenAccount: PublicKey,
  tokenAmount: bigint
): TransactionInstruction {
  const [launchPDA] = findLaunchPDA(tokenMint);
  const [solVaultPDA] = findSolVaultPDA(tokenMint);
  const [curveAuthority] = findCurveAuthorityPDA(tokenMint);

  const discriminator = Buffer.from([0x33, 0xe6, 0x85, 0xa4, 0x01, 0x7f, 0x83, 0x96]);
  const data = Buffer.alloc(discriminator.length + 8);
  discriminator.copy(data, 0);
  data.writeBigUInt64LE(tokenAmount, 8);

  return new TransactionInstruction({
    programId: TOKEN_LAUNCHER_PROGRAM_ID,
    keys: [
      { pubkey: seller, isSigner: true, isWritable: true },
      { pubkey: launchPDA, isSigner: false, isWritable: true },
      { pubkey: curveVault, isSigner: false, isWritable: true },
      { pubkey: sellerTokenAccount, isSigner: false, isWritable: true },
      { pubkey: solVaultPDA, isSigner: false, isWritable: true },
      { pubkey: curveAuthority, isSigner: false, isWritable: false },
      { pubkey: SPL_TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
      { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
    ],
    data,
  });
}

/**
 * Constant Product AMM Math (x * y = k)
 * Estimate tokens received for a SOL input.
 */
export function estimateTokensOut(
  solIn: bigint,
  virtualSol: bigint,
  realSol: bigint,
  realTokens: bigint
): bigint {
  if (solIn <= 0n) return 0n;
  
  const currentSolReserves = virtualSol + realSol;
  const k = currentSolReserves * realTokens;
  const newSolReserves = currentSolReserves + solIn;
  const newTokensReserves = k / newSolReserves;
  
  return realTokens - newTokensReserves;
}

/**
 * Estimate SOL received for a token input.
 */
export function estimateSolOut(
  tokensIn: bigint,
  virtualSol: bigint,
  realSol: bigint,
  realTokens: bigint
): bigint {
  if (tokensIn <= 0n) return 0n;
  if (tokensIn >= realTokens) return realSol; // Cannot drain virtual reserves
  
  const currentSolReserves = virtualSol + realSol;
  const k = currentSolReserves * realTokens;
  const newTokensReserves = realTokens + tokensIn;
  const newSolReserves = k / newTokensReserves;
  
  return currentSolReserves - newSolReserves;
}

/**
 * Current price in SOL per Token.
 */
export function getCurrentPrice(virtualSol: bigint, realSol: bigint, realTokens: bigint): number {
  if (realTokens === 0n) return 0;
  const totalSol = Number(virtualSol + realSol) / 1e9;
  const totalTokens = Number(realTokens) / 1e6; // Assuming 6 decimals
  return totalSol / totalTokens;
}
