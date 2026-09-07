import { supabase } from "../services/supabase";

const SESSION_KEY = "traccer_analytics_session";

function getSessionId(): string {
  let id = sessionStorage.getItem(SESSION_KEY);
  if (!id) {
    id = crypto.randomUUID();
    sessionStorage.setItem(SESSION_KEY, id);
  }
  return id;
}

// Fire-and-forget first-party event tracking (screen views, feature usage,
// signup funnel, first-screen exits). Never throws — a tracking failure
// must not break the feature the user is actually trying to use.
export function trackEvent(name: string, properties: Record<string, unknown> = {}, userId?: string | null) {
  supabase
    .from("analytics_events")
    .insert({
      event_name: name,
      properties,
      user_id: userId ?? null,
      session_id: getSessionId(),
    })
    .then(({ error }) => {
      if (error) console.warn("[analytics]", error.message);
    });
}
