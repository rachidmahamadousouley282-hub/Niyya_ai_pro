
-- =========================================================
-- NIYYA.ai V2 - MIGRATION 0005
-- Quotas quotidiens, publicites recompensees et VIP
-- Version securisee pour la base V2 isolee.
-- Les anciennes fonctions sont conservees.
-- =========================================================

BEGIN;

-- ---------------------------------------------------------
-- 1. COLONNES DE QUOTAS QUOTIDIENS
-- ---------------------------------------------------------

ALTER TABLE public.users
    ADD COLUMN IF NOT EXISTS daily_quota_date DATE,
    ADD COLUMN IF NOT EXISTS daily_messages_used INTEGER NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS daily_bonus_messages INTEGER NOT NULL DEFAULT 0;

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

-- ---------------------------------------------------------
-- 2. JOURNAL DES CONSOMMATIONS
-- Un remboursement maximum par message.
-- ---------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.message_quota_consumptions (
    user_id UUID NOT NULL
        REFERENCES public.users(id) ON DELETE CASCADE,
    request_id UUID NOT NULL,
    tier TEXT NOT NULL
        CHECK (tier IN ('free', 'vip')),
    quota_date DATE NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    refunded_at TIMESTAMPTZ,
    PRIMARY KEY (user_id, request_id)
);

CREATE INDEX IF NOT EXISTS message_quota_consumptions_date_idx
ON public.message_quota_consumptions(user_id, quota_date);

-- ---------------------------------------------------------
-- 3. CONSOMMATION D'UN MESSAGE
-- request_id doit etre un UUID unique genere par le serveur.
-- ---------------------------------------------------------

CREATE OR REPLACE FUNCTION public.consume_message_v2(
    p_user_id UUID,
    p_request_id UUID
)
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
    IF p_user_id IS NULL OR p_request_id IS NULL THEN
        RAISE EXCEPTION 'Parametres de consommation invalides.';
    END IF;

    v_today := (clock_timestamp() AT TIME ZONE 'UTC')::DATE;

    SELECT onboarded_at, vip_until,
           daily_quota_date, daily_messages_used,
           daily_bonus_messages
    INTO v_u
    FROM public.users
    WHERE id = p_user_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Utilisateur introuvable.';
    END IF;

    IF v_u.onboarded_at IS NULL THEN
        RETURN QUERY SELECT FALSE, 'not_onboarded'::TEXT,
                            0, 'none'::TEXT;
        RETURN;
    END IF;

    -- Evite de consommer deux fois la meme requete.
    IF EXISTS (
        SELECT 1
        FROM public.message_quota_consumptions
        WHERE user_id = p_user_id
          AND request_id = p_request_id
    ) THEN
        RETURN QUERY SELECT FALSE, 'duplicate_request'::TEXT,
                            0, 'none'::TEXT;
        RETURN;
    END IF;

    -- Reinitialisation quotidienne UTC.
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

    -- VIP : aucun quota quotidien de messages.
    IF v_u.vip_until IS NOT NULL
       AND v_u.vip_until > clock_timestamp() THEN

        INSERT INTO public.message_quota_consumptions
            (user_id, request_id, tier, quota_date)
        VALUES
            (p_user_id, p_request_id, 'vip', v_today);

        RETURN QUERY SELECT TRUE, 'ok'::TEXT,
                            NULL::INTEGER, 'vip'::TEXT;
        RETURN;
    END IF;

    -- Gratuit : 30 messages + bonus publicitaires.
    v_limit := 30 + v_u.daily_bonus_messages;

    IF v_u.daily_messages_used >= v_limit THEN
        RETURN QUERY SELECT FALSE, 'no_balance'::TEXT,
                            0, 'free'::TEXT;
        RETURN;
    END IF;

    UPDATE public.users
    SET daily_messages_used = daily_messages_used + 1
    WHERE id = p_user_id;

    INSERT INTO public.message_quota_consumptions
        (user_id, request_id, tier, quota_date)
    VALUES
        (p_user_id, p_request_id, 'free', v_today);

    RETURN QUERY SELECT
        TRUE,
        'ok'::TEXT,
        v_limit - v_u.daily_messages_used - 1,
        'free'::TEXT;
END;
$function$;

-- ---------------------------------------------------------
-- 4. VIDEOS RECOMPENSEES
-- Le serveur doit verifier l'evenement publicitaire
-- avant d'appeler cette fonction.
-- ---------------------------------------------------------

