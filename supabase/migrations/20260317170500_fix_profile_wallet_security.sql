-- Migration: Fix Profile Wallet Security (Trust Anchor) Vulnerability
-- Description: Prevents users from changing their wallet_address, which acts as a trust anchor for RLS.

-- 1. Drop the existing overly permissive update policy
DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;

-- 2. Create a new restricted update policy
-- This allows updating other columns (like metadata) but we'll restrict wallet_address at the column level
CREATE POLICY "Users can update own profile"
  ON public.profiles FOR UPDATE
  TO authenticated
  USING (id = auth.uid())
  WITH CHECK (id = auth.uid());

-- 3. Revoke update permission on the wallet_address column for non-admin roles
-- This provides the first layer of defense at the permission level
REVOKE UPDATE (wallet_address) ON public.profiles FROM authenticated;
REVOKE UPDATE (wallet_address) ON public.profiles FROM anon;

-- 4. Add a trigger to enforce immutability of wallet_address
-- This provides a second layer of defense that applies even if RLS/Permissions are misconfigured
CREATE OR REPLACE FUNCTION public.ensure_wallet_address_immutable()
RETURNS TRIGGER AS $$
BEGIN
  IF (NEW.wallet_address IS DISTINCT FROM OLD.wallet_address) THEN
    RAISE EXCEPTION 'The wallet_address column is immutable and cannot be changed.';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS tr_ensure_wallet_address_immutable ON public.profiles;
CREATE TRIGGER tr_ensure_wallet_address_immutable
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.ensure_wallet_address_immutable();

-- 5. Explicitly grant update permissions on other columns if needed (future proofing)
-- For now, there are no other columns besides id, wallet_address, and created_at.
-- If new columns are added, they will be updatable by default unless revoked.
