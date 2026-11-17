

"use strict";

/**
 * NIYYA AI V2
 * Moteur multi-fournisseurs.
 *
 * Les clés API restent exclusivement côté serveur.
 * Les fournisseurs peuvent être remplacés sans modifier
 * les routes ni le reste de l'application.
 */

const PROVIDERS = {
  openai: {
    name: "OpenAI",
    endpoint: "https://api.openai.com/v1/chat/completions",
    model: process.env.OPENAI_MODEL || "gpt-4o-mini",
    apiKey: process.env.OPENAI_API_KEY
  },

  gemini: {
    name: "Google Gemini",
    endpoint: process.env.GEMINI_API_URL || "",
    model: process.env.GEMINI_MODEL || "",
    apiKey: process.env.GEMINI_API_KEY
  },

  anthropic: {
    name: "Anthropic",
    endpoint: "https://api.anthropic.com/v1/messages",
    model: process.env.ANTHROPIC_MODEL || "",
    apiKey: process.env.ANTHROPIC_API_KEY
  }
};

function getActiveProvider() {
  const providerName = (
    process.env.AI_PROVIDER || "openai"
  ).toLowerCase();

  const provider = PROVIDERS[providerName];

  if (!provider) {
    throw new Error("Fournisseur IA non reconnu.");
  }

  if (!provider.apiKey) {
    throw new Error(
      `La clé API du fournisseur ${providerName} est manquante.`
    );
  }

  return { providerName, provider };
}

function buildSystemPrompt(character) {
  const name = character.name || "Personnage";
  const personality = character.personality || "";
  const description = character.description || "";
  const background = character.background || "";
  const speakingStyle = character.speaking_style || "";

  return `
Tu es ${name}, un personnage fictif de NIYYA AI.

PERSONNALITÉ :
${personality}

DESCRIPTION :
${description}

HISTOIRE :
${background}

STYLE DE DIALOGUE :
${speakingStyle}

RÈGLES :
- Reste cohérent avec ton identité et ton histoire.
- Ne change pas arbitrairement de personnalité.
- Réponds naturellement et de manière immersive.
- Tiens compte du contexte de la conversation.
- Ne prétends pas être une personne réelle.
- Respecte les règles de sécurité et les limites d'âge.
- N'invente pas de souvenirs qui ne figurent pas dans le contexte.
- Réponds dans la langue demandée par l'utilisateur.
`.trim();
}

function normalizeHistory(history = []) {
  if (!Array.isArray(history)) {
    throw new Error("Historique de conversation invalide.");
  }

  return history
    .filter(message =>
      message &&
      ["user", "assistant"].includes(message.role) &&
      typeof message.content === "string"
    )
    .slice(-30)
    .map(message => ({
      role: message.role,
      content: message.content.slice(0, 12000)
    }));
}

async function generateWithOpenAI(provider, systemPrompt, history) {
  const response = await fetch(provider.endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${provider.apiKey}`
    },
    body: JSON.stringify({
      model: provider.model,
      messages: [
        { role: "system", content: systemPrompt },
        ...history
      ],
      temperature: 0.8,
      max_tokens: 700
    }),
    signal: AbortSignal.timeout(45000)
  });

  if (!response.ok) {
    throw new Error(`Erreur du fournisseur IA (${response.status}).`);
  }

  const data = await response.json();
  const answer = data.choices?.[0]?.message?.content;

  if (typeof answer !== "string" || !answer.trim()) {
    throw new Error("Le fournisseur IA n'a retourné aucune réponse.");
  }

  return answer.trim();
}

async function generateReply({
  character,
  history,
  language = "fr"
}) {
  if (!character || typeof character !== "object") {
    throw new Error("Personnage invalide.");
  }

  const normalizedHistory = normalizeHistory(history);

  if (normalizedHistory.length === 0) {
    throw new Error("Aucun message à traiter.");
  }

  const { providerName, provider } = getActiveProvider();

  if (providerName !== "openai") {
    throw new Error(
      `L'adaptateur ${providerName} sera ajouté dans une prochaine étape.`
    );
  }

  const systemPrompt = [
    buildSystemPrompt(character),
    `LANGUE DE RÉPONSE : ${language}`
  ].join("\n\n");

  const reply = await generateWithOpenAI(
    provider,
    systemPrompt,
    normalizedHistory
  );

  return {
    reply,
    provider: providerName,
    model: provider.model
  };
}

module.exports = {
  generateReply,
  buildSystemPrompt,
  normalizeHistory
};
