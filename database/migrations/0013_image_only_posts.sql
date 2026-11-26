-- NIYYA.ai V2 — 0013: allow image-only community posts.
-- Keep text-only posts subject to the existing 2-character minimum.
BEGIN;
ALTER TABLE public.community_posts
  DROP CONSTRAINT IF EXISTS community_posts_body_check;
ALTER TABLE public.community_posts
  ADD CONSTRAINT community_posts_body_check
  CHECK (
    (media_data IS NOT NULL AND char_length(btrim(body)) BETWEEN 0 AND 600)
    OR
    (media_data IS NULL AND char_length(btrim(body)) BETWEEN 2 AND 600)
  );
INSERT INTO public.schema_migrations (version, description)
VALUES ('0013', 'Allow image-only community posts while preserving text minimum')
ON CONFLICT (version) DO NOTHING;
COMMIT;
