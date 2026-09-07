-- Migration 023: Add optional description to habits
-- Lets a user note why a habit matters (shown under the habit name).

ALTER TABLE habits ADD COLUMN IF NOT EXISTS description text NOT NULL DEFAULT '';
