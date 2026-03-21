

## Plan: Harden the RPC Proxy Edge Function

The existing `rpc-proxy` edge function already serves as a private RPC endpoint. The build error (`Could not find npm:@solana/web3.js@1.95.3`) is in `auto-trader` and `withdraw` functions, not `rpc-proxy` — but we should fix those too. The main improvements needed:

### Problem Summary
1. **Build errors** in `auto-trader/index.ts` and `withdraw/index.ts` using `npm:@solana/web3.js@1.95.3` specifier that Deno can't resolve
2. **Auth bug** in `rpc-proxy` — `supabase.auth.getClaims()` doesn't exist on the Supabase JS client, causing 401 errors for authenticated calls
3. **No rate limiting or request validation** on the proxy

### Changes

#### 1. Fix `rpc-proxy/index.ts` — Auth + Hardening
- Replace broken `getClaims()` with `supabase.auth.getUser()` for JWT validation
- Add an allowlist of safe JSON-RPC methods (e.g., `getHealth`, `getBalance`, `getTokenAccountsByOwner`, `getLatestBlockhash`, `getTransaction`, `sendTransaction`, `getAccountInfo`, `getSlot`, `getSignaturesForAddress`, `getBlock`, `simulateTransaction`, etc.) — reject unknown methods
- Add request-size guard (reject bodies > 10KB)
- Keep health-check unauthenticated for connection monitoring

#### 2. Fix `auto-trader/index.ts` and `withdraw/index.ts` — npm specifier
- Change `import("npm:@solana/web3.js@1.95.3")` → `import("https://esm.sh/@solana/web3.js@1.95.3")` (esm.sh works reliably in Deno edge functions)
- Same for `npm:bs58@5.0.0` → `https://esm.sh/bs58@5.0.0`
- Same for `npm:@solana/spl-token@0.4.6` → `https://esm.sh/@solana/spl-token@0.4.6`

#### 3. Redeploy all three functions
- Deploy `rpc-proxy`, `auto-trader`, `withdraw`
- Test `rpc-proxy` with a `getHealth` call to verify

### Technical Details

**Allowed RPC methods whitelist:**
```
getHealth, getBalance, getTokenAccountsByOwner, getLatestBlockhash,
getTransaction, sendTransaction, getAccountInfo, getSlot, getBlock,
getSignaturesForAddress, simulateTransaction, getRecentBlockhash,
getTokenAccountBalance, getProgramAccounts, getMultipleAccounts,
getSignatureStatuses, getFeeForMessage, getMinimumBalanceForRentExemption,
isBlockhashValid, getBlockHeight
```

**Auth fix:**
```typescript
// Before (broken):
const { data, error } = await supabase.auth.getClaims(token);
// After (correct):
const { data: { user }, error } = await supabase.auth.getUser(token);
if (error || !user) { return 401; }
```

