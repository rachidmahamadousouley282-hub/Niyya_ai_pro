
-- NIYYA AI V2
-- Preparation des quotas quotidiens
-- Migration additive : aucune donnee existante n'est supprimee.

ALTER TABLE public.users
ADD COLUMN IF NOT EXISTS daily_quota_date DATE,
ADD COLUMN IF NOT EXISTS daily_messages_used INTEGER NOT NULL DEFAULT 0,
ADD COLUMN IF NOT EXISTS daily_bonus_messages INTEGER NOT NULL DEFAULT 0;

ALTER TABLE public.users
ADD CONSTRAINT users_daily_messages_used_check
CHECK (daily_messages_used BETWEEN 0 AND 80);

ALTER TABLE public.users
ADD CONSTRAINT users_daily_bonus_messages_check
CHECK (daily_bonus_messages BETWEEN 0 AND 50);

