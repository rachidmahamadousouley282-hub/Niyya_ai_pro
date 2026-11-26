-- NIYYA.ai V2 — 0012: mandatory administrator review for public image posts.
-- Text-only public posts keep the existing automated moderation flow.
BEGIN;
ALTER TABLE public.community_posts DROP CONSTRAINT IF EXISTS community_posts_status_check;
ALTER TABLE public.community_posts ADD CONSTRAINT community_posts_status_check CHECK (status IN ('published', 'pending_review', 'hidden', 'deleted'));
INSERT INTO public.schema_migrations (version, description)
VALUES ('0012', 'Pre-publication administrator review for public image posts')
ON CONFLICT (version) DO NOTHING;
COMMIT;
