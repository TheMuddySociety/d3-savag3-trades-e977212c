CREATE TABLE public.chat_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  wallet_address text NOT NULL,
  role text NOT NULL,
  content text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.chat_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own chat messages"
  ON public.chat_messages FOR SELECT
  TO public
  USING (true);

CREATE POLICY "Users can insert own chat messages"
  ON public.chat_messages FOR INSERT
  TO public
  WITH CHECK (wallet_address IS NOT NULL AND length(wallet_address) > 30);

CREATE POLICY "Users can delete own chat messages"
  ON public.chat_messages FOR DELETE
  TO public
  USING (true);

CREATE INDEX idx_chat_messages_wallet ON public.chat_messages(wallet_address, created_at);