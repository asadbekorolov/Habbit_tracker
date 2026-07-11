import { serve } from 'std/server'
import { createClient } from 'supabase-js'
import webpush from 'web-push'

// Kiruvchi bildirishnoma yozuvi uchun interfeys
interface NotificationRecord {
  id: string;
  user_id: string;
  title: string;
  body: string;
  link?: string;
}

// Bazadagi push obunasi uchun interfeys
interface PushSubscription {
  id: string;
  endpoint: string;
  p256dh: string;
  auth: string;
}

serve(async (req) => {
  if (req.method !== 'POST') {
    return new Response('Method Not Allowed', { status: 405 })
  }

  try {
    // To'liq huquqli Supabase Admin klientini ishga tushirish
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // VAPID kalitlarini sirlardan (secrets) o'qib olish
    webpush.setVapidDetails(
      Deno.env.get('VAPID_SUBJECT')!, // masalan: 'mailto:sizning_email@example.com'
      Deno.env.get('VAPID_PUBLIC_KEY')!,
      Deno.env.get('VAPID_PRIVATE_KEY')!
    );

    // Webhook'dan kelgan ma'lumotni o'qish
    const payload = await req.json();
    const record = payload.record as NotificationRecord;

    // Maqsadli foydalanuvchining barcha push obunalarini olish
    const { data: subscriptions, error: subsError } = await supabaseAdmin
      .from('push_subscriptions')
      .select('id, endpoint, p256dh, auth')
      .eq('user_id', record.user_id);

    if (subsError) throw new Error(`Obunalarni olishda xatolik: ${subsError.message}`);

    if (!subscriptions || subscriptions.length === 0) {
      return new Response('Obunalar topilmadi', { status: 200 });
    }

    // Yuboriladigan bildirishnoma matnini tayyorlash
    const notificationPayload = JSON.stringify({
      title: record.title,
      body: record.body,
      url: record.link || '/', // Agar link bo'lmasa, asosiy sahifaga o'tish
    });

    // Barcha obunalarga bildirishnomalarni yuborish
    const sendPromises = subscriptions.map(async (sub: PushSubscription) => {
      const pushSubscription = { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } };
      try {
        await webpush.sendNotification(pushSubscription, notificationPayload);
      } catch (err) {
        // Agar obuna eskirgan bo'lsa (410), uni bazadan o'chirish
        if (err.statusCode === 410) {
          await supabaseAdmin.from('push_subscriptions').delete().eq('id', sub.id);
        }
      }
    });

    await Promise.all(sendPromises);

    return new Response(JSON.stringify({ success: true }), { headers: { 'Content-Type': 'application/json' }, status: 200 });

  } catch (error) {
    console.error('send-push-notification funksiyasida xatolik:', error.message);
    return new Response(JSON.stringify({ error: error.message }), { headers: { 'Content-Type': 'application/json' }, status: 500 });
  }
})