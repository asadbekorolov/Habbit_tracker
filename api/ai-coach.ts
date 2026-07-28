// Client aggregates the user's stats into a compact JSON summary
// (see buildCoachSummary in Analytics.tsx) and posts it here. This
// function never touches the DB directly — it's a thin, stateless
// proxy to the Claude API so the ANTHROPIC_API_KEY never reaches the
// client. The client stores the returned note itself (ai_coach_notes)
// via the normal authenticated Supabase session.

const SYSTEM_PROMPT = `You are the "AI Coach" inside Traccer, a habit-tracking app. You receive a JSON summary of one user's last ~30 days of habit, sleep, screen-time and journal data. Write a short, warm, direct coaching note.

Rules:
- 3-5 sentences, plain prose (no markdown headers, no bullet lists longer than 3 items).
- Reference only patterns that are actually present in the JSON — never invent a specific day, number, or habit name that isn't in the data.
- If a clear correlation exists (e.g. a weekday with worse screen time or more broken negative habits, a habit with a strong or weak streak), name it specifically and suggest one concrete action.
- If the data is too thin for a real pattern, give general encouragement plus one concrete next step instead of a fabricated insight.
- Write in the language given by "lang" (uz = Uzbek, ru = Russian, en = English). Default to Uzbek if unclear.
- No greetings ("Salom" etc.), no sign-off — just the note itself.`;

export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') return res.status(405).end();

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return res.status(200).json({ ok: false, error: 'not_configured' });

  const { summary, lang } = req.body || {};
  if (!summary) return res.status(400).json({ ok: false, error: 'missing_summary' });

  try {
    const r = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 400,
        system: SYSTEM_PROMPT,
        messages: [{ role: 'user', content: JSON.stringify({ lang: lang || 'uz', ...summary }) }],
      }),
    });

    const data = await r.json();
    if (!r.ok) {
      return res.status(200).json({ ok: false, error: data?.error?.message || 'ai_error' });
    }

    const note = data?.content?.[0]?.text?.trim();
    if (!note) return res.status(200).json({ ok: false, error: 'empty_response' });

    return res.status(200).json({ ok: true, note });
  } catch (e: any) {
    return res.status(200).json({ ok: false, error: e?.message || 'network_error' });
  }
}
