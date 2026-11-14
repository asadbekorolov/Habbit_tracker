import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = 'https://kiwrqzetpyobaemrsquq.supabase.co'
const SUPABASE_ANON_KEY = 'sb_publishable_-FM3LPMANMViaqDZ1IW2dw_vYOAJv1z'

// Capacitor WebView origins (the web build calls same-origin, no CORS needed).
const ALLOWED_ORIGINS = new Set(['https://localhost', 'http://localhost', 'capacitor://localhost'])

function setCors(req: any, res: any) {
  const origin = req.headers?.origin
  if (origin && ALLOWED_ORIGINS.has(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin)
    res.setHeader('Vary', 'Origin')
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization')
  }
}

function escapeHtml(s: unknown): string {
  return String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

export default async function handler(req: any, res: any) {
  setCors(req, res)
  if (req.method === 'OPTIONS') return res.status(204).end()
  if (req.method !== 'POST') return res.status(405).end()

  const { completer_name, habit_emoji, habit_name, group_id, completer_id } = req.body || {}
  if (!group_id || !completer_id) return res.status(400).json({ ok: false })

  const token = process.env.TELEGRAM_BOT_TOKEN || ''
  if (!token) return res.status(200).json({ ok: false })

  // Only a signed-in member of this group may trigger notifications to it.
  const auth: string = req.headers?.authorization || ''
  const jwt = auth.startsWith('Bearer ') ? auth.slice(7) : ''
  if (!jwt) return res.status(401).json({ ok: false })

  const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY)
  const { data: userData, error: userError } = await supabase.auth.getUser(jwt)
  if (userError || !userData?.user) return res.status(401).json({ ok: false })

  const asUser = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    global: { headers: { Authorization: `Bearer ${jwt}` } },
  })
  const { data: membership } = await asUser
    .from('group_members')
    .select('user_id')
    .eq('group_id', group_id)
    .in('user_id', [userData.user.id, completer_id])
  const memberIds = new Set((membership || []).map((m: any) => m.user_id))
  if (!memberIds.has(userData.user.id) || !memberIds.has(completer_id)) {
    return res.status(403).json({ ok: false })
  }

  // get_group_telegram_recipients 047 dan beri faqat service_role'ga ochiq
  // (chat ID'lar shaxsiy ma'lumot).
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!serviceKey) return res.status(200).json({ ok: false })
  const admin = createClient(SUPABASE_URL, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
  const { data: recipients } = await admin.rpc('get_group_telegram_recipients', {
    p_group_id: group_id,
    p_exclude_user_id: completer_id,
  })

  if (!recipients || recipients.length === 0) {
    return res.status(200).json({ ok: true, sent: 0 })
  }

  const text = `🎯 <b>${escapeHtml(completer_name)}</b>\n${escapeHtml(habit_emoji)} <b>${escapeHtml(habit_name)}</b> ni bajardi!`

  await Promise.allSettled(
    recipients.map((chatId: number) =>
      fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: chatId,
          text,
          parse_mode: 'HTML',
          reply_markup: {
            inline_keyboard: [[{ text: '📋 Odatlarimni ko\'rish', callback_data: 'refresh' }]],
          },
        }),
      }).catch(() => null)
    )
  )

  return res.status(200).json({ ok: true, sent: recipients.length })
}
