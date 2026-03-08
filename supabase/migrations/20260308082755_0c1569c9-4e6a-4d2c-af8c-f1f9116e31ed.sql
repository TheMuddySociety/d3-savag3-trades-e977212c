CREATE TABLE public.price_alerts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  wallet_address TEXT NOT NULL,
  token_address TEXT NOT NULL,
  token_symbol TEXT NOT NULL,
  token_name TEXT NOT NULL,
  target_price NUMERIC NOT NULL,
  direction TEXT NOT NULL CHECK (direction IN ('above', 'below')),
  current_price_at_creation NUMERIC NOT NULL,
  triggered BOOLEAN NOT NULL DEFAULT false,
  triggered_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.price_alerts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own alerts"
  ON public.price_alerts FOR SELECT
  USING (true);

CREATE POLICY "Users can insert their own alerts"
  ON public.price_alerts FOR INSERT
  WITH CHECK (wallet_address IS NOT NULL AND length(wallet_address) > 30);

CREATE POLICY "Users can update their own alerts"
  ON public.price_alerts FOR UPDATE
  USING (true)
  WITH CHECK (wallet_address IS NOT NULL);

CREATE POLICY "Users can delete their own alerts"
  ON public.price_alerts FOR DELETE
  USING (true);

CREATE INDEX idx_price_alerts_wallet ON public.price_alerts (wallet_address);
CREATE INDEX idx_price_alerts_active ON public.price_alerts (triggered, token_address) WHERE triggered = false;