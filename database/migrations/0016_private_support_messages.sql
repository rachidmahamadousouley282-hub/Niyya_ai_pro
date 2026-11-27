-- NIYYA.ai V2 — 0016: private member/team support conversations.
-- Additive only: preserve all existing support tickets.
BEGIN;
CREATE TABLE IF NOT EXISTS public.support_ticket_messages (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 ticket_id uuid NOT NULL REFERENCES public.support_tickets(id) ON DELETE CASCADE,
 sender_user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
 sender_role varchar(12) NOT NULL CHECK(sender_role IN ('member','admin')),
 body text NOT NULL CHECK(btrim(body)<>'' AND length(body)<=5000),
 created_at timestamptz NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS support_ticket_messages_ticket_created_idx ON public.support_ticket_messages(ticket_id,created_at,id);
CREATE INDEX IF NOT EXISTS support_tickets_user_updated_idx ON public.support_tickets(user_id,updated_at DESC);
INSERT INTO public.schema_migrations(version,description) VALUES('0016','Private support ticket conversations') ON CONFLICT(version) DO NOTHING;
COMMIT;
