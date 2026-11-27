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

router.get("/platform-analytics", requireAuth, async (req, res) => {
  if (req.user.role !== "admin") return res.status(403).json({ error: "Accès réservé à la direction NIYYA.ai." });
  const requestedDays = Number(req.query.days || 30);
  const days = [7, 30, 90].includes(requestedDays) ? requestedDays : 30;
  try {
    const result = await query(`
      WITH active_users AS (
        SELECT conv.user_id FROM public.conversations conv
        WHERE conv.created_at >= NOW() - ($1::integer * INTERVAL '1 day')
        UNION
        SELECT conv.user_id FROM public.messages m
        JOIN public.conversations conv ON conv.id = m.conversation_id
        WHERE m.created_at >= NOW() - ($1::integer * INTERVAL '1 day') AND m.role = 'user'
        UNION
        SELECT p.author_user_id FROM public.community_posts p
        WHERE p.created_at >= NOW() - ($1::integer * INTERVAL '1 day') AND p.status = 'published'
        UNION
        SELECT c.author_user_id FROM public.community_comments c
        WHERE c.created_at >= NOW() - ($1::integer * INTERVAL '1 day') AND c.status = 'published'
        UNION
        SELECT l.user_id FROM public.community_post_likes l
        WHERE l.created_at >= NOW() - ($1::integer * INTERVAL '1 day')
      )
      SELECT
        (SELECT COUNT(*)::bigint FROM public.users WHERE is_guest = FALSE) AS members_total,
        (SELECT COUNT(*)::bigint FROM public.users WHERE is_guest = FALSE AND created_at >= NOW() - ($1::integer * INTERVAL '1 day')) AS new_members_period,
        (SELECT COUNT(DISTINCT a.user_id)::bigint FROM active_users a JOIN public.users u ON u.id = a.user_id WHERE u.is_guest = FALSE) AS active_members,
        (SELECT COUNT(DISTINCT a.user_id)::bigint FROM active_users a JOIN public.users u ON u.id = a.user_id WHERE u.is_guest = FALSE AND u.created_at < NOW() - ($1::integer * INTERVAL '1 day')) AS returning_members_period,
        (SELECT COUNT(*)::bigint FROM public.conversations) AS conversations_total,
        (SELECT COUNT(*)::bigint FROM public.conversations WHERE created_at >= NOW() - ($1::integer * INTERVAL '1 day')) AS conversations_period,
        (SELECT COUNT(*)::bigint FROM public.messages) AS messages_total,
        (SELECT COUNT(*)::bigint FROM public.messages m JOIN public.conversations conv ON conv.id = m.conversation_id JOIN public.users u ON u.id = conv.user_id WHERE u.is_guest = FALSE AND m.created_at >= NOW() - ($1::integer * INTERVAL '1 day')) AS messages_period,
        (SELECT COUNT(*)::bigint FROM public.community_posts WHERE status = 'published') AS posts_total,
        (SELECT COUNT(*)::bigint FROM public.community_posts WHERE status = 'published' AND created_at >= NOW() - ($1::integer * INTERVAL '1 day')) AS posts_period,
        (SELECT COUNT(*)::bigint FROM public.community_comments WHERE status = 'published') AS comments_total,
        (SELECT COUNT(*)::bigint FROM public.community_comments WHERE status = 'published' AND created_at >= NOW() - ($1::integer * INTERVAL '1 day')) AS comments_period,
        (SELECT COUNT(*)::bigint FROM public.community_post_likes) AS likes_total,
        (SELECT COUNT(*)::bigint FROM public.community_post_likes WHERE created_at >= NOW() - ($1::integer * INTERVAL '1 day')) AS likes_period,
        (SELECT COUNT(*)::bigint FROM public.community_follows WHERE created_at >= NOW() - ($1::integer * INTERVAL '1 day')) AS follows_period,
        (SELECT COUNT(*)::bigint FROM public.community_follows) AS follows_total,
        (SELECT COUNT(*)::bigint FROM public.character_view_events) AS character_views_total
    `, [days]);
    const [dailyMembers, dailyMessages, dailyPosts, dailyComments, dailyLikes, dailyFollows, dailyConversations, dailyActiveMembers] = await Promise.all([
      query("SELECT created_at::date AS day, COUNT(*)::bigint AS count FROM public.users WHERE is_guest = FALSE AND created_at >= CURRENT_DATE - ($1::integer - 1) GROUP BY created_at::date ORDER BY created_at::date ASC", [days]),
      query("SELECT m.created_at::date AS day, COUNT(*)::bigint AS count FROM public.messages m JOIN public.conversations conv ON conv.id = m.conversation_id JOIN public.users u ON u.id = conv.user_id WHERE u.is_guest = FALSE AND m.created_at >= CURRENT_DATE - ($1::integer - 1) GROUP BY m.created_at::date ORDER BY m.created_at::date ASC", [days]),
      query("SELECT created_at::date AS day, COUNT(*)::bigint AS count FROM public.community_posts WHERE status = 'published' AND created_at >= CURRENT_DATE - ($1::integer - 1) GROUP BY created_at::date ORDER BY created_at::date ASC", [days]),
      query("SELECT created_at::date AS day, COUNT(*)::bigint AS count FROM public.community_comments WHERE status = 'published' AND created_at >= CURRENT_DATE - ($1::integer - 1) GROUP BY created_at::date ORDER BY created_at::date ASC", [days]),
      query("SELECT created_at::date AS day, COUNT(*)::bigint AS count FROM public.community_post_likes WHERE created_at >= CURRENT_DATE - ($1::integer - 1) GROUP BY created_at::date ORDER BY created_at::date ASC", [days]),
      query("SELECT created_at::date AS day, COUNT(*)::bigint AS count FROM public.community_follows WHERE created_at >= CURRENT_DATE - ($1::integer - 1) GROUP BY created_at::date ORDER BY created_at::date ASC", [days]),
      query("SELECT created_at::date AS day, COUNT(*)::bigint AS count FROM public.conversations WHERE created_at >= CURRENT_DATE - ($1::integer - 1) GROUP BY created_at::date ORDER BY created_at::date ASC", [days]),
      query(`WITH actions AS (
        SELECT conv.user_id, conv.created_at::date AS day FROM public.conversations conv WHERE conv.created_at >= CURRENT_DATE - ($1::integer - 1)
        UNION ALL
        SELECT conv.user_id, m.created_at::date AS day FROM public.messages m JOIN public.conversations conv ON conv.id = m.conversation_id WHERE m.role = 'user' AND m.created_at >= CURRENT_DATE - ($1::integer - 1)
        UNION ALL
        SELECT p.author_user_id, p.created_at::date FROM public.community_posts p WHERE p.status = 'published' AND p.created_at >= CURRENT_DATE - ($1::integer - 1)
        UNION ALL
        SELECT c.author_user_id, c.created_at::date FROM public.community_comments c WHERE c.status = 'published' AND c.created_at >= CURRENT_DATE - ($1::integer - 1)
        UNION ALL
        SELECT l.user_id, l.created_at::date FROM public.community_post_likes l WHERE l.created_at >= CURRENT_DATE - ($1::integer - 1)
      )
      SELECT actions.day, COUNT(DISTINCT actions.user_id)::bigint AS count
      FROM actions JOIN public.users u ON u.id = actions.user_id
      WHERE u.is_guest = FALSE GROUP BY actions.day ORDER BY actions.day ASC`, [days])
    ]);
    return res.status(200).json({
      success: true,
      periodDays: days,
      totals: result.rows[0] || {},
      daily: {
        registrations: dailyMembers.rows, messages: dailyMessages.rows, posts: dailyPosts.rows,
        comments: dailyComments.rows, likes: dailyLikes.rows, follows: dailyFollows.rows,
        conversations: dailyConversations.rows, activeMembers: dailyActiveMembers.rows
      },
      measurement: { siteVisits: false, timeSpent: false }
    });
  } catch (error) {
    console.error("Erreur des statistiques globales :", error.message);
    return res.status(500).json({ error: "Impossible de charger les statistiques globales." });
  }
});

