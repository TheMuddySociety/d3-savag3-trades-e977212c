-- Migration: Database Identity Security Hardening
-- Description: Enforces strict immutability of wallet_address and prevents profile tampering/recycling.
-- Date: 2026-03-23

-- 1. Ensure the immutability trigger is active and robust
CREATE OR REPLACE FUNCTION public.ensure_wallet_address_immutable()
RETURNS TRIGGER AS $$
BEGIN
  -- Prevent ANY change to wallet_address
  IF (NEW.wallet_address IS DISTINCT FROM OLD.wallet_address) THEN
    RAISE EXCEPTION 'CRITICAL SECURITY ERROR: The wallet_address column is immutable and acts as a trust anchor for RLS. It cannot be changed.';
  END IF;
  
  -- Prevent changing the owner ID (linking to a different auth user)
  IF (NEW.id IS DISTINCT FROM OLD.id) THEN
    RAISE EXCEPTION 'CRITICAL SECURITY ERROR: The profile owner ID is immutable.';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Re-create the trigger to ensure it's up to date
DROP TRIGGER IF EXISTS tr_ensure_wallet_address_immutable ON public.profiles;
CREATE TRIGGER tr_ensure_wallet_address_immutable
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.ensure_wallet_address_immutable();

-- 2. Explicitly revoke DELETE permissions for general users
-- This prevents a user from deleting their profile and re-creating it with a different wallet_address
REVOKE DELETE ON public.profiles FROM authenticated;
REVOKE DELETE ON public.profiles FROM anon;

-- 3. Add a CHECK constraint for Solana address format (basic safety)
-- Solana addresses are typically 32-44 characters in base58
ALTER TABLE public.profiles 
  ADD CONSTRAINT ck_wallet_address_format 
  CHECK (length(wallet_address) >= 32 AND length(wallet_address) <= 44);

-- 4. Harden the auth_wallet_address helper function
-- Ensure it is strictly STABLE and SECURITY DEFINER (already is, but re-asserting)
CREATE OR REPLACE FUNCTION public.auth_wallet_address()
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  -- This function is the trust anchor for all RLS policies in the application.
  -- It resolves the current auth user's FIXED wallet address from the profiles table.
  SELECT wallet_address FROM public.profiles WHERE id = auth.uid();
$$;

-- 5. Audit Policy check (Final Hardening)
-- Ensure 'Users can update own profile' policy ONLY allows updating metadata columns if any are added, 
-- but since REVOKE UPDATE (wallet_address) was already done in previous migrations, this is redundant but safe.
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'profiles' AND policyname = 'Users can update own profile'
  ) THEN
    CREATE POLICY "Users can update own profile"
      ON public.profiles FOR UPDATE
      TO authenticated
      USING (id = auth.uid())
      WITH CHECK (id = auth.uid());
  END IF;
END $$;
