import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { amount, userId, userEmail, returnUrl, cancelUrl } = await req.json();
    if (!amount || amount < 100) {
      return new Response(JSON.stringify({ error: 'Invalid amount' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const secretKey = Deno.env.get('CHARGILY_SECRET_KEY');
    if (!secretKey) {
      return new Response(JSON.stringify({ error: 'Payment gateway not configured' }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    if (!supabaseUrl) {
      return new Response(JSON.stringify({ error: 'SUPABASE_URL not configured' }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }
    const webhookUrl = `${supabaseUrl}/functions/v1/chargily-webhook`;
    const appDomain = Deno.env.get('APP_DOMAIN') || returnUrl?.split('/wallet')[0] || '';

    const response = await fetch('https://pay.chargily.net/api/v2/checkouts', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${secretKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        amount: Number(amount),
        currency: 'dzd',
        customer_email: userEmail,
        metadata: { user_id: userId },
        success_url: returnUrl || `${appDomain}/wallet?status=success`,
        failure_url: cancelUrl || `${appDomain}/wallet?status=cancel`,
        webhook_endpoint: webhookUrl,
      }),
    });

    const data = await response.json();
    if (!response.ok) {
      return new Response(JSON.stringify({ error: data.message || 'Payment failed' }), { status: response.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    return new Response(JSON.stringify({ checkoutUrl: data.checkout_url, checkoutId: data.id }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
});
