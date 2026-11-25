"use strict";
const express = require("express");
const { rateLimit } = require("express-rate-limit");
const { query } = require("../config/database");
const { requireAuth, optionalAuth } = require("../middleware/auth.middleware");
const safety = require("../engines/safety.engine");

const router = express.Router();
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const writeLimiter = rateLimit({ windowMs: 60000, limit: 10, standardHeaders: "draft-8", legacyHeaders: false });

function sameOrigin(req, res, next) {
  const origin = req.get("origin");
  const host = req.get("host");
  const fetchSite = req.get("sec-fetch-site");
  if (fetchSite && fetchSite !== "same-origin" && fetchSite !== "none") return res.status(403).json({ error: "Requête inter-origine refusée." });
  if (!origin || !host) return res.status(403).json({ error: "Origine non vérifiée." });
  try {
    const parsed = new URL(origin);
    if (parsed.host !== host || (process.env.NODE_ENV === "production" && parsed.protocol !== "https:")) return res.status(403).json({ error: "Origine non autorisée." });
  } catch { return res.status(403).json({ error: "Origine invalide." }); }
  return next();
}
function validId(value) { return typeof value === "string" && UUID.test(value); }
function pagination(value, fallback, max) {
  if (value === undefined) return fallback;
  const n = Number(value);
  return Number.isInteger(n) && n >= 0 ? Math.min(n, max) : null;
}
function cleanText(value, max, field, min) {
  if (typeof value !== "string") throw new Error("Le champ " + field + " est invalide.");
  const cleaned = safety.sanitizeText(value, max);
  if (cleaned.length < min || cleaned.length > max) throw new Error("Le champ " + field + " doit contenir entre " + min + " et " + max + " caractères.");
  const risk = typeof safety.detectCommunityRisk === "function" ? safety.detectCommunityRisk(cleaned) : safety.detectRisk(cleaned);
  if (risk.action !== "allow") throw new Error("Ce texte contient des informations personnelles ou un contenu qui ne peut pas être publié.");
  return cleaned;
}
async function requireOnboarded(userId) {
  const result = await query("SELECT id, pseudonym, age_band, onboarded_at FROM public.users WHERE id = $1 LIMIT 1", [userId]);
  const user = result.rows[0];
  return user && user.onboarded_at && user.pseudonym ? user : null;
}
async function getProfile(userId, viewerId) {
  const result = await query(
    "SELECT u.id, u.pseudonym, u.bio, u.created_at, " +
    "(SELECT COUNT(*)::int FROM public.community_posts p WHERE p.author_user_id = u.id AND p.status = 'published') AS post_count, " +
    "(SELECT COUNT(*)::int FROM public.community_follows f WHERE f.followed_user_id = u.id) AS follower_count, " +
    "(SELECT COUNT(*)::int FROM public.community_follows f WHERE f.follower_user_id = u.id) AS following_count, " +
    "EXISTS (SELECT 1 FROM public.community_follows f WHERE f.follower_user_id = $2 AND f.followed_user_id = u.id) AS is_following " +
    "FROM public.users u WHERE u.id = $1 AND u.onboarded_at IS NOT NULL AND u.pseudonym IS NOT NULL LIMIT 1",
    [userId, viewerId || null]
  );
  return result.rows[0] || null;
}

router.get("/feed", optionalAuth, async (req, res) => {
  const limit = pagination(req.query.limit, 20, 30);
  const offset = pagination(req.query.offset, 0, 5000);
  if (limit === null || offset === null) return res.status(400).json({ error: "Pagination invalide." });
  try {
    const result = await query(
      "SELECT p.id, p.body, p.created_at, u.id AS author_id, u.pseudonym AS author_name, " +
      "(SELECT COUNT(*)::int FROM public.community_post_likes l WHERE l.post_id = p.id) AS like_count, " +
      "(SELECT COUNT(*)::int FROM public.community_comments c WHERE c.post_id = p.id AND c.status = 'published') AS comment_count, " +
      "EXISTS (SELECT 1 FROM public.community_post_likes l WHERE l.post_id = p.id AND l.user_id = $3) AS liked_by_me " +
      "FROM public.community_posts p JOIN public.users u ON u.id = p.author_user_id " +
      "WHERE p.status = 'published' AND u.onboarded_at IS NOT NULL " +
      "ORDER BY p.created_at DESC, p.id DESC LIMIT $1 OFFSET $2",
      [limit, offset, req.user ? req.user.id : null]
    );
    return res.status(200).json({ success: true, posts: result.rows });
  } catch (error) {
    console.error("Erreur du fil communautaire :", error.message);
    return res.status(500).json({ error: "Impossible de charger la communauté." });
  }
});

