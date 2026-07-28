-- Migration 026: Coin shop expansion — profile frames + premium avatar colors
-- Ownership of both is already tracked generically by the existing
-- coin_purchases(user_id, item_id) table (see purchaseCoinItem/hasShopBadge
-- in db.ts) — no new table needed. A frame is "equipped" (shown) via the
-- new active_frame column; a user may own several but display only one.
-- Premium avatar colors don't need an "active" column — the color itself
-- is written directly into the existing profiles.avatar_color on select.

ALTER TABLE profiles ADD COLUMN IF NOT EXISTS active_frame text;
