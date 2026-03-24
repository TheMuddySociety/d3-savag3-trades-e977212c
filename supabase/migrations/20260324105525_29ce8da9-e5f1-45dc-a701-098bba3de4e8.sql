
-- Beach Mode Sessions table for PDA delegation tracking
CREATE TABLE public.beach_mode_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  wallet_address text NOT NULL,
  is_active boolean NOT NULL DEFAULT false,
  delegation_tx text,
  delegation_status text NOT NULL DEFAULT 'pending',
  strategies jsonb NOT NULL DEFAULT '["safe_exit","scalper","new_launch","momentum","dip_buy"]'::jsonb,
  ai_autonomy_level text NOT NULL DEFAULT 'full',
  max_trade_sol numeric NOT NULL DEFAULT 0.5,
  daily_cap_sol numeric NOT NULL DEFAULT 5.0,
  daily_spent_sol numeric NOT NULL DEFAULT 0,
  daily_reset_at timestamptz NOT NULL DEFAULT now(),
  total_trades integer NOT NULL DEFAULT 0,
  total_pnl_sol numeric NOT NULL DEFAULT 0,
  last_evaluation_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(wallet_address)
);

ALTER TABLE public.beach_mode_sessions ENABLE ROW LEVEL SECURITY;

-- Service role full access (for auto-trader cron)
CREATE POLICY "Service role full access on beach_mode_sessions"
  ON public.beach_mode_sessions FOR ALL TO service_role
  USING (true) WITH CHECK (true);

-- Authenticated users can view their own session
CREATE POLICY "Auth users can view own beach session"
  ON public.beach_mode_sessions FOR SELECT TO authenticated
  USING (wallet_address = auth_wallet_address());

-- Authenticated users can insert their own session
CREATE POLICY "Auth users can insert own beach session"
  ON public.beach_mode_sessions FOR INSERT TO authenticated
  WITH CHECK (wallet_address = auth_wallet_address());

-- Authenticated users can update their own session
CREATE POLICY "Auth users can update own beach session"
  ON public.beach_mode_sessions FOR UPDATE TO authenticated
  USING (wallet_address = auth_wallet_address())
  WITH CHECK (wallet_address = auth_wallet_address());

-- Authenticated users can delete their own session
CREATE POLICY "Auth users can delete own beach session"
  ON public.beach_mode_sessions FOR DELETE TO authenticated
  USING (wallet_address = auth_wallet_address());
