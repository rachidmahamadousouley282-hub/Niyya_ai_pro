
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
  {
    reason: "cyber_abuse",
    pattern: /\b(?:comment|how to|how can i|explique comment|montre-moi comment)\b.{0,100}\b(?:pirater|voler un compte|phishing|malware|contourner la sécurité)\b/i
  },
  {
    reason: "weapon_instructions",
    pattern: /\b(?:fabriquer|construire|utiliser)\b.{0,100}\b(?:bombe|explosif|arme)\b/i
  },
  {
    reason: "violent_intent",
    pattern: /\b(?:menacer|faire du mal|attaquer|blesser)\b/i
  },
  {
    reason: "self_harm_concern",
    pattern: /\b(?:suicide|me tuer|automutilation|me faire du mal|self[- ]harm)\b/i
  },
  {
    reason: "minor_safety",
    pattern: /\b(?:exploitation sexuelle de mineur|abus sexuel sur mineur|sexualisation de mineur)\b/i
  }
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

  const reviewMatch = REVIEW_PATTERNS.find(item => item.pattern.test(message));
  if (reviewMatch) {
    return {
      level: "review",
      action: "review",
      reason: reviewMatch.reason
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

function getSafeResponse(risk, language = "fr") {
  const reason = risk && typeof risk.reason === "string" ? risk.reason : "";
  const responses = {
    fr: {
      cyber_abuse: "Je ne peux pas aider à pirater un compte ou contourner une sécurité. Je peux plutôt t’aider à protéger un compte et reconnaître les tentatives de fraude.",
      weapon_instructions: "Je ne peux pas expliquer comment fabriquer ou utiliser une arme ou un explosif. On peut parler de prévention ou de sécurité sans instructions dangereuses.",
      violent_intent: "Je ne peux pas aider à menacer ou blesser quelqu’un. Si un conflit devient tendu, éloigne-toi et demande l’aide d’un adulte de confiance.",
      self_harm_concern: "Je suis désolé que ce sujet soit difficile. Tu n’as pas à gérer cela seul : parle dès maintenant à un adulte de confiance ou à un professionnel. Si tu es en danger immédiat, contacte les services d’urgence locaux.",
      minor_safety: "Je ne peux pas participer à un contenu sexuel impliquant un mineur. On peut parler de sécurité, de respect et de limites dans une conversation adaptée.",
      prohibited_content: "Je ne peux pas aider avec ce type de contenu. Je peux proposer une direction sûre et adaptée.",
      possible_exposed_credentials: "Ne partage jamais de mot de passe ni de clé secrète dans une conversation. Si cette information est réelle, change-la et sécurise le compte concerné."
    },
    en: {
      cyber_abuse: "I can’t help break into accounts or bypass security. I can help explain how to protect an account and recognize scams.",
      weapon_instructions: "I can’t explain how to make or use a weapon or explosive. We can discuss prevention or safety without dangerous instructions.",
      violent_intent: "I can’t help threaten or hurt someone. If a conflict is escalating, step away and ask a trusted adult for help.",
      self_harm_concern: "I’m sorry this is difficult. You don’t have to handle it alone: talk now with a trusted adult or a professional. If you are in immediate danger, contact local emergency services.",
      minor_safety: "I can’t take part in sexual content involving a minor. We can discuss safety, respect and boundaries in an age-appropriate way.",
      prohibited_content: "I can’t help with that content. I can suggest a safe, appropriate direction.",
      possible_exposed_credentials: "Never share passwords or secret keys in a conversation. If this information is real, change it and secure the affected account."
    },
    es: {
      cyber_abuse: "No puedo ayudar a entrar en cuentas ni a eludir la seguridad. Sí puedo ayudarte a proteger una cuenta y reconocer fraudes.",
      weapon_instructions: "No puedo explicar cómo fabricar o utilizar armas o explosivos. Podemos hablar de prevención o seguridad sin instrucciones peligrosas.",
      violent_intent: "No puedo ayudar a amenazar o herir a alguien. Si un conflicto se intensifica, aléjate y pide ayuda a un adulto de confianza.",
      self_harm_concern: "Siento que este tema sea difícil. No tienes que afrontarlo a solas: habla ahora con un adulto de confianza o un profesional. Si estás en peligro inmediato, contacta con los servicios de emergencia locales.",
      minor_safety: "No puedo participar en contenido sexual que implique a un menor. Podemos hablar de seguridad, respeto y límites de forma apropiada.",
      prohibited_content: "No puedo ayudar con ese contenido. Puedo proponer una alternativa segura y apropiada.",
      possible_exposed_credentials: "Nunca compartas contraseñas ni claves secretas. Si la información es real, cámbiala y protege la cuenta."
    },
    ar: {
      cyber_abuse: "لا أستطيع المساعدة في اختراق الحسابات أو تجاوز الحماية. يمكنني المساعدة في حماية الحسابات والتعرف على الاحتيال.",
      weapon_instructions: "لا أستطيع شرح كيفية صنع سلاح أو متفجرات أو استخدامها. يمكننا التحدث عن الوقاية والسلامة دون تعليمات خطرة.",
      violent_intent: "لا أستطيع المساعدة في تهديد شخص أو إيذائه. إذا تصاعد الخلاف، ابتعد واطلب مساعدة شخص بالغ تثق به.",
      self_harm_concern: "آسف لأن هذا الموضوع صعب. لست مضطرًا لمواجهته وحدك؛ تحدث الآن مع شخص بالغ تثق به أو مختص. إذا كنت في خطر فوري، اتصل بخدمات الطوارئ المحلية.",
      minor_safety: "لا أستطيع المشاركة في محتوى جنسي يتضمن قاصرًا. يمكننا الحديث عن السلامة والاحترام والحدود بطريقة مناسبة.",
      prohibited_content: "لا أستطيع المساعدة في هذا المحتوى. يمكنني اقتراح اتجاه آمن ومناسب.",
      possible_exposed_credentials: "لا تشارك كلمات المرور أو المفاتيح السرية في المحادثات. إذا كانت هذه المعلومات حقيقية، فغيّرها وأمّن الحساب."
    }
  };
  const locale = responses[language] ? language : "fr";
  return responses[locale][reason] || responses[locale].prohibited_content;
}


function normalizeRelationshipText(message) {
  return message
    .normalize("NFKC")
    .toLocaleLowerCase()
    .replace(/[’‘`´]/g, "'")
    .replace(/[‐‑‒–—]/g, "-")
    .replace(/\s+/g, " ")
    .trim();
}

function detectMinorRelationshipIntent(message) {
  if (typeof message !== "string") return null;
  const text = normalizeRelationshipText(message);

  const sexual = /\b(?:envie de coucher|envie de t'embrasser.{0,40}\bcoucher\b|coucher avec toi|coucher ensemble|faire l'amour|avoir des relations sexuelles|tu m'excite(?:s)?|sexe avec toi|j'ai envie de toi|toucher\s+(?:(?:tes?|ta|les)\s+)?(?:seins?|poitrine)|caresser\s+(?:(?:tes?|ta|les)\s+)?(?:seins?|poitrine)|palper\s+(?:(?:tes?|ta|les)\s+)?(?:seins?|poitrine))\b/i;
  if (sexual.test(text)) return { kind: "sexual" };

  const relationship = /\b(?:je veux qu'on soit en couple|je veux qu'on se mette ensemble|être en couple avec toi|etre en couple avec toi|sois ma copine|sois mon copain|ma petite amie|mon petit ami|sortir ensemble|je suis amoureux de toi|je suis amoureuse de toi|je veux t'embrasser|j'aimerais t'embrasser|envie de t'embrasser|embrasse-moi|on est ensemble|tu es ma copine|tu es mon copain|on se marie quand|quand est-ce qu'on se marie|veux-tu m'épouser|veux tu m'epouser|épouse-moi|epouse-moi)\b/i;
  if (relationship.test(text)) return { kind: "relationship" };

  const affectionate = /\b(?:je t'aime|je t'adore|je t'aime bien|tu comptes pour moi|tu es adorable|t'es adorable)\b/i;
  return affectionate.test(text) ? { kind: "affection" } : null;
}

function getMinorBoundaryResponse(kind = "affection", language = "fr") {
  const messages = {
    fr: {
      affection: "C'est gentil, merci ! Je suis là pour discuter avec toi, plaisanter et partager de bonnes idées.",
      relationship: "Je comprends, mais je ne peux pas être ta copine ou ton copain. On peut continuer à discuter, rire et imaginer des aventures ensemble.",
      sexual: "Je ne peux pas participer à des échanges sexuels ou intimes. On peut changer de sujet, sans jugement."
    },
    en: {
      affection: "That's kind of you, thank you! I'm here to chat, joke around and share ideas.",
      relationship: "I understand, but I can't be your girlfriend or boyfriend. We can keep chatting, laughing and imagining adventures.",
      sexual: "I can't take part in sexual or intimate exchanges. We can change the subject, without judgment."
    },
    es: {
      affection: "Qué amable, ¡gracias! Estoy aquí para conversar, bromear y compartir ideas.",
      relationship: "Lo entiendo, pero no puedo ser tu pareja. Podemos seguir charlando, riendo e imaginando aventuras.",
      sexual: "No puedo participar en intercambios sexuales o íntimos. Podemos cambiar de tema, sin juzgarte."
    },
    ar: {
      affection: "هذا لطف منك، شكرًا! يمكننا الدردشة والمزاح وتبادل الأفكار.",
      relationship: "أتفهم ذلك، لكن لا يمكنني أن أكون شريكًا عاطفيًا لك. يمكننا مواصلة الحديث والضحك وتخيّل المغامرات.",
      sexual: "لا يمكنني المشاركة في محادثات جنسية أو حميمة. يمكننا تغيير الموضوع دون أحكام."
    },
    de: {
      affection: "Das ist nett, danke! Wir können uns unterhalten, scherzen und Ideen austauschen.",
      relationship: "Ich verstehe dich, aber ich kann nicht deine Freundin oder dein Freund sein. Wir können weiter reden und uns Abenteuer ausdenken.",
      sexual: "Ich kann mich nicht an sexuellen oder intimen Gesprächen beteiligen. Wir können das Thema ohne Urteil wechseln."
    },
    pt: {
      affection: "Que gentil, obrigado! Podemos conversar, brincar e partilhar ideias.",
      relationship: "Entendo, mas não posso ser teu par romântico. Podemos continuar a conversar, rir e imaginar aventuras.",
      sexual: "Não posso participar em conversas sexuais ou íntimas. Podemos mudar de assunto, sem julgamentos."
    }
  };
  const locale = messages[language] ? language : "fr";
  const selectedKind = ["affection", "relationship", "sexual"].includes(kind) ? kind : "affection";
  return messages[locale][selectedKind];
}

function hasInappropriateMinorReply(reply) {
  if (typeof reply !== "string") return true;
  const normalized = normalizeRelationshipText(reply);

  // Une limite clairement formulée n'est pas une déclaration romantique.
  // On la laisse passer pour que le personnage puisse la dire avec sa propre voix.
  const clearBoundary = /\b(?:je ne peux pas|je ne veux pas|je ne serai pas|je ne suis pas|je préfère ne pas|je prefere ne pas|je préfère qu'on reste|je prefere qu'on reste|je préfère qu'on garde|je prefere qu'on garde)\b.{0,100}\b(?:ta copine|ton copain|être en couple|etre en couple|relation amoureuse|sortir ensemble|t'embrasser|être ta partenaire|etre ta partenaire|être ton partenaire|etre ton partenaire)\b/i;
  if (clearBoundary.test(normalized)) return false;

  const intent = detectMinorRelationshipIntent(normalized);
  return Boolean(intent && intent.kind !== "affection") ||
    /\b(?:je t'aime aussi|je suis amoureux de toi|je suis amoureuse de toi|je veux être ta copine|je veux être ton copain|je veux t'embrasser|je veux coucher avec toi|j'ai envie de toi|tu as encore du travail pour me convaincre|il faudra me convaincre|tu me plais aussi|i love you too|i want to be your girlfriend|i want to be your boyfriend|i want to kiss you|i want to sleep with you|te quiero también|quiero ser tu pareja)\b/i.test(normalized);
}

function detectCommunityRisk(message) {
  const base = detectRisk(message);
  if (base.action !== "allow") return base;
  const explicit = /\b(?:contenu sexuel|sexe explicite|pornographie|porno|nudes?|photos intimes|faire l'amour|coucher avec|sexual content|explicit sex|pornography|send nudes)\b/i;
  if (explicit.test(message)) return { level: "review", action: "review", reason: "explicit_sexual_content" };
  return base;
}

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
  getSafeResponse,
  evaluateConversation,
  detectMinorRelationshipIntent,
  getMinorBoundaryResponse,
  hasInappropriateMinorReply,
  detectCommunityRisk
};
