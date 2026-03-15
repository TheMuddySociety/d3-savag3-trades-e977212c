import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    if (!LOVABLE_API_KEY) {
      return new Response(JSON.stringify({ error: 'AI not configured' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { token, investment, days } = await req.json();
    if (!token) {
      return new Response(JSON.stringify({ error: 'token is required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-3-flash-preview',
        messages: [
          {
            role: 'system',
            content: `You are a crypto trading analyst. Analyze the given token metrics and provide a realistic profit/loss prediction. You MUST respond using the provided tool.`,
          },
          {
            role: 'user',
            content: `Analyze this Solana memecoin for a $${investment} investment over ${days} days:
- Symbol: ${token.symbol}
- Name: ${token.name}
- Current Price: $${token.price}
- 24h Change: ${token.change24h}%
- Market Cap: $${token.marketCap}
- 24h Volume: $${token.volume24h}
- Liquidity: $${token.liquidity}

Provide a realistic prediction considering volatility, liquidity depth, and market conditions.`,
          },
        ],
        tools: [
          {
            type: 'function',
            function: {
              name: 'profit_prediction',
              description: 'Return a structured profit prediction for the token investment.',
              parameters: {
                type: 'object',
                properties: {
                  predictedProfit: { type: 'number', description: 'Predicted profit/loss in USD (can be negative)' },
                  confidenceScore: { type: 'number', description: 'Confidence from 0.0 to 1.0' },
                  riskLevel: { type: 'string', enum: ['Low', 'Medium', 'High'] },
                  tradingSignals: {
                    type: 'array',
                    items: { type: 'string' },
                    description: '2-4 specific trading signals observed',
                  },
                  reasoning: { type: 'string', description: 'Brief explanation of the prediction' },
                },
                required: ['predictedProfit', 'confidenceScore', 'riskLevel', 'tradingSignals', 'reasoning'],
                additionalProperties: false,
              },
            },
          },
        ],
        tool_choice: { type: 'function', function: { name: 'profit_prediction' } },
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: 'Rate limit exceeded, please try again later.' }), {
          status: 429,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: 'AI credits exhausted.' }), {
          status: 402,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      const text = await response.text();
      console.error('AI gateway error:', response.status, text);
      return new Response(JSON.stringify({ error: 'AI analysis failed' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const result = await response.json();
    const toolCall = result.choices?.[0]?.message?.tool_calls?.[0];
    if (!toolCall) {
      return new Response(JSON.stringify({ error: 'AI did not return structured data' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const prediction = JSON.parse(toolCall.function.arguments);

    return new Response(JSON.stringify({ success: true, data: prediction }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (e) {
    console.error('ai-profit-analysis error:', e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : 'Unknown error' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
