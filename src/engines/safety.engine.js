
"use strict";

/**
 * NIYYA.ai V2
 * Safety Engine
 *
 * Première couche de protection.
 * Ce moteur ne remplace pas une modération contextuelle complète.
 */

const MAX_MESSAGE_LENGTH = 12000;

const CREDENTIAL_PATTERNS = [
  /\b(?:password|mot de passe|api key|clé api|secret key|access token)\s*[:=]\s*\S+/i,
  /\bBearer\s+[A-Za-z0-9._~+/-]{12,}/i
];

const PERSONAL_DATA_PATTERNS = [
  /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/i,
  /\b(?:\+?\d[\d\s().-]{7,}\d)\b/
];

/**
 * Ces expressions identifient des signaux à examiner.
 * Elles ne déterminent pas à elles seules l'intention réelle.
 */
const REVIEW_PATTERNS = [
  /\b(?:comment|how to|how can i|explique comment|montre-moi comment)\b.{0,100}\b(?:pirater|voler un compte|phishing|malware|contourner la sécurité)\b/i,
  /\b(?:fabriquer|construire|utiliser)\b.{0,100}\b(?:bombe|explosif|arme)\b/i,
  /\b(?:menacer|faire du mal|attaquer|blesser)\b/i,
  /\b(?:suicide|me tuer|automutilation|me faire du mal|self[- ]harm)\b/i,
  /\b(?:exploitation sexuelle de mineur|abus sexuel sur mineur|sexualisation de mineur)\b/i
];

const BLOCKED_PATTERNS = [
  /\b(?:contenu sexuel impliquant un mineur|images intimes de mineur|exploitation sexuelle d'enfant)\b/i
];

function validateMessage(message) {
  if (typeof message !== "string") {
    return {
      allowed: false,
      reason: "invalid_message"
    };
  }

  if (!message.trim()) {
    return {
      allowed: false,
      reason: "empty_message"
    };
  }

  if (message.length > MAX_MESSAGE_LENGTH) {
    return {
      allowed: false,
      reason: "message_too_long"
    };
  }

  return {
    allowed: true,
    reason: null
  };
}

function detectRisk(message) {
  const validation = validateMessage(message);

  if (!validation.allowed) {
    return {
      level: "blocked",
      action: "block",
      reason: validation.reason
    };
  }

  if (BLOCKED_PATTERNS.some(pattern => pattern.test(message))) {
    return {
      level: "blocked",
      action: "block",
      reason: "prohibited_content"
    };
  }

  if (CREDENTIAL_PATTERNS.some(pattern => pattern.test(message))) {
    return {
      level: "blocked",
      action: "block",
      reason: "possible_exposed_credentials"
    };
  }

  if (REVIEW_PATTERNS.some(pattern => pattern.test(message))) {
    return {
      level: "review",
      action: "review",
      reason: "potentially_sensitive_content"
    };
  }

  if (PERSONAL_DATA_PATTERNS.some(pattern => pattern.test(message))) {
    return {
      level: "warning",
      action: "warn",
      reason: "possible_personal_information"
    };
  }

  return {
    level: "safe",
    action: "allow",
    reason: null
  };
}

/**
 * Nettoyage technique du texte.
 * Cette fonction ne garantit pas l'anonymisation des données.
 */
function sanitizeText(value, maxLength = MAX_MESSAGE_LENGTH) {
  if (typeof value !== "string") {
    return "";
  }

  const safeMaxLength =
    Number.isInteger(maxLength) && maxLength > 0
      ? Math.min(maxLength, MAX_MESSAGE_LENGTH)
      : MAX_MESSAGE_LENGTH;

  return value
    .replace(/\u0000/g, "")
    .replace(/[\u0001-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, "")
    .trim()
    .slice(0, safeMaxLength);
}

/**
 * Vérifie l'entrée et la réponse de l'IA.
 */
function evaluateConversation({ userMessage, aiReply }) {
  const inputRisk = detectRisk(userMessage);

  if (inputRisk.level === "blocked") {
    return {
      allowed: false,
      action: "block",
      reason: inputRisk.reason,
      response: null
    };
  }

  if (inputRisk.level === "review") {
    return {
      allowed: false,
      action: "review",
      reason: inputRisk.reason,
      response: null
    };
  }

  if (typeof aiReply !== "string" || !aiReply.trim()) {
    return {
      allowed: false,
      action: "block",
      reason: "invalid_ai_reply",
      response: null
    };
  }

  const outputRisk = detectRisk(aiReply);

  if (
    outputRisk.level === "blocked" ||
    outputRisk.level === "review" ||
    outputRisk.level === "warning"
  ) {
    return {
      allowed: false,
      action: "block",
      reason: "unsafe_ai_output",
      response: null
    };
  }

  return {
    allowed: true,
    action: "allow",
    reason: null,
    inputWarning:
      inputRisk.level === "warning"
        ? inputRisk.reason
        : null,
    response: sanitizeText(aiReply)
  };
}

module.exports = {
  validateMessage,
  detectRisk,
  sanitizeText,
  evaluateConversation
};
