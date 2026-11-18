
"use strict";

const { query, pool } = require("../config/database");

const MAX_MEMORY_LENGTH = 2000;
const MAX_SUMMARY_LENGTH = 12000;
const MAX_RESULTS = 10;

const ALLOWED_CATEGORIES = Object.freeze([
    "profil",
    "preference",
    "projet",
    "general",
    "autre"
]);

const ALLOWED_MEMORY_TYPES = Object.freeze([
    "fact",
    "event",
    "preference",
    "promise",
    "milestone"
]);

// =====================================================
// VALIDATION
// =====================================================

function validateUUID(value, fieldName) {
    const uuidPattern =
        /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

    if (typeof value !== "string" || !uuidPattern.test(value)) {
        throw new TypeError(`${fieldName} must be a valid UUID.`);
    }
}

function normalizeMemoryText(text) {
    if (typeof text !== "string") {
        throw new TypeError("Memory text must be a string.");
    }

    const normalized = text.trim();

    if (!normalized || normalized.length > MAX_MEMORY_LENGTH) {
        throw new RangeError("Invalid memory length.");
    }

    return normalized;
}

function normalizeCategory(category) {
    return ALLOWED_CATEGORIES.includes(category)
        ? category
        : "general";
}

function normalizeMemoryType(memoryType) {
    if (!ALLOWED_MEMORY_TYPES.includes(memoryType)) {
        throw new TypeError("Invalid character memory type.");
    }

    return memoryType;
}

function normalizeLimit(limit) {
    const value = Number.isInteger(limit) ? limit : MAX_RESULTS;

    return Math.max(1, Math.min(value, MAX_RESULTS));
}

function normalizeMetadata(metadata = {}) {
    if (
        !metadata ||
        typeof metadata !== "object" ||
        Array.isArray(metadata)
    ) {
        throw new TypeError("Metadata must be an object.");
    }

    const serialized = JSON.stringify(metadata);

    if (serialized.length > 5000) {
        throw new RangeError("Metadata is too large.");
    }

    return serialized;
}

function normalizeConfidence(confidence = 1) {
    const value = Number(confidence);

    if (!Number.isFinite(value) || value < 0 || value > 1) {
        throw new RangeError("Confidence must be between 0 and 1.");
    }

    return value;
}

function normalizeImportance(importance = 3) {
    if (
        !Number.isInteger(importance) ||
        importance < 1 ||
        importance > 5
    ) {
        throw new RangeError("Importance must be between 1 and 5.");
    }

    return importance;
}

function normalizeDelta(value, fieldName) {
    const number = Number(value);

    if (!Number.isFinite(number) || number < -100 || number > 100) {
        throw new RangeError(`${fieldName} must be between -100 and 100.`);
    }

    return number;
}

// =====================================================
// TRANSACTION HELPER
// =====================================================

async function withTransaction(callback) {
    const client = await pool.connect();

    try {
        await client.query("BEGIN");

        const result = await callback(client);

        await client.query("COMMIT");

        return result;
    } catch (error) {
        await client.query("ROLLBACK");
        throw error;
    } finally {
        client.release();
    }
}

// =====================================================
// RELATIONSHIP ENGINE
// =====================================================

async function ensureRelationship(db, userId, characterId) {
    const result = await db.query(
        `
        INSERT INTO public.character_relationships (
            user_id,
            character_id
        )
        VALUES ($1, $2)
        ON CONFLICT (user_id, character_id)
        DO NOTHING
        RETURNING id
        `,
        [userId, characterId]
    );

    return result.rows[0] || null;
}

async function getRelationship({ userId, characterId }) {
    validateUUID(userId, "userId");
    validateUUID(characterId, "characterId");

    const result = await query(
        `
        SELECT
            id,
            user_id,
            character_id,
            familiarity,
            trust,
            rapport,
            relationship_state,
            created_at,
            updated_at
        FROM public.character_relationships
        WHERE user_id = $1
          AND character_id = $2
        LIMIT 1
        `,
        [userId, characterId]
    );

    return result.rows[0] || null;
}

