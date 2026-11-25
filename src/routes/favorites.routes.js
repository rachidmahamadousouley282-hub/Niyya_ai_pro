"use strict";

const express = require("express");
const { query } = require("../config/database");
const { requireAuth } = require("../middleware/auth.middleware");

const router = express.Router();
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

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

router.get("/", requireAuth, async (req, res) => {
  try {
    const result = await query(
      `SELECT c.id, c.slug, c.name, c.tagline,
              CASE WHEN c.is_system OR c.avatar_status = 'approved' THEN c.avatar_url ELSE NULL END AS avatar_url,
              c.short_bio, c.backstory, c.profile_i18n, c.personality_traits,
              c.greeting, c.category, c.tags, c.published_at, c.created_at,
              CASE WHEN c.is_system THEN 'NIYYA.ai'::varchar ELSE u.pseudonym END AS creator_pseudonym
       FROM public.user_favorite_characters f
       JOIN public.characters c ON c.id = f.character_id
       LEFT JOIN public.users u ON u.id = c.owner_user_id
       WHERE f.user_id = $1
         AND c.status = 'active'
         AND (c.is_system = TRUE OR (c.visibility = 'public' AND c.publication_status = 'approved'))
       ORDER BY f.created_at DESC
       LIMIT 100`,
      [req.user.id]
    );
    return res.status(200).json({ success: true, favorites: result.rows });
  } catch (error) {
    console.error("Erreur de chargement des favoris :", error.message);
    return res.status(500).json({ error: "Impossible de charger les favoris." });
  }
});

router.post("/:characterId", requireAuth, requireSameOrigin, async (req, res) => {
  const { characterId } = req.params;
  if (!UUID_REGEX.test(characterId)) {
    return res.status(400).json({ error: "Identifiant de personnage invalide." });
  }
  try {
    const accessible = await query(
      `SELECT id FROM public.characters
       WHERE id = $1 AND status = 'active'
         AND (is_system = TRUE OR (visibility = 'public' AND publication_status = 'approved'))
       LIMIT 1`,
      [characterId]
    );
    if (!accessible.rows.length) {
      return res.status(404).json({ error: "Personnage public introuvable." });
    }
    await query(
      `INSERT INTO public.user_favorite_characters (user_id, character_id)
       VALUES ($1, $2) ON CONFLICT (user_id, character_id) DO NOTHING`,
      [req.user.id, characterId]
    );
    const count = await query(
      "SELECT COUNT(*)::bigint AS like_count FROM public.user_favorite_characters WHERE character_id = $1",
      [characterId]
    );
    return res.status(200).json({ success: true, favorite: true, characterId, likeCount: count.rows[0]?.like_count || 0 });
  } catch (error) {
    console.error("Erreur d'ajout aux favoris :", error.message);
    return res.status(500).json({ error: "Impossible d'enregistrer ce favori." });
  }
});

router.delete("/:characterId", requireAuth, requireSameOrigin, async (req, res) => {
  const { characterId } = req.params;
  if (!UUID_REGEX.test(characterId)) {
    return res.status(400).json({ error: "Identifiant de personnage invalide." });
  }
  try {
    await query(
      "DELETE FROM public.user_favorite_characters WHERE user_id = $1 AND character_id = $2",
      [req.user.id, characterId]
    );
    const count = await query(
      "SELECT COUNT(*)::bigint AS like_count FROM public.user_favorite_characters WHERE character_id = $1",
      [characterId]
    );
    return res.status(200).json({ success: true, favorite: false, characterId, likeCount: count.rows[0]?.like_count || 0 });
  } catch (error) {
    console.error("Erreur de retrait des favoris :", error.message);
    return res.status(500).json({ error: "Impossible de retirer ce favori." });
  }
});

module.exports = router;
