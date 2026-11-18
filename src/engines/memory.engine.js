
"use strict";

const { query } = require("../config/database");

const MAX_MEMORY_LENGTH = 2000;
const MAX_RESULTS = 10;

const ALLOWED_CATEGORIES = Object.freeze([
  "profil",
  "preference",
  "projet",
  "general",
  "autre"
]);

function validateUserId(userId) {
  if (typeof userId !== "string" || !userId.trim()) {
    throw new TypeError("Identifiant utilisateur invalide.");
  }
}

function validateCharacterId(characterId) {
  if (typeof characterId !== "string" || !characterId.trim()) {
    throw new TypeError("Identifiant personnage invalide.");
  }
}

function normalizeMemoryText(text) {
  if (typeof text !== "string") {
    throw new TypeError("Le souvenir doit être un texte.");
  }

  const normalized = text.trim();

  if (!normalized || normalized.length > MAX_MEMORY_LENGTH) {
    throw new RangeError("Longueur du souvenir invalide.");
  }

  return normalized;
}

function normalizeCategory(category) {
  return ALLOWED_CATEGORIES.includes(category)
    ? category
    : "general";
}

/**
 * Enregistre un souvenir utilisateur.
 *
 * Attention : cette première version utilise user_memories.
 * Cette table ne possède pas encore de character_id.
 */
async function saveUserMemory({
  userId,
  text,
  category = "general"
}) {
  validateUserId(userId);

  const factText = normalizeMemoryText(text);
  const safeCategory = normalizeCategory(category);

  const result = await query(
    `
    INSERT INTO user_memories (
      user_id,
      fact_text,
      category
    )
    VALUES ($1, $2, $3)
    RETURNING id, user_id, fact_text, category, created_at
    `,
    [userId, factText, safeCategory]
  );

  return result.rows[0];
}

/**
 * Recherche les souvenirs d'un utilisateur.
 *
 * La séparation par personnage sera ajoutée
 * avec une future structure dédiée.
 */
async function retrieveRelevantMemories({
  userId,
  characterId,
  message,
  limit = MAX_RESULTS
}) {
  validateUserId(userId);
  validateCharacterId(characterId);

  const safeLimit = Number.isInteger(limit)
    ? Math.min(Math.max(limit, 1), MAX_RESULTS)
    : MAX_RESULTS;

  const searchText =
    typeof message === "string"
      ? message.trim().slice(0, 500)
      : "";

  if (!searchText) {
    return [];
  }

  const result = await query(
    `
    SELECT
      id,
      fact_text,
      category,
      created_at
    FROM user_memories
    WHERE user_id = $1
      AND (
        fact_text ILIKE '%' || $2 || '%'
        OR category = 'profil'
        OR category = 'preference'
      )
    ORDER BY
      CASE
        WHEN fact_text ILIKE '%' || $2 || '%' THEN 0
        ELSE 1
      END,
      updated_at DESC
    LIMIT $3
    `,
    [userId, searchText, safeLimit]
  );

  return result.rows;
}

/**
 * Supprime un souvenir appartenant à l'utilisateur.
 */
async function deleteUserMemory({ userId, memoryId }) {
  validateUserId(userId);

  if (typeof memoryId !== "string" || !memoryId.trim()) {
    throw new TypeError("Identifiant du souvenir invalide.");
  }

  const result = await query(
    `
    DELETE FROM user_memories
    WHERE id = $1
      AND user_id = $2
    RETURNING id
    `,
    [memoryId, userId]
  );

  return result.rowCount > 0;
}

module.exports = {
  ALLOWED_CATEGORIES,
  saveUserMemory,
  retrieveRelevantMemories,
  deleteUserMemory
};

