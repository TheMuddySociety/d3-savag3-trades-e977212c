
CREATE TABLE public.copy_trade_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  wallet_address text NOT NULL,
  target_wallet text NOT NULL,
  signature text NOT NULL,
  swap_type text NOT NULL,
  token_mint text NOT NULL,
  sol_amount numeric NOT NULL DEFAULT 0,
  timestamp bigint,
  processed boolean NOT NULL DEFAULT false,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE(signature, wallet_address)
);

ALTER TABLE public.copy_trade_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own copy trade events"
  ON public.copy_trade_events
  FOR SELECT
  TO public
  USING (true);

CREATE POLICY "Edge functions can insert events"
  ON public.copy_trade_events
  FOR INSERT
  TO public
  WITH CHECK (wallet_address IS NOT NULL AND length(wallet_address) > 30);

CREATE POLICY "Users can update own events"
  ON public.copy_trade_events
  FOR UPDATE
  TO public
  USING (true)
  WITH CHECK (wallet_address IS NOT NULL AND length(wallet_address) > 30);

CREATE POLICY "Users can delete own events"
  ON public.copy_trade_events
  FOR DELETE
  TO public
  USING (true);

-- Enable realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.copy_trade_events;
