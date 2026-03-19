-- Prevent users from changing their wallet_address after profile creation
CREATE OR REPLACE FUNCTION public.prevent_wallet_address_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF OLD.wallet_address IS NOT NULL AND NEW.wallet_address IS DISTINCT FROM OLD.wallet_address THEN
    RAISE EXCEPTION 'wallet_address cannot be changed after profile creation';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER enforce_immutable_wallet_address
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.prevent_wallet_address_change();