router.get("/profiles/me", requireAuth, async (req, res) => {
  try {
    const profile = await getProfile(req.user.id, req.user.id);
    if (!profile) return res.status(403).json({ error: "Termine d'abord ton inscription." });
    return res.status(200).json({ success: true, profile });
  } catch (error) {
    console.error("Erreur du profil communautaire :", error.message);
    return res.status(500).json({ error: "Impossible de charger ton profil." });
  }
});

router.patch("/profiles/me", requireAuth, sameOrigin, writeLimiter, async (req, res) => {
  try {
    if (!await requireOnboarded(req.user.id)) return res.status(403).json({ error: "Termine d'abord ton inscription." });
    const bio = req.body && req.body.bio === "" ? "" : cleanText(req.body && req.body.bio, 180, "bio", 0);
    const result = await query("UPDATE public.users SET bio = $2, updated_at = NOW() WHERE id = $1 RETURNING id, pseudonym, bio, created_at", [req.user.id, bio]);
    return res.status(200).json({ success: true, profile: result.rows[0] });
  } catch (error) {
    if (/champ|contenu|caractères/i.test(error.message || "")) return res.status(400).json({ error: error.message });
    console.error("Erreur de modification du profil :", error.message);
    return res.status(500).json({ error: "Impossible de modifier ton profil." });
  }
});

router.get("/profiles/:userId", optionalAuth, async (req, res) => {
  if (!validId(req.params.userId)) return res.status(400).json({ error: "Identifiant de profil invalide." });
  try {
    const profile = await getProfile(req.params.userId, req.user && req.user.id);
    if (!profile) return res.status(404).json({ error: "Profil introuvable." });
    return res.status(200).json({ success: true, profile, isOwnProfile: Boolean(req.user && req.user.id === profile.id) });
  } catch (error) {
    console.error("Erreur de consultation du profil :", error.message);
    return res.status(500).json({ error: "Impossible de charger ce profil." });
  }
});

router.post("/profiles/:userId/follow", requireAuth, sameOrigin, writeLimiter, async (req, res) => {
  const targetId = req.params.userId;
  if (!validId(targetId)) return res.status(400).json({ error: "Identifiant de profil invalide." });
  if (targetId === req.user.id) return res.status(400).json({ error: "Tu ne peux pas te suivre toi-même." });
  try {
    if (!await requireOnboarded(targetId)) return res.status(404).json({ error: "Profil introuvable." });
    if (!await requireOnboarded(req.user.id)) return res.status(403).json({ error: "Termine d'abord ton inscription." });
    const result = await query(
      "WITH removed AS (DELETE FROM public.community_follows WHERE follower_user_id = $1 AND followed_user_id = $2 RETURNING 1), " +
      "added AS (INSERT INTO public.community_follows (follower_user_id, followed_user_id) SELECT $1, $2 WHERE NOT EXISTS (SELECT 1 FROM removed) ON CONFLICT DO NOTHING RETURNING 1) " +
      "SELECT EXISTS(SELECT 1 FROM added) AS following",
      [req.user.id, targetId]
    );
    const counts = await query("SELECT COUNT(*)::int AS follower_count FROM public.community_follows WHERE followed_user_id = $1", [targetId]);
    return res.status(200).json({ success: true, following: result.rows[0].following, followerCount: counts.rows[0].follower_count });
  } catch (error) {
    console.error("Erreur d'abonnement :", error.message);
    return res.status(500).json({ error: "Impossible de modifier cet abonnement." });
  }
});