async function updateRelationship({
    userId,
    characterId,
    familiarityDelta = 0,
    trustDelta = 0,
    rapportDelta = 0,
    statePatch = {}
}) {
    validateUUID(userId, "userId");
    validateUUID(characterId, "characterId");

    const familiarity = normalizeDelta(
        familiarityDelta,
        "familiarityDelta"
    );

    const trust = normalizeDelta(trustDelta, "trustDelta");

    const rapport = normalizeDelta(
        rapportDelta,
        "rapportDelta"
    );

    const state = normalizeMetadata(statePatch);

    return withTransaction(async (client) => {
        await ensureRelationship(client, userId, characterId);

        const result = await client.query(
            `
            UPDATE public.character_relationships
            SET
                familiarity = GREATEST(
                    0,
                    LEAST(100, familiarity + $3)
                ),
                trust = GREATEST(
                    0,
                    LEAST(100, trust + $4)
                ),
                rapport = GREATEST(
                    0,
                    LEAST(100, rapport + $5)
                ),
                relationship_state =
                    relationship_state || $6::jsonb
            WHERE user_id = $1
              AND character_id = $2
            RETURNING *
            `,
            [
                userId,
                characterId,
                familiarity,
                trust,
                rapport,
                state
            ]
        );

        return result.rows[0];
    });
}

// =====================================================
// PERSONAL USER MEMORY
// =====================================================

async function saveUserMemory({
    userId,
    text,
    category = "general"
}) {
    validateUUID(userId, "userId");

    const factText = normalizeMemoryText(text);
    const normalizedCategory = normalizeCategory(category);

    const result = await query(
        `
        INSERT INTO public.user_memories (
            user_id,
            fact_text,
            category
        )
        VALUES ($1, $2, $3)
        RETURNING
            id,
            user_id,
            fact_text,
            category,
            created_at
        `,
        [userId, factText, normalizedCategory]
    );

    return result.rows[0];
}

async function deleteUserMemory({ userId, memoryId }) {
    validateUUID(userId, "userId");
    validateUUID(memoryId, "memoryId");

    const result = await query(
        `
        DELETE FROM public.user_memories
        WHERE id = $1
          AND user_id = $2
        RETURNING id
        `,
        [memoryId, userId]
    );

    return result.rowCount > 0;
}

// =====================================================
// CHARACTER MEMORY
// =====================================================

async function saveCharacterMemory({
    userId,
    characterId,
    memoryType = "fact",
    content,
    importance = 3,
    confidence = 1,
    sourceConversationId = null,
    metadata = {}
}) {
    validateUUID(userId, "userId");
    validateUUID(characterId, "characterId");

    if (sourceConversationId !== null) {
        validateUUID(sourceConversationId, "sourceConversationId");
    }

    const normalizedContent = normalizeMemoryText(content);
    const normalizedType = normalizeMemoryType(memoryType);
    const normalizedImportance = normalizeImportance(importance);
    const normalizedConfidence = normalizeConfidence(confidence);
    const normalizedMetadata = normalizeMetadata(metadata);

    return withTransaction(async (client) => {
        await ensureRelationship(client, userId, characterId);

        const result = await client.query(
            `
            INSERT INTO public.character_memories (
                user_id,
                character_id,
                memory_type,
                content,
                importance,
                confidence,
                source_conversation_id,
                metadata
            )
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8::jsonb)
            RETURNING *
            `,
            [
                userId,
                characterId,
                normalizedType,
                normalizedContent,
                normalizedImportance,
                normalizedConfidence,
                sourceConversationId,
                normalizedMetadata
            ]
        );

        return result.rows[0];
    });
}

async function retrieveCharacterMemories({
    userId,
    characterId,
    message = "",
    limit = MAX_RESULTS
}) {
    validateUUID(userId, "userId");
    validateUUID(characterId, "characterId");

    const normalizedLimit = normalizeLimit(limit);

    const tokens = typeof message === "string"
        ? message
            .toLowerCase()
            .match(/[\p{L}\p{N}]{3,}/gu) || []
        : [];

    const patterns = [
        ...new Set(tokens.slice(0, 8).map(token => `%${token}%`))
    ];

    const result = await query(
        `
        SELECT
            id,
            user_id,
            character_id,
            memory_type,
            content,
            content AS fact_text,
            importance,
            confidence,
            source_conversation_id,
            metadata,
            created_at,
            updated_at
        FROM public.character_memories
        WHERE user_id = $1
          AND character_id = $2
        ORDER BY
            CASE
                WHEN cardinality($3::text[]) > 0
                 AND content ILIKE ANY($3::text[])
                THEN 0
                ELSE 1
            END,
            importance DESC,
            updated_at DESC
        LIMIT $4
        `,
        [userId, characterId, patterns, normalizedLimit]
    );

    return result.rows;
}

async function deleteCharacterMemory({
    userId,
    characterId,
    memoryId
}) {
    validateUUID(userId, "userId");
    validateUUID(characterId, "characterId");
    validateUUID(memoryId, "memoryId");

    const result = await query(
        `
        DELETE FROM public.character_memories
        WHERE id = $1
          AND user_id = $2
          AND character_id = $3
        RETURNING id
        `,
        [memoryId, userId, characterId]
    );

    return result.rowCount > 0;
}

