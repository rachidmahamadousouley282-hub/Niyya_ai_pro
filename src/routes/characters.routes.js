"use strict";

const express = require("express");
const { query } = require("../config/database");
const { requireAuth, optionalAuth } = require("../middleware/auth.middleware");
const safetyEngine = require("../engines/safety.engine");

const router = express.Router();
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const CATEGORIES = new Set(["original", "anime", "fantasy", "mystery", "comedy", "friendship", "adventure", "science-fiction"]);

const PUBLIC_CHARACTER_FIELDS = [
  "id", "slug", "name", "tagline", "avatar_url", "short_bio", "view_count", "like_count",
  "backstory", "profile_i18n", "personality_traits", "greeting",
  "category", "tags", "creator_pseudonym", "published_at", "created_at"
];

function publicCharacter(character) {
  if (!character) return null;
  const result = {};
  for (const field of PUBLIC_CHARACTER_FIELDS) {
    if (character[field] !== undefined) result[field] = character[field];
  }
  return result;
}

function parsePagination(value, fallback, maximum) {
  if (value === undefined) return fallback;
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 0) return null;
  return Math.min(parsed, maximum);
}

function cleanText(value, maxLength, field, minLength = 0) {
  if (typeof value !== "string") throw new Error(`Le champ ${field} est invalide.`);
  const cleaned = safetyEngine.sanitizeText(value, maxLength);
  if (cleaned.length < minLength || cleaned.length > maxLength) {
    throw new Error(`Le champ ${field} doit contenir entre ${minLength} et ${maxLength} caractères.`);
  }
  const risk = safetyEngine.detectCommunityRisk(cleaned);
  if (risk.action !== "allow") {
    throw new Error("Ce contenu contient des informations personnelles ou un élément qui nécessite une vérification. Modifie-le avant de continuer.");
  }
  return cleaned;
}

function cleanAvatarData(value) {
  if (value === undefined || value === null || value === "") return null;
  if (typeof value !== "string" || value.length > 280000 ||
      !/^data:image\/jpeg;base64,[A-Za-z0-9+/]+={0,2}$/.test(value)) {
    throw new Error("La photo doit être un JPEG compressé de 200 Ko maximum.");
  }
  return value;
}

function cleanList(value, maxItems, maxLength, field) {
  if (value === undefined || value === null) return [];
  if (!Array.isArray(value) || value.length > maxItems) {
    throw new Error(`La liste ${field} est invalide.`);
  }
  const unique = [...new Set(value.map(item => cleanText(item, maxLength, field, 1)))];
  return unique;
}

