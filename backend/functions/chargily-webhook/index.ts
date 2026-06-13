import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.0';

serve(async (req) => {
  try {
    const body = await req.json();
    const event = body.type;
    const checkout = body.data;

    if (event === 'checkout.paid' && checkout?.metadata?.user_id) {
      const userId = checkout.metadata.user_id;
      const amount = checkout.amount;

      const supabase = createClient(
        Deno.env.get('SUPABASE_URL')!,
        Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
        { auth: { persistSession: false, autoRefreshToken: false } }
      );

      // زيادة رصيد المحفظة
      const { data: profile } = await supabase.from('profiles').select('wallet_balance').eq('id', userId).single();
      const newBalance = (profile?.wallet_balance || 0) + amount;
      await supabase.from('profiles').update({ wallet_balance: newBalance }).eq('id', userId);

      // تسجيل المعاملة
      await supabase.from('top_up_transactions').insert({
        user_id: userId,
        amount,
        status: 'completed',
        provider: 'chargily',
        checkout_id: checkout.id,
      });
    }

    return new Response('ok', { status: 200 });
  } catch (_err) {
    return new Response('ok', { status: 200 });
  }
});
