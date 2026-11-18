
"use strict";

const EMOTIONS = Object.freeze([
  "joy",
  "sadness",
  "anger",
  "fear",
  "surprise",
  "curiosity",
  "calm",
  "neutral"
]);

const KEYWORDS = {
  joy: ["heureux", "content", "super", "génial", "merci", "love", "happy"],
  sadness: ["triste", "déçu", "malheureux", "pleurer", "seul", "sad"],
  anger: ["énervé", "furieux", "colère", "insupportable", "déteste"],
  fear: ["peur", "inquiet", "angoissé", "terrifié", "danger"],
  surprise: ["incroyable", "surpris", "wow", "impossible", "vraiment"],
  curiosity: ["pourquoi", "comment", "explique", "curieux", "intéressant"],
  calm: ["calme", "tranquille", "repos", "paisible"]
};

function normalizeText(text) {
  if (typeof text !== "string") return "";

  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

function detectEmotion(message) {
  const text = normalizeText(message);

  if (!text.trim()) {
    return {
      emotion: "neutral",
      confidence: 0
    };
  }

  const scores = {};

  for (const emotion of EMOTIONS) {
    scores[emotion] = 0;
  }

  for (const [emotion, words] of Object.entries(KEYWORDS)) {
    for (const word of words) {
      if (text.includes(normalizeText(word))) {
        scores[emotion] += 1;
      }
    }
  }

  const ranked = Object.entries(scores)
    .filter(([emotion]) => emotion !== "neutral")
    .sort((a, b) => b[1] - a[1]);

  const [emotion, score] = ranked[0];

  if (!score) {
    return {
      emotion: "neutral",
      confidence: 0.5
    };
  }

  const total = Object.values(scores).reduce(
    (sum, value) => sum + value,
    0
  );

  return {
    emotion,
    confidence: Math.min(score / Math.max(total, 1), 1)
  };
}

function createEmotionState(initialEmotion = "neutral") {
  const emotion = EMOTIONS.includes(initialEmotion)
    ? initialEmotion
    : "neutral";

  return {
    current: emotion,
    intensity: 0.5,
    updatedAt: new Date().toISOString()
  };
}

function updateEmotionState(state, detected) {
  const currentState = state || createEmotionState();

  const emotion = EMOTIONS.includes(detected?.emotion)
    ? detected.emotion
    : "neutral";

  const confidence = Number.isFinite(detected?.confidence)
    ? Math.max(0, Math.min(detected.confidence, 1))
    : 0;

  return {
    current: emotion,
    intensity: confidence,
    updatedAt: new Date().toISOString()
  };
}

function getResponseGuidance(emotion) {
  const guidance = {
    joy: "Adopter un ton chaleureux et positif.",
    sadness: "Répondre avec douceur et compréhension.",
    anger: "Garder un ton calme et respectueux.",
    fear: "Rassurer sans minimiser les préoccupations.",
    surprise: "Montrer de l'intérêt et réagir naturellement.",
    curiosity: "Donner des explications claires et intéressantes.",
    calm: "Conserver un ton posé et naturel.",
    neutral: "Répondre naturellement selon la personnalité du personnage."
  };

  return guidance[EMOTIONS.includes(emotion) ? emotion : "neutral"];
}

module.exports = {
  EMOTIONS,
  detectEmotion,
  createEmotionState,
  updateEmotionState,
  getResponseGuidance
};

