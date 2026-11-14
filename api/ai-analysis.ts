// Server-side proxy for the "AI Tahlil" feature (Analytics page).
//
// The Anthropic API key lives ONLY in the Vercel env var ANTHROPIC_API_KEY —
// it must never be shipped inside the web bundle or the Android/iOS app.
// Callers must send their Supabase session token so that only signed-in
// users can spend API credits through this endpoint.

import Anthropic from '@anthropic-ai/sdk'
import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = 'https://kiwrqzetpyobaemrsquq.supabase.co'
const SUPABASE_ANON_KEY = 'sb_publishable_-FM3LPMANMViaqDZ1IW2dw_vYOAJv1z'

const MAX_PAYLOAD_CHARS = 20000

// Web build (same origin) needs no CORS; these are the Capacitor WebView
// origins (Android: https://localhost, iOS: capacitor://localhost).
const ALLOWED_ORIGINS = new Set([
  'https://localhost',
  'http://localhost',
  'capacitor://localhost',
])

const SYSTEM_PROMPT = `Siz xatti-harakatlar psixologiyasi va yuqori unumdorlik (High-Performance Habit Coaching) bo'yicha yetakchi AI tahlilchisiz.
Sizga foydalanuvchining barcha odatlari va ko'rsatkichlari telemetriyasi taqdim etiladi.
Sizning vazifangiz shunchaki umumiy gaplar aytish emas, balki ANIQ RAQAMLAR, STATISTIK BOG'LIQLIKLAR va KELAJAK UCHUN AMALIY MASLAHATLAR bilan boyitilgan chuqur hisobot tuzish.

Tahlil tuzilmasi:
1. 📊 Aniq Raqamlar va Tendensiyalar (qaysi odatlar kuchli, qaysilari zaif, raqamlar bilan solishtirish).
2. ⚡ Uyqu va Salomatlikning Intizomga Ta'siri (uyqu soati va qadamlarning odatlarni bajarishga bog'liqligi).
3. 🎯 Kelgusi 7-14 Kunlik Strategik Reja (zaif odatlarni, masalan: ertalab yugurish yoki turnikni tiklash uchun qat'iy vaqt va trigger taklif qilish).

Faqat telemetriyada haqiqatan bor raqam va odatlarga tayaning — ma'lumotda yo'q raqam yoki odatni o'ylab topmang.
Javobni o'zbek tilida, professional, chuqur tahliliy va kuchli motivatsion ruhda yozing.`

function setCors(req: any, res: any) {
  const origin = req.headers?.origin
  if (origin && ALLOWED_ORIGINS.has(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin)
    res.setHeader('Vary', 'Origin')
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization')
    res.setHeader('Access-Control-Max-Age', '86400')
  }
}

export default async function handler(req: any, res: any) {
  setCors(req, res)
  if (req.method === 'OPTIONS') return res.status(204).end()
  if (req.method !== 'POST') return res.status(405).end()

  if (!process.env.ANTHROPIC_API_KEY) {
    return res.status(503).json({ ok: false, error: 'not_configured' })
  }

  // Only signed-in users may use the endpoint.
  const auth: string = req.headers?.authorization || ''
  const token = auth.startsWith('Bearer ') ? auth.slice(7) : ''
  if (!token) return res.status(401).json({ ok: false, error: 'unauthorized' })

  const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY)
  const { data: userData, error: userError } = await supabase.auth.getUser(token)
  if (userError || !userData?.user) {
    return res.status(401).json({ ok: false, error: 'unauthorized' })
  }

  const payload = req.body?.payload
  if (typeof payload !== 'string' || !payload.trim()) {
    return res.status(400).json({ ok: false, error: 'missing_payload' })
  }
  if (payload.length > MAX_PAYLOAD_CHARS) {
    return res.status(413).json({ ok: false, error: 'payload_too_large' })
  }

  // Tanga yechish faqat serverda (spend_coins_for_ai — faqat service_role'ga ochiq).
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!serviceKey) {
    return res.status(503).json({ ok: false, error: 'not_configured' })
  }
  const admin = createClient(SUPABASE_URL, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
  const userId = userData.user.id

  const { error: chargeError } = await admin.rpc('spend_coins_for_ai', { p_user_id: userId })
  if (chargeError) {
    if ((chargeError.message || '').includes('insufficient_coins')) {
      return res.status(402).json({ ok: false, error: 'insufficient_coins' })
    }
    console.error('AI charge failed', chargeError.message)
    return res.status(500).json({ ok: false, error: 'charge_failed' })
  }

  // AI natija bermasa, tangalar qaytariladi.
  const refund = async () => {
    const { error } = await admin.rpc('refund_coins_for_ai', { p_user_id: userId })
    if (error) console.error('AI refund failed', userId, error.message)
  }

  const client = new Anthropic() // reads ANTHROPIC_API_KEY

  try {
    const response = await client.beta.messages.create({
      model: 'claude-opus-5-5',
      max_tokens: 16000,
      output_config: { effort: 'medium' },
      // If the model declines, the API retries on a fallback model in the same call.
      betas: ['server-side-fallback-2026-07-01'],
      fallbacks: 'default',
      system: SYSTEM_PROMPT,
      messages: [{ role: 'user', content: payload }],
    })

    if (response.stop_reason === 'refusal') {
      await refund()
      return res.status(200).json({ ok: false, error: 'refused' })
    }

    // Thinking blocks come first on this model — collect only the text blocks.
    const text = response.content
      .filter((b): b is Anthropic.Beta.BetaTextBlock => b.type === 'text')
      .map((b) => b.text)
      .join('\n')
      .trim()

    if (!text) {
      await refund()
      return res.status(200).json({ ok: false, error: 'empty_response' })
    }
    return res.status(200).json({ ok: true, text })
  } catch (e: any) {
    await refund()
    if (e instanceof Anthropic.RateLimitError) {
      return res.status(429).json({ ok: false, error: 'rate_limited' })
    }
    if (e instanceof Anthropic.APIError) {
      console.error('Anthropic API error', e.status, e.message)
      return res.status(502).json({ ok: false, error: 'ai_error' })
    }
    console.error('AI analysis failed', e)
    return res.status(500).json({ ok: false, error: 'network_error' })
  }
}
