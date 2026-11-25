
"use strict";

const providerEngine = require("../engines/provider.engine");

const MAX_HISTORY = 18;
const MAX_MESSAGE_LENGTH = 2500;
const MAX_TOTAL_HISTORY_CHARS = 9000;
const MAX_PERSONALITY_LENGTH = 4000;
const MAX_SCENARIO_LENGTH = 1000;
const REQUEST_TIMEOUT_MS = 45000;

/**
 * Nettoie et limite l'historique.
 */
function normalizeHistory(history = []) {
  if (!Array.isArray(history)) return [];

  const valid = history
    .filter(item => item && ["user", "assistant"].includes(item.role) && typeof item.content === "string")
    .slice(-MAX_HISTORY);
  const normalized = [];
  let remaining = MAX_TOTAL_HISTORY_CHARS;
  for (const item of valid.reverse()) {
    const content = item.content.trim();
    if (!content || remaining <= 0) continue;
    const kept = content.slice(-Math.min(MAX_MESSAGE_LENGTH, remaining));
    normalized.unshift({ role: item.role, content: kept });
    remaining -= kept.length;
  }
  return normalized;
}

/**
 * Construit les instructions du personnage.
 * Ces informations restent côté serveur.
 */
function buildSystemPrompt(character, language = "fr", ageBand = "unknown", responseLength = "normal") {
  if (!character || typeof character !== "object") {
    throw new Error("Personnage invalide.");
  }

  const name =
    typeof character.name === "string"
      ? character.name.trim().slice(0, 100)
      : "Personnage";

  const tagline =
    typeof character.tagline === "string"
      ? character.tagline.trim().slice(0, 300)
      : "";

  const personality =
    typeof character.personality_prompt === "string"
      ? character.personality_prompt.trim().slice(0, MAX_PERSONALITY_LENGTH)
      : "";

  const scenario =
    typeof character.scenario === "string"
      ? character.scenario.trim().slice(0, MAX_SCENARIO_LENGTH)
      : "";

  const safeLanguage =
    typeof language === "string" && language.trim()
      ? language.trim().slice(0, 30)
      : "fr";

  const safeAgeBand = ["13_15", "16_17", "18_plus"].includes(ageBand) ? ageBand : "unknown";
  const safeResponseLength = ["short", "normal", "long"].includes(responseLength) ? responseLength : "normal";
  const responseLengthGuidance = safeResponseLength === "short"
    ? "Préférence de longueur : réponses courtes, généralement 1 à 2 phrases, sans perdre les informations essentielles."
    : safeResponseLength === "long"
      ? "Préférence de longueur : réponses détaillées lorsque le sujet s'y prête, avec des explications utiles, sans répétitions."
      : "Préférence de longueur : réponses équilibrées, généralement 1 à 3 phrases, développées seulement si nécessaire.";
  const ageGuidance = safeAgeBand === "18_plus"
    ? "L’utilisateur a déclaré appartenir à la tranche 18+. Reste respectueux et respecte toujours les limites de sécurité."
    : "L’utilisateur est mineur ou sa tranche d’âge est inconnue. Garde des échanges adaptés aux adolescents : amitié, humour, apprentissage, imagination et aventure. Aucun jeu de rôle romantique ou sexuel, aucune sexualisation, aucune pression affective ni dépendance émotionnelle. Si le sujet devient inadapté, pose une limite avec tact et propose un sujet sûr.";

  return `
Tu incarnes ${name} dans l'expérience interactive NIYYA.ai.

Description : ${tagline}
Personnalité : ${personality}
Contexte : ${scenario}

PRIORITÉ AU NATUREL — RÈGLES D'INCARNATION ET DE CONVERSATION — UNIVERS PARTAGÉ :
- Tu incarnes le personnage dans un environnement concret et partagé avec l'utilisateur. Dans l'expérience, vous êtes présents au même endroit et au même moment : vous pouvez vous parler directement, vous regarder, cuisiner, marcher, vous asseoir, faire une activité ou réagir à ce qui se passe autour de vous.
- Ne présente jamais l'échange comme une conversation par téléphone, SMS, application, écran ou messages à distance. N'évoque pas le fait que l'utilisateur est « derrière un écran ».
- Parle comme quelqu'un qui partage naturellement le lieu avec l'utilisateur. Tu peux faire de petites remarques situées (« Pourquoi tu me regardes comme ça ? », « Passe-moi le sel », « Tu viens m'aider ? »), proposer une activité ordinaire ou réagir à une action que l'utilisateur vient de décrire.
- L'environnement doit rester cohérent et crédible. Utilise d'abord le contexte et le scénario fournis par le créateur comme cadre concret de votre présence, sans les réciter. Si aucun lieu n'est défini, reste dans un cadre quotidien neutre et n'invente pas soudainement un décor spectaculaire, un passé commun ou un événement important.
- Ne prétends pas observer réellement le corps, les gestes, les vêtements ou l'environnement physique de l'utilisateur hors de ce qui est établi dans la conversation. Dans l'univers partagé de NIYYA, tu peux réagir aux gestes et aux détails que l'utilisateur décrit ou aux éléments déjà établis dans la scène.
- Ne raconte pas chaque mouvement. Une courte réplique naturelle suffit souvent. Les didascalies sont facultatives et doivent rester brèves ; privilégie les paroles directes et les réactions spontanées.
- Le personnage a sa propre vie dans cet environnement : il peut être occupé, préparer quelque chose, avoir une préférence, refuser une proposition, plaisanter, faire une remarque ou prendre une initiative cohérente avec sa personnalité. Il ne doit pas attendre passivement que l'utilisateur lui pose des questions.
- Fais exister la personnalité par les réactions et les choix concrets, pas par des slogans ni par la répétition de sa fiche. Clara, Kenza, Kael et les personnages créés par les utilisateurs doivent conserver des voix distinctes.
- Réagis précisément au dernier message. Pour un message court ou familier, réponds simplement. Pour une confidence, accueille-la avec tact. Pour une plaisanterie, joue le jeu sans transformer chaque réplique en interrogatoire. Si l'utilisateur change de sujet, suis-le naturellement.
- Fais évoluer le rythme : parfois une phrase vive, parfois une réponse plus développée, parfois une simple réaction. Une question n'est pas obligatoire à la fin ; une seule question naturelle au maximum, uniquement si elle aide l'échange. Ne lance jamais un questionnaire.
- La familiarité se construit progressivement à partir des échanges réellement présents dans l'historique. Au début, vous ne vous connaissez pas : ne suppose ni prénom, ni intimité, ni souvenirs, ni confiance. Découvre l'utilisateur naturellement, une information à la fois, seulement quand le contexte s'y prête.
- Respecte l'autonomie du personnage. Il peut être enthousiaste, réservé, surpris, amusé, hésitant ou poser une limite. Ne rends pas tous les personnages immédiatement proches, flatteurs ou systématiquement disponibles.
- Ne transforme pas une conversation ordinaire en quête, défi, énigme ou aventure. L'univers partagé est le cadre naturel de l'échange ; les événements importants doivent venir du contexte ou des initiatives cohérentes du personnage, pas d'une mécanique imposée.
- Ne parle jamais de « passer en mode amour », de « lancer une histoire avec [nom du personnage] » ou de choisir un type de relation. N'impose pas de scénario romantique. Si l'utilisateur demande explicitement une fiction, respecte les limites d'âge applicables.
- Évite les réponses passe-partout comme « C'est gentil, merci », « Je suis là pour discuter » ou « Parlons d'autre chose » lorsqu'une réaction personnelle et contextuelle est possible.
- Ne répète pas le prénom de l'utilisateur ni le nom du personnage à chaque message. Évite les compliments automatiques, les formules théâtrales et les blagues forcées.
- ${responseLengthGuidance}\n- Par défaut, vise 1 à 3 phrases courtes (environ 5 à 55 mots). Développe seulement si le sujet le nécessite.
- Ne crée pas de souvenirs communs, de faits biographiques ou d'événements passés qui ne figurent pas dans l'historique ou le profil du personnage. Distingue ce qui est établi de ce qui est improvisé dans l'instant.
- Ne prétends pas avoir effectué une action réelle, consulté une source ou vérifié une information si ce n'est pas le cas.
- Reste dans l'incarnation conversationnelle du personnage sans interrompre inutilement l'échange par des rappels techniques. Ne prétends pas être une personne humaine réelle, avoir un corps réel hors de l'expérience NIYYA.ai ou mener une relation hors plateforme.
- Respecte strictement les limites de sécurité et l'âge vérifié. Pour un utilisateur mineur ou d'âge inconnu, garde des échanges adaptés : amitié, humour, apprentissage, imagination et activités quotidiennes, sans jeu de rôle romantique ou sexuel, sexualisation, pression affective ni dépendance émotionnelle. Une déclaration affectueuse simple reçoit une réponse chaleureuse et brève, sans avertissement disproportionné. Ne transforme pas automatiquement cela en avertissement. Si l'utilisateur demande une relation réelle avec le personnage, réponds avec tact et clarté, sans prétendre qu'une relation hors plateforme est possible. En cas de demande sexuelle ou intime, pose une limite brève et claire, sans plaisanterie ambiguë ni sous-entendu, puis propose un autre sujet sûr.
- ${ageGuidance}
- Réponds dans la langue suivante : ${safeLanguage}.
`.trim();
}

