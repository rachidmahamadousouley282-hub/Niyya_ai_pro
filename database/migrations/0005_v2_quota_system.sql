
-- =========================================================
-- NIYYA AI V2 - MIGRATION 0005
-- Quotas quotidiens, videos recompensees et VIP
-- Migration additive : aucune donnee historique supprimee.
-- =========================================================

-- 1. Colonnes de suivi quotidien
ALTER TABLE public.users
ADD COLUMN IF NOT EXISTS daily_quota_date DATE,
ADD COLUMN IF NOT EXISTS daily_messages_used INTEGER NOT NULL DEFAULT 0,
ADD COLUMN IF NOT EXISTS daily_bonus_messages INTEGER NOT NULL DEFAULT 0;

-- 2. Contraintes : ajout sans doublon
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conrelid = 'public.users'::regclass
        AND conname = 'users_daily_messages_used_check'
    ) THEN
        ALTER TABLE public.users
        ADD CONSTRAINT users_daily_messages_used_check
        CHECK (daily_messages_used BETWEEN 0 AND 80);
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conrelid = 'public.users'::regclass
        AND conname = 'users_daily_bonus_messages_check'
    ) THEN
        ALTER TABLE public.users
        ADD CONSTRAINT users_daily_bonus_messages_check
        CHECK (daily_bonus_messages BETWEEN 0 AND 50);
    END IF;
END;
$$;

