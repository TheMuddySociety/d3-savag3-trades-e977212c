-- Create RPC request audit log table
CREATE TABLE public.rpc_request_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid,
  rpc_method text NOT NULL,
  status_code integer NOT NULL,
  latency_ms integer,
  error_message text,
  ip_hint text,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.rpc_request_logs ENABLE ROW LEVEL SECURITY;

-- Service role can do everything (edge function uses service role to insert)
CREATE POLICY "Service role full access on rpc_request_logs"
  ON public.rpc_request_logs
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Authenticated users can view their own logs
CREATE POLICY "Auth users can view own rpc logs"
  ON public.rpc_request_logs
  FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

-- Index for querying by user and time
CREATE INDEX idx_rpc_logs_user_created ON public.rpc_request_logs (user_id, created_at DESC);

-- Index for monitoring queries by method
CREATE INDEX idx_rpc_logs_method ON public.rpc_request_logs (rpc_method, created_at DESC);

-- Auto-cleanup: delete logs older than 30 days via pg_cron
SELECT cron.schedule(
  'cleanup-rpc-logs-daily',
  '0 3 * * *',
  $$DELETE FROM public.rpc_request_logs WHERE created_at < now() - interval '30 days';$$
);