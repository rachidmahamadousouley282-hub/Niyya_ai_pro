"use strict";

const express = require("express");
const crypto = require("crypto");
const { pool, query } = require("../config/database");
const { requireAuth } = require("../middleware/auth.middleware");
const { processMessage } = require("../engines/conversation.engine");
const safetyEngine = require("../engines/safety.engine");
const quotaService = require("../services/quota.service");
const characterEngine = require("../engines/character.engine");
const memoryEngine = require("../engines/memory.engine");

const router = express.Router();
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function validUUID(value) {
  return typeof value === "string" && UUID_REGEX.test(value);
}

function requireSameOrigin(req, res, next) {
  const origin = req.get("origin");
  const host = req.get("host");
  const fetchSite = req.get("sec-fetch-site");

  if (fetchSite && fetchSite !== "same-origin" && fetchSite !== "none") {
    return res.status(403).json({ error: "Requête inter-origine refusée." });
  }
  if (!origin || !host) {
    return res.status(403).json({ error: "Origine de requête non vérifiée." });
  }

  try {
    const parsed = new URL(origin);
    if (parsed.host !== host || (process.env.NODE_ENV === "production" && parsed.protocol !== "https:")) {
      return res.status(403).json({ error: "Origine de requête non autorisée." });
    }
  } catch {
    return res.status(403).json({ error: "Origine de requête invalide." });
  }
  return next();
}

function isMissingQuotaMigration(error) {
  return error && (
    error.code === "42883" ||
    (error.code === "42P01" && /message_quota_consumptions/i.test(error.message || ""))
  );
}

router.get("/conversations", requireAuth, async (req, res) => {
  try {
    const result = await query(
      `SELECT c.id, c.title, c.character_id, c.created_at, c.updated_at,
              ch.name AS character_name, ch.avatar_url AS character_avatar
       FROM public.conversations c
       LEFT JOIN public.characters ch ON ch.id = c.character_id
       WHERE c.user_id = $1
       ORDER BY c.updated_at DESC
       LIMIT 100`,
      [req.user.id]
    );
    return res.status(200).json({ success: true, conversations: result.rows });
  } catch (error) {
    console.error("Erreur de liste des conversations :", error.message);
    return res.status(500).json({ error: "Impossible de charger les conversations." });
  }
});

router.post("/conversations", requireAuth, requireSameOrigin, async (req, res) => {
  const characterId = req.body && req.body.characterId;
  if (!validUUID(characterId)) {
    return res.status(400).json({ error: "Identifiant de personnage invalide." });
  }

  try {
    const character = await characterEngine.getCharacterForConversation({
      characterId,
      userId: req.user.id
    });
    if (!character) {
      return res.status(404).json({ error: "Personnage introuvable ou inaccessible." });
    }

    const result = await query(
      `INSERT INTO public.conversations (user_id, character_id, title)
       VALUES ($1, $2, $3)
       RETURNING id, title, character_id, created_at, updated_at`,
      [req.user.id, characterId, character.name.slice(0, 120)]
    );
    return res.status(201).json({ success: true, conversation: result.rows[0] });
  } catch (error) {
    console.error("Erreur de création de conversation :", error.message);
    return res.status(500).json({ error: "Impossible de créer la conversation." });
  }
});

router.get("/:conversationId/messages", requireAuth, async (req, res) => {
  const { conversationId } = req.params;
  if (!validUUID(conversationId)) {
    return res.status(400).json({ error: "Identifiant de conversation invalide." });
  }

  try {
    const owner = await query(
      "SELECT id FROM public.conversations WHERE id = $1 AND user_id = $2 LIMIT 1",
      [conversationId, req.user.id]
    );
    if (!owner.rows.length) {
      return res.status(404).json({ error: "Conversation introuvable." });
    }

    const result = await query(
      `SELECT id, role, content, created_at
       FROM public.messages
       WHERE conversation_id = $1 AND role IN ('user', 'assistant')
       ORDER BY created_at ASC, id ASC
       LIMIT 500`,
      [conversationId]
    );
    return res.status(200).json({ success: true, messages: result.rows });
  } catch (error) {
    console.error("Erreur de chargement des messages :", error.message);
    return res.status(500).json({ error: "Impossible de charger les messages." });
  }
});

