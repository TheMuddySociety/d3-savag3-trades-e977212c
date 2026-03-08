
CREATE TABLE public.access_payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  wallet_address text NOT NULL,
  tx_signature text NOT NULL,
  sol_amount numeric NOT NULL DEFAULT 0.04141,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE(wallet_address)
);

ALTER TABLE public.access_payments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can check payment status"
  ON public.access_payments FOR SELECT
  USING (true);

CREATE POLICY "Insert payment record"
  ON public.access_payments FOR INSERT
  WITH CHECK (wallet_address IS NOT NULL AND length(wallet_address) > 30);
