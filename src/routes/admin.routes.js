"use strict";

const express = require("express");
const { query } = require("../config/database");
const providerEngine = require("../engines/provider.engine");
const { requireAuth } = require("../middleware/auth.middleware");

const router = express.Router();

router.get("/character-analytics", requireAuth, async (req, res) => {
  if (req.user.role !== "admin") {
    return res.status(403).json({ error: "Accès réservé à la direction NIYYA.ai." });
  }

  const requestedDays = Number(req.query.days || 30);
  const days = [7, 30, 90].includes(requestedDays) ? requestedDays : 30;

  try {
    const summary = await query(
      `SELECT
         (SELECT COUNT(*)::bigint FROM public.character_view_events
          WHERE view_date >= CURRENT_DATE - ($1::integer - 1)) AS views,
         (SELECT COUNT(*)::bigint FROM public.user_favorite_characters f
          JOIN public.characters c ON c.id = f.character_id
          WHERE f.created_at >= NOW() - ($1::integer * INTERVAL '1 day')
            AND c.status = 'active'
            AND (c.is_system = TRUE OR (c.visibility = 'public' AND c.publication_status = 'approved'))) AS likes,
         (SELECT COUNT(*)::bigint FROM public.conversations conv
          JOIN public.characters c ON c.id = conv.character_id
          WHERE conv.created_at >= NOW() - ($1::integer * INTERVAL '1 day')
            AND c.status = 'active'
            AND (c.is_system = TRUE OR (c.visibility = 'public' AND c.publication_status = 'approved'))) AS conversations_started,
         (SELECT COUNT(*)::bigint FROM public.characters c
          WHERE c.status = 'active'
            AND (c.is_system = TRUE OR (c.visibility = 'public' AND c.publication_status = 'approved'))) AS public_characters`,
      [days]
    );

    const topCharacters = await query(
      `SELECT c.id, c.name, c.category,
         (SELECT COUNT(*)::bigint FROM public.character_view_events v
          WHERE v.character_id = c.id
            AND v.view_date >= CURRENT_DATE - ($1::integer - 1)) AS views,
         (SELECT COUNT(*)::bigint FROM public.user_favorite_characters f
          WHERE f.character_id = c.id
            AND f.created_at >= NOW() - ($1::integer * INTERVAL '1 day')) AS likes,
         (SELECT COUNT(*)::bigint FROM public.conversations conv
          WHERE conv.character_id = c.id
            AND conv.created_at >= NOW() - ($1::integer * INTERVAL '1 day')) AS conversations_started
       FROM public.characters c
       WHERE c.status = 'active'
         AND (c.is_system = TRUE OR (c.visibility = 'public' AND c.publication_status = 'approved'))
       ORDER BY views DESC, likes DESC, conversations_started DESC, c.name ASC
       LIMIT 25`,
      [days]
    );

    const dailyViews = await query(
      `SELECT view_date AS day, COUNT(*)::bigint AS count
       FROM public.character_view_events
       WHERE view_date >= CURRENT_DATE - ($1::integer - 1)
       GROUP BY view_date ORDER BY view_date ASC`,
      [days]
    );

    const dailyLikes = await query(
      `SELECT f.created_at::date AS day, COUNT(*)::bigint AS count
       FROM public.user_favorite_characters f
       JOIN public.characters c ON c.id = f.character_id
       WHERE f.created_at >= NOW() - ($1::integer * INTERVAL '1 day')
         AND c.status = 'active'
         AND (c.is_system = TRUE OR (c.visibility = 'public' AND c.publication_status = 'approved'))
       GROUP BY f.created_at::date ORDER BY f.created_at::date ASC`,
      [days]
    );

    const dailyConversations = await query(
      `SELECT conv.created_at::date AS day, COUNT(*)::bigint AS count
       FROM public.conversations conv
       JOIN public.characters c ON c.id = conv.character_id
       WHERE conv.created_at >= NOW() - ($1::integer * INTERVAL '1 day')
         AND c.status = 'active'
         AND (c.is_system = TRUE OR (c.visibility = 'public' AND c.publication_status = 'approved'))
       GROUP BY conv.created_at::date ORDER BY conv.created_at::date ASC`,
      [days]
    );

    return res.status(200).json({
      success: true,
      periodDays: days,
      summary: summary.rows[0] || {},
      topCharacters: topCharacters.rows,
      daily: {
        views: dailyViews.rows,
        likes: dailyLikes.rows,
        conversations: dailyConversations.rows
      }
    });
  } catch (error) {
    console.error("Erreur des statistiques personnages :", error.message);
    return res.status(500).json({ error: "Impossible de charger les statistiques des personnages." });
  }
});

router.get("/official/announcements", requireAuth, async (req, res) => {
  if (req.user.role !== "admin") {
    return res.status(403).json({ error: "Accès réservé à l'équipe NIYYA." });
  }
  try {
    const result = await query(
      "SELECT p.id, p.body, p.created_at FROM public.community_posts p " +
      "JOIN public.users u ON u.id = p.author_user_id " +
      "WHERE u.is_official = TRUE AND p.status = 'published' " +
      "ORDER BY p.created_at DESC LIMIT 30"
    );
    return res.status(200).json({ success: true, announcements: result.rows });
  } catch (error) {
    console.error("Erreur de lecture des annonces officielles :", error.message);
    return res.status(500).json({ error: "Impossible de charger les annonces officielles." });
  }
});

router.post("/official/announcements", requireAuth, async (req, res) => {
  if (req.user.role !== "admin") {
    return res.status(403).json({ error: "Accès réservé à l'équipe NIYYA." });
  }
  const origin = req.get("origin");
  const host = req.get("host");
  try {
    if (!origin || !host || new URL(origin).host !== host) {
      return res.status(403).json({ error: "Origine de requête non autorisée." });
    }
  } catch {
    return res.status(403).json({ error: "Origine de requête invalide." });
  }
  const body = typeof req.body?.body === "string" ? req.body.body.trim() : "";
  if (body.length < 2 || body.length > 600) {
    return res.status(400).json({ error: "Une annonce doit contenir entre 2 et 600 caractères." });
  }
  try {
    const result = await query(
      "INSERT INTO public.community_posts (author_user_id, body, visibility, status) " +
      "SELECT id, $1, 'public', 'published' FROM public.users WHERE is_official = TRUE " +
      "RETURNING id, body, visibility, status, created_at",
      [body]
    );
    if (!result.rows.length) return res.status(503).json({ error: "Le compte officiel n'est pas disponible." });
    return res.status(201).json({ success: true, post: result.rows[0] });
  } catch (error) {
    console.error("Erreur de publication officielle :", error.message);
    return res.status(500).json({ error: "Impossible de publier l'annonce." });
  }
});


module.exports = router;


router.get("/system-status", requireAuth, async (req, res) => {
  if (req.user.role !== "admin") {
    return res.status(403).json({ error: "Accès réservé à la direction NIYYA.ai." });
  }
  try {
    const activeName = String(process.env.AI_PROVIDER || providerEngine.DEFAULT_PROVIDER).trim().toLowerCase();
    const available = providerEngine.getAvailableProviders();
    const selected = available.find(item => item.name === activeName);
    return res.status(200).json({
      success: true,
      ai: {
        provider: selected ? selected.name : "unknown",
        configured: Boolean(selected && selected.configured),
        mode: selected ? selected.mode : "disabled"
      }
    });
  } catch (error) {
    console.error("Erreur de diagnostic IA :", error.message);
    return res.status(500).json({ error: "Impossible de vérifier la configuration IA." });
  }
});