router.get("/site-traffic", requireAuth, async (req, res) => {
  if (req.user.role !== "admin") return res.status(403).json({ error: "Accès réservé à la direction NIYYA.ai." });
  const requestedDays = Number(req.query.days || 30);
  const days = [7, 30, 90].includes(requestedDays) ? requestedDays : 30;
  try {
    const [current, previous, daily, pages] = await Promise.all([
      query("SELECT COUNT(*)::bigint AS page_views, COUNT(DISTINCT visitor_key_hash)::bigint AS unique_visitors FROM public.site_analytics_events WHERE occurred_at >= NOW() - ($1::integer * INTERVAL '1 day')", [days]),
      query("SELECT COUNT(*)::bigint AS page_views, COUNT(DISTINCT visitor_key_hash)::bigint AS unique_visitors FROM public.site_analytics_events WHERE occurred_at >= NOW() - (($1::integer * 2) * INTERVAL '1 day') AND occurred_at < NOW() - ($1::integer * INTERVAL '1 day')", [days]),
      query("SELECT occurred_at::date AS day, COUNT(*)::bigint AS page_views, COUNT(DISTINCT visitor_key_hash)::bigint AS unique_visitors FROM public.site_analytics_events WHERE occurred_at >= CURRENT_DATE - ($1::integer - 1) GROUP BY occurred_at::date ORDER BY occurred_at::date ASC", [days]),
      query("SELECT page_path, COUNT(*)::bigint AS page_views, COUNT(DISTINCT visitor_key_hash)::bigint AS unique_visitors FROM public.site_analytics_events WHERE occurred_at >= NOW() - ($1::integer * INTERVAL '1 day') GROUP BY page_path ORDER BY page_views DESC, page_path ASC LIMIT 15", [days])
    ]);
    const now = current.rows[0] || {}, before = previous.rows[0] || {};
    const percent = (a, b) => Number(b || 0) === 0
      ? (Number(a || 0) > 0 ? null : 0)
      : Math.round(((Number(a || 0) - Number(b || 0)) / Number(b)) * 1000) / 10;
    return res.status(200).json({
      success: true, periodDays: days, current: now, previous: before,
      growth: { pageViewsPercent: percent(now.page_views, before.page_views), uniqueVisitorsPercent: percent(now.unique_visitors, before.unique_visitors) },
      daily: daily.rows, pages: pages.rows,
      tracking: { startedAt: "after-deployment", storesIp: false, storesUserAgent: false }
    });
  } catch (error) {
    console.error("Erreur des statistiques de fréquentation :", error.message);
    return res.status(500).json({ error: "Impossible de charger les statistiques de fréquentation." });
  }
});

