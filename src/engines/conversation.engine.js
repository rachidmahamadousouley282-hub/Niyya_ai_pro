
"use strict";

const { generateReply } = require("../services/ai.service");
const { query } = require("../config/database");

const characterEngine = require("./character.engine");
const emotionEngine = require("./emotion.engine");
const memoryEngine = require("./memory.engine");
const safetyEngine = require("./safety.engine");

const MAX_HISTORY = 30;
const MAX_MESSAGE_LENGTH = 12000;

function validateInput({ userId, characterId, message }) {
  if (typeof userId !== "string" || !userId.trim()) {
    throw new TypeError("Utilisateur invalide.");
  }

  if (typeof characterId !== "string" || !characterId.trim()) {
    throw new TypeError("Personnage invalide.");
  }

  if (typeof message !== "string" || !message.trim()) {
    throw new TypeError("Le message est obligatoire.");
  }

  if (message.length > MAX_MESSAGE_LENGTH) {
    throw new RangeError("Le message est trop long.");
  }
}

/**
 * The current onboarding records a self-declared age band only.
 * Until a trusted age-assurance flow exists, a self-declared 18+ value
 * must not unlock the adult conversation profile.
 */
function resolveConversationAgeBand(account = {}) {
  if (account.age_band === "13_15" || account.age_band === "16_17") {
    return account.age_band;
  }
  return "unknown";
}

function normalizeHistory(history = []) {
  if (!Array.isArray(history)) {
    return [];
  }

  return history
    .filter(
      item =>
        item &&
        ["user", "assistant"].includes(item.role) &&
        typeof item.content === "string"
    )
    .slice(-MAX_HISTORY)
    .map(item => ({
      role: item.role,
      content: item.content.slice(0, MAX_MESSAGE_LENGTH)
    }));
}

async function processMessage({
  userId,
  characterId,
  message,
  history = [],
  language = "fr"
}) {
  validateInput({ userId, characterId, message });

  const character = await characterEngine.getCharacterForConversation({
    characterId,
    userId
  });

  if (!character) {
    throw new Error("Personnage introuvable ou inaccessible.");
  }

  const accountResult = await query(
    "SELECT age_band, adult_confirmed_at FROM public.users WHERE id = $1 LIMIT 1",
    [userId]
  );
  const account = accountResult.rows[0] || {};
  const ageBand = resolveConversationAgeBand(account);

  if (ageBand !== "18_plus") {
    const relationshipIntent = safetyEngine.detectMinorRelationshipIntent(message);
    if (relationshipIntent) {
      return {
        reply: safetyEngine.getMinorBoundaryResponse(relationshipIntent.kind, language),
        characterId: character.id,
        emotion: "neutral",
        provider: "niyya-safety",
        model: "age-appropriate-boundary",
        usage: { prompt_tokens: 0, completion_tokens: 0, total_tokens: 0 }
      };
    }
  }

  const safeHistory = normalizeHistory(history);

  const detectedEmotion = emotionEngine.detectEmotion(message);

  const emotionGuidance = emotionEngine.getResponseGuidance(
    detectedEmotion.emotion
  );

  let memories = [];

  if (typeof memoryEngine.retrieveRelevantMemories === "function") {
    try {
      memories = await memoryEngine.retrieveRelevantMemories({
        userId,
        characterId,
        message
      });
    } catch (error) {
      // La mémoire profonde est facultative tant que la migration 0006
      // n'est pas appliquée sur la branche V2.
      if (error && error.code === "42P01") {
        console.warn("Mémoire profonde indisponible : migration 0006 requise.");
        memories = [];
      } else {
        throw error;
      }
    }
  }

  const memoryContext = Array.isArray(memories)
    ? memories
        .slice(0, 5)
        .map(memory => memory.fact_text)
        .filter(text => typeof text === "string")
        .join("\n")
        .slice(0, 1200)
    : "";

  const enrichedCharacter = {
    ...character,
    personality_prompt: [
      character.personality_prompt,
      `État émotionnel du message : ${detectedEmotion.emotion}.`,
      emotionGuidance,
      memoryContext
        ? `Souvenirs pertinents à prendre en compte :\n${memoryContext}`
        : ""
    ]
      .filter(Boolean)
      .join("\n\n")
  };

  const reply = await generateReply({
    character: enrichedCharacter,
    history: [
      ...safeHistory,
      {
        role: "user",
        content: message.trim()
      }
    ],
    language,
    ageBand
  });

  if (!reply || typeof reply.reply !== "string" || !reply.reply.trim()) {
    throw new Error("Le moteur IA n'a pas généré de réponse valide.");
  }

  const generatedRelationshipIntent = safetyEngine.detectMinorRelationshipIntent(reply.reply);
  const finalReply = ageBand !== "18_plus" &&
    (generatedRelationshipIntent || safetyEngine.hasInappropriateMinorReply(reply.reply))
    ? safetyEngine.getMinorBoundaryResponse(generatedRelationshipIntent ? generatedRelationshipIntent.kind : "romantic", language)
    : reply.reply;

  return {
    reply: finalReply,
    characterId: character.id,
    emotion: detectedEmotion.emotion,
    provider: reply.provider,
    model: reply.model,
    usage: reply.usage || null
  };
}

module.exports = {
  processMessage,
  normalizeHistory,
  resolveConversationAgeBand
};
