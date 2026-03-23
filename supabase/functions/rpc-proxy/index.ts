import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const ALLOWED_METHODS = new Set([
  "getHealth", "getBalance", "getTokenAccountsByOwner", "getLatestBlockhash",
  "getTransaction", "sendTransaction", "getAccountInfo", "getSlot", "getBlock",
  "getSignaturesForAddress", "simulateTransaction", "getRecentBlockhash",
  "getTokenAccountBalance", "getProgramAccounts", "getMultipleAccounts",
  "getSignatureStatuses", "getFeeForMessage", "getMinimumBalanceForRentExemption",
  "isBlockhashValid", "getBlockHeight",
]);

const MAX_BODY_SIZE = 10240; // 10KB

// --- Sliding window rate limiter (in-memory, per-isolate) ---
const RATE_LIMIT_WINDOW_MS = 60_000; // 60 seconds
const RATE_LIMIT_MAX_REQUESTS = 60;   // 60 requests per window

interface SlidingWindow {
  timestamps: number[];
}

const rateLimitMap = new Map<string, SlidingWindow>();

// Periodic cleanup to prevent unbounded memory growth
const CLEANUP_INTERVAL_MS = 120_000;
let lastCleanup = Date.now();

function cleanupStaleEntries(now: number) {
  if (now - lastCleanup < CLEANUP_INTERVAL_MS) return;
  lastCleanup = now;
  for (const [key, window] of rateLimitMap) {
    if (window.timestamps.length === 0 || window.timestamps[window.timestamps.length - 1] < now - RATE_LIMIT_WINDOW_MS) {
      rateLimitMap.delete(key);
    }
  }
}

function checkRateLimit(userId: string): { allowed: boolean; remaining: number; retryAfterMs?: number } {
  const now = Date.now();
  cleanupStaleEntries(now);

  let window = rateLimitMap.get(userId);
  if (!window) {
    window = { timestamps: [] };
    rateLimitMap.set(userId, window);
  }

  // Trim timestamps outside the sliding window
  const cutoff = now - RATE_LIMIT_WINDOW_MS;
  while (window.timestamps.length > 0 && window.timestamps[0] <= cutoff) {
    window.timestamps.shift();
  }

  if (window.timestamps.length >= RATE_LIMIT_MAX_REQUESTS) {
    const oldestInWindow = window.timestamps[0];
    const retryAfterMs = oldestInWindow + RATE_LIMIT_WINDOW_MS - now;
    return { allowed: false, remaining: 0, retryAfterMs };
  }

  window.timestamps.push(now);
  return { allowed: true, remaining: RATE_LIMIT_MAX_REQUESTS - window.timestamps.length };
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body = await req.text();

    // Size guard
    if (body.length > MAX_BODY_SIZE) {
      return new Response(JSON.stringify({ error: "Request too large" }), {
        status: 413, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let parsedBody: any;
    try { parsedBody = JSON.parse(body); } catch { parsedBody = {}; }

    // Method whitelist
    const method = parsedBody?.method;
    if (method && !ALLOWED_METHODS.has(method)) {
      return new Response(JSON.stringify({ error: "Method not allowed" }), {
        status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Allow unauthenticated health checks (no rate limit)
    const isHealthCheck = method === "getHealth";

    let userId = "anonymous";

    if (!isHealthCheck) {
      const authHeader = req.headers.get("Authorization");
      if (!authHeader) {
        return new Response(JSON.stringify({ error: "Missing Authorization header" }), {
          status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
      const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
      const supabase = createClient(supabaseUrl, anonKey, {
        global: { headers: { Authorization: authHeader } },
      });

      const token = authHeader.replace("Bearer ", "");
      const { data: { user }, error: authError } = await supabase.auth.getUser(token);

      if (authError || !user) {
        return new Response(JSON.stringify({ error: "Invalid token" }), {
          status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      userId = user.id;

      // Per-user rate limiting
      const { allowed, remaining, retryAfterMs } = checkRateLimit(userId);
      if (!allowed) {
        return new Response(JSON.stringify({ error: "Rate limit exceeded. Try again shortly." }), {
          status: 429,
          headers: {
            ...corsHeaders,
            "Content-Type": "application/json",
            "Retry-After": String(Math.ceil((retryAfterMs || 1000) / 1000)),
            "X-RateLimit-Limit": String(RATE_LIMIT_MAX_REQUESTS),
            "X-RateLimit-Remaining": "0",
          },
        });
      }
    }

    let heliusKey = Deno.env.get("HELIUS_API_KEY");
    const isInvalidKey = !heliusKey || heliusKey.includes("REPLACE") || heliusKey.length < 10;

    let rpcUrl: string;
    if (isInvalidKey) {
      console.warn("HELIUS_API_KEY is missing or invalid. Falling back to public RPC.");
      rpcUrl = "https://api.mainnet-beta.solana.com";
    } else {
      rpcUrl = `https://mainnet.helius-rpc.com/?api-key=${heliusKey}`;
    }

    const rpcRes = await fetch(rpcUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body,
    });

    // Fallback to public RPC on 401/403 from Helius
    if ((rpcRes.status === 403 || rpcRes.status === 401) && !isInvalidKey) {
      console.error(`Helius returned ${rpcRes.status}. Attempting public RPC fallback.`);
      const fallbackRes = await fetch("https://api.mainnet-beta.solana.com", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body,
      });
      const fallbackData = await fallbackRes.text();
      return new Response(fallbackData, {
        status: fallbackRes.status,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const data = await rpcRes.text();
    return new Response(data, {
      status: rpcRes.status,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
