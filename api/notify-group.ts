import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = 'https://kiwrqzetpyobaemrsquq.supabase.co'
const SUPABASE_ANON_KEY = 'sb_publishable_-FM3LPMANMViaqDZ1IW2dw_vYOAJv1z'

export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') return res.status(405).end()

  const { completer_name, habit_emoji, habit_name, group_id, completer_id } = req.body
  if (!group_id || !completer_id) return res.status(200).json({ ok: false })

  const token = process.env.TELEGRAM_BOT_TOKEN || ''
  if (!token) return res.status(200).json({ ok: false })

  const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY)

  const { data: recipients } = await supabase.rpc('get_group_telegram_recipients', {
    p_group_id: group_id,
    p_exclude_user_id: completer_id,
  })

  if (!recipients || recipients.length === 0) {
    return res.status(200).json({ ok: true, sent: 0 })
  }

  const text = `🎯 <b>${completer_name}</b>\n${habit_emoji} <b>${habit_name}</b> ni bajardi!`

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
