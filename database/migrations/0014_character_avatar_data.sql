-- NIYYA.ai V2 — 0014: store small, compressed JPEG avatars on private characters.
ALTER TABLE public.characters DROP CONSTRAINT IF EXISTS chk_character_avatar;
ALTER TABLE public.characters
  ADD CONSTRAINT chk_character_avatar CHECK (
    avatar_url IS NULL
    OR avatar_url LIKE 'https://%'
    OR (
      avatar_url LIKE 'data:image/jpeg;base64,%'
      AND length(avatar_url) <= 280000
      AND avatar_url ~ '^data:image/jpeg;base64,[A-Za-z0-9+/]+={0,2}$'
    )
  );
INSERT INTO public.schema_migrations (version, description)
VALUES ('0014', 'Allow compressed private character JPEG avatars')
ON CONFLICT (version) DO NOTHING;