router.post("/posts", requireAuth, sameOrigin, writeLimiter, async (req, res) => {
  try {
    const user = await requireOnboarded(req.user.id);
    if (!user) return res.status(403).json({ error: "Termine d'abord ton inscription." });
    const body = cleanText(req.body && req.body.body, 600, "publication", 2);
    const result = await query("INSERT INTO public.community_posts (author_user_id, body) VALUES ($1, $2) RETURNING id, body, created_at", [req.user.id, body]);
    return res.status(201).json({ success: true, post: { ...result.rows[0], author_id: user.id, author_name: user.pseudonym, like_count: 0, comment_count: 0, liked_by_me: false } });
  } catch (error) {
    if (/champ|contenu|caractères/i.test(error.message || "")) return res.status(400).json({ error: error.message });
    console.error("Erreur de publication :", error.message);
    return res.status(500).json({ error: "Impossible de publier ce message." });
  }
});

router.delete("/posts/:postId", requireAuth, sameOrigin, writeLimiter, async (req, res) => {
  if (!validId(req.params.postId)) return res.status(400).json({ error: "Publication invalide." });
  try {
    const result = await query("UPDATE public.community_posts SET status = 'deleted', updated_at = NOW() WHERE id = $1 AND author_user_id = $2 AND status = 'published' RETURNING id", [req.params.postId, req.user.id]);
    if (!result.rows.length) return res.status(404).json({ error: "Publication introuvable." });
    return res.status(200).json({ success: true });
  } catch (error) {
    console.error("Erreur de suppression de publication :", error.message);
    return res.status(500).json({ error: "Impossible de supprimer cette publication." });
  }
});

router.post("/posts/:postId/like", requireAuth, sameOrigin, writeLimiter, async (req, res) => {
  if (!validId(req.params.postId)) return res.status(400).json({ error: "Publication invalide." });
  try {
    if (!await requireOnboarded(req.user.id)) return res.status(403).json({ error: "Termine d'abord ton inscription." });
    const result = await query(
      "WITH target AS (SELECT id FROM public.community_posts WHERE id = $2 AND status = 'published'), " +
      "removed AS (DELETE FROM public.community_post_likes l USING target t WHERE l.post_id = t.id AND l.user_id = $1 RETURNING 1), " +
      "added AS (INSERT INTO public.community_post_likes (user_id, post_id) SELECT $1, id FROM target WHERE NOT EXISTS (SELECT 1 FROM removed) ON CONFLICT DO NOTHING RETURNING 1) " +
      "SELECT EXISTS(SELECT 1 FROM target) AS exists, EXISTS(SELECT 1 FROM added) AS liked",
      [req.user.id, req.params.postId]
    );
    if (!result.rows[0] || !result.rows[0].exists) return res.status(404).json({ error: "Publication introuvable." });
    const count = await query("SELECT COUNT(*)::int AS like_count FROM public.community_post_likes WHERE post_id = $1", [req.params.postId]);
    return res.status(200).json({ success: true, liked: result.rows[0].liked, likeCount: count.rows[0].like_count });
  } catch (error) {
    console.error("Erreur de réaction :", error.message);
    return res.status(500).json({ error: "Impossible d'enregistrer ta réaction." });
  }
});

router.get("/posts/:postId/comments", optionalAuth, async (req, res) => {
  if (!validId(req.params.postId)) return res.status(400).json({ error: "Publication invalide." });
  try {
    const result = await query(
      "SELECT c.id, c.body, c.created_at, u.id AS author_id, u.pseudonym AS author_name " +
      "FROM public.community_comments c JOIN public.users u ON u.id = c.author_user_id " +
      "JOIN public.community_posts p ON p.id = c.post_id AND p.status = 'published' " +
      "WHERE c.post_id = $1 AND c.status = 'published' ORDER BY c.created_at ASC LIMIT 50",
      [req.params.postId]
    );
    return res.status(200).json({ success: true, comments: result.rows });
  } catch (error) {
    console.error("Erreur de chargement des commentaires :", error.message);
    return res.status(500).json({ error: "Impossible de charger les commentaires." });
  }
});

router.post("/posts/:postId/comments", requireAuth, sameOrigin, writeLimiter, async (req, res) => {
  if (!validId(req.params.postId)) return res.status(400).json({ error: "Publication invalide." });
  try {
    const user = await requireOnboarded(req.user.id);
    if (!user) return res.status(403).json({ error: "Termine d'abord ton inscription." });
    const body = cleanText(req.body && req.body.body, 240, "commentaire", 1);
    const result = await query(
      "INSERT INTO public.community_comments (post_id, author_user_id, body) " +
      "SELECT p.id, $2, $3 FROM public.community_posts p WHERE p.id = $1 AND p.status = 'published' " +
      "RETURNING id, post_id, body, created_at",
      [req.params.postId, req.user.id, body]
    );
    if (!result.rows.length) return res.status(404).json({ error: "Publication introuvable." });
    return res.status(201).json({ success: true, comment: { ...result.rows[0], author_id: user.id, author_name: user.pseudonym } });
  } catch (error) {
    if (/champ|contenu|caractères/i.test(error.message || "")) return res.status(400).json({ error: error.message });
    console.error("Erreur de commentaire :", error.message);
    return res.status(500).json({ error: "Impossible d'ajouter le commentaire." });
  }
});

