
CREATE TABLE public.pending_auto_trades (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  wallet_address text NOT NULL,
  token_mint text NOT NULL,
  token_symbol text,
  side text NOT NULL DEFAULT 'sell',
  amount_raw text NOT NULL,
  decimals int NOT NULL DEFAULT 6,
  strategy text NOT NULL,
  reason text,
  entry_price numeric,
  current_price numeric,
  pnl_percent numeric,
  status text NOT NULL DEFAULT 'pending',
  executed_at timestamptz,
  tx_signature text,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.pending_auto_trades ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role full access on pending_auto_trades"
  ON public.pending_auto_trades FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Auth users can view own pending trades"
  ON public.pending_auto_trades FOR SELECT
  TO authenticated
  USING (wallet_address = auth_wallet_address());

CREATE POLICY "Auth users can update own pending trades"
  ON public.pending_auto_trades FOR UPDATE
  TO authenticated
  USING (wallet_address = auth_wallet_address())
  WITH CHECK (wallet_address = auth_wallet_address());

CREATE POLICY "Auth users can delete own pending trades"
  ON public.pending_auto_trades FOR DELETE
  TO authenticated
  USING (wallet_address = auth_wallet_address());

-- Also create an entry_prices table to persist entry prices across sessions
CREATE TABLE public.auto_trade_entry_prices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  wallet_address text NOT NULL,
  token_mint text NOT NULL,
  entry_price numeric NOT NULL,
  recorded_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(wallet_address, token_mint)
);

ALTER TABLE public.auto_trade_entry_prices ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role full access on entry_prices"
  ON public.auto_trade_entry_prices FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Auth users can view own entry prices"
  ON public.auto_trade_entry_prices FOR SELECT
  TO authenticated
  USING (wallet_address = auth_wallet_address());

CREATE POLICY "Auth users can insert own entry prices"
  ON public.auto_trade_entry_prices FOR INSERT
  TO authenticated
  WITH CHECK (wallet_address = auth_wallet_address());

CREATE POLICY "Auth users can update own entry prices"
  ON public.auto_trade_entry_prices FOR UPDATE
  TO authenticated
  USING (wallet_address = auth_wallet_address())
  WITH CHECK (wallet_address = auth_wallet_address());

CREATE POLICY "Auth users can delete own entry prices"
  ON public.auto_trade_entry_prices FOR DELETE
  TO authenticated
  USING (wallet_address = auth_wallet_address());
