-- Drop all overly permissive policies and replace with auth-based ones

-- ═══ live_trades ═══
DROP POLICY IF EXISTS "Users can view own live trades" ON public.live_trades;
DROP POLICY IF EXISTS "Users can insert own live trades" ON public.live_trades;

CREATE POLICY "Authenticated users can view own live trades"
  ON public.live_trades FOR SELECT TO authenticated
  USING (wallet_address = public.auth_wallet_address());

CREATE POLICY "Authenticated users can insert own live trades"
  ON public.live_trades FOR INSERT TO authenticated
  WITH CHECK (wallet_address = public.auth_wallet_address());

-- ═══ sim_wallets ═══
DROP POLICY IF EXISTS "Users can view own sim wallet" ON public.sim_wallets;
DROP POLICY IF EXISTS "Users can insert own sim wallet" ON public.sim_wallets;
DROP POLICY IF EXISTS "Users can update own sim wallet" ON public.sim_wallets;

CREATE POLICY "Auth users can view own sim wallet"
  ON public.sim_wallets FOR SELECT TO authenticated
  USING (wallet_address = public.auth_wallet_address());

CREATE POLICY "Auth users can insert own sim wallet"
  ON public.sim_wallets FOR INSERT TO authenticated
  WITH CHECK (wallet_address = public.auth_wallet_address());

CREATE POLICY "Auth users can update own sim wallet"
  ON public.sim_wallets FOR UPDATE TO authenticated
  USING (wallet_address = public.auth_wallet_address())
  WITH CHECK (wallet_address = public.auth_wallet_address());

-- ═══ auto_trade_budgets ═══
DROP POLICY IF EXISTS "Users can view own budgets" ON public.auto_trade_budgets;
DROP POLICY IF EXISTS "Users can insert own budgets" ON public.auto_trade_budgets;
DROP POLICY IF EXISTS "Users can update own budgets" ON public.auto_trade_budgets;
DROP POLICY IF EXISTS "Users can delete own budgets" ON public.auto_trade_budgets;

CREATE POLICY "Auth users can view own budgets"
  ON public.auto_trade_budgets FOR SELECT TO authenticated
  USING (wallet_address = public.auth_wallet_address());

CREATE POLICY "Auth users can insert own budgets"
  ON public.auto_trade_budgets FOR INSERT TO authenticated
  WITH CHECK (wallet_address = public.auth_wallet_address());

CREATE POLICY "Auth users can update own budgets"
  ON public.auto_trade_budgets FOR UPDATE TO authenticated
  USING (wallet_address = public.auth_wallet_address())
  WITH CHECK (wallet_address = public.auth_wallet_address());

CREATE POLICY "Auth users can delete own budgets"
  ON public.auto_trade_budgets FOR DELETE TO authenticated
  USING (wallet_address = public.auth_wallet_address());

-- ═══ access_payments ═══
DROP POLICY IF EXISTS "Anyone can check payment status" ON public.access_payments;
DROP POLICY IF EXISTS "Insert payment record" ON public.access_payments;

CREATE POLICY "Auth users can view own payments"
  ON public.access_payments FOR SELECT TO authenticated
  USING (wallet_address = public.auth_wallet_address());

CREATE POLICY "Auth users can insert own payments"
  ON public.access_payments FOR INSERT TO authenticated
  WITH CHECK (wallet_address = public.auth_wallet_address());

-- ═══ withdrawals ═══
DROP POLICY IF EXISTS "Users can view own withdrawals" ON public.withdrawals;
DROP POLICY IF EXISTS "Edge functions can insert withdrawals" ON public.withdrawals;

CREATE POLICY "Auth users can view own withdrawals"
  ON public.withdrawals FOR SELECT TO authenticated
  USING (wallet_address = public.auth_wallet_address());

CREATE POLICY "Auth users can insert own withdrawals"
  ON public.withdrawals FOR INSERT TO authenticated
  WITH CHECK (wallet_address = public.auth_wallet_address());

-- ═══ chat_messages ═══
DROP POLICY IF EXISTS "Users can view own chat messages" ON public.chat_messages;
DROP POLICY IF EXISTS "Users can insert own chat messages" ON public.chat_messages;
DROP POLICY IF EXISTS "Users can delete own chat messages" ON public.chat_messages;

CREATE POLICY "Auth users can view own chat messages"
  ON public.chat_messages FOR SELECT TO authenticated
  USING (wallet_address = public.auth_wallet_address());

CREATE POLICY "Auth users can insert own chat messages"
  ON public.chat_messages FOR INSERT TO authenticated
  WITH CHECK (wallet_address = public.auth_wallet_address());

CREATE POLICY "Auth users can delete own chat messages"
  ON public.chat_messages FOR DELETE TO authenticated
  USING (wallet_address = public.auth_wallet_address());

-- ═══ sim_orders ═══
DROP POLICY IF EXISTS "Users can manage own sim orders" ON public.sim_orders;

CREATE POLICY "Auth users can select own sim orders"
  ON public.sim_orders FOR SELECT TO authenticated
  USING (wallet_address = public.auth_wallet_address());

CREATE POLICY "Auth users can insert own sim orders"
  ON public.sim_orders FOR INSERT TO authenticated
  WITH CHECK (wallet_address = public.auth_wallet_address());

CREATE POLICY "Auth users can update own sim orders"
  ON public.sim_orders FOR UPDATE TO authenticated
  USING (wallet_address = public.auth_wallet_address())
  WITH CHECK (wallet_address = public.auth_wallet_address());

