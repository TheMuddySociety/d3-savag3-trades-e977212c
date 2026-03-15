import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.93.3";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { budget_id, wallet_address } = await req.json();

    if (!budget_id || !wallet_address) {
      return new Response(JSON.stringify({ error: 'Missing budget_id or wallet_address' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const platformPrivateKey = Deno.env.get('PLATFORM_WALLET_PRIVATE_KEY');
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Fetch budget
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
        const { Connection, PublicKey, Keypair, SystemProgram, Transaction } = await import("npm:@solana/web3.js@1.95.3");
        const bs58 = (await import("npm:bs58@5.0.0")).default;

        const connection = new Connection("https://api.mainnet-beta.solana.com");
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
        const { Connection, PublicKey, Keypair, Transaction } = await import("npm:@solana/web3.js@1.95.3");
        const { getAssociatedTokenAddress, createTransferInstruction, getAccount, createAssociatedTokenAccountInstruction } = await import("npm:@solana/spl-token@0.4.6");
        const bs58 = (await import("npm:bs58@5.0.0")).default;

        const USDC_MINT = new PublicKey("EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v");
        const connection = new Connection("https://api.mainnet-beta.solana.com");
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
