-- AI Coach Note cache: one note per user, generated on-demand from
-- client-aggregated summary data (see api/ai-coach.ts + Analytics.tsx).
-- The LLM call itself happens in the serverless function; this table
-- only stores the resulting text so the page doesn't need to re-call
-- the AI on every visit.

create table if not exists ai_coach_notes (
  user_id uuid primary key references profiles(id) on delete cascade,
  note text not null,
  generated_at timestamptz not null default now()
);

alter table ai_coach_notes enable row level security;

drop policy if exists "coach_notes_select_own" on ai_coach_notes;
create policy "coach_notes_select_own" on ai_coach_notes
  for select using (auth.uid() = user_id);

drop policy if exists "coach_notes_insert_own" on ai_coach_notes;
create policy "coach_notes_insert_own" on ai_coach_notes
  for insert with check (auth.uid() = user_id);

drop policy if exists "coach_notes_update_own" on ai_coach_notes;
create policy "coach_notes_update_own" on ai_coach_notes
  for update using (auth.uid() = user_id);
