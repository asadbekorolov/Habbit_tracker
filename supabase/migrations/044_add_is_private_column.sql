-- Migration 044: Ensure is_private column exists on profiles table
ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS is_private BOOLEAN DEFAULT false;
