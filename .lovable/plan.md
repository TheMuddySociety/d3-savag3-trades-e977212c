

## Audit: Trading Budget & Token Detection Issues

### Issue 1: Budget Can't Be Added

The console shows a React error: `Cannot update a component (Toaster) while rendering a different component (AutoStrategies)`. This happens because `toast()` is being called during render phase somewhere in `AutoStrategies.tsx`. This can cause the budget UI to malfunction or not respond to interactions.

**Root cause**: The `BudgetManager` component calls `toast()` inside the "Top Up" button's `onClick` inline, but the real problem is the rendering cycle conflict between AutoStrategies and the Toaster. The `useEffect` at line 153 has a complex dependency array using `.map().join()` which can trigger re-renders that cascade into toast calls.

**Fix**:
- Wrap the strategy evaluation polling setup in a stable ref-based pattern to avoid re-render loops
- Ensure `toast()` is never called synchronously during a render cycle
- Move the `addLog` + `toast` calls in `proceedToggle` into a `useEffect` or `setTimeout` to break the render cycle

### Issue 2: Only 2 Tokens Detected

The wallet-portfolio edge function uses the Helius `/addresses/{wallet}/balances` endpoint, which returns token balances. The response confirms only 2 tokens (POOT, gomu) are returned by Helius for wallet `BQefQgbpAqPjoGKLTmAA2haZh9pEURYNefPFwsTotgem`.

This could be because:
- Helius balances API may not return all token types (some pump.fun tokens may be classified as compressed/non-fungible)
- Tokens with very small dust amounts get filtered out

**Fix**:
- Switch to using Helius DAS `searchAssets` or `getTokenAccounts` RPC method which returns ALL SPL token accounts for a wallet, not just the subset from the REST balances endpoint
- This catches compressed tokens, pump.fun tokens, and any other SPL tokens the simplified endpoint misses

### Implementation Plan

**1. Fix the render-phase setState error in AutoStrategies.tsx**
- Stabilize the polling `useEffect` dependency to prevent re-render cascades
- Wrap `toast()` calls in `proceedToggle` with `setTimeout(() => toast(...), 0)` to defer out of render

**2. Fix wallet-portfolio to detect all tokens**
- Replace the Helius REST `/addresses/{wallet}/balances` call with the RPC method `getTokenAccountsByOwner` which returns every SPL token account
- This is the standard Solana RPC method that guarantees all token accounts are returned
- Keep the existing DAS metadata + price enrichment pipeline

### Technical Details

For `getTokenAccountsByOwner`, the RPC call looks like:
```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "method": "getTokenAccountsByOwner",
  "params": [
    "WALLET_ADDRESS",
    { "programId": "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA" },
    { "encoding": "jsonParsed" }
  ]
}
```
This returns parsed token account data including mint, amount, and decimals for every token the wallet holds, including pump.fun tokens.

We also need to check for Token-2022 program tokens:
```json
{ "programId": "TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb" }
```

### Files to Edit
- `src/components/dashboard/bot-tools/AutoStrategies.tsx` — fix render-phase toast error
- `supabase/functions/wallet-portfolio/index.ts` — use `getTokenAccountsByOwner` for complete token detection

