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
    "(SELECT COUNT(*)::int FROM public.community_posts p WHERE p.author_user_id = u.id AND p.status = 'published' AND (p.visibility = 'public' OR u.id = $2)) AS post_count, " +
    "(SELECT COUNT(*)::int FROM public.community_follows f WHERE f.followed_user_id = u.id) AS follower_count, " +
    "(SELECT COUNT(*)::int FROM public.community_follows f WHERE f.follower_user_id = u.id) AS following_count, " +
    "EXISTS (SELECT 1 FROM public.community_follows f WHERE f.follower_user_id = $2 AND f.followed_user_id = u.id) AS is_following, " +
    "EXISTS (SELECT 1 FROM public.community_blocks b WHERE b.blocker_user_id = $2 AND b.blocked_user_id = u.id) AS is_blocked " +
    "FROM public.users u WHERE u.id = $1 AND u.onboarded_at IS NOT NULL AND u.pseudonym IS NOT NULL LIMIT 1",
    [userId, viewerId || null]
  );
  return result.rows[0] || null;
}

router.get("/feed", optionalAuth, async (req, res) => {
  const limit = pagination(req.query.limit, 20, 30);
  const offset = pagination(req.query.offset, 0, 5000);
  const mode = ["all", "following", "mine"].includes(req.query.mode) ? req.query.mode : "all";
  if (limit === null || offset === null) return res.status(400).json({ error: "Pagination invalide." });
  try {
    const viewer = req.user ? req.user.id : null;
    const result = await query(
      "SELECT p.id, p.body, p.visibility, (p.media_data IS NOT NULL) AS has_image, p.media_mime, p.created_at, u.id AS author_id, u.pseudonym AS author_name, " +
      "(SELECT COUNT(*)::int FROM public.community_post_likes l WHERE l.post_id = p.id) AS like_count, " +
      "(SELECT COUNT(*)::int FROM public.community_comments c WHERE c.post_id = p.id AND c.status = 'published') AS comment_count, " +
      "EXISTS (SELECT 1 FROM public.community_post_likes l WHERE l.post_id = p.id AND l.user_id = $3) AS liked_by_me, " +
      "EXISTS (SELECT 1 FROM public.community_follows f WHERE f.follower_user_id = $3 AND f.followed_user_id = u.id) AS is_following " +
      "FROM public.community_posts p JOIN public.users u ON u.id = p.author_user_id " +
      "WHERE p.status = 'published' AND u.onboarded_at IS NOT NULL " +
      "AND (p.visibility = 'public' OR p.author_user_id = $3) " +
      "AND ($4 <> 'following' OR EXISTS (SELECT 1 FROM public.community_follows f WHERE f.follower_user_id = $3 AND f.followed_user_id = u.id)) " +
      "AND ($4 <> 'mine' OR p.author_user_id = $3) " +
      "AND ($3 IS NULL OR NOT EXISTS (SELECT 1 FROM public.community_blocks b WHERE (b.blocker_user_id = $3 AND b.blocked_user_id = u.id) OR (b.blocker_user_id = u.id AND b.blocked_user_id = $3))) " +
      "ORDER BY p.created_at DESC, p.id DESC LIMIT $1 OFFSET $2",
      [limit, offset, viewer, mode]
    );
    return res.status(200).json({ success: true, posts: result.rows, mode });
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
  const body = req.body && typeof req.body === "object" ? req.body : {};
  const hasBio = Object.prototype.hasOwnProperty.call(body, "bio");
  const hasPseudonym = Object.prototype.hasOwnProperty.call(body, "pseudonym");
  if (!hasBio && !hasPseudonym) return res.status(400).json({ error: "Aucune modification à enregistrer." });

  try {
    if (!await requireOnboarded(req.user.id)) return res.status(403).json({ error: "Termine d'abord ton inscription." });
    const updates = [];
    const values = [];
    const add = (column, value) => {
      values.push(value);
      updates.push(column + " = $" + values.length);
    };

    if (hasBio) {
      const bio = body.bio === "" ? "" : cleanText(body.bio, 180, "bio", 0);
      add("bio", bio);
    }
    if (hasPseudonym) {
      if (typeof body.pseudonym !== "string") return res.status(400).json({ error: "Le pseudo est invalide." });
      const pseudonym = body.pseudonym.trim();
      if (!/^[A-Za-z0-9_]{3,20}$/.test(pseudonym)) {
        return res.status(400).json({ error: "Le pseudo doit contenir 3 à 20 lettres, chiffres ou _." });
      }
      const pseudonymRisk = typeof safety.detectCommunityRisk === "function"
        ? safety.detectCommunityRisk(pseudonym)
        : safety.detectRisk(pseudonym);
      if (pseudonymRisk.action !== "allow") {
        return res.status(400).json({ error: "Ce pseudo ne peut pas être utilisé." });
      }
      add("pseudonym", pseudonym);
      updates.push("pseudonym_changed_at = NOW()");
    }

    values.push(req.user.id);
    const result = await query(
      "UPDATE public.users SET " + updates.join(", ") + ", updated_at = NOW() WHERE id = $" + values.length +
      " RETURNING id, pseudonym, bio, created_at",
      values
    );
    if (!result.rows.length) return res.status(404).json({ error: "Profil introuvable." });
    return res.status(200).json({ success: true, profile: result.rows[0] });
  } catch (error) {
    if (error.code === "23505") return res.status(409).json({ error: "Ce pseudo est déjà utilisé. Choisis-en un autre." });
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
    const blocked = await query("SELECT 1 FROM public.community_blocks WHERE (blocker_user_id=$1 AND blocked_user_id=$2) OR (blocker_user_id=$2 AND blocked_user_id=$1) LIMIT 1", [req.user.id,targetId]);
    if (blocked.rows.length) return res.status(403).json({ error: "Cet abonnement n'est pas disponible." });
    const result = await query(
      "WITH removed AS (DELETE FROM public.community_follows WHERE follower_user_id = $1 AND followed_user_id = $2 RETURNING 1), " +
      "added AS (INSERT INTO public.community_follows (follower_user_id, followed_user_id) SELECT $1, $2 WHERE NOT EXISTS (SELECT 1 FROM removed) ON CONFLICT DO NOTHING RETURNING 1) " +
      "SELECT EXISTS(SELECT 1 FROM added) AS following",
      [req.user.id, targetId]
    );
    if (result.rows[0].following) await query("INSERT INTO public.community_notifications (recipient_user_id, actor_user_id, event_type) VALUES ($1,$2,'follow')", [targetId, req.user.id]);
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
    const rawBody = typeof (req.body && req.body.body) === "string" ? req.body.body : "";
    const body = rawBody.trim() ? cleanText(rawBody, 600, "publication", 2) : "";
    const visibility = req.body && req.body.visibility === "private" ? "private" : "public";
    let image = null;
    if (req.body && req.body.image) {
      const match = /^data:(image\/(?:jpeg|png|webp));base64,([A-Za-z0-9+/=]+)$/.exec(req.body.image);
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
    if (body.length < 2 && !image) return res.status(400).json({ error: "Ajoute un texte ou une image à ta publication." });
    const result = await query(
      "INSERT INTO public.community_posts (author_user_id, body, visibility, media_data, media_mime) VALUES ($1,$2,$3,$4,$5) RETURNING id, body, visibility, (media_data IS NOT NULL) AS has_image, media_mime, created_at",
      [req.user.id, body, visibility, image ? image.data : null, image ? image.mime : null]
    );
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
      "WITH target AS (SELECT id FROM public.community_posts WHERE id = $2 AND status = 'published' AND (visibility = 'public' OR author_user_id = $1) AND NOT EXISTS (SELECT 1 FROM public.community_blocks b WHERE (b.blocker_user_id = $1 AND b.blocked_user_id = author_user_id) OR (b.blocker_user_id = author_user_id AND b.blocked_user_id = $1))), " +
      "removed AS (DELETE FROM public.community_post_likes l USING target t WHERE l.post_id = t.id AND l.user_id = $1 RETURNING 1), " +
      "added AS (INSERT INTO public.community_post_likes (user_id, post_id) SELECT $1, id FROM target WHERE NOT EXISTS (SELECT 1 FROM removed) ON CONFLICT DO NOTHING RETURNING 1) " +
      "SELECT EXISTS(SELECT 1 FROM target) AS exists, EXISTS(SELECT 1 FROM added) AS liked",
      [req.user.id, req.params.postId]
    );
    if (!result.rows[0] || !result.rows[0].exists) return res.status(404).json({ error: "Publication introuvable." });
    if (result.rows[0].liked) {
      await query("INSERT INTO public.community_notifications (recipient_user_id, actor_user_id, event_type, post_id) SELECT author_user_id, $1, 'like', id FROM public.community_posts WHERE id = $2 AND author_user_id <> $1", [req.user.id, req.params.postId]);
    }
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
      "WHERE c.post_id = $1 AND c.status = 'published' AND (p.visibility = 'public' OR p.author_user_id = $2) AND ($2 IS NULL OR NOT EXISTS (SELECT 1 FROM public.community_blocks b WHERE (b.blocker_user_id = $2 AND b.blocked_user_id = p.author_user_id) OR (b.blocker_user_id = p.author_user_id AND b.blocked_user_id = $2))) ORDER BY c.created_at ASC LIMIT 50",
      [req.params.postId, req.user ? req.user.id : null]
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
      "SELECT p.id, $2, $3 FROM public.community_posts p WHERE p.id = $1 AND p.status = 'published' AND (p.visibility = 'public' OR p.author_user_id = $2) " +
      "AND NOT EXISTS (SELECT 1 FROM public.community_blocks b WHERE (b.blocker_user_id = $2 AND b.blocked_user_id = p.author_user_id) OR (b.blocker_user_id = p.author_user_id AND b.blocked_user_id = $2)) " +
      "RETURNING id, post_id, body, created_at",
      [req.params.postId, req.user.id, body]
    );
    if (!result.rows.length) return res.status(404).json({ error: "Publication introuvable." });
    await query("INSERT INTO public.community_notifications (recipient_user_id, actor_user_id, event_type, post_id) SELECT author_user_id, $1, 'comment', id FROM public.community_posts WHERE id = $2 AND author_user_id <> $1", [req.user.id, req.params.postId]);
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


router.get("/profiles/:userId/relations", optionalAuth, async(req,res)=>{
  const target=req.params.userId;
  const type=req.query.type==="following"?"following":"followers";
  if(!validId(target))return res.status(400).json({error:"Profil invalide."});
  try{
    const col=type==="followers"?"followed_user_id":"follower_user_id";
    const join=type==="followers"?"f.follower_user_id":"f.followed_user_id";
    const result=await query(
      "SELECT u.id,u.pseudonym,u.bio FROM public.community_follows f JOIN public.users u ON u.id="+join+
      " WHERE f."+col+"=$1 AND u.onboarded_at IS NOT NULL AND ($2 IS NULL OR NOT EXISTS(SELECT 1 FROM public.community_blocks b WHERE (b.blocker_user_id=$2 AND b.blocked_user_id=u.id) OR (b.blocker_user_id=u.id AND b.blocked_user_id=$2))) ORDER BY f.created_at DESC LIMIT 100",
      [target,req.user?req.user.id:null]);
    return res.json({success:true,members:result.rows,type});
  }catch(error){return res.status(500).json({error:"Impossible de charger cette liste."});}
});

router.post("/comments/:commentId/report", requireAuth, sameOrigin, writeLimiter, async(req,res)=>{
  if(!validId(req.params.commentId))return res.status(400).json({error:"Commentaire invalide."});
  const reason=["spam","harassment","unsafe","personal_info","other"].includes(req.body&&req.body.reason)?req.body.reason:"other";
  try{
    const exists=await query("SELECT id FROM public.community_comments WHERE id=$1 AND status='published'",[req.params.commentId]);
    if(!exists.rows.length)return res.status(404).json({error:"Commentaire introuvable."});
    const result=await query("INSERT INTO public.community_reports(reporter_user_id,target_type,target_id,reason) VALUES($1,'comment',$2,$3) ON CONFLICT(reporter_user_id,target_type,target_id) DO NOTHING RETURNING id",[req.user.id,req.params.commentId,reason]);
    return res.status(201).json({success:true,reported:Boolean(result.rows.length)});
  }catch(error){return res.status(500).json({error:"Impossible de signaler ce commentaire."});}
});


router.get("/posts/:postId/media", optionalAuth, async (req, res) => {
  if (!validId(req.params.postId)) return res.sendStatus(400);
  try {
    const result = await query("SELECT media_data, media_mime, author_user_id, visibility, status FROM public.community_posts WHERE id=$1 LIMIT 1", [req.params.postId]);
    const item = result.rows[0];
    if (!item || !item.media_data || item.status !== "published") return res.sendStatus(404);
    if (item.visibility === "private" && (!req.user || req.user.id !== item.author_user_id)) return res.sendStatus(404);
    if (req.user) {
      const blocked = await query("SELECT 1 FROM public.community_blocks WHERE (blocker_user_id=$1 AND blocked_user_id=$2) OR (blocker_user_id=$2 AND blocked_user_id=$1) LIMIT 1", [req.user.id,item.author_user_id]);
      if (blocked.rows.length) return res.sendStatus(404);
    }
    res.set("Content-Type", item.media_mime);
    res.set("Cache-Control", item.visibility === "private" ? "private, no-store" : "public, max-age=3600");
    res.set("X-Content-Type-Options", "nosniff");
    return res.send(item.media_data);
  } catch (error) { console.error("Erreur média communauté :", error.message); return res.sendStatus(500); }
});

router.get("/profiles/:userId/posts", optionalAuth, async (req,res) => {
  if (!validId(req.params.userId)) return res.status(400).json({error:"Profil invalide."});
  const limit=pagination(req.query.limit,20,30);
  if(limit===null) return res.status(400).json({error:"Pagination invalide."});
  try {
    const viewer=req.user ? req.user.id : null;
    const result=await query(
      "SELECT p.id,p.body,p.visibility,(p.media_data IS NOT NULL) AS has_image,p.media_mime,p.created_at,u.id AS author_id,u.pseudonym AS author_name,"+
      "(SELECT COUNT(*)::int FROM public.community_post_likes l WHERE l.post_id=p.id) AS like_count,"+
      "(SELECT COUNT(*)::int FROM public.community_comments c WHERE c.post_id=p.id AND c.status='published') AS comment_count,"+
      "EXISTS(SELECT 1 FROM public.community_post_likes l WHERE l.post_id=p.id AND l.user_id=$2) AS liked_by_me "+
      "FROM public.community_posts p JOIN public.users u ON u.id=p.author_user_id "+
      "WHERE p.author_user_id=$1 AND p.status='published' AND (p.visibility='public' OR $1=$2) "+
      "AND ($2 IS NULL OR NOT EXISTS(SELECT 1 FROM public.community_blocks b WHERE (b.blocker_user_id=$2 AND b.blocked_user_id=$1) OR (b.blocker_user_id=$1 AND b.blocked_user_id=$2))) "+
      "ORDER BY p.created_at DESC LIMIT $3",[req.params.userId,viewer,limit]);
    return res.json({success:true,posts:result.rows});
  } catch(error){console.error("Erreur publications profil :",error.message);return res.status(500).json({error:"Impossible de charger les publications."});}
});

router.get("/search", optionalAuth, async (req,res)=>{
  const term=typeof req.query.q==="string"?req.query.q.trim().slice(0,40):"";
  if(term.length<2) return res.json({success:true,profiles:[]});
  try{
    const result=await query(
      "SELECT u.id,u.pseudonym,u.bio,(SELECT COUNT(*)::int FROM public.community_follows f WHERE f.followed_user_id=u.id) AS follower_count "+
      "FROM public.users u WHERE u.onboarded_at IS NOT NULL AND u.pseudonym ILIKE $1 "+
      "AND ($2 IS NULL OR NOT EXISTS(SELECT 1 FROM public.community_blocks b WHERE (b.blocker_user_id=$2 AND b.blocked_user_id=u.id) OR (b.blocker_user_id=u.id AND b.blocked_user_id=$2))) "+
      "ORDER BY follower_count DESC,u.pseudonym LIMIT 20",["%"+term+"%",req.user?req.user.id:null]);
    return res.json({success:true,profiles:result.rows});
  }catch(error){return res.status(500).json({error:"Recherche indisponible."});}
});

router.get("/notifications", requireAuth, async(req,res)=>{
  try{
    const result=await query(
      "SELECT n.id,n.event_type,n.created_at,n.read_at,n.post_id,u.id AS actor_id,u.pseudonym AS actor_name "+
      "FROM public.community_notifications n LEFT JOIN public.users u ON u.id=n.actor_user_id "+
      "WHERE n.recipient_user_id=$1 ORDER BY n.created_at DESC LIMIT 40",[req.user.id]);
    return res.json({success:true,notifications:result.rows,unread_count:result.rows.filter(x=>!x.read_at).length});
  }catch(error){return res.status(500).json({error:"Notifications indisponibles."});}
});

router.post("/notifications/read", requireAuth, sameOrigin, writeLimiter, async(req,res)=>{
  try{await query("UPDATE public.community_notifications SET read_at=NOW() WHERE recipient_user_id=$1 AND read_at IS NULL",[req.user.id]);return res.json({success:true});}
  catch(error){return res.status(500).json({error:"Impossible de marquer les notifications."});}
});

router.post("/profiles/:userId/block", requireAuth, sameOrigin, writeLimiter, async(req,res)=>{
  const target=req.params.userId;
  if(!validId(target)||target===req.user.id)return res.status(400).json({error:"Membre invalide."});
  try{
    const existing=await query("SELECT 1 FROM public.community_blocks WHERE blocker_user_id=$1 AND blocked_user_id=$2",[req.user.id,target]);
    if(existing.rows.length){
      await query("DELETE FROM public.community_blocks WHERE blocker_user_id=$1 AND blocked_user_id=$2",[req.user.id,target]);
      return res.json({success:true,blocked:false});
    }
    await query("INSERT INTO public.community_blocks(blocker_user_id,blocked_user_id) VALUES($1,$2) ON CONFLICT DO NOTHING",[req.user.id,target]);
    await query("DELETE FROM public.community_follows WHERE (follower_user_id=$1 AND followed_user_id=$2) OR (follower_user_id=$2 AND followed_user_id=$1)",[req.user.id,target]);
    return res.json({success:true,blocked:true});
  }catch(error){return res.status(500).json({error:"Impossible de modifier le blocage."});}
});


module.exports = router;
