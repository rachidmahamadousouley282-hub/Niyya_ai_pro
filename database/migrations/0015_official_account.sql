-- NIYYA.ai V2 — 0015: official platform identity and automatic follow.
-- Additive only; no existing account or community content is removed.
BEGIN;
ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS is_official boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS is_verified boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS verification_status varchar(16) NOT NULL DEFAULT 'none'
    CHECK (verification_status IN ('none', 'pending', 'approved', 'rejected'));
CREATE UNIQUE INDEX IF NOT EXISTS users_single_official_account_idx
  ON public.users (is_official) WHERE is_official = TRUE;
INSERT INTO public.users (
  id, role, is_guest, pseudonym, bio, language_code, country_code,
  adult_confirmed_at, terms_accepted_at, terms_version, onboarded_at,
  is_official, is_verified, verification_status, created_at, updated_at
) VALUES (
  '00000000-0000-4000-8000-000000000015', 'user', TRUE, 'NIYYA_Officiel',
  'Le compte officiel de NIYYA.ai : annonces, nouveautés et assistance.',
  'fr', 'NE', NOW(), NOW(), '2.0', NOW(), TRUE, TRUE, 'approved', NOW(), NOW()
) ON CONFLICT (id) DO UPDATE SET
  is_official=TRUE, is_verified=TRUE, verification_status='approved',
  bio=EXCLUDED.bio, updated_at=NOW();
CREATE OR REPLACE FUNCTION public.follow_official_on_onboarding()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER
SET search_path TO 'pg_catalog', 'pg_temp'
AS $function$
BEGIN
  IF NEW.onboarded_at IS NOT NULL AND OLD.onboarded_at IS NULL
     AND NEW.id <> '00000000-0000-4000-8000-000000000015'::uuid THEN
    INSERT INTO public.community_follows (follower_user_id, followed_user_id)
    VALUES (NEW.id, '00000000-0000-4000-8000-000000000015'::uuid)
    ON CONFLICT DO NOTHING;
  END IF;
  RETURN NEW;
END;
$function$;
DROP TRIGGER IF EXISTS users_follow_official_after_onboarding ON public.users;
CREATE TRIGGER users_follow_official_after_onboarding
AFTER UPDATE OF onboarded_at ON public.users
FOR EACH ROW EXECUTE FUNCTION public.follow_official_on_onboarding();
INSERT INTO public.community_follows (follower_user_id, followed_user_id)
SELECT u.id, '00000000-0000-4000-8000-000000000015'::uuid
FROM public.users u
WHERE u.onboarded_at IS NOT NULL
  AND u.id <> '00000000-0000-4000-8000-000000000015'::uuid
ON CONFLICT DO NOTHING;
INSERT INTO public.schema_migrations (version, description)
VALUES ('0015', 'Official NIYYA account, verification markers and automatic follow')
ON CONFLICT (version) DO NOTHING;
COMMIT;
