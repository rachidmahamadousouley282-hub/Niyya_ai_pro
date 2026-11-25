-- NIYYA.ai V2 — 0010: community feed, profiles, follows, comments and reports.
-- Additive migration. No existing user content or tables are removed.
BEGIN;

ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS bio varchar(180) NOT NULL DEFAULT '';

CREATE TABLE IF NOT EXISTS public.community_posts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  author_user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  body varchar(600) NOT NULL CHECK (char_length(btrim(body)) BETWEEN 2 AND 600),
  status varchar(12) NOT NULL DEFAULT 'published' CHECK (status IN ('published', 'hidden', 'deleted')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS community_posts_feed_idx ON public.community_posts (created_at DESC, id DESC) WHERE status = 'published';
CREATE INDEX IF NOT EXISTS community_posts_author_idx ON public.community_posts (author_user_id, created_at DESC);

CREATE TABLE IF NOT EXISTS public.community_post_likes (
  user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  post_id uuid NOT NULL REFERENCES public.community_posts(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, post_id)
);
CREATE INDEX IF NOT EXISTS community_post_likes_post_idx ON public.community_post_likes (post_id);

CREATE TABLE IF NOT EXISTS public.community_comments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id uuid NOT NULL REFERENCES public.community_posts(id) ON DELETE CASCADE,
  author_user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  body varchar(240) NOT NULL CHECK (char_length(btrim(body)) BETWEEN 1 AND 240),
  status varchar(12) NOT NULL DEFAULT 'published' CHECK (status IN ('published', 'hidden', 'deleted')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS community_comments_post_idx ON public.community_comments (post_id, created_at) WHERE status = 'published';

CREATE TABLE IF NOT EXISTS public.community_follows (
  follower_user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  followed_user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (follower_user_id, followed_user_id),
  CHECK (follower_user_id <> followed_user_id)
);
CREATE INDEX IF NOT EXISTS community_follows_followed_idx ON public.community_follows (followed_user_id, created_at DESC);

CREATE TABLE IF NOT EXISTS public.community_reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  reporter_user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  target_type varchar(12) NOT NULL CHECK (target_type IN ('post', 'comment')),
  target_id uuid NOT NULL,
  reason varchar(24) NOT NULL CHECK (reason IN ('spam', 'harassment', 'unsafe', 'personal_info', 'other')),
  details varchar(300),
  status varchar(12) NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'resolved', 'dismissed')),
  created_at timestamptz NOT NULL DEFAULT now(),
  reviewed_at timestamptz,
  reviewed_by uuid REFERENCES public.users(id) ON DELETE SET NULL,
  UNIQUE (reporter_user_id, target_type, target_id)
);
CREATE INDEX IF NOT EXISTS community_reports_queue_idx ON public.community_reports (created_at) WHERE status = 'open';

INSERT INTO public.schema_migrations (version, description)
VALUES ('0010', 'Community feed, pseudonymous profiles, follows, comments and reports')
ON CONFLICT (version) DO NOTHING;
COMMIT;
