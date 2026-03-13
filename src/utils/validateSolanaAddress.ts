
const BASE58_CHARS = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';

/**
 * Validates that a string is a valid Solana address (base58, 32-44 chars)
 */
export function isValidSolanaAddress(address: string): boolean {
  if (!address || address.length < 32 || address.length > 44) return false;
  for (const char of address) {
    if (!BASE58_CHARS.includes(char)) return false;
  }
  return true;
}