router.post("/:conversationId/messages", requireAuth, requireSameOrigin, async (req, res) => {
  const { conversationId } = req.params;
  const message = req.body && req.body.message;
  const requestedLanguage = req.body && req.body.language;
  const supportedLanguages = ["fr", "en", "es", "ar", "de", "pt"];
  const responseLanguage = supportedLanguages.includes(requestedLanguage)
    ? requestedLanguage
    : "fr";

  if (!validUUID(conversationId)) {
    return res.status(400).json({ error: "Identifiant de conversation invalide." });
  }
  const validation = safetyEngine.validateMessage(message);
  if (!validation.allowed) {
    return res.status(400).json({ error: "Message invalide ou trop long." });
  }

  const risk = safetyEngine.detectRisk(message);
  if (risk.action === "block" || risk.action === "review") {
    return res.status(400).json({
      error: "Ce message ne peut pas être traité. Reformule-le de manière sûre.",
      code: risk.reason
    });
  }

  let requestId = null;
  let quotaConsumed = false;

  try {
    const conversationResult = await query(
      `SELECT c.id, c.character_id
       FROM public.conversations c
       WHERE c.id = $1 AND c.user_id = $2
       LIMIT 1`,
      [conversationId, req.user.id]
    );
    if (!conversationResult.rows.length || !conversationResult.rows[0].character_id) {
      return res.status(404).json({ error: "Conversation introuvable." });
    }

    const characterId = conversationResult.rows[0].character_id;
    const historyResult = await query(
      `SELECT role, content FROM public.messages
       WHERE conversation_id = $1 AND role IN ('user', 'assistant')
       ORDER BY created_at DESC, id DESC LIMIT 30`,
      [conversationId]
    );
    const history = historyResult.rows.reverse();

    requestId = crypto.randomUUID();
    const quota = await quotaService.consumeMessage(req.user.id, requestId);
    if (!quota.allowed) {
      return res.status(429).json({
        error: quota.reason === "not_onboarded"
          ? "Termine ton inscription avant de discuter."
          : "Ton quota de messages est épuisé.",
        code: quota.reason,
        remaining: quota.remaining
      });
    }
    quotaConsumed = true;

    const generated = await processMessage({
      userId: req.user.id,
      characterId,
      message: message.trim(),
      history,
      language: responseLanguage
    });
    const safety = safetyEngine.evaluateConversation({
      userMessage: message,
      aiReply: generated.reply
    });
    if (!safety.allowed) {
      throw new Error("La réponse générée n'a pas passé le contrôle de sécurité.");
    }

    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      const ownership = await client.query(
        "SELECT id FROM public.conversations WHERE id = $1 AND user_id = $2 FOR UPDATE",
        [conversationId, req.user.id]
      );
      if (!ownership.rows.length) throw new Error("Conversation ownership changed.");

      await client.query(
        "INSERT INTO public.messages (conversation_id, role, content) VALUES ($1, 'user', $2), ($1, 'assistant', $3)",
        [conversationId, message.trim(), safety.response]
      );
      await client.query(
        "UPDATE public.conversations SET updated_at = NOW() WHERE id = $1 AND user_id = $2",
        [conversationId, req.user.id]
      );
      await client.query("COMMIT");
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }

    try {
      await memoryEngine.updateRelationship({
        userId: req.user.id,
        characterId,
        familiarityDelta: 1,
        rapportDelta: 1
      });
    } catch (relationshipError) {
      console.warn("Mise à jour relationnelle différée :", relationshipError.message);
    }

    return res.status(200).json({
      success: true,
      conversationId,
      userMessage: message.trim(),
      reply: safety.response,
      remaining: quota.remaining,
      tier: quota.tier,
      provider: generated.provider,
      model: generated.model
    });
  } catch (error) {
    if (quotaConsumed && requestId) {
      try {
        await quotaService.refundMessage(req.user.id, requestId);
      } catch (refundError) {
        console.error("Échec du remboursement de quota :", refundError.message);
      }
    }
    if (isMissingQuotaMigration(error)) {
      return res.status(503).json({
        error: "Le système de quota V2 n'est pas encore activé sur cette base.",
        code: "quota_migration_required"
      });
    }
    console.error("Erreur d'envoi du message :", error.message);
    return res.status(500).json({ error: "Impossible de traiter ce message pour le moment." });
  }
});

module.exports = router;