// =====================================================
// CONVERSATION SUMMARIES
// =====================================================

async function saveConversationSummary({
    userId,
    characterId,
    conversationId,
    summary,
    messagesCount = 0
}) {
    validateUUID(userId, "userId");
    validateUUID(characterId, "characterId");
    validateUUID(conversationId, "conversationId");

    if (typeof summary !== "string") {
        throw new TypeError("Summary must be a string.");
    }

    const normalizedSummary = summary.trim();

    if (normalizedSummary.length > MAX_SUMMARY_LENGTH) {
        throw new RangeError("Summary is too long.");
    }

    if (
        !Number.isInteger(messagesCount) ||
        messagesCount < 0
    ) {
        throw new RangeError("Invalid messagesCount.");
    }

    return withTransaction(async (client) => {
        await ensureRelationship(client, userId, characterId);

        const result = await client.query(
            `
            INSERT INTO public.conversation_summaries (
                conversation_id,
                user_id,
                character_id,
                summary,
                messages_count,
                last_summarized_at
            )
            VALUES ($1, $2, $3, $4, $5, NOW())
            ON CONFLICT (conversation_id)
            DO UPDATE SET
                summary = EXCLUDED.summary,
                messages_count = EXCLUDED.messages_count,
                last_summarized_at = NOW()
            WHERE
                conversation_summaries.user_id = EXCLUDED.user_id
                AND conversation_summaries.character_id =
                    EXCLUDED.character_id
            RETURNING *
            `,
            [
                conversationId,
                userId,
                characterId,
                normalizedSummary,
                messagesCount
            ]
        );

        if (!result.rows[0]) {
            throw new Error("Conversation summary ownership mismatch.");
        }

        return result.rows[0];
    });
}

async function getConversationSummary({
    userId,
    characterId,
    conversationId
}) {
    validateUUID(userId, "userId");
    validateUUID(characterId, "characterId");
    validateUUID(conversationId, "conversationId");

    const result = await query(
        `
        SELECT *
        FROM public.conversation_summaries
        WHERE conversation_id = $1
          AND user_id = $2
          AND character_id = $3
        LIMIT 1
        `,
        [conversationId, userId, characterId]
    );

    return result.rows[0] || null;
}

// =====================================================
// UNIFIED MEMORY RETRIEVAL
// Compatible with conversation.engine.js
// =====================================================

async function retrieveRelevantMemories({
    userId,
    characterId,
    message,
    limit = MAX_RESULTS
}) {
    validateUUID(userId, "userId");
    validateUUID(characterId, "characterId");

    const normalizedLimit = normalizeLimit(limit);

    const searchText = typeof message === "string"
        ? message.trim().slice(0, 500)
        : "";

    if (!searchText) {
        return [];
    }

    const [personalResult, characterMemories] = await Promise.all([
        query(
            `
            SELECT
                id,
                fact_text,
                category,
                created_at,
                updated_at
            FROM public.user_memories
            WHERE user_id = $1
              AND (
                  fact_text ILIKE '%' || $2 || '%'
                  OR category IN ('profil', 'preference')
              )
            ORDER BY
                CASE
                    WHEN fact_text ILIKE '%' || $2 || '%'
                    THEN 0
                    ELSE 1
                END,
                updated_at DESC
            LIMIT $3
            `,
            [userId, searchText, normalizedLimit]
        ),

        retrieveCharacterMemories({
            userId,
            characterId,
            message: searchText,
            limit: normalizedLimit
        })
    ]);

    const personalMemories = personalResult.rows.map(memory => ({
        ...memory,
        scope: "personal",
        memory_type: memory.category,
        importance: 3
    }));

    const narrativeMemories = characterMemories.map(memory => ({
        ...memory,
        scope: "character",
        category: memory.memory_type
    }));

    return [...personalMemories, ...narrativeMemories]
        .sort((a, b) => {
            if (b.importance !== a.importance) {
                return b.importance - a.importance;
            }

            return new Date(b.updated_at || b.created_at) -
                new Date(a.updated_at || a.created_at);
        })
        .slice(0, normalizedLimit);
}

// =====================================================
// EXPORTS
// =====================================================

module.exports = {
    ALLOWED_CATEGORIES,
    ALLOWED_MEMORY_TYPES,

    saveUserMemory,
    retrieveRelevantMemories,
    deleteUserMemory,

    ensureRelationship,
    getRelationship,
    updateRelationship,

    saveCharacterMemory,
    retrieveCharacterMemories,
    deleteCharacterMemory,

    saveConversationSummary,
    getConversationSummary
};
