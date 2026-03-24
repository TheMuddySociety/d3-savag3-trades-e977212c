import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { Connection, PublicKey, Keypair, VersionedTransaction } from "https://esm.sh/@solana/web3.js@1.98.4";
import bs58 from "https://esm.sh/bs58@5.0.0";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

type TaskType = 'background_trade' | 'background_launch';
type TaskStatus = 'queued' | 'processing' | 'completed' | 'failed';

interface TaskRow {
  id: string;
  wallet_address: string;
  task_type: TaskType;
  status: TaskStatus;
  params: Record<string, any>;
  result: Record<string, any> | null;
  error: string | null;
  created_at: string;
  updated_at: string;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Auth check
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'No authorization header' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

    // Verify JWT to get wallet
    const userClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user }, error: authError } = await userClient.auth.getUser();
    if (authError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const serviceClient = createClient(supabaseUrl, supabaseServiceKey);

    // Fetch the trusted wallet_address for the authenticated user
    const { data: profile } = await serviceClient
      .from('profiles')
      .select('wallet_address')
      .eq('id', user.id)
      .single();
      
    const authWallet = profile?.wallet_address;

    const body = await req.json();
    const { action } = body;

    // ── Enforce Wallet Identity Constraint ────────────────────────
    if (['queue_trade', 'queue_launch', 'get_tasks'].includes(action)) {
      if (!authWallet) {
        return new Response(JSON.stringify({ error: 'Wallet profile strictly required for this action' }), {
          status: 403,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      
      if (body.wallet_address && body.wallet_address !== authWallet) {
        return new Response(JSON.stringify({ error: 'Unauthorized wallet manipulation detected' }), {
          status: 403,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      // Guarantee the payload uses the authenticated, trusted wallet
      body.wallet_address = authWallet;
    }

    switch (action) {
      // ── Queue a background trade ──────────────────────────────
      case 'queue_trade': {
        const { wallet_address, input_mint, output_mint, amount, slippage_bps } = body;
        if (!wallet_address || !input_mint || !output_mint || !amount) {
          return new Response(JSON.stringify({ error: 'Missing required trade params' }), {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }

        const { data, error } = await serviceClient
          .from('d3mon_task_queue')
          .insert({
            wallet_address,
            task_type: 'background_trade' as TaskType,
            status: 'queued' as TaskStatus,
            params: { input_mint, output_mint, amount, slippage_bps: slippage_bps || 300 },
          })
          .select()
          .single();

        if (error) throw error;
        return new Response(JSON.stringify({ success: true, task: data }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      // ── Queue a background token launch ───────────────────────
      case 'queue_launch': {
        const { wallet_address, token_name, token_symbol, description, signed_tx, image_url, curve_preset } = body;
        if (!wallet_address || !token_name || !token_symbol || !signed_tx) {
          return new Response(JSON.stringify({ error: 'Missing required launch params' }), {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }

        const { data, error } = await serviceClient
          .from('d3mon_task_queue')
          .insert({
            wallet_address,
            task_type: 'background_launch' as TaskType,
            status: 'queued' as TaskStatus,
            params: { token_name, token_symbol, description, signed_tx, image_url, curve_preset },
          })
          .select()
          .single();

        if (error) throw error;
        return new Response(JSON.stringify({ success: true, task: data }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      // ── Get pending/recent tasks for a wallet ─────────────────
      case 'get_tasks': {
        const { wallet_address, limit = 20 } = body;
        if (!wallet_address) {
          return new Response(JSON.stringify({ error: 'wallet_address required' }), {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }

        const { data, error } = await serviceClient
          .from('d3mon_task_queue')
          .select('*')
          .eq('wallet_address', wallet_address)
          .order('created_at', { ascending: false })
          .limit(limit);

        if (error) throw error;
        return new Response(JSON.stringify({ success: true, tasks: data || [] }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      // ── Process next queued task (called by cron / scheduler) ──
      case 'process_next': {
        // Pick the oldest queued task
        const { data: task, error: fetchError } = await serviceClient
          .from('d3mon_task_queue')
          .select('*')
          .eq('status', 'queued')
          .order('created_at', { ascending: true })
          .limit(1)
          .single();

        if (fetchError || !task) {
          return new Response(JSON.stringify({ success: true, processed: false, reason: 'no queued tasks' }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }

        // Mark as processing
        await serviceClient
          .from('d3mon_task_queue')
          .update({ status: 'processing', updated_at: new Date().toISOString() })
          .eq('id', task.id);

        try {
          let result: any = {};

          if (task.task_type === 'background_trade') {
            result = await executeBackgroundTrade(task.params, serviceClient);
          } else if (task.task_type === 'background_launch') {
            result = await executeBackgroundLaunch(task.params, supabaseUrl, supabaseServiceKey);
          }

          await serviceClient
            .from('d3mon_task_queue')
            .update({ status: 'completed', result, updated_at: new Date().toISOString() })
            .eq('id', task.id);

          return new Response(JSON.stringify({ success: true, processed: true, task_id: task.id, result }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        } catch (execError: unknown) {
          const errorMsg = execError instanceof Error ? execError.message : 'Unknown execution error';
          await serviceClient
            .from('d3mon_task_queue')
            .update({ status: 'failed', error: errorMsg, updated_at: new Date().toISOString() })
            .eq('id', task.id);

          return new Response(JSON.stringify({ success: false, task_id: task.id, error: errorMsg }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }
      }

      case 'ping':
        return new Response(JSON.stringify({ status: 'ok', ts: Date.now() }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });

      default:
        return new Response(JSON.stringify({ error: 'Invalid action' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
    }
  } catch (error: unknown) {
    console.error('D3MON Background error:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    return new Response(JSON.stringify({ success: false, error: message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});

// ─── Background Trade Execution ─────────────────────────────────────
async function executeBackgroundTrade(params: Record<string, any>, supabase: any) {
  const { wallet_address, input_mint, output_mint, amount, slippage_bps } = params;

  // 1. Check if user has a deposit budget
  const { data: budget } = await supabase
    .from('auto_trade_budgets')
    .select('*')
    .eq('wallet_address', wallet_address)
    .eq('currency', input_mint === 'So11111111111111111111111111111111111111112' ? 'SOL' : 'USDC')
    .eq('budget_mode', 'deposit')
    .eq('is_active', true)
    .single();

  const platformPrivateKey = Deno.env.get('PLATFORM_WALLET_PRIVATE_KEY');

  if (budget && budget.remaining_amount >= amount && platformPrivateKey) {
    // 🚀 AUTONOMOUS SIGNING MODE (Deposit Budget Available)
    console.log(`Executing autonomous trade for ${wallet_address} using platform wallet...`);
    
    try {
      const platformKeypair = Keypair.fromSecretKey(bs58.decode(platformPrivateKey));
      const rpcUrl = Deno.env.get('SOLANA_RPC_URL') || "https://api.mainnet-beta.solana.com";
      const connection = new Connection(rpcUrl);

      // Get Quote & Transaction from Jupiter
      const quoteRes = await fetch(
        `https://quote-api.jup.ag/v6/quote?inputMint=${input_mint}&outputMint=${output_mint}&amount=${Math.floor(amount * (input_mint.includes('So11') ? 1e9 : 1e6))}&slippageBps=${slippage_bps || 100}`
      );
      const quote = await quoteRes.json();
      
      const swapRes = await fetch('https://quote-api.jup.ag/v6/swap', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          quoteResponse: quote,
          userPublicKey: platformKeypair.publicKey.toString(),
          wrapAndUnwrapSol: true,
        }),
      });
      const { swapTransaction } = await swapRes.json();

      // Sign and Send
      const transactionBuf = Buffer.from(swapTransaction, 'base64');
      const transaction = VersionedTransaction.deserialize(transactionBuf);
      
      const { blockhash } = await connection.getLatestBlockhash();
      transaction.message.recentBlockhash = blockhash;
      transaction.sign([platformKeypair]);

      const signature = await connection.sendRawTransaction(transaction.serialize());
      await connection.confirmTransaction(signature);

      // Update budget
      await supabase
        .from('auto_trade_budgets')
        .update({
          spent_amount: (budget.spent_amount || 0) + amount,
          remaining_amount: budget.remaining_amount - amount,
          updated_at: new Date().toISOString()
        })
        .eq('id', budget.id);

      // Log trade
      await supabase.from('live_trades').insert({
        wallet_address,
        tx_signature: signature,
        input_mint,
        output_mint,
        input_amount: amount,
        output_amount: parseFloat(quote.outAmount) / (output_mint.includes('So11') ? 1e9 : 1e6),
        input_usd_value: 0, // Should fetch if needed
        output_usd_value: 0,
        status: 'success',
        trade_type: 'background_auto',
        bot_type: 'd3s_agent'
      });

      return {
        success: true,
        signature,
        mode: 'autonomous',
        note: 'Trade executed autonomously via platform wallet (Deposit Mode)'
      };
    } catch (err: any) {
      console.error('Autonomous trade failed:', err);
      throw new Error(`Autonomous execution failed: ${err.message}`);
    }
  }

  // 2. Fallback to Hybrid Mode (User signatures required)
  // Use Jupiter Ultra API (gasless) for the swap
  const orderResp = await fetch('https://ultra-api.jup.ag/v1/order', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      inputMint: input_mint,
      outputMint: output_mint,
      amount: Math.floor(amount * (input_mint.includes('So11') ? 1e9 : 1e6)), 
      taker: params.wallet_address,
      slippageBps: slippage_bps || 300,
    }),
  });

  if (!orderResp.ok) {
    const errText = await orderResp.text();
    throw new Error(`Jupiter order failed: ${orderResp.status} - ${errText}`);
  }

  const order = await orderResp.json();
  
  // Insert into pending_auto_trades for frontend pickup
  await supabase.from('pending_auto_trades').insert({
    wallet_address: params.wallet_address,
    token_mint: output_mint,
    token_symbol: 'Pending',
    side: 'buy',
    amount_raw: Math.floor(amount * (input_mint.includes('So11') ? 1e9 : 1e6)).toString(),
    decimals: input_mint.includes('So11') ? 9 : 6,
    strategy: 'd3s_agent',
    reason: 'Hybrid Mode Execution (Requires Signature)',
    status: 'pending'
  });

  return {
    order_id: order.requestId,
    input_mint,
    output_mint,
    amount,
    status: 'order_created',
    mode: 'hybrid',
    note: 'Deposit budget unavailable. Trade queued for manual signature in frontend.',
  };
}

// ─── Background Token Launch Execution ──────────────────────────────
async function executeBackgroundLaunch(params: Record<string, any>, supabaseUrl: string, serviceKey: string) {
  const { signed_tx, token_name, token_symbol } = params;

  // Submit the pre-signed transaction via Jupiter Studio
  const jupiterApiKey = Deno.env.get('JUPITER_API_KEY');
  if (!jupiterApiKey) throw new Error('JUPITER_API_KEY not configured');

  const submitResp = await fetch('https://api.jup.ag/studio/v1/dbc/pool/submit', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': jupiterApiKey,
    },
    body: JSON.stringify({ signedTransaction: signed_tx }),
  });

  if (!submitResp.ok) {
    const errBody = await submitResp.text();
    throw new Error(`Studio submit failed: ${submitResp.status} - ${errBody}`);
  }

  const result = await submitResp.json();
  return {
    token_name,
    token_symbol,
    signature: result.signature || result.txSignature,
    mint: result.mint,
    status: 'launched',
  };
}
