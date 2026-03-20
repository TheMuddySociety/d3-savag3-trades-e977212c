import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const STUDIO_API_BASE = "https://api.jup.ag/studio/v1";

function ok(data: unknown) {
  return new Response(JSON.stringify({ success: true, data }), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function err(message: string, status = 500) {
  return new Response(JSON.stringify({ success: false, error: message }), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  // ── JWT Authentication ──────────────────────────────────────────
  const authHeader = req.headers.get("Authorization");
  if (!authHeader) return err("Missing Authorization header", 401);

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
  const supabase = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authHeader } },
  });
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();
  if (authError || !user) return err("Invalid token", 401);

  const JUPITER_API_KEY = Deno.env.get("JUPITER_API_KEY");

  const apiHeaders: Record<string, string> = {
    "Content-Type": "application/json",
  };
  if (JUPITER_API_KEY) apiHeaders["x-api-key"] = JUPITER_API_KEY;

  try {
    let body: any;
    try {
      body = await req.json();
    } catch {
      return err("Invalid or missing JSON body", 400);
    }

    const { action } = body;

    switch (action) {
      // ── Create Token Transaction ──────────────────────────────────
      case "create_token_tx": {
        const {
          tokenName,
          tokenSymbol,
          creator,
          initialMarketCap,
          migrationMarketCap,
          quoteMint,
          tokenImageContentType,
          antiSniping,
          feeBps,
          isLpLocked,
          lockedVestingParam,
        } = body;

        if (!tokenName || !tokenSymbol || !creator) {
          return err("tokenName, tokenSymbol, and creator are required", 400);
        }

        const payload: any = {
          buildCurveByMarketCapParam: {
            quoteMint:
              quoteMint || "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v",
            initialMarketCap: initialMarketCap || 16000,
            migrationMarketCap: migrationMarketCap || 69000,
            tokenQuoteDecimal: 6,
            lockedVestingParam: lockedVestingParam || {
              totalLockedVestingAmount: 0,
              cliffUnlockAmount: 0,
              numberOfVestingPeriod: 0,
              totalVestingDuration: 0,
              cliffDurationFromMigrationTime: 0,
            },
          },
          antiSniping: antiSniping ?? true,
          fee: { feeBps: feeBps ?? 100 },
          isLpLocked: isLpLocked ?? true,
          tokenName,
          tokenSymbol,
          tokenImageContentType: tokenImageContentType || "image/jpeg",
          creator,
        };

        const resp = await fetch(`${STUDIO_API_BASE}/dbc-pool/create-tx`, {
          method: "POST",
          headers: apiHeaders,
          body: JSON.stringify(payload),
        });

        if (!resp.ok) {
          const text = await resp.text();
          console.error("Studio create-tx error:", resp.status, text);
          return err(`Studio API error: ${resp.status} ${text}`, resp.status);
        }

        const data = await resp.json();
        return ok(data);
      }

      // ── Upload Token Metadata ─────────────────────────────────────
      case "upload_metadata": {
        const { metadataPresignedUrl, metadata } = body;
        if (!metadataPresignedUrl || !metadata) {
          return err(
            "metadataPresignedUrl and metadata are required",
            400
          );
        }

        const resp = await fetch(metadataPresignedUrl, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(metadata),
        });

        if (!resp.ok) {
          const text = await resp.text();
          console.error("Metadata upload error:", resp.status, text);
          return err(`Metadata upload failed: ${resp.status}`, resp.status);
        }

        return ok({ uploaded: true });
      }

      // ── Submit Signed Transaction ─────────────────────────────────
      case "submit_token": {
        const { signedTransaction, owner, content } = body;
        if (!signedTransaction || !owner) {
          return err("signedTransaction and owner are required", 400);
        }

        const formData = new FormData();
        formData.append("transaction", signedTransaction);
        formData.append("owner", owner);
        formData.append("content", content || "");

        const submitHeaders: Record<string, string> = {};
        if (JUPITER_API_KEY) submitHeaders["x-api-key"] = JUPITER_API_KEY;

        const resp = await fetch(`${STUDIO_API_BASE}/dbc-pool/submit`, {
          method: "POST",
          headers: submitHeaders,
          body: formData,
        });

        if (!resp.ok) {
          const text = await resp.text();
          console.error("Studio submit error:", resp.status, text);
          return err(`Submit failed: ${resp.status} ${text}`, resp.status);
        }

        const data = await resp.json();
        return ok(data);
      }

      // ── Pool Addresses by Mint ────────────────────────────────────
      case "pool_addresses": {
        const { mint } = body;
        if (!mint) return err("mint is required", 400);

        const resp = await fetch(
          `${STUDIO_API_BASE}/dbc-pool/addresses/${mint}`,
          { headers: apiHeaders }
        );

        if (!resp.ok) {
          const text = await resp.text();
          return err(
            `Pool addresses lookup failed: ${resp.status}`,
            resp.status
          );
        }

        const data = await resp.json();
        return ok(data);
      }

      // ── Check Unclaimed Fees ──────────────────────────────────────
      case "check_fees": {
        const { poolAddress } = body;
        if (!poolAddress) return err("poolAddress is required", 400);

        const resp = await fetch(`${STUDIO_API_BASE}/dbc/fee`, {
          method: "POST",
          headers: apiHeaders,
          body: JSON.stringify({ poolAddress }),
        });

        if (!resp.ok) {
          const text = await resp.text();
          return err(`Fee check failed: ${resp.status}`, resp.status);
        }

        const data = await resp.json();
        return ok(data);
      }

      // ── Create Claim Fees Transaction ─────────────────────────────
      case "claim_fees_tx": {
        const { ownerWallet, poolAddress, maxQuoteAmount } = body;
        if (!ownerWallet || !poolAddress) {
          return err("ownerWallet and poolAddress are required", 400);
        }

        const resp = await fetch(`${STUDIO_API_BASE}/dbc/fee/create-tx`, {
          method: "POST",
          headers: apiHeaders,
          body: JSON.stringify({
            ownerWallet,
            poolAddress,
            maxQuoteAmount: maxQuoteAmount || 0,
          }),
        });

        if (!resp.ok) {
          const text = await resp.text();
          return err(`Claim tx creation failed: ${resp.status}`, resp.status);
        }

        const data = await resp.json();
        return ok(data);
      }

      case "ping":
        return ok({ status: "ok", ts: Date.now() });

      default:
        return err("Invalid action. Use: create_token_tx, upload_metadata, submit_token, pool_addresses, check_fees, claim_fees_tx", 400);
    }
  } catch (error: unknown) {
    console.error("jupiter-studio error:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return err(message);
  }
});