-- 3. Consommation d'un message
CREATE OR REPLACE FUNCTION public.consume_message(p_user_id UUID)
RETURNS TABLE (
    allowed BOOLEAN,
    reason TEXT,
    remaining INTEGER,
    tier TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'pg_catalog', 'pg_temp'
AS $function$
DECLARE
    v_u RECORD;
    v_today DATE;
    v_limit INTEGER;
BEGIN
    IF p_user_id IS NULL THEN
        RAISE EXCEPTION 'Identifiant utilisateur invalide.';
    END IF;

    v_today := (clock_timestamp() AT TIME ZONE 'UTC')::DATE;

    SELECT onboarded_at, vip_until,
           daily_quota_date, daily_messages_used,
           daily_bonus_messages,
           rewarded_videos_today, rewarded_videos_day
    INTO v_u
    FROM public.users
    WHERE id = p_user_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Utilisateur introuvable.';
    END IF;

    IF v_u.onboarded_at IS NULL THEN
        RETURN QUERY SELECT FALSE, 'not_onboarded'::TEXT, 0, 'none'::TEXT;
        RETURN;
    END IF;

    -- Remise a zero quotidienne en UTC
    IF v_u.daily_quota_date IS DISTINCT FROM v_today THEN
        UPDATE public.users
        SET daily_quota_date = v_today,
            daily_messages_used = 0,
            daily_bonus_messages = 0,
            rewarded_videos_today = 0,
            rewarded_videos_day = v_today
        WHERE id = p_user_id;

        v_u.daily_messages_used := 0;
        v_u.daily_bonus_messages := 0;
    END IF;

    -- VIP : pas de compteur mensuel de messages
    IF v_u.vip_until IS NOT NULL
       AND v_u.vip_until > clock_timestamp() THEN
        RETURN QUERY SELECT TRUE, 'ok'::TEXT, NULL::INTEGER, 'vip'::TEXT;
        RETURN;
    END IF;

    -- Gratuit : 30 messages + bonus publicitaires
    v_limit := 30 + v_u.daily_bonus_messages;

    IF v_u.daily_messages_used >= v_limit THEN
        RETURN QUERY SELECT FALSE, 'no_balance'::TEXT, 0, 'free'::TEXT;
        RETURN;
    END IF;

    UPDATE public.users
    SET daily_messages_used = daily_messages_used + 1
    WHERE id = p_user_id;

    RETURN QUERY SELECT
        TRUE,
        'ok'::TEXT,
        v_limit - v_u.daily_messages_used - 1,
        'free'::TEXT;
END;
$function$;

-- 4. Attribution d'une recompense publicitaire validee
CREATE OR REPLACE FUNCTION public.grant_rewarded_video(
    p_user_id UUID,
    p_provider TEXT,
    p_provider_event_id TEXT
)
RETURNS TABLE (
    granted BOOLEAN,
    messages_added INTEGER,
    balance INTEGER,
    reason TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'pg_catalog', 'pg_temp'
AS $function$
DECLARE
    v_u RECORD;
    v_today DATE;
    v_inserted INTEGER;
    v_bonus INTEGER;
    v_used INTEGER;
    v_videos INTEGER;
BEGIN
    IF p_user_id IS NULL
       OR p_provider IS NULL OR BTRIM(p_provider) = ''
       OR p_provider_event_id IS NULL
       OR BTRIM(p_provider_event_id) = '' THEN
        RAISE EXCEPTION 'Parametres de recompense invalides.';
    END IF;

    v_today := (clock_timestamp() AT TIME ZONE 'UTC')::DATE;

    SELECT onboarded_at, vip_until,
           daily_quota_date, daily_messages_used,
           daily_bonus_messages,
           rewarded_videos_today, rewarded_videos_day
    INTO v_u
    FROM public.users
    WHERE id = p_user_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Utilisateur introuvable.';
    END IF;

    IF v_u.onboarded_at IS NULL THEN
        RETURN QUERY SELECT FALSE, 0, 0, 'not_onboarded'::TEXT;
        RETURN;
    END IF;

    IF v_u.vip_until IS NOT NULL
       AND v_u.vip_until > clock_timestamp() THEN
        RETURN QUERY SELECT FALSE, 0, 0, 'vip_no_ads'::TEXT;
        RETURN;
    END IF;

    v_used := v_u.daily_messages_used;
    v_bonus := v_u.daily_bonus_messages;
    v_videos := v_u.rewarded_videos_today;

    -- Remise a zero quotidienne en UTC
    IF v_u.daily_quota_date IS DISTINCT FROM v_today THEN
        v_used := 0;
        v_bonus := 0;
        v_videos := 0;

        UPDATE public.users
        SET daily_quota_date = v_today,
            daily_messages_used = 0,
            daily_bonus_messages = 0,
            rewarded_videos_today = 0,
            rewarded_videos_day = v_today
        WHERE id = p_user_id;
    END IF;

    IF v_videos >= 5 THEN
        RETURN QUERY SELECT FALSE, 0,
            GREATEST(30 + v_bonus - v_used, 0),
            'daily_cap'::TEXT;
        RETURN;
    END IF;

    -- Un evenement fournisseur ne peut etre utilise deux fois
    INSERT INTO public.ad_reward_events (
        user_id, provider, provider_event_id
    )
    VALUES (
        p_user_id, BTRIM(p_provider), BTRIM(p_provider_event_id)
    )
    ON CONFLICT ON CONSTRAINT uq_ad_reward_event DO NOTHING;

    GET DIAGNOSTICS v_inserted = ROW_COUNT;

    IF v_inserted = 0 THEN
        RETURN QUERY SELECT FALSE, 0,
            GREATEST(30 + v_bonus - v_used, 0),
            'duplicate'::TEXT;
        RETURN;
    END IF;

    UPDATE public.users
    SET rewarded_videos_today = v_videos + 1,
        daily_bonus_messages = v_bonus + 10
    WHERE id = p_user_id;

    RETURN QUERY SELECT TRUE, 10,
        GREATEST(30 + v_bonus + 10 - v_used, 0),
        'ok'::TEXT;
END;
$function$;

-- 5. Remboursement d'un message echoue
CREATE OR REPLACE FUNCTION public.refund_message(
    p_user_id UUID,
    p_tier TEXT
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'pg_catalog', 'pg_temp'
AS $function$
DECLARE
    v_exists BOOLEAN;
    v_today DATE;
BEGIN
    IF p_user_id IS NULL THEN
        RAISE EXCEPTION 'Identifiant utilisateur invalide.';
    END IF;

    IF p_tier NOT IN ('vip', 'free') OR p_tier IS NULL THEN
        RAISE EXCEPTION 'Niveau de remboursement invalide.';
    END IF;

    SELECT TRUE INTO v_exists
    FROM public.users
    WHERE id = p_user_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Utilisateur introuvable.';
    END IF;

    -- Les messages VIP ne sont pas decomptes.
    IF p_tier = 'vip' THEN
        RETURN;
    END IF;

    v_today := (clock_timestamp() AT TIME ZONE 'UTC')::DATE;

    -- Un ancien quota expire ne doit pas etre reporte au lendemain.
    UPDATE public.users
    SET daily_messages_used = GREATEST(daily_messages_used - 1, 0)
    WHERE id = p_user_id
      AND daily_quota_date = v_today;
END;
$function$;

-- 6. Permissions : application uniquement
REVOKE ALL ON FUNCTION public.consume_message(UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.grant_rewarded_video(UUID, TEXT, TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.refund_message(UUID, TEXT) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.consume_message(UUID) TO niyya_app;
GRANT EXECUTE ON FUNCTION public.grant_rewarded_video(UUID, TEXT, TEXT) TO niyya_app;
GRANT EXECUTE ON FUNCTION public.refund_message(UUID, TEXT) TO niyya_app;

-- =========================================================
-- FIN DE LA MIGRATION 0005
-- =========================================================