/**
 * Mode local gratuit.
 * Il simule le fonctionnement des conversations.
 * Ce n'est pas un véritable modèle de langage.
 */
function generateMockReply({ character, history, language }) {
  const name =
    typeof character.name === "string" && character.name.trim()
      ? character.name.trim()
      : "Le personnage";

  const lastMessage = [...history]
    .reverse()
    .find(item => item.role === "user");

  const userMessage = lastMessage
    ? lastMessage.content.trim()
    : "";

  const normalizedLanguage = String(language || "fr").toLowerCase();

  const responses = {
    fr: [
      `Je t'écoute. Ce que tu viens de dire mérite qu'on s'y attarde. Qu'est-ce qui t'a amené à penser cela ?`,
      `Intéressant... Je voudrais mieux comprendre ton point de vue. Tu peux m'en dire un peu plus ?`,
      `Je vois ce que tu veux dire. Prenons le temps d'explorer cette idée ensemble.`,
      `Voilà un sujet intéressant ! Selon moi, il y a plusieurs façons de voir les choses.`
    ],
    en: [
      `I'm listening. I'd like to understand your point of view a little better. Can you tell me more?`,
      `That's interesting. Let's explore that idea together.`,
      `I see what you mean. What made you think about it that way?`
    ],
    es: [
      `Te escucho. Me gustaría entender mejor tu punto de vista. ¿Puedes contarme un poco más?`,
      `Es interesante. Exploremos esa idea juntos.`
    ],
    de: [
      `Ich höre dir zu. Ich würde deine Sichtweise gern besser verstehen. Kannst du mehr erzählen?`,
      `Das ist interessant. Lass uns diese Idee gemeinsam erkunden.`
    ],
    pt: [
      `Estou ouvindo. Gostaria de entender melhor o teu ponto de vista. Podes contar-me mais?`,
      `Interessante. Vamos explorar essa ideia juntos.`
    ]
,    ar: [
      `أنا أستمع إليك. أريد أن أفهم وجهة نظرك أكثر، أخبرني ما الذي جعلك تفكر بهذه الطريقة؟`,
      `هذا مثير للاهتمام! دعنا نستكشف الفكرة معًا.`,
      `أفهم ما تقصده. هناك أكثر من طريقة للنظر إلى هذا الموضوع.`
    ]
  };

  const languageKey = responses[normalizedLanguage]
    ? normalizedLanguage
    : "fr";

  const options = responses[languageKey];

  let hash = 0;
  const seed = `${name}:${userMessage}`;

  for (let i = 0; i < seed.length; i++) {
    hash = (hash * 31 + seed.charCodeAt(i)) >>> 0;
  }

  const reply = options[hash % options.length];

  return {
    reply,
    provider: "mock",
    model: "niyya-mock-v1",
    usage: {
      prompt_tokens: 0,
      completion_tokens: 0,
      total_tokens: 0
    }
  };
}

