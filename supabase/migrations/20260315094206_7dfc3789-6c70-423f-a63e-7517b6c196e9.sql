
CREATE TABLE public.withdrawals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  wallet_address text NOT NULL,
  amount numeric NOT NULL DEFAULT 0,
  currency text NOT NULL DEFAULT 'SOL',
  tx_signature text NOT NULL,
  budget_id uuid,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.withdrawals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own withdrawals" ON public.withdrawals
  FOR SELECT TO public USING (true);

CREATE POLICY "Edge functions can insert withdrawals" ON public.withdrawals
  FOR INSERT TO public WITH CHECK (wallet_address IS NOT NULL AND length(wallet_address) > 30);
