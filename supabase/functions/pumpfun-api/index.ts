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
    let endpoint = '/coins/king-of-the-hill';
    let params: Record<string, string | number> = {};

    try {
      const body = await req.json();
      if (body.endpoint) endpoint = body.endpoint;
      if (body.params) params = body.params;
    } catch {
      // Use defaults
    }

    const allowedEndpoints = [
      '/coins/latest',
      '/coins/king-of-the-hill',
      '/coins/currently-live',
      '/coins/for-you',
    ];

    const basePath = endpoint.split('?')[0];
    if (!allowedEndpoints.includes(basePath)) {
      return new Response(JSON.stringify({ error: 'Endpoint not allowed' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

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
        'Referer': 'https://pump.fun/',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      },
    });

    const responseText = await response.text();
    console.log(`[PumpFun API] Status: ${response.status}, Body length: ${responseText.length}`);

    if (!response.ok) {
      console.error(`[PumpFun API] Error response: ${responseText.substring(0, 500)}`);
      return new Response(JSON.stringify({ 
        error: `Pump.Fun API returned ${response.status}`,
        details: responseText.substring(0, 200),
      }), {
        status: response.status,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Try to parse as JSON
    let data;
    try {
      data = JSON.parse(responseText);
    } catch {
      console.error(`[PumpFun API] Non-JSON response: ${responseText.substring(0, 200)}`);
      return new Response(JSON.stringify({ error: 'Non-JSON response from Pump.Fun', raw: responseText.substring(0, 200) }), {
        status: 502,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

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