CREATE POLICY "Auth users can delete own sim orders"
  ON public.sim_orders FOR DELETE TO authenticated
  USING (wallet_address = public.auth_wallet_address());

-- ═══ price_alerts ═══
DROP POLICY IF EXISTS "Users can view their own alerts" ON public.price_alerts;
DROP POLICY IF EXISTS "Users can insert their own alerts" ON public.price_alerts;
DROP POLICY IF EXISTS "Users can update their own alerts" ON public.price_alerts;
DROP POLICY IF EXISTS "Users can delete their own alerts" ON public.price_alerts;

CREATE POLICY "Auth users can view own alerts"
  ON public.price_alerts FOR SELECT TO authenticated
  USING (wallet_address = public.auth_wallet_address());

CREATE POLICY "Auth users can insert own alerts"
  ON public.price_alerts FOR INSERT TO authenticated
  WITH CHECK (wallet_address = public.auth_wallet_address());

CREATE POLICY "Auth users can update own alerts"
  ON public.price_alerts FOR UPDATE TO authenticated
  USING (wallet_address = public.auth_wallet_address())
  WITH CHECK (wallet_address = public.auth_wallet_address());

CREATE POLICY "Auth users can delete own alerts"
  ON public.price_alerts FOR DELETE TO authenticated
  USING (wallet_address = public.auth_wallet_address());

-- ═══ copy_trade_configs ═══
DROP POLICY IF EXISTS "Users can manage own copy trade configs" ON public.copy_trade_configs;

CREATE POLICY "Auth users can select own copy configs"
  ON public.copy_trade_configs FOR SELECT TO authenticated
  USING (wallet_address = public.auth_wallet_address());

CREATE POLICY "Auth users can insert own copy configs"
  ON public.copy_trade_configs FOR INSERT TO authenticated
  WITH CHECK (wallet_address = public.auth_wallet_address());

CREATE POLICY "Auth users can update own copy configs"
  ON public.copy_trade_configs FOR UPDATE TO authenticated
  USING (wallet_address = public.auth_wallet_address())
  WITH CHECK (wallet_address = public.auth_wallet_address());

CREATE POLICY "Auth users can delete own copy configs"
  ON public.copy_trade_configs FOR DELETE TO authenticated
  USING (wallet_address = public.auth_wallet_address());

-- ═══ sim_bot_configs ═══
DROP POLICY IF EXISTS "Users can manage own bot configs" ON public.sim_bot_configs;

CREATE POLICY "Auth users can select own bot configs"
  ON public.sim_bot_configs FOR SELECT TO authenticated
  USING (wallet_address = public.auth_wallet_address());

CREATE POLICY "Auth users can insert own bot configs"
  ON public.sim_bot_configs FOR INSERT TO authenticated
  WITH CHECK (wallet_address = public.auth_wallet_address());

CREATE POLICY "Auth users can update own bot configs"
  ON public.sim_bot_configs FOR UPDATE TO authenticated
  USING (wallet_address = public.auth_wallet_address())
  WITH CHECK (wallet_address = public.auth_wallet_address());

CREATE POLICY "Auth users can delete own bot configs"
  ON public.sim_bot_configs FOR DELETE TO authenticated
  USING (wallet_address = public.auth_wallet_address());

-- ═══ copy_trade_events ═══
DROP POLICY IF EXISTS "Users can view own copy trade events" ON public.copy_trade_events;
DROP POLICY IF EXISTS "Edge functions can insert events" ON public.copy_trade_events;
DROP POLICY IF EXISTS "Users can update own events" ON public.copy_trade_events;
DROP POLICY IF EXISTS "Users can delete own events" ON public.copy_trade_events;

CREATE POLICY "Auth users can view own copy events"
  ON public.copy_trade_events FOR SELECT TO authenticated
  USING (wallet_address = public.auth_wallet_address());

CREATE POLICY "Auth users can insert own copy events"
  ON public.copy_trade_events FOR INSERT TO authenticated
  WITH CHECK (wallet_address = public.auth_wallet_address());

CREATE POLICY "Auth users can update own copy events"
  ON public.copy_trade_events FOR UPDATE TO authenticated
  USING (wallet_address = public.auth_wallet_address())
  WITH CHECK (wallet_address = public.auth_wallet_address());

CREATE POLICY "Auth users can delete own copy events"
  ON public.copy_trade_events FOR DELETE TO authenticated
  USING (wallet_address = public.auth_wallet_address());

-- ═══ sim_holdings ═══
DROP POLICY IF EXISTS "Users can manage own sim holdings" ON public.sim_holdings;

CREATE POLICY "Auth users can select own sim holdings"
  ON public.sim_holdings FOR SELECT TO authenticated
  USING (wallet_address = public.auth_wallet_address());

CREATE POLICY "Auth users can insert own sim holdings"
  ON public.sim_holdings FOR INSERT TO authenticated
  WITH CHECK (wallet_address = public.auth_wallet_address());

CREATE POLICY "Auth users can update own sim holdings"
  ON public.sim_holdings FOR UPDATE TO authenticated
  USING (wallet_address = public.auth_wallet_address())
  WITH CHECK (wallet_address = public.auth_wallet_address());

CREATE POLICY "Auth users can delete own sim holdings"
  ON public.sim_holdings FOR DELETE TO authenticated
  USING (wallet_address = public.auth_wallet_address());