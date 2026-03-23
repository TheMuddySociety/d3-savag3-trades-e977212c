import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.93.3";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Authorization header is required' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { budget_id } = await req.json();

    if (!budget_id) {
      return new Response(JSON.stringify({ error: 'Missing budget_id' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabaseUrl = (globalThis as any).Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = (globalThis as any).Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const anonKey = (globalThis as any).Deno.env.get('SUPABASE_ANON_KEY')!;
    const platformPrivateKey = (globalThis as any).Deno.env.get('PLATFORM_WALLET_PRIVATE_KEY');
    
    // Create a user client to verify the JWT
    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } }
    });
    const { data: { user }, error: authError } = await userClient.auth.getUser();

    if (authError || !user) {
      return new Response(JSON.stringify({ error: 'Invalid or expired token' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabase = createClient(supabaseUrl, supabaseKey);

    // Get the trusted wallet address from profiles
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('wallet_address')
      .eq('id', user.id)
      .single();

    if (profileError || !profile) {
      return new Response(JSON.stringify({ error: 'User profile not found' }), {
        status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const wallet_address = profile.wallet_address;

    // Fetch budget and verify ownership
    const { data: budget, error: budgetError } = await supabase
      .from('auto_trade_budgets')
      .select('*')
      .eq('id', budget_id)
      .eq('wallet_address', wallet_address)
      .eq('is_active', true)
      .single();

    if (budgetError || !budget) {
      return new Response(JSON.stringify({ error: 'Budget not found or inactive' }), {
        status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (budget.budget_mode !== 'deposit') {
      return new Response(JSON.stringify({ error: 'Only deposit-mode budgets can be withdrawn' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const withdrawAmount = budget.remaining_amount || 0;
    if (withdrawAmount <= 0) {
      return new Response(JSON.stringify({ error: 'No remaining balance to withdraw' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    let txSignature = null;

    if (budget.currency === 'SOL' && platformPrivateKey) {
      try {
        // Dynamic imports for Solana
        const { Connection, PublicKey, Keypair, SystemProgram, Transaction } = await import("https://esm.sh/@solana/web3.js@1.98.4");
        const bs58 = (await import("https://esm.sh/bs58@5.0.0")).default;

        const projectId = (globalThis as any).Deno.env.get('VITE_REOWN_PROJECT_ID');
        const rpcUrl = projectId 
          ? `https://rpc.walletconnect.org/v1/?chainId=solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp&projectId=${projectId}`
          : "https://api.mainnet-beta.solana.com";
        const connection = new Connection(rpcUrl);
        const platformKeypair = Keypair.fromSecretKey(bs58.decode(platformPrivateKey));
        const recipientPubkey = new PublicKey(wallet_address);

        const lamports = Math.floor(withdrawAmount * 1e9);

        // Check platform wallet balance
        const balance = await connection.getBalance(platformKeypair.publicKey);
        const requiredLamports = lamports + 5000; // + fee
        if (balance < requiredLamports) {
          return new Response(JSON.stringify({ error: 'Platform wallet has insufficient SOL balance. Contact support.' }), {
            status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }

        const transaction = new Transaction().add(
          SystemProgram.transfer({
            fromPubkey: platformKeypair.publicKey,
            toPubkey: recipientPubkey,
            lamports,
          })
        );

        transaction.feePayer = platformKeypair.publicKey;
        const { blockhash } = await connection.getLatestBlockhash();
        transaction.recentBlockhash = blockhash;

        transaction.sign(platformKeypair);
        txSignature = await connection.sendRawTransaction(transaction.serialize());
        await connection.confirmTransaction(txSignature);
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : 'Unknown transfer error';
        console.error('SOL withdraw error:', msg);
        return new Response(JSON.stringify({ error: `Transfer failed: ${msg}` }), {
          status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
    } else if (budget.currency === 'USDC' && platformPrivateKey) {
      // USDC SPL token transfer
      try {
        const { Connection, PublicKey, Keypair, Transaction } = await import("https://esm.sh/@solana/web3.js@1.95.3");
        const { getAssociatedTokenAddress, createTransferInstruction, getAccount, createAssociatedTokenAccountInstruction } = await import("https://esm.sh/@solana/spl-token@0.4.6");
        const bs58 = (await import("https://esm.sh/bs58@5.0.0")).default;

        const projectId = Deno.env.get('VITE_REOWN_PROJECT_ID');
        const rpcUrl = projectId 
          ? `https://rpc.walletconnect.org/v1/?chainId=solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp&projectId=${projectId}`
          : "https://api.mainnet-beta.solana.com";
        const USDC_MINT = new PublicKey("EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v");
        const connection = new Connection(rpcUrl);
        const platformKeypair = Keypair.fromSecretKey(bs58.decode(platformPrivateKey));
        const recipientPubkey = new PublicKey(wallet_address);

        const platformAta = await getAssociatedTokenAddress(USDC_MINT, platformKeypair.publicKey);
        const recipientAta = await getAssociatedTokenAddress(USDC_MINT, recipientPubkey);

        // USDC has 6 decimals
        const amount = Math.floor(withdrawAmount * 1e6);

        // Check platform USDC balance
        const platformAccount = await getAccount(connection, platformAta);
        if (Number(platformAccount.amount) < amount) {
          return new Response(JSON.stringify({ error: 'Platform wallet has insufficient USDC balance. Contact support.' }), {
            status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }

        const transaction = new Transaction();

        // Create recipient ATA if needed
        try {
          await getAccount(connection, recipientAta);
        } catch {
          transaction.add(
            createAssociatedTokenAccountInstruction(
              platformKeypair.publicKey,
              recipientAta,
              recipientPubkey,
              USDC_MINT,
            )
          );
        }

        transaction.add(
          createTransferInstruction(platformAta, recipientAta, platformKeypair.publicKey, amount)
        );

        transaction.feePayer = platformKeypair.publicKey;
        const { blockhash } = await connection.getLatestBlockhash();
        transaction.recentBlockhash = blockhash;

        transaction.sign(platformKeypair);
        txSignature = await connection.sendRawTransaction(transaction.serialize());
        await connection.confirmTransaction(txSignature);
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : 'Unknown transfer error';
        console.error('USDC withdraw error:', msg);
        return new Response(JSON.stringify({ error: `USDC transfer failed: ${msg}` }), {
          status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
    } else {
      return new Response(JSON.stringify({ error: 'Platform wallet key not configured' }), {
        status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Mark budget as inactive and zero out remaining
    await supabase
      .from('auto_trade_budgets')
      .update({
        is_active: false,
        remaining_amount: 0,
        updated_at: new Date().toISOString(),
      })
      .eq('id', budget_id);

    // Record withdrawal in history
    await supabase.from('withdrawals').insert({
      wallet_address,
      amount: withdrawAmount,
      currency: budget.currency,
      tx_signature: txSignature,
      budget_id,
    });

    return new Response(JSON.stringify({
      success: true,
      tx_signature: txSignature,
      amount: withdrawAmount,
      currency: budget.currency,
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('withdraw error:', message);
    return new Response(JSON.stringify({ error: message }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
