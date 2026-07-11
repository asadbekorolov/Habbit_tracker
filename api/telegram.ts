import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = 'https://kiwrqzetpyobaemrsquq.supabase.co'
const SUPABASE_ANON_KEY = 'sb_publishable_-FM3LPMANMViaqDZ1IW2dw_vYOAJv1z'

function db() {
  return createClient(SUPABASE_URL, SUPABASE_ANON_KEY)
}

function getToken() {
  return process.env.TELEGRAM_BOT_TOKEN || '8608987932:AAG0xPQ-XhOUGoAoyUCdynatAEMCUJt58v0'
}

async function tg(method: string, body: object) {
  const token = getToken()
  const r = await fetch(`https://api.telegram.org/bot${token}/${method}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  return r.json()
}

async function sendMsg(chatId: number, text: string, extra?: object) {
  return tg('sendMessage', { chat_id: chatId, text, parse_mode: 'HTML', ...extra })
}

async function answerCbq(queryId: string, text: string) {
  return tg('answerCallbackQuery', { callback_query_id: queryId, text, show_alert: false })
}

async function showHabits(chatId: number) {
  const supabase = db()
  const { data } = await supabase.rpc('get_habits_for_telegram', { p_telegram_chat_id: chatId })

  if (!data?.ok) {
    return sendMsg(chatId, '❌ Avval ilovadan Telegram botni ulang.')
  }

  const habits: any[] = data.habits || []
  if (habits.length === 0) {
    return sendMsg(chatId, '📋 Hali ijobiy odat qo\'shilmagan.\n\nTraccer ilovasida odat qo\'shing.')
  }

  const done = habits.filter((h: any) => h.done).length
  const keyboard = habits.map((h: any) => [{
    text: `${h.done ? '✅' : '⬜'} ${h.emoji} ${h.name}`,
    callback_data: `d_${h.id}`,
  }])
  keyboard.push([{ text: '🔄 Yangilash', callback_data: 'refresh' }])

  return sendMsg(chatId, `📅 <b>Bugungi odatlar</b> — ${done}/${habits.length} bajarildi`, {
    reply_markup: { inline_keyboard: keyboard },
  })
}

export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') return res.status(405).end()
  if (!getToken()) return res.status(200).json({ ok: true, debug: 'no_token' })

  const body = req.body
  const supabase = db()

  // Text messages
  if (body.message) {
    const msg = body.message
    const chatId: number = msg.chat.id
    const text: string = msg.text || ''

    if (text.startsWith('/start')) {
      const userId = (text.split(' ')[1] || '').trim()
      if (userId) {
        const { data } = await supabase.rpc('link_telegram_account', {
          p_user_id: userId,
          p_telegram_chat_id: chatId,
        })
        if (!data?.ok) {
          await sendMsg(chatId, '❌ Foydalanuvchi topilmadi. Ilovadan qayta urinib ko\'ring.')
        } else {
          await sendMsg(chatId, `✅ <b>${data.display_name}</b>, Traccer bilan muvaffaqiyatli ulandi!\n\nBugungi odatlaringiz:`)
          await showHabits(chatId)
        }
      } else {
        await sendMsg(chatId, '👋 <b>Traccer Bot</b>ga xush kelibsiz!\n\nBog\'lanish uchun Traccer ilovasida Profil → "Telegram Bot" → <b>Ulash</b> tugmasini bosing.')
      }
    } else if (text === '/odatlar' || text.startsWith('/odatlar@')) {
      await showHabits(chatId)
    }

    return res.status(200).json({ ok: true })
  }

  // Inline button presses
  if (body.callback_query) {
    const query = body.callback_query
    const chatId: number = query.message.chat.id
    const data: string = query.data || ''

    if (data === 'refresh') {
      await answerCbq(query.id, '🔄 Yangilandi')
      await showHabits(chatId)
      return res.status(200).json({ ok: true })
    }

    if (data.startsWith('d_')) {
      const habitId = data.slice(2)

      const { data: result } = await supabase.rpc('complete_habit_via_telegram', {
        p_telegram_chat_id: chatId,
        p_habit_id: habitId,
      })

      if (!result?.ok) {
        await answerCbq(query.id, '❌ Xatolik yuz berdi')
        return res.status(200).json({ ok: true })
      }

      if (result.already_done) {
        await answerCbq(query.id, '✅ Bu odat allaqachon bajarilgan!')
      } else {
        await answerCbq(query.id, '🎉 Bajarildi! +1 ball +1 🪙')
        await tg('editMessageText', {
          chat_id: chatId,
          message_id: query.message.message_id,
          text: `✅ <b>${result.emoji || ''} ${result.name || ''}</b> — Bajarildi!\n\n+1 ball · +1 🪙`,
          parse_mode: 'HTML',
          reply_markup: { inline_keyboard: [[{ text: '📋 Barcha odatlar', callback_data: 'refresh' }]] },
        })
      }
    }

    return res.status(200).json({ ok: true })
  }

  res.status(200).json({ ok: true })
}
