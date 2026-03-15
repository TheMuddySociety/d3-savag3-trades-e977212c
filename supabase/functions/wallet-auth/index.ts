import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";
import nacl from "https://esm.sh/tweetnacl@1.0.3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

function base58Decode(str: string): Uint8Array {
  const ALPHABET = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";
  const bytes: number[] = [];
  for (const c of str) {
    let carry = ALPHABET.indexOf(c);
    if (carry < 0) throw new Error("Invalid base58 character");
    for (let j = 0; j < bytes.length; j++) {
      carry += bytes[j] * 58;
      bytes[j] = carry & 0xff;
      carry >>= 8;
    }
    while (carry > 0) {
      bytes.push(carry & 0xff);
      carry >>= 8;
    }
  }
  for (const c of str) {
    if (c !== "1") break;
    bytes.push(0);
  }
  return new Uint8Array(bytes.reverse());
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { wallet_address, message, signature } = await req.json();

    if (!wallet_address || !message || !signature) {
      return new Response(
        JSON.stringify({ error: "wallet_address, message, and signature required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Verify the message contains a recent timestamp (within 5 minutes)
    const nonceMatch = message.match(/Nonce:\s*(\d+)/);
    if (!nonceMatch) {
      return new Response(
        JSON.stringify({ error: "Invalid message format" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    const nonce = parseInt(nonceMatch[1]);
    const now = Date.now();
    if (Math.abs(now - nonce) > 5 * 60 * 1000) {
      return new Response(
        JSON.stringify({ error: "Nonce expired" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Verify ed25519 signature
    const publicKeyBytes = base58Decode(wallet_address);
    const signatureBytes = base58Decode(signature);
    const messageBytes = new TextEncoder().encode(message);

    const isValid = nacl.sign.detached.verify(messageBytes, signatureBytes, publicKeyBytes);
    if (!isValid) {
      return new Response(
        JSON.stringify({ error: "Invalid signature" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Create Supabase admin client
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const admin = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    // Deterministic email from wallet address
    const email = `${wallet_address}@wallet.savag3bot.app`;
    const password = `siws_${wallet_address}_${serviceRoleKey.slice(0, 16)}`;

    // Check if user exists
    const { data: existingProfile } = await admin
      .from("profiles")
      .select("id")
      .eq("wallet_address", wallet_address)
      .maybeSingle();

    let userId: string;

    if (existingProfile) {
      userId = existingProfile.id;
    } else {
      // Create new user
      const { data: newUser, error: createErr } = await admin.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: { wallet_address },
      });

      if (createErr) {
        // User might exist but profile doesn't — try to find by email
        const { data: { users }, error: listErr } = await admin.auth.admin.listUsers();
        const found = users?.find((u) => u.email === email);
        if (!found) throw createErr;
        userId = found.id;
      } else {
        userId = newUser.user.id;
      }

      // Create profile
      await admin.from("profiles").upsert({
        id: userId,
        wallet_address,
      });
    }

    // Sign in to get session tokens
    const { data: signInData, error: signInErr } = await admin.auth.admin.generateLink({
      type: "magiclink",
      email,
    });

    // Use signInWithPassword for a proper session
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const anonClient = createClient(supabaseUrl, anonKey);
    const { data: session, error: sessionErr } = await anonClient.auth.signInWithPassword({
      email,
      password,
    });

    if (sessionErr) throw sessionErr;

    return new Response(
      JSON.stringify({
        success: true,
        access_token: session.session?.access_token,
        refresh_token: session.session?.refresh_token,
        expires_in: session.session?.expires_in,
        user_id: userId,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err: any) {
    console.error("Wallet auth error:", err);
    return new Response(
      JSON.stringify({ error: err.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
