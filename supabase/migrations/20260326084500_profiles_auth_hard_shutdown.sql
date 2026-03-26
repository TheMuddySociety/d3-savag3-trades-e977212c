-- Migration: Profiles Auth Hard Shutdown (Identity Security Patch)
-- Description: Completely revokes the ability for authenticated users to self-initialize or modify their profiles.
--              Profile creation is now strictly delegated to the 'wallet-auth' Edge Function (Security Definer).
-- Date: 2026-03-26

-- 1. Drop ALL insecure policies on the profiles table
DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can only insert own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can only insert own profile if it doesn't exist" ON public.profiles;

-- 2. Re-create the SELECT policy (Safe)
-- Users can still read their own profile to see their derived wallet_address.
DROP POLICY IF EXISTS "Users can view own profile" ON public.profiles;
CREATE POLICY "Users can view own profile"
  ON public.profiles FOR SELECT
  TO authenticated
  USING (id = auth.uid());

-- 3. Revoke all UPDATE/DELETE permissions at the role level
-- This provides defense-in-depth even if RLS is somehow bypassed or disabled.
REVOKE UPDATE, DELETE, INSERT ON public.profiles FROM authenticated;
REVOKE UPDATE, DELETE, INSERT ON public.profiles FROM anon;

-- 4. Re-assert the immutability trigger for wallet_address (Robust Layer)
CREATE OR REPLACE FUNCTION public.ensure_wallet_address_immutable()
RETURNS TRIGGER AS $$
BEGIN
  -- Prevent ANY change to wallet_address or id
  IF (NEW.wallet_address IS DISTINCT FROM OLD.wallet_address) THEN
    RAISE EXCEPTION 'CRITICAL SECURITY ERROR: The wallet_address column is immutable and acts as a trust anchor for RLS.';
  END IF;
  
  IF (NEW.id IS DISTINCT FROM OLD.id) THEN
    RAISE EXCEPTION 'CRITICAL SECURITY ERROR: The profile owner ID is immutable.';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS tr_ensure_wallet_address_immutable ON public.profiles;
CREATE TRIGGER tr_ensure_wallet_address_immutable
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.ensure_wallet_address_immutable();

-- 5. Final validation of the auth_wallet_address() trust anchor
CREATE OR REPLACE FUNCTION public.auth_wallet_address()
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  -- Resolved from the FIXED profile row linked to the auth user.
  -- Since users can no longer INSERT or UPDATE these rows, the mapping is guaranteed to be authentic.
  SELECT wallet_address FROM public.profiles WHERE id = auth.uid();
$$;