router.post("/posts/:postId/report", requireAuth, sameOrigin, writeLimiter, async (req, res) => {
  if (!validId(req.params.postId)) return res.status(400).json({ error: "Publication invalide." });
  if (!await requireOnboarded(req.user.id)) return res.status(403).json({ error: "Termine d'abord ton inscription." });
  const reason = ["spam", "harassment", "unsafe", "personal_info", "other"].includes(req.body && req.body.reason) ? req.body.reason : "other";
  try {
    const exists = await query("SELECT id FROM public.community_posts WHERE id = $1 AND status = 'published'", [req.params.postId]);
    if (!exists.rows.length) return res.status(404).json({ error: "Publication introuvable." });
    const result = await query(
      "INSERT INTO public.community_reports (reporter_user_id, target_type, target_id, reason) VALUES ($1, 'post', $2, $3) " +
      "ON CONFLICT (reporter_user_id, target_type, target_id) DO NOTHING RETURNING id",
      [req.user.id, req.params.postId, reason]
    );
    return res.status(201).json({ success: true, reported: Boolean(result.rows.length) });
  } catch (error) {
    console.error("Erreur de signalement :", error.message);
    return res.status(500).json({ error: "Impossible d'envoyer ce signalement." });
  }
});

router.get("/moderation/reports", requireAuth, async (req, res) => {
  if (req.user.role !== "admin") return res.status(403).json({ error: "Accès réservé à l'administration." });
  try {
    const result = await query(
      "SELECT r.id, r.target_type, r.target_id, r.reason, r.created_at, u.pseudonym AS reporter_name, " +
      "CASE WHEN r.target_type = 'post' THEN p.body ELSE c.body END AS target_body " +
      "FROM public.community_reports r JOIN public.users u ON u.id = r.reporter_user_id " +
      "LEFT JOIN public.community_posts p ON r.target_type = 'post' AND p.id = r.target_id " +
      "LEFT JOIN public.community_comments c ON r.target_type = 'comment' AND c.id = r.target_id " +
      "WHERE r.status = 'open' ORDER BY r.created_at ASC LIMIT 100"
    );
    return res.status(200).json({ success: true, reports: result.rows });
  } catch (error) {
    console.error("Erreur de modération communautaire :", error.message);
    return res.status(500).json({ error: "Impossible de charger les signalements." });
  }
});

router.patch("/moderation/reports/:reportId", requireAuth, sameOrigin, writeLimiter, async (req, res) => {
  if (req.user.role !== "admin") return res.status(403).json({ error: "Accès réservé à l'administration." });
  const reportId = req.params.reportId;
  const decision = req.body && req.body.decision;
  if (!validId(reportId) || !["remove", "keep"].includes(decision)) return res.status(400).json({ error: "Décision invalide." });
  try {
    const report = await query("SELECT target_type, target_id FROM public.community_reports WHERE id = $1 AND status = 'open' LIMIT 1", [reportId]);
    if (!report.rows.length) return res.status(404).json({ error: "Signalement introuvable." });
    const target = report.rows[0];
    if (decision === "remove") {
      const table = target.target_type === "post" ? "community_posts" : "community_comments";
      await query("UPDATE public." + table + " SET status = 'hidden', updated_at = NOW() WHERE id = $1", [target.target_id]);
    }
    await query("UPDATE public.community_reports SET status = $2, reviewed_at = NOW(), reviewed_by = $3 WHERE id = $1", [reportId, decision === "remove" ? "resolved" : "dismissed", req.user.id]);
    return res.status(200).json({ success: true, decision });
  } catch (error) {
    console.error("Erreur de décision de modération :", error.message);
    return res.status(500).json({ error: "Impossible d'enregistrer la décision." });
  }
});

module.exports = router;
