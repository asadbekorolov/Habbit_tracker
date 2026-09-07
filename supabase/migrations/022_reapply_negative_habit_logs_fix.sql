-- Migration 022: Re-apply migration 020, undoing migration 021.
--
-- Confirmed with the user against real data: rows logged this morning
-- (2026-07-28 ~04:42 UTC) for "O'yin o'ynash" and "no FAP" were created by
-- tapping the green circle (kept/resisted), yet stored completed=false.
-- This happened because the live Vercel deployment at that time still ran
-- an older build (pushed to GitHub only later in this session) that wrote
-- the inverted value. Migration 020 correctly fixed this; migration 021
-- wrongly reverted it based on a mistaken belief that the app code (which,
-- as committed in this repo, was already correct) had never been buggy in
-- production. It had -- just not yet in what was actually deployed.
--
-- The app code and service worker are now fixed and deployed, so this is
-- expected to be the final, one-time historical data correction needed --
-- everything logged from now on is written correctly at write-time.

UPDATE habit_logs
SET completed = NOT completed
WHERE habit_id IN (
  SELECT id FROM habits WHERE type = 'negative'
);
