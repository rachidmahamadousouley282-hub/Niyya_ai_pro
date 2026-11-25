-- NIYYA.ai V2 — 0011: richer community sharing, privacy, inbox and blocks.
-- Additive only. Images are kept as small, validated blobs in Postgres; no paid storage service.
BEGIN;
ALTER TABLE public.community_posts
  ADD COLUMN IF NOT EXISTS visibility varchar(10) NOT NULL DEFAULT 'public',
  ADD COLUMN IF NOT EXISTS media_data bytea,
  ADD COLUMN IF NOT EXISTS media_mime varchar(32);
ALTER TABLE public.community_posts DROP CONSTRAINT IF EXISTS community_posts_visibility_check;
ALTER TABLE public.community_posts ADD CONSTRAINT community_posts_visibility_check CHECK (visibility IN ('public','private'));
ALTER TABLE public.community_posts DROP CONSTRAINT IF EXISTS community_posts_media_pair_check;
ALTER TABLE public.community_posts ADD CONSTRAINT community_posts_media_pair_check CHECK ((media_data IS NULL AND media_mime IS NULL) OR (media_data IS NOT NULL AND media_mime IN ('image/jpeg','image/png','image/webp')));
ALTER TABLE public.community_posts DROP CONSTRAINT IF EXISTS community_posts_body_check;
ALTER TABLE public.community_posts DROP CONSTRAINT IF EXISTS community_posts_body_or_media_check;
ALTER TABLE public.community_posts ADD CONSTRAINT community_posts_body_or_media_check CHECK ((char_length(btrim(body)) BETWEEN 2 AND 600) OR (media_data IS NOT NULL AND char_length(btrim(body)) <= 600));
CREATE INDEX IF NOT EXISTS community_posts_visibility_feed_idx ON public.community_posts (visibility, created_at DESC, id DESC) WHERE status='published';
CREATE TABLE IF NOT EXISTS public.community_notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  recipient_user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  actor_user_id uuid REFERENCES public.users(id) ON DELETE SET NULL,
  event_type varchar(16) NOT NULL CHECK (event_type IN ('follow','like','comment')),
  post_id uuid REFERENCES public.community_posts(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  read_at timestamptz
);
CREATE INDEX IF NOT EXISTS community_notifications_inbox_idx ON public.community_notifications(recipient_user_id, created_at DESC);
CREATE TABLE IF NOT EXISTS public.community_blocks (
  blocker_user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  blocked_user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (blocker_user_id, blocked_user_id),
  CHECK (blocker_user_id <> blocked_user_id)
);
CREATE INDEX IF NOT EXISTS community_blocks_blocked_idx ON public.community_blocks(blocked_user_id);
INSERT INTO public.schema_migrations(version,description)
VALUES ('0011','Community image posts, privacy, notifications and member blocks')
ON CONFLICT(version) DO NOTHING;
COMMIT;
