-- NIYYA.ai V2 — privacy-preserving character engagement analytics
-- One profile view per user (including guest accounts) per character per day.
CREATE TABLE IF NOT EXISTS public.character_view_events (
  user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  character_id uuid NOT NULL REFERENCES public.characters(id) ON DELETE CASCADE,
  view_date date NOT NULL DEFAULT CURRENT_DATE,
  created_at timestamptz NOT NULL DEFAULT NOW(),
  PRIMARY KEY (user_id, character_id, view_date)
);

CREATE INDEX IF NOT EXISTS idx_character_view_events_character_date
  ON public.character_view_events (character_id, view_date DESC);

CREATE INDEX IF NOT EXISTS idx_character_view_events_date
  ON public.character_view_events (view_date DESC);
