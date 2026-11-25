-- NIYYA.ai V2 — Persistent character favorites
-- Additive migration; safe to re-run.
CREATE TABLE IF NOT EXISTS public.user_favorite_characters (
  user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  character_id uuid NOT NULL REFERENCES public.characters(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT NOW(),
  PRIMARY KEY (user_id, character_id)
);

CREATE INDEX IF NOT EXISTS idx_user_favorite_characters_recent
  ON public.user_favorite_characters (user_id, created_at DESC);
