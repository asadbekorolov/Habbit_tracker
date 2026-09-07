-- Migration 024: Exponential 10-tier level curve
-- Replaces the old flat 5-tier table (50/150/300/500, capped at level 5)
-- with an exponential curve threshold(N) = round(N^1.5 * 100), capped at
-- level 10. Must stay in sync with LEVEL_THRESHOLDS in src/utils/levels.ts.
-- Thresholds: L1=0 L2=283 L3=520 L4=800 L5=1118 L6=1470 L7=1852 L8=2263
-- L9=2700 L10=3162 (max).

CREATE OR REPLACE FUNCTION calculate_level(xp integer)
RETURNS integer
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT CASE
    WHEN xp >= 3162 THEN 10
    WHEN xp >= 2700 THEN 9
    WHEN xp >= 2263 THEN 8
    WHEN xp >= 1852 THEN 7
    WHEN xp >= 1470 THEN 6
    WHEN xp >= 1118 THEN 5
    WHEN xp >= 800  THEN 4
    WHEN xp >= 520  THEN 3
    WHEN xp >= 283  THEN 2
    ELSE 1
  END;
$$;

-- Existing users' current_level was computed under the old curve — recompute
-- everyone against the new thresholds so it doesn't silently drift out of
-- sync with total_xp until their next add_xp_to_user call.
UPDATE profiles SET current_level = calculate_level(total_xp);