function requireSameOrigin(req, res, next) {
  const origin = req.get("origin");
  const host = req.get("host");
  const fetchSite = req.get("sec-fetch-site");
  if (fetchSite && fetchSite !== "same-origin" && fetchSite !== "none") {
    return res.status(403).json({ error: "Requête inter-origine refusée." });
  }
  if (!origin || !host) return res.status(403).json({ error: "Origine de requête non vérifiée." });
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

async function requireCreatorAccess(userId) {
  const result = await query(
    `SELECT onboarded_at, adult_confirmed_at, terms_accepted_at, pseudonym
     FROM public.users WHERE id = $1 LIMIT 1`,
    [userId]
  );
  const user = result.rows[0];
  return Boolean(user && user.onboarded_at && user.adult_confirmed_at &&
    user.terms_accepted_at && user.pseudonym);
}

async function requireCreatorDraftAccess(userId) {
  const result = await query(
    `SELECT onboarded_at, terms_accepted_at, pseudonym, age_band
     FROM public.users WHERE id = $1 LIMIT 1`,
    [userId]
  );
  const user = result.rows[0];
  return Boolean(user && user.onboarded_at && user.terms_accepted_at && user.pseudonym && user.age_band);
}

function ownCharacter(character) {
  return {
    id: character.id,
    name: character.name,
    tagline: character.tagline,
    short_bio: character.short_bio,
    backstory: character.backstory,
    personality_prompt: character.personality_prompt,
    scenario: character.scenario,
    greeting: character.greeting,
    category: character.category,
    personality_traits: character.personality_traits,
    tags: character.tags,
    avatar_url: character.avatar_url,
    visibility: character.visibility,
    publication_status: character.publication_status,
    created_at: character.created_at,
    updated_at: character.updated_at
  };
}

// GET /api/characters — personnages publics et système.
router.get("/", async (req, res) => {
  try {
    const limit = parsePagination(req.query.limit, 20, 50);
    const offset = parsePagination(req.query.offset, 0, 10000);
    if (limit === null || offset === null) {
      return res.status(400).json({ error: "Paramètres de pagination invalides." });
    }
    const result = await query(
      `SELECT * FROM (
         SELECT c.id, c.slug, c.name, c.tagline, c.avatar_url, c.short_bio,
                (SELECT COUNT(*)::bigint FROM public.character_view_events v WHERE v.character_id = c.id) AS view_count,
                (SELECT COUNT(*)::bigint FROM public.user_favorite_characters f WHERE f.character_id = c.id) AS like_count,
                c.backstory, c.profile_i18n, c.personality_traits, c.greeting,
                c.category, c.tags, 'NIYYA.ai'::varchar AS creator_pseudonym,
                c.published_at, c.created_at
         FROM public.characters c
         WHERE c.is_system = TRUE AND c.status = 'active'
         UNION ALL
         SELECT c.id, c.slug, c.name, c.tagline,
                CASE WHEN c.avatar_status = 'approved' THEN c.avatar_url ELSE NULL END AS avatar_url,
                c.short_bio,
                (SELECT COUNT(*)::bigint FROM public.character_view_events v WHERE v.character_id = c.id) AS view_count,
                (SELECT COUNT(*)::bigint FROM public.user_favorite_characters f WHERE f.character_id = c.id) AS like_count,
                c.backstory, c.profile_i18n, c.personality_traits,
                c.greeting, c.category, c.tags, u.pseudonym AS creator_pseudonym,
                c.published_at, c.created_at
         FROM public.characters c
         JOIN public.users u ON u.id = c.owner_user_id
         WHERE c.visibility = 'public' AND c.publication_status = 'approved'
           AND c.status = 'active' AND u.pseudonym IS NOT NULL
       ) AS discoverable
       ORDER BY published_at DESC NULLS LAST, name ASC LIMIT $1 OFFSET $2`,
      [limit, offset]
    );
    return res.status(200).json({ success: true, characters: result.rows.map(publicCharacter) });
  } catch (error) {
    console.error("Erreur de découverte des personnages :", error.message);
    return res.status(500).json({ error: "Impossible de charger les personnages." });
  }
});

// GET /api/characters/mine — brouillons et créations de l'utilisateur.
router.get("/mine", requireAuth, async (req, res) => {
  try {
    const result = await query(
      `SELECT id, name, tagline, short_bio, backstory, personality_prompt,
              scenario, greeting, category, personality_traits, tags, avatar_url,
              visibility, publication_status, created_at, updated_at
       FROM public.characters
       WHERE owner_user_id = $1 AND is_system = FALSE
       ORDER BY updated_at DESC LIMIT 50`,
      [req.user.id]
    );
    return res.status(200).json({ success: true, characters: result.rows.map(ownCharacter) });
  } catch (error) {
    console.error("Erreur de chargement des créations :", error.message);
    return res.status(500).json({ error: "Impossible de charger tes créations." });
  }
});

// POST /api/characters — crée un brouillon privé.
router.post("/", requireAuth, requireSameOrigin, async (req, res) => {
  try {
    if (!await requireCreatorDraftAccess(req.user.id)) {
      return res.status(403).json({
        error: "Pour créer un personnage, termine d’abord ton profil : choisis un pseudonyme, indique ta tranche d’âge et accepte les conditions de NIYYA.",
        code: "creator_onboarding_required"
      });
    }
    const body = req.body || {};
    const name = cleanText(body.name, 40, "nom", 2);
    const tagline = cleanText(body.tagline, 100, "description courte", 3);
    const shortBio = cleanText(body.shortBio, 500, "présentation", 10);
    const backstory = cleanText(body.backstory, 3000, "histoire", 10);
    const personalityPrompt = cleanText(body.personalityPrompt, 4000, "personnalité", 10);
    const scenario = cleanText(body.scenario || "Un univers fictif et bienveillant.", 1000, "scénario", 5);
    const greeting = cleanText(body.greeting, 800, "message d'accueil", 2);
    const category = typeof body.category === "string" && CATEGORIES.has(body.category)
      ? body.category : "original";
    const traits = cleanList(body.traits, 8, 32, "traits de personnalité");
    const tags = cleanList(body.tags, 8, 24, "mots-clés");
    const avatarData = cleanAvatarData(body.avatarData);
    const result = await query(
      `INSERT INTO public.characters
        (owner_user_id, is_system, name, tagline, personality_prompt, scenario,
         visibility, publication_status, avatar_status, avatar_url, short_bio, backstory,
         personality_traits, greeting, category, tags, profile_i18n)
       VALUES ($1, FALSE, $2, $3, $4, $5, 'private', 'none',
               CASE WHEN $12::text IS NULL THEN 'none' ELSE 'pending' END, $12,
               $6, $7, $8::text[], $9, $10, $11::text[], '{}'::jsonb)
       RETURNING id, name, tagline, short_bio, backstory, personality_prompt,
                 scenario, greeting, category, personality_traits, tags, avatar_url,
                 visibility, publication_status, created_at, updated_at`,
      [req.user.id, name, tagline, personalityPrompt, scenario, shortBio,
       backstory, traits, greeting, category, tags, avatarData]
    );
    return res.status(201).json({
      success: true,
      character: ownCharacter(result.rows[0]),
      canSubmit: await requireCreatorAccess(req.user.id)
    });
  } catch (error) {
    if (/champ|liste|contenu|caractères|photo/i.test(error.message || "")) {
      return res.status(400).json({ error: error.message });
    }
    console.error("Erreur de création de personnage :", error.message);
    return res.status(500).json({ error: "Impossible d'enregistrer ce personnage." });
  }
});

// PATCH /api/characters/:characterId — modifie un brouillon privé ou refusé.
router.patch("/:characterId", requireAuth, requireSameOrigin, async (req, res) => {
  const { characterId } = req.params;
  if (!UUID_REGEX.test(characterId)) {
    return res.status(400).json({ error: "Identifiant de personnage invalide." });
  }
  try {
    if (!await requireCreatorDraftAccess(req.user.id)) {
      return res.status(403).json({
        error: "Termine ton inscription avant de modifier un personnage.",
        code: "creator_onboarding_required"
      });
    }
    const body = req.body || {};
    const name = cleanText(body.name, 40, "nom", 2);
    const tagline = cleanText(body.tagline, 100, "description courte", 3);
    const shortBio = cleanText(body.shortBio, 500, "présentation", 10);
    const backstory = cleanText(body.backstory, 3000, "histoire", 10);
    const personalityPrompt = cleanText(body.personalityPrompt, 4000, "personnalité", 10);
    const scenario = cleanText(body.scenario || "Un univers fictif et bienveillant.", 1000, "scénario", 5);
    const greeting = cleanText(body.greeting, 800, "message d'accueil", 2);
    const category = typeof body.category === "string" && CATEGORIES.has(body.category)
      ? body.category : "original";
    const traits = cleanList(body.traits, 8, 32, "traits de personnalité");
    const tags = cleanList(body.tags, 8, 24, "mots-clés");
    const avatarData = cleanAvatarData(body.avatarData);
    const result = await query(
      `UPDATE public.characters
       SET name = $3, tagline = $4, short_bio = $5, backstory = $6,
           personality_prompt = $7, scenario = $8, greeting = $9,
           category = $10, personality_traits = $11::text[], tags = $12::text[],
           avatar_url = CASE WHEN $14::boolean THEN NULL WHEN $13::text IS NOT NULL THEN $13 ELSE avatar_url END,
           avatar_status = CASE WHEN $14::boolean THEN 'none' WHEN $13::text IS NULL THEN avatar_status ELSE 'pending' END,
           updated_at = NOW()
       WHERE id = $1 AND owner_user_id = $2 AND is_system = FALSE
         AND status = 'active' AND visibility = 'private'
         AND publication_status IN ('none', 'rejected')
       RETURNING id, name, tagline, short_bio, backstory, personality_prompt,
                 scenario, greeting, category, personality_traits, tags, avatar_url,
                 visibility, publication_status, created_at, updated_at`,
      [characterId, req.user.id, name, tagline, shortBio, backstory,
       personalityPrompt, scenario, greeting, category, traits, tags, avatarData, Boolean(body.removeAvatar)]
    );
    if (!result.rows.length) {
      return res.status(409).json({
        error: "Ce personnage n'est pas modifiable : seuls tes brouillons privés et les demandes refusées peuvent être modifiés."
      });
    }
    return res.status(200).json({
      success: true,
      character: ownCharacter(result.rows[0]),
      canSubmit: await requireCreatorAccess(req.user.id)
    });
  } catch (error) {
    if (/champ|liste|contenu|caractères|photo/i.test(error.message || "")) {
      return res.status(400).json({ error: error.message });
    }
    console.error("Erreur de modification de personnage :", error.message);
    return res.status(500).json({ error: "Impossible de modifier ce personnage." });
  }
});

// POST /api/characters/:characterId/submit — demande une validation avant publication.
router.post("/:characterId/submit", requireAuth, requireSameOrigin, async (req, res) => {
  const { characterId } = req.params;
  if (!UUID_REGEX.test(characterId)) return res.status(400).json({ error: "Identifiant de personnage invalide." });
  try {
    if (!await requireCreatorAccess(req.user.id)) {
      return res.status(403).json({ error: "Termine le parcours d'inscription autorisé avant de publier.", code: "creator_onboarding_required" });
    }
    const result = await query(
      `UPDATE public.characters
       SET publication_status = 'pending', visibility = 'private', updated_at = NOW()
       WHERE id = $1 AND owner_user_id = $2 AND is_system = FALSE
         AND status = 'active' AND publication_status IN ('none', 'rejected')
       RETURNING id, name, publication_status, visibility, updated_at`,
      [characterId, req.user ? req.user.id : null]
    );
    if (!result.rows.length) {
      return res.status(409).json({ error: "Ce personnage est introuvable ou déjà en cours de validation." });
    }
    return res.status(200).json({ success: true, character: result.rows[0], message: "Demande envoyée. Le personnage restera privé pendant sa vérification." });
  } catch (error) {
    console.error("Erreur de soumission du personnage :", error.message);
    return res.status(500).json({ error: "Impossible d'envoyer ce personnage en validation." });
  }
});

// GET /api/characters/moderation/pending — réservé à l'administration.
router.get("/moderation/pending", requireAuth, async (req, res) => {
  if (req.user.role !== "admin") return res.status(403).json({ error: "Accès réservé à l'administration." });
  try {
    const result = await query(
      `SELECT c.id, c.name, c.tagline, c.short_bio, c.backstory,
              c.personality_prompt, c.scenario, c.greeting, c.category,
              c.personality_traits, c.tags, c.created_at, u.pseudonym AS creator_pseudonym
       FROM public.characters c JOIN public.users u ON u.id = c.owner_user_id
       WHERE c.is_system = FALSE AND c.visibility = 'private'
         AND c.publication_status = 'pending' AND c.status = 'active'
       ORDER BY c.updated_at ASC LIMIT 100`
    );
    return res.status(200).json({ success: true, characters: result.rows });
  } catch (error) {
    console.error("Erreur de file de modération :", error.message);
    return res.status(500).json({ error: "Impossible de charger la file de modération." });
  }
});

// PATCH /api/characters/:characterId/moderation — décision d'un administrateur.
router.patch("/:characterId/moderation", requireAuth, requireSameOrigin, async (req, res) => {
  if (req.user.role !== "admin") return res.status(403).json({ error: "Accès réservé à l'administration." });
  const { characterId } = req.params;
  const decision = req.body && req.body.decision;
  if (!UUID_REGEX.test(characterId) || !["approve", "reject"].includes(decision)) {
    return res.status(400).json({ error: "Décision de modération invalide." });
  }
  try {
    const approved = decision === "approve";
    const result = await query(
      `UPDATE public.characters
       SET publication_status = $2, visibility = $3,
           published_at = CASE WHEN $2 = 'approved' THEN NOW() ELSE NULL END,
           updated_at = NOW()
       WHERE id = $1 AND is_system = FALSE AND visibility = 'private'
         AND publication_status = 'pending' AND status = 'active'
       RETURNING id, name, publication_status, visibility, published_at`,
      [characterId, approved ? "approved" : "rejected", approved ? "public" : "private"]
    );
    if (!result.rows.length) return res.status(404).json({ error: "Demande introuvable ou déjà traitée." });
    return res.status(200).json({ success: true, character: result.rows[0] });
  } catch (error) {
    console.error("Erreur de décision de modération :", error.message);
    return res.status(500).json({ error: "Impossible d'enregistrer cette décision." });
  }
});

// POST /api/characters/:characterId/view — comptabilise une consultation unique par utilisateur et par jour.
router.post("/:characterId/view", requireAuth, requireSameOrigin, async (req, res) => {
  const { characterId } = req.params;
  if (!UUID_REGEX.test(characterId)) {
    return res.status(400).json({ error: "Identifiant de personnage invalide." });
  }
  try {
    const result = await query(
      `INSERT INTO public.character_view_events (user_id, character_id)
       SELECT $1, c.id
       FROM public.characters c
       WHERE c.id = $2 AND c.status = 'active'
         AND (c.is_system = TRUE OR
              (c.visibility = 'public' AND c.publication_status = 'approved'))
       ON CONFLICT (user_id, character_id, view_date) DO NOTHING
       RETURNING character_id`,
      [req.user.id, characterId]
    );
    if (!result.rows.length) {
      const accessible = await query(
        `SELECT id FROM public.characters
         WHERE id = $1 AND status = 'active'
           AND (is_system = TRUE OR (visibility = 'public' AND publication_status = 'approved')) LIMIT 1`,
        [characterId]
      );
      if (!accessible.rows.length) {
        return res.status(404).json({ error: "Personnage public introuvable." });
      }
    }
    return res.status(200).json({ success: true, counted: Boolean(result.rows.length) });
  } catch (error) {
    console.error("Erreur de comptage de consultation :", error.message);
    return res.status(500).json({ error: "Impossible d'enregistrer cette consultation." });
  }
});

// GET /api/characters/:characterId — fiche publique ou personnage appartenant à l'utilisateur.
router.get("/:characterId", optionalAuth, async (req, res) => {
  try {
    const { characterId } = req.params;
    if (!UUID_REGEX.test(characterId)) return res.status(400).json({ error: "Identifiant de personnage invalide." });
    const result = await query(
      `SELECT c.id, c.slug, c.name, c.tagline,
              CASE WHEN c.is_system OR c.avatar_status = 'approved' THEN c.avatar_url ELSE NULL END AS avatar_url,
              c.short_bio,
              (SELECT COUNT(*)::bigint FROM public.character_view_events v WHERE v.character_id = c.id) AS view_count,
              (SELECT COUNT(*)::bigint FROM public.user_favorite_characters f WHERE f.character_id = c.id) AS like_count,
              c.backstory, c.profile_i18n, c.personality_traits,
              c.greeting, c.category, c.tags,
              CASE WHEN c.is_system THEN 'NIYYA.ai'::varchar ELSE u.pseudonym END AS creator_pseudonym,
              c.published_at, c.created_at
       FROM public.characters c LEFT JOIN public.users u ON u.id = c.owner_user_id
       WHERE c.id = $1 AND c.status = 'active'
         AND (c.is_system = TRUE
           OR (c.visibility = 'public' AND c.publication_status = 'approved')
           OR c.owner_user_id = $2)
       LIMIT 1`,
      [characterId, req.user ? req.user.id : null]
    );
    if (!result.rows.length) return res.status(404).json({ error: "Personnage introuvable ou inaccessible." });
    return res.status(200).json({ success: true, character: publicCharacter(result.rows[0]) });
  } catch (error) {
    console.error("Erreur de consultation du personnage :", error.message);
    return res.status(500).json({ error: "Impossible de charger ce personnage." });
  }
});

module.exports = router;
