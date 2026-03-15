
CREATE TABLE public.auto_trade_budgets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  wallet_address text NOT NULL,
  currency text NOT NULL DEFAULT 'SOL',
  budget_mode text NOT NULL DEFAULT 'deposit',
  deposit_amount numeric NOT NULL DEFAULT 0,
  spent_amount numeric NOT NULL DEFAULT 0,
  remaining_amount numeric NOT NULL DEFAULT 0,
  spending_limit numeric,
  escrow_amount numeric NOT NULL DEFAULT 0,
  escrow_tx text,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.auto_trade_budgets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can insert own budgets"
  ON public.auto_trade_budgets FOR INSERT
  TO public
  WITH CHECK (wallet_address IS NOT NULL AND length(wallet_address) > 30);

CREATE POLICY "Users can view own budgets"
  ON public.auto_trade_budgets FOR SELECT
  TO public
  USING (true);

CREATE POLICY "Users can update own budgets"
  ON public.auto_trade_budgets FOR UPDATE
  TO public
  USING (true)
  WITH CHECK (wallet_address IS NOT NULL AND length(wallet_address) > 30);

CREATE POLICY "Users can delete own budgets"
  ON public.auto_trade_budgets FOR DELETE
  TO public
  USING (true);
