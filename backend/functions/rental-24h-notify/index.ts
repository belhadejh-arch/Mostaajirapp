import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
      { auth: { persistSession: false, autoRefreshToken: false } }
    );

    // إيجاد الإيجارات النشطة التي تبقى 24 ساعة أو أقل ولم يُرسل إليها إشعار بعد
    const { data: rentals, error } = await supabase
      .from('rentals')
      .select('id, renter_id, product_title, start_time, duration_days, alert_48h_sent')
      .eq('status', 'active')
      .eq('alert_48h_sent', false);

    if (error || !rentals || rentals.length === 0) {
      return new Response(JSON.stringify({ message: 'No rentals need notification' }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const now = Date.now();
    const notifications = [];

    for (const rental of rentals) {
      if (!rental.start_time || !rental.duration_days) continue;
      const endTime = new Date(rental.start_time).getTime() + rental.duration_days * 24 * 3600000;
      const diff = endTime - now;
      // إرسال إشعار عند تبقي 24 ساعة أو أقل (ولكن أكبر من 0)
      if (diff > 0 && diff <= 24 * 3600000) {
        notifications.push({
          user_id: rental.renter_id,
          title: 'تذكير: انتهاء فترة الإيجار قريباً',
          body: `إيجار "${rental.product_title}" ينتهي خلال ${Math.ceil(diff / 3600000)} ساعة. الرجاء التواصل مع المؤجر لترتيب الإعادة.`,
          type: 'reminder',
          read: false,
        });
        // تحديث حالة الإشعار
        await supabase.from('rentals').update({ alert_48h_sent: true }).eq('id', rental.id);
      }
    }

    if (notifications.length > 0) {
      await supabase.from('notifications').insert(notifications);
    }

    return new Response(JSON.stringify({ sent: notifications.length }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
});
