-- NIYYA.ai V2 — Migration 0008
-- Age-aware onboarding. Stores an age band, never a date of birth.
-- Minors keep access to age-appropriate conversations; creator tools remain adult-only.

BEGIN;

ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS age_band varchar(10);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.users'::regclass
      AND conname = 'users_age_band_check'
  ) THEN
    ALTER TABLE public.users
      ADD CONSTRAINT users_age_band_check
      CHECK (age_band IS NULL OR age_band IN ('13_15', '16_17', '18_plus'));
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.complete_onboarding_v2(
  p_user_id uuid,
  p_language text,
  p_country text,
  p_pseudonym text,
  p_age_band text,
  p_terms_version text
)
RETURNS TABLE(ok boolean, message text, messages_granted integer)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'pg_catalog', 'pg_temp'
AS $function$
DECLARE
  v_user RECORD;
  v_err TEXT;
  v_now TIMESTAMPTZ;
  v_welcome CONSTANT INT := 25;
BEGIN
  IF p_user_id IS NULL THEN
    RAISE EXCEPTION 'Identifiant utilisateur invalide.';
  END IF;

  SELECT id, onboarded_at
    INTO v_user
    FROM public.users
    WHERE id = p_user_id
    FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Utilisateur introuvable.';
  END IF;

  IF v_user.onboarded_at IS NOT NULL THEN
    RETURN QUERY SELECT FALSE, 'Profil déjà créé.'::TEXT, 0;
    RETURN;
  END IF;

  IF p_age_band IS NULL OR p_age_band NOT IN ('13_15', '16_17', '18_plus') THEN
    RETURN QUERY SELECT FALSE, 'Tranche d’âge non prise en charge.'::TEXT, 0;
    RETURN;
  END IF;

  IF p_terms_version IS NULL OR BTRIM(p_terms_version) = ''
     OR LENGTH(p_terms_version) > 20 THEN
    RETURN QUERY SELECT FALSE, 'Version des conditions invalide.'::TEXT, 0;
    RETURN;
  END IF;

  IF p_language IS NULL OR NOT EXISTS (
    SELECT 1 FROM public.supported_languages
    WHERE code = p_language AND enabled
  ) THEN
    RETURN QUERY SELECT FALSE, 'Langue non disponible.'::TEXT, 0;
    RETURN;
  END IF;

  IF p_country IS NULL OR p_country !~ '^[A-Z]{2}$' THEN
    RETURN QUERY SELECT FALSE, 'Pays invalide.'::TEXT, 0;
    RETURN;
  END IF;

  v_err := public.validate_pseudonym(p_pseudonym);
  IF v_err IS NOT NULL THEN
    RETURN QUERY SELECT FALSE, v_err, 0;
    RETURN;
  END IF;

  v_now := clock_timestamp();

  BEGIN
    UPDATE public.users
    SET language_code = p_language,
        country_code = p_country,
        pseudonym = p_pseudonym,
        age_band = p_age_band,
        adult_confirmed_at = CASE WHEN p_age_band = '18_plus' THEN v_now ELSE NULL END,
        terms_accepted_at = v_now,
        terms_version = BTRIM(p_terms_version),
        onboarded_at = v_now,
        messages_balance = messages_balance + v_welcome
    WHERE id = p_user_id;
  EXCEPTION
    WHEN unique_violation THEN
      RETURN QUERY SELECT FALSE, 'Ce pseudo est déjà pris.'::TEXT, 0;
      RETURN;
  END;

  RETURN QUERY SELECT TRUE, 'Profil créé.'::TEXT, v_welcome;
END;
$function$;

INSERT INTO public.schema_migrations (version, description)
VALUES ('0008', 'Age-aware onboarding with privacy-preserving age bands')
ON CONFLICT (version) DO NOTHING;

COMMIT;
