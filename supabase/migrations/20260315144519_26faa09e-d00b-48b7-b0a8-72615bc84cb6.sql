ALTER TABLE public.auto_trade_entry_prices 
  ADD COLUMN IF NOT EXISTS peak_price numeric,
  ADD COLUMN IF NOT EXISTS lowest_price numeric,
  ADD COLUMN IF NOT EXISTS price_1h_ago numeric;

-- Allow pending_auto_trades to have 'buy' side trades
-- (already supports it via text column, no change needed)

-- Add index for faster lookups
CREATE INDEX IF NOT EXISTS idx_pending_auto_trades_wallet_status 
  ON public.pending_auto_trades(wallet_address, status);
CREATE INDEX IF NOT EXISTS idx_entry_prices_wallet 
  ON public.auto_trade_entry_prices(wallet_address);
