
-- Add payment_type column to access_payments
ALTER TABLE public.access_payments ADD COLUMN IF NOT EXISTS payment_type text NOT NULL DEFAULT 'access';

-- Create copy_trade_configs table
CREATE TABLE public.copy_trade_configs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  wallet_address text NOT NULL,
  target_wallet text NOT NULL,
  max_sol_per_trade numeric NOT NULL DEFAULT 0.5,
  is_active boolean NOT NULL DEFAULT false,
  last_checked_tx text,
  blacklisted_tokens text[] DEFAULT '{}',
  auto_sell boolean NOT NULL DEFAULT true,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.copy_trade_configs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own copy trade configs" ON public.copy_trade_configs
  FOR ALL TO public
  USING (true)
  WITH CHECK (wallet_address IS NOT NULL AND length(wallet_address) > 30);
