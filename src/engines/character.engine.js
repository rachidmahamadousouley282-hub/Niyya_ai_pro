
"use strict";

const { query } = require("../config/database");

function validateUserId(userId) {
  if (typeof userId !== "string" || !userId.trim()) {
    throw new TypeError("Un identifiant utilisateur est requis.");
  }
}

function validateCharacterId(characterId) {
  if (typeof characterId !== "string" || !characterId.trim()) {
    throw new TypeError("Un identifiant de personnage est requis.");
  }
}

function normalizePagination(limit = 20, offset = 0) {
  const safeLimit = Number.isInteger(limit)
    ? Math.min(Math.max(limit, 1), 50)
    : 20;

  const safeOffset = Number.isInteger(offset)
    ? Math.max(offset, 0)
    : 0;

  return { limit: safeLimit, offset: safeOffset };
}

/**
 * Liste les personnages système et les personnages
 * publics approuvés.
 *
 * Ne retourne jamais les prompts privés.
 */
async function listDiscoverableCharacters({
  limit = 20,
  offset = 0
} = {}) {
  const pagination = normalizePagination(limit, offset);

  const result = await query(
    `
    SELECT *
    FROM (
      SELECT
        c.id, c.slug, c.name, c.tagline, c.avatar_url,
        c.short_bio, c.backstory, c.profile_i18n, c.personality_traits,
        c.greeting, c.category, c.tags,
        'NIYYA.ai'::varchar AS creator_pseudonym,
        c.published_at, c.created_at
      FROM public.characters c
      WHERE c.is_system = TRUE
        AND c.status = 'active'

      UNION ALL

      SELECT
        c.id, c.slug, c.name, c.tagline,
        CASE WHEN c.avatar_status = 'approved' THEN c.avatar_url ELSE NULL END AS avatar_url,
        c.short_bio, c.backstory, c.personality_traits,
        c.greeting, c.category, c.tags,
        u.pseudonym AS creator_pseudonym,
        c.published_at, c.created_at
      FROM public.characters c
      JOIN public.users u ON u.id = c.owner_user_id
      WHERE c.visibility = 'public'
        AND c.publication_status = 'approved'
        AND c.status = 'active'
        AND u.pseudonym IS NOT NULL
    ) AS discoverable
    ORDER BY published_at DESC NULLS LAST, name ASC
    LIMIT $1 OFFSET $2
    `,
    [pagination.limit, pagination.offset]
  );

  return result.rows;
}

/**
 * Charge un personnage utilisable dans une conversation.
 *
 * Autorise :
 * - les personnages système actifs ;
 * - les personnages publics approuvés et actifs ;
 * - les personnages appartenant à l'utilisateur.
 *
 * Cette fonction retourne des données internes.
 * Ne pas envoyer directement son résultat au navigateur.
 */
async function getCharacterForConversation({
  characterId,
  userId
}) {
  validateCharacterId(characterId);
  validateUserId(userId);

  const result = await query(
    `
    SELECT
      c.id,
      c.owner_user_id,
      c.is_system,
      c.slug,
      c.name,
      c.tagline,
      c.personality_prompt,
      c.scenario,
      c.avatar_url,
      c.status,
      c.visibility,
      c.publication_status,
      c.published_at,
      c.avatar_status,
      c.short_bio,
      c.backstory,
      c.profile_i18n,
      c.personality_traits,
      c.greeting,
      c.category,
      c.tags,
      CASE WHEN c.is_system THEN 'NIYYA.ai'::varchar ELSE u.pseudonym END AS creator_pseudonym,
      c.created_at
    FROM public.characters c
    LEFT JOIN public.users u ON u.id = c.owner_user_id
    WHERE c.id = $1
      AND c.status = 'active'
      AND (
        is_system = TRUE
        OR (
          visibility = 'public'
          AND publication_status = 'approved'
        )
        OR owner_user_id = $2
      )
    LIMIT 1
    `,
    [characterId, userId]
  );

  return result.rows[0] || null;
}

/**
 * Charge un personnage appartenant exclusivement
 * à l'utilisateur connecté.
 */
async function getCharacterForOwner({
  characterId,
  userId
}) {
  validateCharacterId(characterId);
  validateUserId(userId);

  const result = await query(
    `
    SELECT
      id,
      owner_user_id,
      name,
      tagline,
      personality_prompt,
      scenario,
      avatar_url,
      status,
      visibility,
      publication_status,
      avatar_status,
      created_at,
      updated_at
    FROM characters
    WHERE id = $1
      AND owner_user_id = $2
      AND is_system = FALSE
    LIMIT 1
    `,
    [characterId, userId]
  );

  return result.rows[0] || null;
}

module.exports = {
  listDiscoverableCharacters,
  getCharacterForConversation,
  getCharacterForOwner
};

