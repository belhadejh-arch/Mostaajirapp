import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const { token, lessorId } = await req.json();
    if (!token || !lessorId) {
      return new Response(JSON.stringify({ error: 'Missing token or lessorId' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
      { auth: { persistSession: false, autoRefreshToken: false } }
    );

    // البحث عن الإيجار بالتوكين
    const { data: rental, error: rentalError } = await supabase
      .from('rentals')
      .select('*')
      .eq('return_token', token)
      .eq('owner_id', lessorId)
      .eq('status', 'active')
      .single();

    if (rentalError || !rental) {
      return new Response(JSON.stringify({ error: 'كود إعادة غير صالح أو العملية غير نشطة' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // إعادة الوديعة للمستأجر
    if (rental.deposit > 0) {
      const { data: renterProfile } = await supabase.from('profiles').select('wallet_balance').eq('id', rental.renter_id).single();
      if (renterProfile) {
        const newBalance = (renterProfile.wallet_balance || 0) + rental.deposit;
        await supabase.from('profiles').update({ wallet_balance: newBalance }).eq('id', rental.renter_id);
      }
    }

    // تحديث حالة الإيجار
    await supabase.from('rentals').update({
      status: 'completed',
      return_token: null, // إبطال التوكين بعد الاستخدام
      end_time: new Date().toISOString(),
    }).eq('id', rental.id);

    return new Response(JSON.stringify({ success: true, message: 'تمت إعادة الشيء المؤجر بنجاح وإغلاق المعاملة' }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
});
