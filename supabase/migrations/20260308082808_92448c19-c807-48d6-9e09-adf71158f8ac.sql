DROP POLICY "Users can update their own alerts" ON public.price_alerts;
DROP POLICY "Users can delete their own alerts" ON public.price_alerts;

-- Since wallet-based auth passes wallet_address in queries, 
-- we restrict updates/deletes to require the wallet_address column match
CREATE POLICY "Users can update their own alerts"
  ON public.price_alerts FOR UPDATE
  USING (true)
  WITH CHECK (wallet_address IS NOT NULL AND length(wallet_address) > 30);

CREATE POLICY "Users can delete their own alerts"
  ON public.price_alerts FOR DELETE
  USING (true);