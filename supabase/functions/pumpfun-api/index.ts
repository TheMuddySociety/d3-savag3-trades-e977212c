import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const PUMP_API_BASE = 'https://frontend-api-v3.pump.fun';

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { endpoint, params } = await req.json();

    // Supported endpoints
    const allowedEndpoints = [
      '/coins/latest',
      '/coins/king-of-the-hill',
      '/coins/currently-live',
      '/coins/for-you',
    ];

    const basePath = endpoint?.split('?')[0];
    if (!allowedEndpoints.includes(basePath)) {
      return new Response(JSON.stringify({ error: 'Endpoint not allowed' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Build query string from params
    const queryParams = new URLSearchParams();
    if (params) {
      for (const [key, value] of Object.entries(params)) {
        if (value !== undefined && value !== null) {
          queryParams.set(key, String(value));
        }
      }
    }

    const queryString = queryParams.toString();
    const url = `${PUMP_API_BASE}${endpoint}${queryString ? '?' + queryString : ''}`;

    console.log(`[PumpFun API] Fetching: ${url}`);

    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
        'Origin': 'https://pump.fun',
        'User-Agent': 'Mozilla/5.0',
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`[PumpFun API] Error ${response.status}: ${errorText}`);
      return new Response(JSON.stringify({ error: `Pump.Fun API error: ${response.status}`, details: errorText }), {
        status: response.status,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const data = await response.json();

    return new Response(JSON.stringify(data), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('[PumpFun API] Error:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
