import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.93.3";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
  'Content-Type': 'application/json',
};

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body = await req.json();
    const { action } = body;

    if (!action) {
      return new Response(JSON.stringify({ success: false, error: 'Missing action' }), { status: 400, headers: corsHeaders });
    }

    // Authenticate user
    const authHeader = req.headers.get('authorization') || '';
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY') || Deno.env.get('SUPABASE_PUBLISHABLE_KEY') || '';
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

    const userClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: { user }, error: authError } = await userClient.auth.getUser();

    // For cron-triggered actions, verify CRON_SECRET
    const isCron = action === 'cron_evaluate';
    if (isCron) {
      const cronSecret = Deno.env.get('CRON_SECRET');
      const token = authHeader.replace(/^Bearer\s+/i, '');
      if (!cronSecret || token !== cronSecret) {
        return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: corsHeaders });
      }
    } else if (!user) {
      return new Response(JSON.stringify({ success: false, error: 'Unauthorized' }), { status: 401, headers: corsHeaders });
    }

    const adminClient = createClient(supabaseUrl, serviceKey);

    // ═══ ACTIVATE Beach Mode ═══
    if (action === 'activate') {
      const { walletAddress, delegationTx, strategies, maxTradeSol, dailyCapSol } = body;
      if (!walletAddress) {
        return new Response(JSON.stringify({ success: false, error: 'walletAddress required' }), { status: 400, headers: corsHeaders });
      }

      // Upsert session
      const { data, error } = await adminClient
        .from('beach_mode_sessions')
        .upsert({
          wallet_address: walletAddress,
          is_active: true,
          delegation_tx: delegationTx || null,
          delegation_status: delegationTx ? 'confirmed' : 'pending',
          strategies: strategies || ['safe_exit', 'scalper', 'new_launch', 'momentum', 'dip_buy'],
          ai_autonomy_level: 'full',
          max_trade_sol: maxTradeSol || 0.5,
          daily_cap_sol: dailyCapSol || 5.0,
          daily_spent_sol: 0,
          daily_reset_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        }, { onConflict: 'wallet_address' })
        .select()
        .single();

      if (error) throw error;

      // Also ensure auto-trader bot config is active with beach mode
      await adminClient.from('sim_bot_configs').upsert({
        wallet_address: walletAddress,
        bot_type: 'auto',
        is_active: true,
        config: {
          beachMode: true,
          strategies: strategies || ['safe_exit', 'scalper', 'new_launch', 'momentum', 'dip_buy'],
          maxBudget: maxTradeSol || 0.5,
          safeExitStopLoss: 15,
          safeExitTakeProfit: 50,
          scalperTarget: 3,
          launchMinLiquidity: 100,
          launchMaxAge: 30,
        },
        updated_at: new Date().toISOString(),
      }, { onConflict: 'wallet_address,bot_type' });

      console.log(`Beach Mode ACTIVATED for ${walletAddress}`);
      return new Response(JSON.stringify({ success: true, session: data }), { headers: corsHeaders });
    }

    // ═══ DEACTIVATE Beach Mode ═══
    if (action === 'deactivate') {
      const { walletAddress } = body;
      if (!walletAddress) {
        return new Response(JSON.stringify({ success: false, error: 'walletAddress required' }), { status: 400, headers: corsHeaders });
      }

      await adminClient
        .from('beach_mode_sessions')
        .update({ is_active: false, updated_at: new Date().toISOString() })
        .eq('wallet_address', walletAddress);

      // Deactivate auto-trader config
      await adminClient
        .from('sim_bot_configs')
        .update({ is_active: false, updated_at: new Date().toISOString() })
        .eq('wallet_address', walletAddress)
        .eq('bot_type', 'auto');

      console.log(`Beach Mode DEACTIVATED for ${walletAddress}`);
      return new Response(JSON.stringify({ success: true }), { headers: corsHeaders });
    }

    // ═══ GET STATUS ═══
    if (action === 'status') {
      const { walletAddress } = body;
      if (!walletAddress) {
        return new Response(JSON.stringify({ success: false, error: 'walletAddress required' }), { status: 400, headers: corsHeaders });
      }

      const { data: session } = await adminClient
        .from('beach_mode_sessions')
        .select('*')
        .eq('wallet_address', walletAddress)
        .single();

      // Get recent trades
      const { data: recentTrades } = await adminClient
        .from('pending_auto_trades')
        .select('*')
        .eq('wallet_address', walletAddress)
        .order('created_at', { ascending: false })
        .limit(10);

      // Get budget info
      const { data: budget } = await adminClient
        .from('auto_trade_budgets')
        .select('*')
        .eq('wallet_address', walletAddress)
        .eq('is_active', true)
        .single();

      return new Response(JSON.stringify({
        success: true,
        session: session || null,
        recentTrades: recentTrades || [],
        budget: budget || null,
      }), { headers: corsHeaders });
    }

    // ═══ UPDATE STRATEGIES ═══
    if (action === 'update_strategies') {
      const { walletAddress, strategies, maxTradeSol, dailyCapSol } = body;
      if (!walletAddress) {
        return new Response(JSON.stringify({ success: false, error: 'walletAddress required' }), { status: 400, headers: corsHeaders });
      }

      const updates: Record<string, any> = { updated_at: new Date().toISOString() };
      if (strategies) updates.strategies = strategies;
      if (maxTradeSol !== undefined) updates.max_trade_sol = maxTradeSol;
      if (dailyCapSol !== undefined) updates.daily_cap_sol = dailyCapSol;

      await adminClient
        .from('beach_mode_sessions')
        .update(updates)
        .eq('wallet_address', walletAddress);

      // Sync to sim_bot_configs
      if (strategies) {
        const { data: config } = await adminClient
          .from('sim_bot_configs')
          .select('config')
          .eq('wallet_address', walletAddress)
          .eq('bot_type', 'auto')
          .single();

        if (config) {
          const newConfig = { ...(config.config as any), strategies, maxBudget: maxTradeSol };
          await adminClient
            .from('sim_bot_configs')
            .update({ config: newConfig, updated_at: new Date().toISOString() })
            .eq('wallet_address', walletAddress)
            .eq('bot_type', 'auto');
        }
      }

      return new Response(JSON.stringify({ success: true }), { headers: corsHeaders });
    }

    // ═══ AI EVALUATE (autonomous strategy selection) ═══
    if (action === 'ai_evaluate') {
      const { walletAddress } = body;
      if (!walletAddress) {
        return new Response(JSON.stringify({ success: false, error: 'walletAddress required' }), { status: 400, headers: corsHeaders });
      }

      // Simple heuristic AI evaluation — can be upgraded to LLM later
      const { data: session } = await adminClient
        .from('beach_mode_sessions')
        .select('*')
        .eq('wallet_address', walletAddress)
        .eq('is_active', true)
        .single();

      if (!session) {
        return new Response(JSON.stringify({ success: false, error: 'Beach Mode not active' }), { status: 400, headers: corsHeaders });
      }

      // Reset daily cap if needed
      const resetTime = new Date(session.daily_reset_at);
      const now = new Date();
      if (now.getTime() - resetTime.getTime() > 24 * 60 * 60 * 1000) {
        await adminClient
          .from('beach_mode_sessions')
          .update({ daily_spent_sol: 0, daily_reset_at: now.toISOString() })
          .eq('id', session.id);
      }

      const remainingDaily = session.daily_cap_sol - session.daily_spent_sol;
      const activeStrategies = session.strategies as string[];

      const evaluation = {
        walletAddress,
        activeStrategies,
        remainingDailyBudget: remainingDaily,
        maxPerTrade: Math.min(session.max_trade_sol, remainingDaily),
        recommendation: remainingDaily <= 0 
          ? 'HOLD — Daily cap reached' 
          : activeStrategies.length === 0 
            ? 'IDLE — No strategies enabled'
            : 'ACTIVE — Monitoring markets',
        timestamp: now.toISOString(),
      };

      await adminClient
        .from('beach_mode_sessions')
        .update({ last_evaluation_at: now.toISOString() })
        .eq('id', session.id);

      return new Response(JSON.stringify({ success: true, evaluation }), { headers: corsHeaders });
    }

    return new Response(JSON.stringify({ success: false, error: `Unknown action: ${action}` }), { status: 400, headers: corsHeaders });
  } catch (error: any) {
    console.error('[beach-mode] Error:', error);
    return new Response(
      JSON.stringify({ success: false, error: error.message || 'Internal error' }),
      { status: 500, headers: corsHeaders }
    );
  }
});
