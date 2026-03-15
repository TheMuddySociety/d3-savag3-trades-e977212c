import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const PLATFORM_WALLET = "ETz1CboRkEJZDZcstd6bjHtjhRsydHQNHPEYMuhcYK2Z";
const REQUIRED_LAMPORTS = 100_000_000; // 0.1 SOL
const SYSTEM_PROGRAM = "11111111111111111111111111111111";

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { walletAddress, signature } = await req.json();

    if (!walletAddress || !signature) {
      return new Response(
        JSON.stringify({ error: "walletAddress and signature are required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const admin = createClient(supabaseUrl, serviceRoleKey);

    // 1. Check if this signature was already recorded (idempotent)
    const { data: existing } = await admin
      .from("access_payments")
      .select("id")
      .eq("tx_signature", signature)
      .maybeSingle();

    if (existing) {
      return new Response(
        JSON.stringify({ success: true, alreadyRecorded: true }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 2. Fetch and verify the transaction on-chain
    const heliusKey = Deno.env.get("HELIUS_API_KEY");
    const rpcUrl = heliusKey
      ? `https://mainnet.helius-rpc.com/?api-key=${heliusKey}`
      : "https://api.mainnet-beta.solana.com";

    const txRes = await fetch(rpcUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: 1,
        method: "getTransaction",
        params: [
          signature,
          { encoding: "jsonParsed", maxSupportedTransactionVersion: 0 },
        ],
      }),
    });

    const txData = await txRes.json();
    const tx = txData?.result;

    if (!tx) {
      return new Response(
        JSON.stringify({ error: "Transaction not found on-chain. It may still be confirming — try again in a few seconds." }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 3. Check transaction was successful
    if (tx.meta?.err) {
      return new Response(
        JSON.stringify({ error: "Transaction failed on-chain" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 4. Find a SOL transfer instruction to the platform wallet with correct amount
    const instructions = tx.transaction?.message?.instructions || [];
    let verified = false;
    let senderAddress = "";
    let transferAmount = 0;

    for (const ix of instructions) {
      // Check for parsed System Program transfer
      if (
        ix.program === "system" &&
        ix.parsed?.type === "transfer" &&
        ix.parsed?.info
      ) {
        const info = ix.parsed.info;
        if (
          info.destination === PLATFORM_WALLET &&
          info.lamports >= REQUIRED_LAMPORTS
        ) {
          verified = true;
          senderAddress = info.source;
          transferAmount = info.lamports;
          break;
        }
      }
    }

    // Also check inner instructions (in case of versioned tx)
    if (!verified && tx.meta?.innerInstructions) {
      for (const inner of tx.meta.innerInstructions) {
        for (const ix of inner.instructions || []) {
          if (
            ix.program === "system" &&
            ix.parsed?.type === "transfer" &&
            ix.parsed?.info?.destination === PLATFORM_WALLET &&
            ix.parsed?.info?.lamports >= REQUIRED_LAMPORTS
          ) {
            verified = true;
            senderAddress = ix.parsed.info.source;
            transferAmount = ix.parsed.info.lamports;
            break;
          }
        }
        if (verified) break;
      }
    }

    if (!verified) {
      return new Response(
        JSON.stringify({
          error: `Transaction does not contain a valid ${REQUIRED_LAMPORTS / 1e9} SOL transfer to the platform wallet`,
        }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 5. Verify the sender matches the claimed wallet
    if (senderAddress !== walletAddress) {
      return new Response(
        JSON.stringify({ error: "Transaction sender does not match the provided wallet address" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 6. Record the verified payment
    const { error: insertErr } = await admin.from("access_payments").insert({
      wallet_address: walletAddress,
      tx_signature: signature,
      sol_amount: transferAmount / 1e9,
      payment_type: "fee_free_pass",
    });

    if (insertErr) {
      // Unique constraint violation = already recorded (race condition)
      if (insertErr.code === "23505") {
        return new Response(
          JSON.stringify({ success: true, alreadyRecorded: true }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      throw insertErr;
    }

    console.log(`✅ Verified payment: ${walletAddress} → ${signature} (${transferAmount / 1e9} SOL)`);

    return new Response(
      JSON.stringify({ success: true, solAmount: transferAmount / 1e9 }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err: any) {
    console.error("verify-payment error:", err);
    return new Response(
      JSON.stringify({ error: err.message || "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
