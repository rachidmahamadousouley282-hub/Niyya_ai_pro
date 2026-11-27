-- NIYYA.ai V2 — 0018: privacy-conscious first-party page-view analytics.
-- Only a hash of a random browser identifier is stored; no IP or user-agent.
BEGIN;
CREATE TABLE IF NOT EXISTS public.site_analytics_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  visitor_key_hash char(64) NOT NULL CHECK (visitor_key_hash ~ '^[a-f0-9]{64}$'),
  page_path varchar(140) NOT NULL CHECK (page_path ~ '^/[a-zA-Z0-9/_-]*(#[a-zA-Z0-9_-]{1,40})?$'),
  occurred_at timestamptz NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS site_analytics_events_occurred_idx ON public.site_analytics_events (occurred_at DESC);
CREATE INDEX IF NOT EXISTS site_analytics_events_visitor_occurred_idx ON public.site_analytics_events (visitor_key_hash, occurred_at DESC);
INSERT INTO public.schema_migrations(version, description) VALUES ('0018', 'First-party privacy-conscious site visit analytics') ON CONFLICT (version) DO NOTHING;
COMMIT;