CREATE OR REPLACE FUNCTION public.grant_rewarded_video_v2(
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
       OR p_provider IS NULL
       OR BTRIM(p_provider) = ''
       OR LENGTH(BTRIM(p_provider)) > 100
       OR p_provider_event_id IS NULL
       OR BTRIM(p_provider_event_id) = ''
       OR LENGTH(BTRIM(p_provider_event_id)) > 255 THEN
        RAISE EXCEPTION 'Parametres publicitaires invalides.';
    END IF;

    v_today := (clock_timestamp() AT TIME ZONE 'UTC')::DATE;

    SELECT onboarded_at, vip_until,
           daily_quota_date, daily_messages_used,
           daily_bonus_messages, rewarded_videos_today
    INTO v_u
    FROM public.users
    WHERE id = p_user_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Utilisateur introuvable.';
    END IF;

    IF v_u.onboarded_at IS NULL THEN
        RETURN QUERY SELECT FALSE, 0, 0,
                            'not_onboarded'::TEXT;
        RETURN;
    END IF;

    IF v_u.vip_until IS NOT NULL
       AND v_u.vip_until > clock_timestamp() THEN
        RETURN QUERY SELECT FALSE, 0, 0,
                            'vip_no_ads'::TEXT;
        RETURN;
    END IF;

    v_used := COALESCE(v_u.daily_messages_used, 0);
    v_bonus := COALESCE(v_u.daily_bonus_messages, 0);
    v_videos := COALESCE(v_u.rewarded_videos_today, 0);

    -- Reinitialisation quotidienne UTC.
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

    IF v_videos >= 5 OR v_bonus + 10 > 50 THEN
        RETURN QUERY SELECT FALSE, 0,
            GREATEST(30 + v_bonus - v_used, 0),
            'daily_cap'::TEXT;
        RETURN;
    END IF;

    -- Un evenement publicitaire ne peut etre attribue
    -- qu'une seule fois.
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

-- ---------------------------------------------------------
-- 5. REMBOURSEMENT IDEMPOTENT
-- Chaque request_id ne peut etre rembourse qu'une fois.
-- ---------------------------------------------------------

CREATE OR REPLACE FUNCTION public.refund_message_v2(
    p_user_id UUID,
    p_request_id UUID
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'pg_catalog', 'pg_temp'
AS $function$
DECLARE
    v_tier TEXT;
    v_quota_date DATE;
    v_today DATE;
BEGIN
    IF p_user_id IS NULL OR p_request_id IS NULL THEN
        RAISE EXCEPTION 'Parametres de remboursement invalides.';
    END IF;

    PERFORM 1
    FROM public.users
    WHERE id = p_user_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Utilisateur introuvable.';
    END IF;

    UPDATE public.message_quota_consumptions
    SET refunded_at = clock_timestamp()
    WHERE user_id = p_user_id
      AND request_id = p_request_id
      AND refunded_at IS NULL
    RETURNING tier, quota_date
    INTO v_tier, v_quota_date;

    IF NOT FOUND THEN
        RETURN FALSE;
    END IF;

    IF v_tier = 'vip' THEN
        RETURN TRUE;
    END IF;

    v_today := (clock_timestamp() AT TIME ZONE 'UTC')::DATE;

    -- Pas de report d'un remboursement sur un autre jour.
    IF v_quota_date = v_today THEN
        UPDATE public.users
        SET daily_messages_used =
            GREATEST(daily_messages_used - 1, 0)
        WHERE id = p_user_id
          AND daily_quota_date = v_today;
    END IF;

    RETURN TRUE;
END;
$function$;

-- ---------------------------------------------------------
-- 6. PERMISSIONS
-- ---------------------------------------------------------

REVOKE ALL ON FUNCTION
    public.consume_message_v2(UUID, UUID) FROM PUBLIC;

REVOKE ALL ON FUNCTION
    public.grant_rewarded_video_v2(UUID, TEXT, TEXT) FROM PUBLIC;

REVOKE ALL ON FUNCTION
    public.refund_message_v2(UUID, UUID) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION
    public.consume_message_v2(UUID, UUID) TO niyya_app;

GRANT EXECUTE ON FUNCTION
    public.grant_rewarded_video_v2(UUID, TEXT, TEXT) TO niyya_app;

GRANT EXECUTE ON FUNCTION
    public.refund_message_v2(UUID, UUID) TO niyya_app;

-- ---------------------------------------------------------
-- 7. SUIVI DE MIGRATION
-- ---------------------------------------------------------

INSERT INTO public.schema_migrations (version, description)
SELECT '0005', 'Daily quotas, rewarded ads and VIP for NIYYA V2'
WHERE NOT EXISTS (
    SELECT 1
    FROM public.schema_migrations
    WHERE version = '0005'
);

COMMIT;

-- =========================================================
-- FIN MIGRATION 0005
-- =========================================================
