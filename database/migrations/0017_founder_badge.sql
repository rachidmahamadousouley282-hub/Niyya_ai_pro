-- NIYYA.ai V2 — 0017: dedicated founder identity marker and badge.
BEGIN;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS is_founder boolean NOT NULL DEFAULT false;
CREATE UNIQUE INDEX IF NOT EXISTS users_single_founder_account_idx
  ON public.users (is_founder) WHERE is_founder = TRUE;
UPDATE public.users SET is_founder = TRUE, updated_at = NOW()
WHERE id = '71883e29-caa1-4ec4-a7b2-1a11d0960dda' AND is_guest = FALSE;
INSERT INTO public.schema_migrations (version, description)
VALUES ('0017', 'Founder account marker and distinct founder badge')
ON CONFLICT (version) DO NOTHING;
COMMIT;