router.get("/official/announcements", requireAuth, async (req, res) => {
  if (req.user.role !== "admin") {
    return res.status(403).json({ error: "Accès réservé à l'équipe NIYYA." });
  }
  try {
    const result = await query(
      "SELECT p.id, p.body, (p.media_data IS NOT NULL) AS has_image, p.media_mime, p.created_at FROM public.community_posts p " +
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
  let image = null;
  if (req.body && req.body.image) {
    const match = /^data:(image\\/(?:jpeg|png|webp));base64,([A-Za-z0-9+/=]+)$/.exec(req.body.image);
    if (!match) return res.status(400).json({ error: "Image invalide. Formats acceptés : JPG, PNG ou WebP." });
    const imageBytes = Buffer.from(match[2], "base64");
    if (!imageBytes.length || imageBytes.length > 1500000) return res.status(413).json({ error: "L'image doit faire 1,5 Mo maximum après compression." });
    const signatures = {
      "image/jpeg": imageBytes[0] === 0xff && imageBytes[1] === 0xd8,
      "image/png": imageBytes.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10])),
      "image/webp": imageBytes.toString("ascii",0,4) === "RIFF" && imageBytes.toString("ascii",8,12) === "WEBP"
    };
    if (!signatures[match[1]]) return res.status(400).json({ error: "Le fichier ne correspond pas à son format déclaré." });
    image = { data: imageBytes, mime: match[1] };
  }
  if ((body.length < 2 && !image) || body.length > 600) {
    return res.status(400).json({ error: "Ajoute un texte (2 à 600 caractères) ou une image à l'annonce." });
  }
  try {
    const result = await query(
      "INSERT INTO public.community_posts (author_user_id, body, visibility, media_data, media_mime, status) " +
      "SELECT id, $1, 'public', $2, $3, 'published' FROM public.users WHERE is_official = TRUE " +
      "RETURNING id, body, visibility, status, (media_data IS NOT NULL) AS has_image, media_mime, created_at",
      [body, image ? image.data : null, image ? image.mime : null]
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
