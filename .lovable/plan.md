

## Plan: Clean Up Mobile UI + Add Connection Status Indicator

### What we're doing

Two improvements inspired by the clean Solana template aesthetic:

1. **Cleaner mobile layout** -- Reduce visual clutter in MobileHeader (tighter, more minimal), improve spacing/padding in the mobile dashboard content area, and polish the bottom nav with subtle refinements.

2. **Connection Status Indicator** -- A new compact component that shows wallet health (connected/disconnected), network latency (RPC ping), and API connectivity status (edge functions reachable). Displayed below the mobile header and in the desktop right sidebar.

---

### Technical Details

**1. MobileHeader cleanup** (`src/components/layout/MobileHeader.tsx`)
- Reduce header height from `h-12` to `h-11`
- Use the logo image instead of text+icon for brand mark (consistent with desktop)
- Tighten wallet address pill styling
- Remove redundant `appkit-button` when wallet is disconnected (keep just UnifiedWalletButton for cleaner look)

**2. MobileDashboard spacing** (`src/pages/Index.tsx`)
- Reduce `pt-16` to `pt-14` and `pb-20` to `pb-18` to match tighter header/nav
- Reduce `space-y-3` to `space-y-2.5` for tighter card stacking on mobile

**3. MobileBottomNav polish** (`src/components/layout/MobileBottomNav.tsx`)
- Reduce nav height from `h-16` to `h-14`
- Slightly smaller icons (`h-4 w-4`) and tighter label text
- Add a subtle top glow line on active tab instead of bottom indicator

**4. New `ConnectionStatus` component** (`src/components/dashboard/ConnectionStatus.tsx`)
- Three status dots: **Wallet** (green/red based on `useWallet().connected`), **RPC** (pings `rpc-proxy` edge function on mount, shows green/yellow/red), **API** (pings `token-prices` edge function, shows green/red)
- Compact horizontal bar with three labeled dots
- Auto-refreshes every 30 seconds
- Uses existing `supabase` client to call edge functions for health checks

**5. Integrate ConnectionStatus**
- In `MobileDashboard`: render it just below `MobileHeader` (inside `pt-14` area, as a sticky sub-bar)
- In `DesktopDashboard`: add it to the top bar area next to the LIVE badge

### Files to create/modify
- **Create**: `src/components/dashboard/ConnectionStatus.tsx`
- **Edit**: `src/components/layout/MobileHeader.tsx`
- **Edit**: `src/components/layout/MobileBottomNav.tsx`
- **Edit**: `src/pages/Index.tsx`