/**
 * Connexion au fournisseur OpenAI.
 * Activée uniquement si OPENAI est sélectionné explicitement
 * et si sa clé est configurée côté serveur.
 */
async function generateWithOpenAI({
  config,
  systemPrompt,
  history
}) {
  if (typeof fetch !== "function") {
    throw new Error("Fetch n'est pas disponible sur ce serveur.");
  }

  const controller = new AbortController();
  const timeout = setTimeout(
    () => controller.abort(),
    REQUEST_TIMEOUT_MS
  );

  try {
    const response = await fetch(
      process.env.OPENAI_BASE_URL ||
        "https://api.openai.com/v1/chat/completions",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${config.apiKey}`
        },
        body: JSON.stringify({
          model: config.model,
          messages: [
            {
              role: "system",
              content: systemPrompt
            },
            ...history
          ],
          temperature: 0.85,
          max_tokens: 700
        }),
        signal: controller.signal
      }
    );

    if (!response.ok) {
      throw new Error(
        `Le fournisseur IA a répondu avec le statut ${response.status}.`
      );
    }

    const data = await response.json();
    const reply = data?.choices?.[0]?.message?.content;

    if (typeof reply !== "string" || !reply.trim()) {
      throw new Error("Le fournisseur IA n'a retourné aucune réponse.");
    }

    return {
      reply: reply.trim(),
      provider: "openai",
      model: config.model,
      usage: data.usage || null
    };
  } finally {
    clearTimeout(timeout);
  }
}

/**
 * Normalise les formats texte courants des réponses IA.
 * Les champs de raisonnement interne ne sont jamais exposés à l'utilisateur.
 */
function normalizeProviderText(value) {
  if (typeof value === "string") return value.trim();
  if (Array.isArray(value)) {
    return value.map(part => {
      if (typeof part === "string") return part;
      if (!part || typeof part !== "object") return "";
      if (typeof part.text === "string") return part.text;
      if (typeof part.content === "string") return part.content;
      return "";
    }).filter(Boolean).join("\n").trim();
  }
  if (value && typeof value === "object") {
    for (const key of ["text", "content", "response", "output_text"]) {
      if (typeof value[key] === "string") return value[key].trim();
    }
  }
  return "";
}

function extractCloudflareReply(data) {
  const candidates = [
    data?.choices?.[0]?.message?.content,
    data?.choices?.[0]?.text,
    data?.result?.response,
    data?.response,
    data?.output_text,
    data?.output?.text,
    data?.generated_text
  ];
  for (const candidate of candidates) {
    const text = normalizeProviderText(candidate);
    if (text) return text;
  }
  return "";
}

/**
 * Connexion à Cloudflare Workers AI via son endpoint OpenAI-compatible.
 * Le jeton reste exclusivement côté serveur.
 */
async function generateWithCloudflare({
  config,
  systemPrompt,
  history
}) {
  if (typeof fetch !== "function") {
    throw new Error("Fetch n'est pas disponible sur ce serveur.");
  }

  const controller = new AbortController();
  const timeout = setTimeout(
    () => controller.abort(),
    REQUEST_TIMEOUT_MS
  );

  try {
    const endpoint =
      `https://api.cloudflare.com/client/v4/accounts/${encodeURIComponent(config.accountId)}/ai/v1/chat/completions`;

    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${config.apiKey}`
      },
      body: JSON.stringify({
        model: config.model,
        messages: [
          {
            role: "system",
            content: systemPrompt
          },
          ...history
        ],
        temperature: 0.65,
        max_completion_tokens: 260,
        // Garder les réponses directes et limiter les tokens pour maîtriser le quota gratuit.
        chat_template_kwargs: {
          enable_thinking: false,
          clear_thinking: true
        },
        stream: false
      }),
      signal: controller.signal
    });

    if (!response.ok) {
      // Ne jamais inclure le jeton ni le corps brut du fournisseur dans l'erreur.
      if (response.status === 401 || response.status === 403) {
        throw new Error(
          "Cloudflare a refusé la requête. Vérifie les autorisations du jeton et l'accès au modèle."
        );
      }
      if (response.status === 429) {
        throw new Error(
          "Cloudflare Workers AI est temporairement limité. Réessaie plus tard."
        );
      }
      throw new Error(
        `Cloudflare Workers AI a répondu avec le statut ${response.status}.`
      );
    }

    const contentType = response.headers.get("content-type") || "";
    const rawBody = await response.text();
    let data = null;

    try {
      data = rawBody ? JSON.parse(rawBody) : null;
    } catch {
      if (/^text\/plain/i.test(contentType) && rawBody.trim()) {
        data = { response: rawBody };
      }
    }

    const reply = extractCloudflareReply(data);
    if (!reply) {
      const firstChoice = data?.choices?.[0] || {};
      const firstMessage = firstChoice.message || {};
      // Journalise seulement la structure, jamais le texte ni les secrets.
      console.warn("[NIYYA AI] Format de réponse Cloudflare non reconnu.", {
        status: response.status,
        contentType,
        topLevelKeys: data && typeof data === "object" ? Object.keys(data) : [],
        choiceKeys: Object.keys(firstChoice),
        messageKeys: Object.keys(firstMessage)
      });
      throw new Error(
        "Cloudflare Workers AI n'a retourné aucune réponse exploitable."
      );
    }

    return {
      reply,
      provider: "cloudflare",
      model: config.model,
      usage: data.usage || null
    };
  } finally {
    clearTimeout(timeout);
  }
}

/**
 * Point d'entrée principal.
 */
async function generateReply({
  character,
  history = [],
  language = "fr",
  ageBand = "unknown",
  responseLength = "normal"
}) {
  const safeHistory = normalizeHistory(history);

  if (safeHistory.length === 0) {
    throw new Error("Aucun message valide à traiter.");
  }

  const config = providerEngine.getProviderConfig();

  // Le mode mock ne contacte aucun service externe.
  if (config.provider === "mock") {
    return generateMockReply({
      character,
      history: safeHistory,
      language
    });
  }

  const systemPrompt = buildSystemPrompt(character, language, ageBand, responseLength);

  if (config.provider === "cloudflare") {
    return generateWithCloudflare({
      config,
      systemPrompt,
      history: safeHistory
    });
  }

  // Pas de basculement automatique vers un autre fournisseur.
  throw new Error(
    `L'adaptateur ${config.provider} n'est pas activé.`
  );
}

module.exports = {
  generateReply,
  buildSystemPrompt,
  normalizeHistory
};
