
BEGIN;

-- =========================================================
-- NIYYA.ai V2
-- MIGRATION 0006 : DEEP MEMORY ENGINE
-- PostgreSQL 18+
-- =========================================================

-- 1. Relation indépendante utilisateur-personnage

CREATE TABLE public.character_relationships (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    user_id UUID NOT NULL
        REFERENCES public.users(id) ON DELETE CASCADE,

    character_id UUID NOT NULL
        REFERENCES public.characters(id) ON DELETE CASCADE,

    familiarity INTEGER NOT NULL DEFAULT 0
        CHECK (familiarity BETWEEN 0 AND 100),

    trust INTEGER NOT NULL DEFAULT 0
        CHECK (trust BETWEEN 0 AND 100),

    rapport INTEGER NOT NULL DEFAULT 0
        CHECK (rapport BETWEEN 0 AND 100),

    relationship_state JSONB NOT NULL DEFAULT '{}'::jsonb,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT character_relationships_user_character_unique
        UNIQUE (user_id, character_id)
);

-- 2. Mémoire propre à chaque relation

CREATE TABLE public.character_memories (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    user_id UUID NOT NULL,
    character_id UUID NOT NULL,

    memory_type VARCHAR(30) NOT NULL DEFAULT 'fact'
        CHECK (
            memory_type IN (
                'fact',
                'event',
                'preference',
                'promise',
                'milestone'
            )
        ),

    content TEXT NOT NULL
        CHECK (LENGTH(BTRIM(content)) BETWEEN 1 AND 2000),

    importance INTEGER NOT NULL DEFAULT 3
        CHECK (importance BETWEEN 1 AND 5),

    confidence NUMERIC(4,3) NOT NULL DEFAULT 1.000
        CHECK (confidence BETWEEN 0 AND 1),

    source_conversation_id UUID,

    metadata JSONB NOT NULL DEFAULT '{}'::jsonb,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT character_memories_relationship_fk
        FOREIGN KEY (user_id, character_id)
        REFERENCES public.character_relationships(user_id, character_id)
        ON DELETE CASCADE
);

-- 3. Clé composite nécessaire pour vérifier
-- l'identité exacte des conversations.

CREATE UNIQUE INDEX conversations_identity_uidx
ON public.conversations (id, user_id, character_id);

-- 4. Résumés persistants des conversations

CREATE TABLE public.conversation_summaries (
    conversation_id UUID PRIMARY KEY,

    user_id UUID NOT NULL,
    character_id UUID NOT NULL,

    summary TEXT NOT NULL DEFAULT ''
        CHECK (LENGTH(summary) <= 12000),

    messages_count INTEGER NOT NULL DEFAULT 0
        CHECK (messages_count >= 0),

    last_summarized_at TIMESTAMPTZ,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT conversation_summaries_identity_fk
        FOREIGN KEY (conversation_id, user_id, character_id)
        REFERENCES public.conversations(id, user_id, character_id)
        ON DELETE CASCADE,

    CONSTRAINT conversation_summaries_relationship_fk
        FOREIGN KEY (user_id, character_id)
        REFERENCES public.character_relationships(user_id, character_id)
        ON DELETE CASCADE
);

-- 5. Source des souvenirs.
-- Si une conversation est supprimée, le souvenir reste.
-- Seul son lien vers cette conversation est effacé.

ALTER TABLE public.character_memories
ADD CONSTRAINT character_memories_conversation_fk
FOREIGN KEY (source_conversation_id, user_id, character_id)
REFERENCES public.conversations(id, user_id, character_id)
ON DELETE SET NULL (source_conversation_id);

-- 6. Index de recherche

CREATE INDEX character_memories_lookup_idx
ON public.character_memories
(user_id, character_id, importance DESC, created_at DESC);

CREATE INDEX character_memories_type_idx
ON public.character_memories
(user_id, character_id, memory_type);

CREATE INDEX conversation_summaries_user_character_idx
ON public.conversation_summaries
(user_id, character_id);

CREATE INDEX character_relationships_character_idx
ON public.character_relationships(character_id);

-- 7. Mise à jour automatique des dates

CREATE OR REPLACE FUNCTION public.update_deep_memory_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$;

CREATE TRIGGER character_relationships_updated_at
BEFORE UPDATE ON public.character_relationships
FOR EACH ROW
EXECUTE FUNCTION public.update_deep_memory_updated_at();

CREATE TRIGGER character_memories_updated_at
BEFORE UPDATE ON public.character_memories
FOR EACH ROW
EXECUTE FUNCTION public.update_deep_memory_updated_at();

CREATE TRIGGER conversation_summaries_updated_at
BEFORE UPDATE ON public.conversation_summaries
FOR EACH ROW
EXECUTE FUNCTION public.update_deep_memory_updated_at();

-- 8. Permissions applicatives

GRANT SELECT, INSERT, UPDATE, DELETE
ON public.character_relationships TO niyya_app;

GRANT SELECT, INSERT, UPDATE, DELETE
ON public.character_memories TO niyya_app;

GRANT SELECT, INSERT, UPDATE, DELETE
ON public.conversation_summaries TO niyya_app;

-- 9. SUIVI DE MIGRATION

INSERT INTO public.schema_migrations (version, description)
SELECT '0006', 'Deep memory engine and conversation summaries'
WHERE NOT EXISTS (
    SELECT 1
    FROM public.schema_migrations
    WHERE version = '0006'
);

COMMIT;
