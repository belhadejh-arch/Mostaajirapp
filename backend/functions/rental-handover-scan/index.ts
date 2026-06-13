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
      .select('*, profiles!rentals_owner_id_fkey(wallet_balance), profiles_renter:profiles!rentals_renter_id_fkey(wallet_balance)')
      .eq('handover_token', token)
      .eq('owner_id', lessorId)
      .eq('status', 'accepted')
      .single();

    if (rentalError || !rental) {
      return new Response(JSON.stringify({ error: 'كود QR غير صالح أو العملية مكتملة مسبقاً' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // تحويل الرصيد
    const { data: lessorProfile } = await supabase.from('profiles').select('wallet_balance, earnings_balance').eq('id', rental.owner_id).single();
    const { data: renterProfile } = await supabase.from('profiles').select('wallet_balance').eq('id', rental.renter_id).single();

    if (!lessorProfile || !renterProfile) {
      return new Response(JSON.stringify({ error: 'User profiles not found' }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // خصم من المستأجر (الإيجار + العمولة)
    const totalDeduction = rental.total_amount;
    const newRenterBalance = (renterProfile.wallet_balance || 0) - totalDeduction;
    if (newRenterBalance < 0) {
      return new Response(JSON.stringify({ error: 'رصيد المستأجر غير كافٍ' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // إضافة صافي المبلغ للمؤجر
    const newLessorEarnings = (lessorProfile.earnings_balance || 0) + rental.net_earnings;
    const newLessorWallet = (lessorProfile.wallet_balance || 0) + rental.net_earnings;

    // تحديث المستخدمين
    await supabase.from('profiles').update({ wallet_balance: newRenterBalance }).eq('id', rental.renter_id);
    await supabase.from('profiles').update({ earnings_balance: newLessorEarnings, wallet_balance: newLessorWallet }).eq('id', rental.owner_id);

    // تحديث حالة الإيجار
    await supabase.from('rentals').update({
      status: 'active',
      start_time: new Date().toISOString(),
      handover_token: null, // إبطال التوكين بعد الاستخدام
    }).eq('id', rental.id);

    return new Response(JSON.stringify({ success: true, message: 'تم مسح الكود بنجاح! انتقل الرصيد للمؤجر وبدأ الإيجار' }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
});
