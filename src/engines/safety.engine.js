
"use strict";

const MAX_MESSAGE_LENGTH = 12000;

const BLOCKED_PATTERNS = [
  /\b(?:steal|hack|phishing|malware)\b/i,
  /\b(?:voler|pirater|arnaquer|phishing)\b/i
];

const PERSONAL_DATA_PATTERNS = [
  /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/i,
  /\b(?:password|mot de passe|api key|clé api)\s*[:=]\s*\S+/i
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
      reason: validation.reason
    };
  }

  if (PERSONAL_DATA_PATTERNS.some(pattern => pattern.test(message))) {
    return {
      level: "warning",
      reason: "possible_sensitive_information"
    };
  }

  if (BLOCKED_PATTERNS.some(pattern => pattern.test(message))) {
    return {
      level: "review",
      reason: "potentially_unsafe_content"
    };
  }

  return {
    level: "safe",
    reason: null
  };
}

function sanitizeText(value, maxLength = MAX_MESSAGE_LENGTH) {
  if (typeof value !== "string") {
    return "";
  }

  return value
    .replace(/\u0000/g, "")
    .trim()
    .slice(0, maxLength);
}

function evaluateConversation({ userMessage, aiReply }) {
  const inputRisk = detectRisk(userMessage);

  if (inputRisk.level === "blocked") {
    return {
      allowed: false,
      reason: inputRisk.reason,
      response: null
    };
  }

  if (typeof aiReply !== "string" || !aiReply.trim()) {
    return {
      allowed: false,
      reason: "invalid_ai_reply",
      response: null
    };
  }

  return {
    allowed: true,
    reason: null,
    response: sanitizeText(aiReply)
  };
}

module.exports = {
  validateMessage,
  detectRisk,
  sanitizeText,
  evaluateConversation
};

